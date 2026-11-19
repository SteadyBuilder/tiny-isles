import React, { useState } from 'react';
import { PublicRoomListing } from '../../data/dropInConfig';
import { MISSION_DIFFICULTIES } from '../../data/missions';
import { getDropInLockReasonLabel } from '../../game/utils/dropInPolicyUtils';
import { PixelGameButton } from '../ui/PixelGameButton';
import { WoodModalFrame } from '../ui/WoodModalFrame';

interface JoinRoomModalProps {
  isOpen: boolean;
  publicRooms: PublicRoomListing[];
  joinErrorMessage: string | null;
  onClearError: () => void;
  onClose: () => void;
  onJoinByCode: (inviteCode: string) => boolean;
  onJoinListing: (listing: PublicRoomListing) => boolean;
}

function formatElapsedTime(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}분 ${secs < 10 ? `0${secs}` : secs}초`;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  publicRooms,
  joinErrorMessage,
  onClearError,
  onClose,
  onJoinByCode,
  onJoinListing,
}) => {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    const joined = onJoinByCode(cleaned);
    if (joined) {
      onClose();
    }
  };

  const handleClickRoom = (room: PublicRoomListing) => {
    const joined = onJoinListing(room);
    if (joined) {
      onClose();
    }
  };

  return (
    <WoodModalFrame
      title="협동 방 탐색 & 초대 코드 참가"
      ribbonVariant="blue"
      maxWidthClass="max-w-lg"
      onClose={onClose}
    >
      <div className="space-y-3">
        {joinErrorMessage && (
          <div className="p-2.5 rounded-lg bg-[#fef2f2] border-2 border-[#dc2626] flex items-center justify-between gap-2">
            <span className="text-xs font-black text-[#991b1b]">{joinErrorMessage}</span>
            <button
              type="button"
              onClick={onClearError}
              className="text-[11px] font-black text-[#7f1d1d] underline shrink-0"
            >
              닫기
            </button>
          </div>
        )}

        {/* 1. 실시간 오픈 인스턴스 룸 목록 */}
        <div className="ts-paper-sheet p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#3a200f]">
              📡 실시간 공개 협동 방 ({publicRooms.length})
            </span>
            <span className="text-[10px] font-bold text-[#6e4625]">
              진행도 65% 미만 방만 중도 합류 가능
            </span>
          </div>

          {publicRooms.length === 0 ? (
            <div className="py-5 px-3 rounded-lg bg-[#e6cfab]/60 border border-dashed border-[#b89568] text-center space-y-1">
              <div className="text-xs font-black text-[#4a301e]">
                현재 열려 있는 공개 협동 방이 없습니다.
              </div>
              <p className="text-[11px] font-bold text-[#6e4625]">
                직접 호스트가 되어 방을 개설하거나, 친구의 6자리 초대 코드를 아래에 입력해 합류하세요!
              </p>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
              {publicRooms.map((room) => {
                const isJoinable = room.lockReason === 'open';
                const diffLabel =
                  MISSION_DIFFICULTIES[room.difficulty]?.label ?? room.difficulty;
                const progressPct = Math.min(
                  100,
                  Math.round((room.currentCount / Math.max(1, room.targetCount)) * 100)
                );

                return (
                  <div
                    key={room.roomId}
                    className={`p-2.5 rounded-lg border-2 flex flex-wrap items-center justify-between gap-2 ${
                      isJoinable
                        ? 'bg-[#fff7e6] border-[#8c5a32]'
                        : 'bg-[#e6cfab]/70 border-[#a88963] opacity-80'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            room.status === 'waiting'
                              ? 'bg-[#166534] text-[#dcfce7]'
                              : isJoinable
                              ? 'bg-[#1d4ed8] text-[#dbeafe]'
                              : 'bg-[#7f1d1d] text-[#fee2e2]'
                          }`}
                        >
                          {room.status === 'waiting'
                            ? '대기실 모집 중'
                            : isJoinable
                            ? '전투 진행 중 (난입 가능)'
                            : getDropInLockReasonLabel(room.lockReason)}
                        </span>
                        <span className="text-xs font-black text-[#2b1810] truncate">
                          {room.missionTitle}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#78350f] text-[#fef3c7] text-[10px] font-black">
                          {diffLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] font-bold text-[#5c3a1e] flex-wrap">
                        <span>👑 방장: {room.hostName}</span>
                        <span>·</span>
                        <span>
                          👥 {room.currentPlayers}/{room.maxPlayers}명
                        </span>
                        <span>·</span>
                        <span>코드: {room.inviteCode}</span>
                        {room.status === 'playing' && (
                          <>
                            <span>·</span>
                            <span>
                              🎯 진행도 {room.currentCount}/{room.targetCount} ({progressPct}%)
                            </span>
                            <span>·</span>
                            <span>⏱️ {formatElapsedTime(room.elapsedSec)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <PixelGameButton
                      label={
                        !isJoinable
                          ? '입장 불가'
                          : room.status === 'playing'
                          ? '중도 합류'
                          : '대기실 입장'
                      }
                      variant={isJoinable ? 'blue' : 'red'}
                      size="sm"
                      disabled={!isJoinable}
                      onClick={() => handleClickRoom(room)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 2. 초대 코드 직접 입력 */}
        <form onSubmit={handleSubmit} className="ts-paper-sheet p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#3a200f]">🔑 6자리 초대 코드 직접 입력</span>
            <span className="text-[10px] font-bold text-[#6e4625]">
              진행 중인 방도 종반부 전이면 즉시 난입
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (joinErrorMessage) onClearError();
              }}
              maxLength={8}
              placeholder="예: A7K9P2"
              className="flex-1 px-3 py-2 rounded-lg bg-[#fff7e6] border-2 border-[#8c5a32] text-center font-pixel-display text-base font-bold tracking-[0.2em] uppercase text-[#2b1810] outline-none focus:border-[#2563eb]"
            />
            <PixelGameButton
              type="submit"
              label="코드로 합류"
              iconSrc="/assets/ui/Icons/Icon_05.png"
              variant="blue"
              size="sm"
              disabled={!code.trim()}
            />
          </div>
        </form>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span className="text-[10px] font-bold text-[#fef3c7]/90 pixel-btn-shadow">
            💡 중도 합류 시 경과 시간 비례 초기 보급품이 지급되며, 잠수(무기여) 시 별의 파편이 지급되지 않습니다.
          </span>
          <PixelGameButton label="닫기" variant="red" size="sm" onClick={onClose} />
        </div>
      </div>
    </WoodModalFrame>
  );
};
