import React, { useState } from 'react';
import { getDifficultyConfig, getMissionById } from '../../data/missions';
import { RoomVersionCompatibility } from '../../lib/roomVersionUtils';
import { APP_VERSION_CONFIG, getCurrentBuildId, isDevBuild } from '../../lib/versionGuard';
import { RoomConfig, RoomMember } from '../../types/room';
import { PixelGameButton } from '../ui/PixelGameButton';
import { WoodModalFrame } from '../ui/WoodModalFrame';

interface RoomWaitingModalProps {
  roomConfig: RoomConfig;
  members: RoomMember[];
  isHost: boolean;
  versionCompatibility: RoomVersionCompatibility;
  onToggleAllowDropIn?: () => void;
  onForceUpdate: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const RoomWaitingModal: React.FC<RoomWaitingModalProps> = ({
  roomConfig,
  members,
  isHost,
  versionCompatibility,
  onToggleAllowDropIn,
  onForceUpdate,
  onStartMatch,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const mission = getMissionById(roomConfig.missionId);
  const difficulty = getDifficultyConfig(roomConfig.difficulty);
  const inviteCode = roomConfig.inviteCode ?? roomConfig.roomId;
  const allowDropIn = roomConfig.allowDropIn !== false;

  const handleCopyInvite = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete(APP_VERSION_CONFIG.cacheBusterParam);
    url.searchParams.set('room', inviteCode);
    url.searchParams.set('mission', roomConfig.missionId);
    url.searchParams.set('diff', roomConfig.difficulty);
    const buildId = getCurrentBuildId();
    if (!isDevBuild(buildId)) {
      url.searchParams.set('v', buildId);
    }
    void navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <WoodModalFrame
      title={`협동 대기실 (${members.length}/${roomConfig.maxPlayers})`}
      ribbonVariant="blue"
      maxWidthClass="max-w-lg"
      closeOnBackdrop={false}
      onClose={onLeaveRoom}
      headerRight={
        <span className="text-xs font-black text-[#fef3c7] pixel-btn-shadow">
          {mission.title} · {difficulty.label}
        </span>
      }
    >
      {/* 버전 불일치 경고 배너 */}
      {!versionCompatibility.isCompatible && (
        <div className="p-2.5 rounded-lg bg-[#fef2f2] border-2 border-[#dc2626] flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 flex-1 min-w-[180px]">
            <div className="text-xs font-black text-[#991b1b]">
              게임 버전 불일치 감지
            </div>
            <p className="text-[11px] font-bold text-[#7f1d1d] leading-snug">
              {versionCompatibility.isLocalOutdated
                ? '현재 구버전으로 접속되어 있습니다. 최신 버전으로 새로고침 후 참여해 주세요.'
                : '구버전으로 접속한 수호자가 있습니다. 모두 최신 버전으로 새로고침하면 원정을 시작할 수 있습니다.'}
            </p>
          </div>
          <PixelGameButton
            label="최신화"
            variant="red"
            size="sm"
            onClick={onForceUpdate}
          />
        </div>
      )}

      {/* 미션 요약 & 초대 코드 양피지 */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-black text-[#3a200f]">{mission.title}</div>
            <div className="text-[11px] font-bold text-[#6e4625] mt-0.5">
              난이도: {difficulty.label} · 예상 시간: {mission.estimatedMinutes}
            </div>
          </div>
          <PixelGameButton
            label={copied ? '초대 링크 복사됨!' : `코드: ${inviteCode}`}
            iconSrc="/assets/ui/Icons/Icon_08.png"
            variant="red"
            size="sm"
            onClick={handleCopyInvite}
          />
        </div>

        <div className="pt-1.5 border-t border-[#c4a274] flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <span className="font-bold text-[#4a301e]">
            {allowDropIn
              ? '🟢 중도 합류 허용: 원정 시작 후에도 진행도 65% 전까지 다른 수호자가 합류할 수 있습니다.'
              : '🔒 중도 합류 잠금: 원정이 시작되면 외부 수호자의 중간 난입을 차단합니다.'}
          </span>
          {isHost && onToggleAllowDropIn && (
            <button
              type="button"
              onClick={onToggleAllowDropIn}
              className={`px-2 py-1 rounded border font-black text-[10px] cursor-pointer transition ${
                allowDropIn
                  ? 'bg-[#166534] text-[#dcfce7] border-[#14532d]'
                  : 'bg-[#7f1d1d] text-[#fee2e2] border-[#450a0a]'
              }`}
            >
              {allowDropIn ? '중도 합류: 허용됨' : '중도 합류: 잠금'}
            </button>
          )}
        </div>
      </div>

      {/* 참여 수호자 목록 */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-black text-[#3a200f]">
          <span>참여 중인 수호자</span>
          {!isHost && (
            <span className="text-[#b45309] animate-pulse">
              방장이 원정을 시작하기를 기다리는 중...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {members.map((m) => {
            const isOutdated = versionCompatibility.outdatedMemberIds.includes(m.playerId);
            return (
              <div
                key={m.playerId}
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg border-2 ${
                  isOutdated
                    ? 'bg-[#fee2e2] border-[#dc2626]'
                    : 'bg-[#e6cfab] border-[#b89568]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={
                      m.color === 'red'
                        ? '/assets/ui/Human Avatars/Avatars_06.png'
                        : '/assets/ui/Human Avatars/Avatars_01.png'
                    }
                    alt={m.name}
                    className="w-7 h-7 object-contain pixel-art shrink-0"
                  />
                  <span className="text-xs font-black text-[#2b1810] truncate">{m.name}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isOutdated && (
                    <span className="px-1.5 py-0.5 rounded bg-[#dc2626] text-white text-[10px] font-black">
                      구버전
                    </span>
                  )}
                  {m.isHost && (
                    <span className="px-1.5 py-0.5 rounded bg-[#92400e] text-[#fef3c7] text-[10px] font-black">
                      방장
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 액션 */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <PixelGameButton label="나가기" variant="red" size="sm" onClick={onLeaveRoom} />
        {isHost && (
          <PixelGameButton
            label={versionCompatibility.isCompatible ? '원정 시작하기' : '버전 동기화 대기'}
            iconSrc="/assets/ui/Icons/Icon_05.png"
            variant="blue"
            size="md"
            disabled={!versionCompatibility.isCompatible}
            onClick={onStartMatch}
          />
        )}
      </div>
    </WoodModalFrame>
  );
};

