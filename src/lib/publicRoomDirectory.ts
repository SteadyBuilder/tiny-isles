import type { RealtimeChannel } from '@supabase/supabase-js';
import { DROP_IN_POLICY_CONFIG, PublicRoomListing } from '../data/dropInConfig';
import { evaluateDropInLockReason } from '../game/utils/dropInPolicyUtils';
import { RoomDifficultyId } from '../types/room';
import { supabase } from './supabase';

export type PublicRoomDirectoryListener = (rooms: PublicRoomListing[]) => void;

interface PresenceListingMap {
  [key: string]: Array<Partial<PublicRoomListing>>;
}

/**
 * Supabase Realtime 공용 디렉토리 채널(`tiny_isles_public_rooms_v1`) 기반
 * 실시간 멀티플레이 방 목록 브로드캐스터 & 브라우저 서비스
 */
class PublicRoomDirectoryService {
  private channel: RealtimeChannel | null = null;
  private isSubscribed = false;
  private listeners = new Set<PublicRoomDirectoryListener>();
  private currentRooms: PublicRoomListing[] = [];
  private activeHostListing: PublicRoomListing | null = null;
  private hostKey = '';
  private ensureChannelPromise: Promise<void> | null = null;

  public subscribeListings(listener: PublicRoomDirectoryListener): () => void {
    this.listeners.add(listener);
    listener(this.currentRooms);
    void this.ensureChannelOpen();
    return () => {
      this.listeners.delete(listener);
      this.maybeTeardownIfIdle();
    };
  }

  public getCachedListings(): PublicRoomListing[] {
    return this.currentRooms;
  }

  public findRoomByCode(inviteCode: string): PublicRoomListing | undefined {
    const clean = inviteCode.trim().toUpperCase();
    return this.currentRooms.find(
      (r) => r.inviteCode.toUpperCase() === clean || r.roomId.toUpperCase() === clean
    );
  }

  public async publishHostRoom(
    listing: Omit<PublicRoomListing, 'lockReason' | 'updatedAt'> & { ended?: boolean }
  ): Promise<void> {
    const lockReason = evaluateDropInLockReason({
      currentPlayers: listing.currentPlayers,
      maxPlayers: listing.maxPlayers,
      currentCount: listing.currentCount,
      targetCount: listing.targetCount,
      elapsedSec: listing.elapsedSec,
      timeLimitSec: listing.timeLimitSec,
      allowDropIn: listing.allowDropIn,
      ended: listing.ended,
    });

    if (listing.ended) {
      await this.unpublishHostRoom();
      return;
    }

    const fullListing: PublicRoomListing = {
      roomId: listing.roomId,
      inviteCode: listing.inviteCode,
      hostPlayerId: listing.hostPlayerId,
      hostName: listing.hostName,
      missionId: listing.missionId,
      missionTitle: listing.missionTitle,
      difficulty: listing.difficulty,
      status: listing.status,
      currentPlayers: listing.currentPlayers,
      maxPlayers: listing.maxPlayers,
      currentCount: listing.currentCount,
      targetCount: listing.targetCount,
      elapsedSec: listing.elapsedSec,
      timeLimitSec: listing.timeLimitSec,
      allowDropIn: listing.allowDropIn,
      lockReason,
      hostAppVersion: listing.hostAppVersion,
      updatedAt: Date.now(),
    };

    this.activeHostListing = fullListing;
    await this.ensureChannelOpen(listing.roomId);
    if (this.channel && this.isSubscribed) {
      try {
        await this.channel.track(fullListing);
      } catch {
        // 네트워크 일시 지연 무시
      }
    }
  }

  public async unpublishHostRoom(): Promise<void> {
    this.activeHostListing = null;
    if (this.channel && this.isSubscribed) {
      try {
        await this.channel.untrack();
      } catch {
        // untrack 오류 무시
      }
    }
    this.maybeTeardownIfIdle();
  }

