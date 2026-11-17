import React from 'react';
import { PLAYER_CLASS_DEFINITIONS } from '../data/classes';
import { GameEvents } from '../game/events/gameEvents';
import { PlayerProgressionState } from '../types/game';

interface PlayerProgressionHudProps {
  progression: PlayerProgressionState;
  hasJobHallBuilt: boolean;
  isNearJobHall: boolean;
  onOpenInventory: () => void;
  onOpenJobHall: () => void;
}

export const PlayerProgressionHud: React.FC<PlayerProgressionHudProps> = ({
  progression,
  hasJobHallBuilt,
  isNearJobHall,
  onOpenInventory,
  onOpenJobHall,
}) => {
  const classDef = PLAYER_CLASS_DEFINITIONS[progression.classId];
  const expRatio = Math.min(
    100,
    Math.round((progression.exp / Math.max(1, progression.nextLevelExp)) * 100)
  );
  const cooldownRemainingSec = Math.max(
    0,
    Math.ceil(progression.skillCooldownRemainingMs / 1000)
  );

  const equippedCount = Object.values(progression.equipped).filter(Boolean).length;
  const canEnterJobHall = hasJobHallBuilt && isNearJobHall;

  const handleJobHallClick = () => {
    if (!hasJobHallBuilt) {
      GameEvents.emit(
        'game-alert',
        '🏗️ 먼저 중앙 마을 [B]에서 [왕국 전직소]를 건설한 뒤 전직소 앞으로 이동하세요!'
      );
      return;
    }
    if (!isNearJobHall) {
      GameEvents.emit(
        'game-alert',
        '🚶 [왕국 전직소] 건물 앞으로 직접 이동해야 전직할 수 있습니다! (접근 후 [E] 또는 클릭)'
      );
      return;
    }
    onOpenJobHall();
  };

  return (
    <div className="fixed bottom-[6.5rem] left-2 md:bottom-3 md:left-3 z-30 flex flex-col gap-1 pointer-events-auto max-w-[180px] sm:max-w-[330px] md:max-w-[380px]">
      <div className="ts-hud-pill px-2 py-1 md:px-2.5 md:py-2 flex flex-col gap-1 md:gap-1.5 shadow-lg">
        {/* Top Row: Level + Class Badge + Combat Stats (desktop) / EXP% (mobile) */}
        <div className="flex items-center justify-between gap-1.5 md:gap-2">
          <div className="flex items-center gap-1 md:gap-1.5 min-w-0">
            <span className="px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-[11px] font-black bg-[#1e3a8a] text-[#fef3c7] border border-[#fde68a]/60 shrink-0">
              Lv.{progression.level}
            </span>
            <span className="text-[11px] md:text-xs leading-none shrink-0">{classDef.icon}</span>
            <span className="text-[10px] md:text-xs font-black text-[#fef3c7] truncate">{classDef.name}</span>
          </div>

          <span className="md:hidden text-[9px] font-black text-[#93c5fd] tabular-nums shrink-0">
            {expRatio}%
          </span>

          <div className="hidden md:flex items-center gap-2 text-[11px] font-black text-[#fde68a] shrink-0">
            <span title="총 공격력">⚔️ {progression.totalAttack}</span>
            <span title="최대 체력">❤️ {progression.totalMaxHp}</span>
          </div>
        </div>

        {/* EXP Bar */}
        <div className="w-full h-1.5 md:h-2.5 bg-[#1e120a] rounded-full overflow-hidden border border-[#785e42] relative">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${expRatio}%`,
              backgroundImage: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
            }}
          />
          <span className="hidden md:flex absolute inset-0 items-center justify-center text-[8px] font-black text-white drop-shadow">
            EXP {progression.exp} / {progression.nextLevelExp} ({expRatio}%)
          </span>
        </div>

        {/* Action Buttons Row: Skill [Q] (desktop/tablet), Inventory [I], Job Advancement */}
        <div className="flex items-center gap-1 md:gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={() => GameEvents.emit('cast-active-skill')}
            disabled={cooldownRemainingSec > 0}
            className={`hidden md:flex flex-1 px-2 py-1 rounded-md border text-[11px] font-black items-center justify-center gap-1 transition-transform active:scale-95 ${
              cooldownRemainingSec > 0
                ? 'bg-[#291d14] border-[#5c422a] text-[#9ca3af] cursor-not-allowed'
                : 'bg-[#1e3a8a] border-[#60a5fa] text-[#eff6ff] hover:brightness-110'
            }`}
            title={classDef.skillDescription}
          >
            <span className="px-1 rounded bg-black/40 text-[9px] text-[#93c5fd]">Q</span>
            <span>{classDef.skillIcon}</span>
            <span className="truncate">{classDef.skillName}</span>
            {cooldownRemainingSec > 0 && (
              <span className="text-[#fca5a5] font-extrabold">{cooldownRemainingSec}s</span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenInventory}
            className="flex-1 md:flex-none px-1.5 py-0.5 md:px-2 md:py-1 rounded-md border border-[#d97706] bg-[#78350f] text-[#fef3c7] text-[10px] md:text-[11px] font-black flex items-center justify-center gap-1 hover:brightness-110 active:scale-95 whitespace-nowrap"
            title="장비 및 인벤토리 열기 (단축키 I)"
          >
            <span className="hidden md:inline px-1 rounded bg-black/40 text-[9px] text-[#fde68a]">I</span>
            <span>가방</span>
            <span className="md:hidden text-[9px] text-[#fde68a]">({progression.bagItems.length})</span>
            <span className="hidden md:inline text-[10px] text-[#fde68a]">
              ({progression.bagItems.length}·장착{equippedCount})
            </span>
          </button>

          <button
            type="button"
            onClick={handleJobHallClick}
            className={`px-1.5 py-0.5 md:px-2 md:py-1 rounded-md border text-[10px] md:text-[11px] font-black flex items-center justify-center gap-1 transition-transform active:scale-95 whitespace-nowrap shrink-0 ${
              canEnterJobHall && progression.jobPoints > 0 && progression.classId === 'pawn'
                ? 'bg-[#581c87] border-[#c084fc] text-[#f3e8ff] animate-pulse hover:brightness-110'
                : canEnterJobHall
                  ? 'bg-[#3b2313] border-[#fde047] text-[#fef3c7] hover:brightness-110'
                  : 'bg-[#291d14] border-[#5c422a] text-[#a8a29e]'
            }`}
            title={
              canEnterJobHall
                ? '왕국 전직소 입장 [E]'
                : hasJobHallBuilt
                  ? '왕국 전직소 앞으로 이동하면 전직할 수 있습니다'
                  : '마을에 왕국 전직소 건설 후 방문 시 전직 가능'
            }
          >
            <span>{canEnterJobHall ? '🏛️ 전직 [E]' : '🏛️ 전직'}</span>
            {progression.jobPoints > 0 && (
              <span className="px-1 rounded-full bg-[#a855f7] text-white text-[9px]">
                +{progression.jobPoints}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
