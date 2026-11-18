import React from 'react';
import { PLAYER_CLASS_DEFINITIONS } from '../data/classes';
import { HUD_ACTION_SPRITES } from '../data/hudIcons';
import { GameEvents } from '../game/events/gameEvents';
import { DashCooldownState, PlayerProgressionState } from '../types/game';
import { DesktopActionDock } from './hud/DesktopActionDock';
import { PotionQuickSlot } from './hud/PotionQuickSlot';

interface PlayerProgressionHudProps {
  progression: PlayerProgressionState;
  dashState?: DashCooldownState;
  hasJobHallBuilt: boolean;
  isNearJobHall: boolean;
  hasToolShopBuilt: boolean;
  isNearToolShop: boolean;
  onOpenInventory: () => void;
  onOpenJobHall: () => void;
  onOpenToolShop: () => void;
}

export const PlayerProgressionHud: React.FC<PlayerProgressionHudProps> = ({
  progression,
  dashState,
  hasJobHallBuilt,
  isNearJobHall,
  hasToolShopBuilt,
  isNearToolShop,
  onOpenInventory,
  onOpenJobHall,
  onOpenToolShop,
}) => {
  const classDef = PLAYER_CLASS_DEFINITIONS[progression.classId];
  const expRatio = Math.min(
    100,
    Math.round((progression.exp / Math.max(1, progression.nextLevelExp)) * 100)
  );

  const equippedCount = Object.values(progression.equipped).filter(Boolean).length;
  const canEnterJobHall = hasJobHallBuilt && isNearJobHall;
  const canEnterToolShop = hasToolShopBuilt && isNearToolShop;

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

  const handleToolShopClick = () => {
    if (!hasToolShopBuilt) {
      GameEvents.emit(
        'game-alert',
        '🏗️ 먼저 영지 [B]에서 [도구 상점]을 건설한 뒤 상점 앞으로 이동하세요!'
      );
      return;
    }
    if (!isNearToolShop) {
      GameEvents.emit(
        'game-alert',
        '🚶 [도구 상점] 건물 앞으로 직접 이동해야 구매할 수 있습니다! (접근 후 [E] 또는 클릭)'
      );
      return;
    }
    onOpenToolShop();
  };

  return (
    <>
      {/* PC Bottom-Center Combat Dock (Potions [1][2][3], Skill [Q], Dash [Shift]) */}
      <DesktopActionDock progression={progression} dashState={dashState} />

      {/* Bottom-Left Status & Menu Panel */}
      <div className="fixed bottom-[6.5rem] left-2 md:bottom-3 md:left-3 z-30 flex flex-col gap-1 pointer-events-auto max-w-[184px] sm:max-w-[260px] md:max-w-[290px]">
        <div className="ts-hud-pill px-2 py-1.5 md:px-2.5 md:py-2 flex flex-col gap-1.5 shadow-lg">
          {/* Top Row: Level + Class Badge + Combat Stats (desktop) / EXP% (mobile) */}
          <div className="flex items-center justify-between gap-1.5 md:gap-2">
            <div className="flex items-center gap-1 md:gap-1.5 min-w-0">
              <span className="px-1 md:px-1.5 py-0.5 rounded text-[10px] md:text-[11px] font-black bg-[#1e3a8a] text-[#fef3c7] border border-[#fde68a]/60 shrink-0">
                Lv.{progression.level}
              </span>
              <span className="text-[11px] md:text-xs leading-none shrink-0">{classDef.icon}</span>
              <span className="text-[10px] md:text-xs font-black text-[#fef3c7] truncate">
                {classDef.name}
              </span>
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

          {/* Mobile Potion Quick Slot Row (Desktop potions live in DesktopActionDock) */}
          <div className="flex md:hidden items-center justify-between gap-1 pt-0.5">
            <PotionQuickSlot
              potions={progression.potions}
              cooldownRemainingMs={progression.potionCooldownRemainingMs ?? 0}
              compact
            />
          </div>

          {/* Compact Sprite Menu Row: Bag [I], Tool Shop [E], Job Hall [E] */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={onOpenInventory}
              className="relative flex-1 h-8 md:h-9 px-2 rounded-lg border border-[#d97706] bg-[#78350f] text-[#fef3c7] text-[10px] md:text-[11px] font-black flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-95 transition"
              title={`가방 및 장비 (보관 ${progression.bagItems.length} · 장착 ${equippedCount}) [I]`}
              aria-label="가방 열기"
            >
              <span className="hidden md:inline px-1 rounded bg-black/45 text-[9px] text-[#fde68a] leading-tight">
                I
              </span>
              <img
                src={HUD_ACTION_SPRITES.bag}
                alt="가방"
                className="w-4 h-4 md:w-5 md:h-5 object-contain pixel-art shrink-0"
              />
              <span className="text-[10px] font-black text-[#fde68a] tabular-nums">
                {progression.bagItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToolShopClick}
              className={`relative flex-1 h-8 md:h-9 px-2 rounded-lg border text-[10px] md:text-[11px] font-black flex items-center justify-center gap-1 transition active:scale-95 ${
                canEnterToolShop
                  ? 'bg-[#064e3b] border-[#34d399] text-[#d1fae5] hover:brightness-110'
                  : 'bg-[#291d14] border-[#5c422a] text-[#a8a29e]'
              }`}
              title={
                canEnterToolShop
                  ? '도구 상점 입장 [E]'
                  : hasToolShopBuilt
                    ? '도구 상점 앞으로 이동하면 물약을 구매할 수 있습니다'
                    : '마을에 도구 상점 건설 후 방문 시 물약 구매 가능'
              }
              aria-label="도구 상점"
            >
              <img
                src={HUD_ACTION_SPRITES.shop}
                alt="상점"
                className={`w-4 h-4 md:w-5 md:h-5 object-contain pixel-art shrink-0 ${
                  canEnterToolShop ? '' : 'opacity-70'
                }`}
              />
              {canEnterToolShop && (
                <span className="px-1 rounded bg-black/45 text-[9px] text-[#6ee7b7] leading-tight">
                  E
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleJobHallClick}
              className={`relative flex-1 h-8 md:h-9 px-2 rounded-lg border text-[10px] md:text-[11px] font-black flex items-center justify-center gap-1 transition active:scale-95 ${
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
              aria-label="왕국 전직소"
            >
              <img
                src={HUD_ACTION_SPRITES.jobHall}
                alt="전직"
                className={`w-4 h-4 md:w-5 md:h-5 object-contain pixel-art shrink-0 ${
                  canEnterJobHall ? '' : 'opacity-70'
                }`}
              />
              {canEnterJobHall && (
                <span className="px-1 rounded bg-black/45 text-[9px] text-[#fde047] leading-tight">
                  E
                </span>
              )}
              {progression.jobPoints > 0 && (
                <span className="px-1 rounded-full bg-[#a855f7] text-white text-[9px] leading-tight">
                  +{progression.jobPoints}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
