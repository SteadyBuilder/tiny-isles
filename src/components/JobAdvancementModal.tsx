import React from 'react';
import { ADVANCEMENT_CLASS_LIST, PLAYER_CLASS_DEFINITIONS } from '../data/classes';
import { GameEvents } from '../game/events/gameEvents';
import { PlayerProgressionState } from '../types/game';
import { PixelGameButton } from './ui/PixelGameButton';
import { WoodModalFrame } from './ui/WoodModalFrame';

interface JobAdvancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  progression: PlayerProgressionState;
  hasJobHallBuilt: boolean;
}

export const JobAdvancementModal: React.FC<JobAdvancementModalProps> = ({
  isOpen,
  onClose,
  progression,
  hasJobHallBuilt,
}) => {
  if (!isOpen) return null;

  const currentClass = PLAYER_CLASS_DEFINITIONS[progression.classId];

  return (
    <WoodModalFrame
      id="job-advancement-modal"
      title="왕국 전직소 — 4대 전투 클래스"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-lg"
      onClose={onClose}
      headerRight={
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#29150b]/85 border border-[#b89568] text-xs font-black text-[#fde68a]">
          <span>Lv.{progression.level}</span>
          <span>·</span>
          <span>전직 포인트: {progression.jobPoints}pt</span>
        </div>
      }
    >
      {/* Status Banner */}
      <div className="ts-paper-sheet p-2.5 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black text-[#2b1810]">
            현재 클래스:{' '}
            <strong className="text-[#1d4ed8]">
              {currentClass.icon} {currentClass.name} ({currentClass.title})
            </strong>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-black border ${
              hasJobHallBuilt
                ? 'bg-[#dcfce7] border-[#15803d] text-[#14532d]'
                : 'bg-[#fef3c7] border-[#b45309] text-[#78350f]'
            }`}
          >
            {hasJobHallBuilt ? '🏛️ 전직소 건설 완료' : '🏗️ 마을에 왕국 전직소 건설 필요'}
          </span>
        </div>
        <p className="text-[11px] font-bold text-[#6e4625]">
          사냥으로 <strong>Lv.3</strong> 이상 달성 및 중앙 마을에 <strong>왕국 전직소</strong> 건설 시 4대 전투 클래스로 전직하거나 클래스를 변경할 수 있습니다.
        </p>
      </div>

      {/* 4 Classes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-0.5">
        {ADVANCEMENT_CLASS_LIST.map((cls) => {
          const isCurrent = progression.classId === cls.id;
          const levelMet = progression.level >= cls.requiredLevel;

          return (
            <div
              key={cls.id}
              className={`ts-paper-sheet p-2.5 flex flex-col justify-between gap-2 border-2 ${
                isCurrent ? 'ring-2 ring-[#2563eb] border-[#2563eb]' : 'border-[#a89070]'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl leading-none">{cls.icon}</span>
                    <div>
                      <div className="text-xs font-black text-[#2b1810]">{cls.name}</div>
                      <div className="text-[10px] font-bold text-[#1e3a8a]">{cls.title}</div>
                    </div>
                  </div>
                  {isCurrent && (
                    <span className="px-1.5 py-0.5 rounded bg-[#1d4ed8] text-white text-[9px] font-black">
                      현재 전직
                    </span>
                  )}
                </div>

                <p className="text-[10px] font-bold text-[#4a301e] leading-snug">
                  {cls.passiveDescription}
                </p>

                {/* Bonus Stats */}
                <div className="flex flex-wrap gap-1 text-[9px] font-black">
                  <span className="px-1.5 py-0.5 rounded bg-[#e6cfab] text-[#7f1d1d]">
                    ⚔️ 공격력 +{cls.baseAttackBonus}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#e6cfab] text-[#14532d]">
                    ❤️ 체력 +{cls.baseHpBonus}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-[#e6cfab] text-[#1e3a8a]">
                    👟 이속 +{cls.baseSpeedBonus}
                  </span>
                </div>

                {/* Active Skill Box */}
                <div className="p-1.5 rounded bg-[#dcc29c] border border-[#b89568] space-y-0.5">
                  <div className="text-[10px] font-black text-[#1e3a8a]">
                    [Q] {cls.skillIcon} {cls.skillName} (쿨타임 {(cls.skillCooldownMs / 1000).toFixed(1)}초)
                  </div>
                  <div className="text-[9px] font-bold text-[#4a301e] leading-tight">
                    {cls.skillDescription}
                  </div>
                </div>
              </div>

              <PixelGameButton
                label={
                  isCurrent
                    ? '전직 완료됨'
                    : !levelMet
                      ? `Lv.${cls.requiredLevel} 필요`
                      : `전직하기 (${cls.costGold}🪙)`
                }
                variant={isCurrent ? 'red' : 'blue'}
                size="sm"
                fullWidth
                disabled={isCurrent || !levelMet}
                onClick={() => {
                  GameEvents.emit('select-player-class', cls.id);
                  onClose();
                }}
              />
            </div>
          );
        })}
      </div>
    </WoodModalFrame>
  );
};
