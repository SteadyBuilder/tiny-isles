import React, { useState } from 'react';
import { MISSION_CATALOG, MISSION_DIFFICULTIES } from '../../data/missions';
import { RoomDifficultyId } from '../../types/room';
import { PixelGameButton } from '../ui/PixelGameButton';
import { WoodModalFrame } from '../ui/WoodModalFrame';

export type MissionLaunchMode = 'solo' | 'coop';

interface MissionSelectModalProps {
  isOpen: boolean;
  launchMode: MissionLaunchMode;
  clearedMissionIds: string[];
  onClose: () => void;
  onConfirm: (missionId: string, difficulty: RoomDifficultyId) => void;
}

export const MissionSelectModal: React.FC<MissionSelectModalProps> = ({
  isOpen,
  launchMode,
  clearedMissionIds,
  onClose,
  onConfirm,
}) => {
  const [selectedMissionId, setSelectedMissionId] = useState<string>(MISSION_CATALOG[0].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState<RoomDifficultyId>('normal');

  if (!isOpen) return null;

  const isSolo = launchMode === 'solo';

  return (
    <WoodModalFrame
      title={isSolo ? '싱글플레이 원정 선택' : '멀티플레이 방 개설'}
      ribbonVariant={isSolo ? 'blue' : 'red'}
      maxWidthClass="max-w-3xl"
      onClose={onClose}
      headerRight={
        <span className="text-xs font-extrabold text-[#fef3c7] pixel-btn-shadow">
          {isSolo
            ? '오프라인 1인 원정 · ESC 일시정지 지원'
            : '최대 4인 협동 룸 · 초대 코드 자동 발급'}
        </span>
      }
    >
      {/* 미션 카드 (양피지 시트) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {MISSION_CATALOG.map((mission) => {
          const active = mission.id === selectedMissionId;
          const cleared = clearedMissionIds.includes(mission.id);
          return (
            <button
              key={mission.id}
              type="button"
              onClick={() => setSelectedMissionId(mission.id)}
              className={`ts-paper-sheet text-left p-2 flex flex-col justify-between gap-2 transition cursor-pointer ${
                active
                  ? 'ring-4 ring-[#fbbf24] brightness-105 scale-[1.01]'
                  : 'opacity-85 hover:opacity-100'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-1.5">
                  <span className="font-black text-sm text-[#3a200f] leading-snug">
                    {mission.title}
                  </span>
                  {cleared && (
                    <span className="px-1.5 py-0.5 rounded bg-[#4f803b] text-[#fef5df] text-[9px] font-black shrink-0">
                      완료
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-bold text-[#7c4a22] mt-0.5">{mission.subtitle}</p>
                <p className="text-[11px] text-[#4a301e] mt-1.5 leading-relaxed">
                  {mission.description}
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] font-extrabold pt-1.5 border-t border-[#c7a97e]">
                <span className="text-[#5c3c24]">⏱ {mission.estimatedMinutes}</span>
                <span className="text-[#b45309] flex items-center gap-1">
                  <img src="/assets/ui/Icons/Icon_07.png" alt="" className="w-3.5 h-3.5 pixel-art" />
                  {mission.baseRewardPoints}P
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 난이도 선택 */}
      <div className="ts-paper-sheet p-2">
        <div className="text-xs font-black text-[#3a200f] mb-1.5 flex items-center gap-1.5">
          <img src="/assets/ui/Icons/Icon_06.png" alt="" className="w-4 h-4 pixel-art" />
          <span>난이도 선택</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['normal', 'hard', 'nightmare'] as RoomDifficultyId[]).map((diffId) => {
            const cfg = MISSION_DIFFICULTIES[diffId];
            const active = selectedDifficulty === diffId;
            return (
              <button
                key={diffId}
                type="button"
                onClick={() => setSelectedDifficulty(diffId)}
                className={`p-2 rounded-lg border-2 text-left transition ${
                  active
                    ? 'bg-[#fde68a] border-[#92400e] shadow-inner'
                    : 'bg-[#ead5b4] border-[#c4a479] hover:bg-[#f3e2c7]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-black text-[#3a200f]">
                  <span>{cfg.label}</span>
                  <span className="text-[#b45309]">보상 x{cfg.rewardMultiplier.toFixed(1)}</span>
                </div>
                <p className="text-[10px] font-semibold text-[#5c3c24] mt-0.5 leading-snug">
                  {cfg.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 하단 출정 버튼 */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <PixelGameButton
          label="취소"
          variant="red"
          size="sm"
          onClick={onClose}
        />
        <PixelGameButton
          label={isSolo ? '원정 출정하기' : '대기실 개설하기'}
          iconSrc="/assets/ui/Icons/Icon_05.png"
          variant="blue"
          size="md"
          onClick={() => onConfirm(selectedMissionId, selectedDifficulty)}
        />
      </div>
    </WoodModalFrame>
  );
};