  private async ensureChannelOpen(preferredKey?: string): Promise<void> {
    if (this.channel && this.isSubscribed) return;
    if (this.ensureChannelPromise) return this.ensureChannelPromise;

    this.ensureChannelPromise = new Promise<void>((resolve) => {
      const key =
        preferredKey ||
        this.activeHostListing?.roomId ||
        `viewer_${Math.random().toString(36).slice(2, 9)}`;
      this.hostKey = key;

      const channelName = DROP_IN_POLICY_CONFIG.publicDirectoryChannelName;
      const ch = supabase.channel(channelName, {
        config: {
          presence: { key },
        },
      });
      this.channel = ch;

      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          this.ensureChannelPromise = null;
          resolve();
        }
      };

      const timeout = setTimeout(finish, 3000);

      ch.on('presence', { event: 'sync' }, () => {
        this.rebuildRoomListFromPresence();
      }).subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          this.isSubscribed = true;
          if (this.activeHostListing) {
            try {
              await ch.track(this.activeHostListing);
            } catch {
              // 무시
            }
          }
          this.rebuildRoomListFromPresence();
          finish();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          clearTimeout(timeout);
          this.isSubscribed = false;
          finish();
        }
      });
    });

    return this.ensureChannelPromise;
  }

  private rebuildRoomListFromPresence(): void {
    if (!this.channel) return;
    const raw = this.channel.presenceState() as PresenceListingMap;
    const now = Date.now();
    const byRoomId = new Map<string, PublicRoomListing>();

    for (const entries of Object.values(raw)) {
      if (!Array.isArray(entries)) continue;
      for (const item of entries) {
        if (!item || !item.roomId || !item.missionId) continue;
        // 45초 이상 갱신이 없는 유령 엔트리 제외
        if (typeof item.updatedAt === 'number' && now - item.updatedAt > 45_000) continue;

        const existing = byRoomId.get(item.roomId);
        if (existing && existing.updatedAt > (item.updatedAt ?? 0)) continue;

        const currentPlayers = Math.max(1, Number(item.currentPlayers ?? 1));
        const maxPlayers = Math.max(1, Number(item.maxPlayers ?? 4));
        const currentCount = Math.max(0, Number(item.currentCount ?? 0));
        const targetCount = Math.max(1, Number(item.targetCount ?? 1));
        const elapsedSec = Math.max(0, Number(item.elapsedSec ?? 0));
        const timeLimitSec =
          typeof item.timeLimitSec === 'number' ? item.timeLimitSec : null;
        const allowDropIn = item.allowDropIn !== false;

        const lockReason = evaluateDropInLockReason({
          currentPlayers,
          maxPlayers,
          currentCount,
          targetCount,
          elapsedSec,
          timeLimitSec,
          allowDropIn,
        });

        byRoomId.set(item.roomId, {
          roomId: String(item.roomId),
          inviteCode: String(item.inviteCode || item.roomId),
          hostPlayerId: String(item.hostPlayerId || ''),
          hostName: String(item.hostName || '수호자'),
          missionId: String(item.missionId),
          missionTitle: String(item.missionTitle || '협동 원정'),
          difficulty: (item.difficulty as RoomDifficultyId) || 'normal',
          status: item.status === 'playing' ? 'playing' : 'waiting',
          currentPlayers,
          maxPlayers,
          currentCount,
          targetCount,
          elapsedSec,
          timeLimitSec,
          allowDropIn,
          lockReason,
          hostAppVersion: item.hostAppVersion,
          updatedAt: Number(item.updatedAt ?? now),
        });
      }
    }

    const sorted = Array.from(byRoomId.values()).sort((a, b) => {
      // 입장 가능한 방 우선 -> 대기실 우선 -> 최근 생성/업데이트 순
      const aOpen = a.lockReason === 'open' ? 0 : 1;
      const bOpen = b.lockReason === 'open' ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;
      if (a.status !== b.status) return a.status === 'waiting' ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    this.currentRooms = sorted;
    this.listeners.forEach((l) => l(this.currentRooms));
  }

  private maybeTeardownIfIdle(): void {
    if (this.listeners.size > 0 || this.activeHostListing !== null) return;
    if (this.channel) {
      const ch = this.channel;
      this.channel = null;
      this.isSubscribed = false;
      void supabase.removeChannel(ch);
    }
  }
}

export const publicRoomDirectory = new PublicRoomDirectoryService();
