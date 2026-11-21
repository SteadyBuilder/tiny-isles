import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { PLAYER_CLASS_DEFINITIONS } from '../../data/classes';
import { HUD_STATUS_ICONS } from '../../data/hudIcons';
import {
  CenterVillageHp,
  Inventory,
  PlayerHpState,
  PlayerProgressionState,
  WaveState,
} from '../../types/game';
import { MissionProgressState, RoomMode } from '../../types/room';
import { PixelThreatGauge } from '../ui/PixelThreatGauge';
import { HUD_RESOURCE_SLOTS } from './hudUtils';
import { LandscapeQuickMenuPopover } from './LandscapeQuickMenuPopover';
import { LandscapeTopRightMenu } from './LandscapeTopRightMenu';
import { WaveCenterStatusBanner } from './WaveCenterStatusBanner';

export interface HudLandscapeBarProps {
  inventory: Inventory;
  onlineCount: number;
  playerHp?: PlayerHpState;
  progression?: PlayerProgressionState;
  hasJobHallBuilt?: boolean;
  isNearJobHall?: boolean;
  hasToolShopBuilt?: boolean;
  isNearToolShop?: boolean;
  unlockedCount: number;
  totalIslands: number;
  waveState?: WaveState;
  centerVillageHp?: CenterVillageHp;
  alertMessage?: string | null;
  missionProgress?: MissionProgressState | null;
  roomMode?: RoomMode;
  isMuted: boolean;
  copied: boolean;
  showTestMenu?: boolean;
  onToggleSound: () => void;
  onCopyLink: () => void;
  onOpenMinimap?: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onTogglePause?: () => void;
  onOpenInventory?: () => void;
  onOpenToolShop?: () => void;
  onOpenJobHall?: () => void;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
}

/**
 * 모바일 가로모드 전용 컴팩트 HUD.
 * - 좌상단: 캐릭터 레벨/직업/HP/EXP + 위협도 + 자원(2줄 슬림)
 * - 상단 중앙: 웨이브 진행/알림 배너만 필요 시 얇게 노출해 중앙 플레이 시야 극대화
 * - 우상단/우측: LandscapeTopRightMenu + LandscapeQuickMenuPopover 위임
 */
export const HudLandscapeBar: React.FC<HudLandscapeBarProps> = ({
  inventory,
  onlineCount,
  playerHp,
  progression,
  hasJobHallBuilt = false,
  isNearJobHall = false,
  hasToolShopBuilt = false,
  isNearToolShop = false,
  unlockedCount,
  totalIslands,
  waveState,
  centerVillageHp,
  alertMessage,
  missionProgress = null,
  roomMode = 'solo',
  isMuted,
  copied,
  showTestMenu = false,
  onToggleSound,
  onCopyLink,
  onOpenMinimap,
  onOpenSettings,
  onOpenHelp,
  onTogglePause,
  onOpenInventory,
  onOpenToolShop,
  onOpenJobHall,
  onTriggerRegularWave,
  onTriggerBossWave,
}) => {
  const [isSurging, setIsSurging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMissionCollapsed, setIsMissionCollapsed] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const handleArrived = () => {
      setIsSurging(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsSurging(false), 320);
    };
    window.addEventListener('threat-orb-arrived', handleArrived);
    return () => {
      window.removeEventListener('threat-orb-arrived', handleArrived);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const hpValue = playerHp?.hp ?? 100;
  const hpMax = playerHp?.maxHp ?? 100;
  const hpRatio = Math.max(0, Math.min(100, Math.round((hpValue / Math.max(1, hpMax)) * 100)));
  const isFainted = playerHp?.isFainted ?? false;

  const classDef = progression ? PLAYER_CLASS_DEFINITIONS[progression.classId] : null;
  const expRatio = progression
    ? Math.min(100, Math.round((progression.exp / Math.max(1, progression.nextLevelExp)) * 100))
    : 0;

  const threat = waveState?.threatPercent ?? 0;
  const countdown = waveState?.countdownSecondsRemaining ?? null;
  const isCountingDown = countdown !== null;
  const isWarning = isCountingDown || threat >= (waveState?.warningThreshold ?? 80);

  return (
    <div id="hud-landscape-root" className="fixed inset-0 z-30 pointer-events-none select-none">
      {/* 1. TOP-LEFT: Ultra-Compact Character + Threat + Resource Strip */}
      <div
        className="absolute flex flex-col gap-1 pointer-events-none max-w-[46vw]"
        style={{
          top: 'max(0.3rem, env(safe-area-inset-top, 0.3rem))',
          left: 'max(0.45rem, env(safe-area-inset-left, 0.45rem))',
        }}
      >
        {/* Row 1: Lv + Class + HP/EXP + Threat */}
        <div
          className={`ts-hud-pill px-2 py-1 flex items-center gap-1.5 pointer-events-auto shadow-lg ${
            isWarning ? 'ring-1 ring-red-400/75' : ''
          }`}
        >
          {progression && classDef && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="px-1 py-0.5 rounded text-[9px] font-black bg-[#1e3a8a] text-[#fef3c7] border border-[#fde68a]/60 leading-none tabular-nums">
                Lv.{progression.level}
              </span>
              <span className="text-[11px] leading-none" title={classDef.name}>
                {classDef.icon}
              </span>
            </div>
          )}

          {/* Stacked HP & EXP Bars */}
          <div className="flex flex-col gap-0.5 min-w-[66px]">
            <div className="flex items-center gap-1">
              <img src={HUD_STATUS_ICONS.heart} alt="HP" className="w-2.5 h-2.5 pixel-art shrink-0" />
              <div className="relative flex-1 h-2 bg-[#1e120a] rounded-full overflow-hidden border border-[#785e42]">
                <div
                  className={`h-full transition-all duration-200 ${
                    isFainted ? 'bg-slate-400' : 'bg-gradient-to-r from-rose-600 to-rose-400'
                  }`}
                  style={{ width: `${isFainted ? 0 : hpRatio}%` }}
                />
              </div>
              <span
                className={`text-[9px] font-black tabular-nums leading-none pixel-btn-shadow ${
                  isFainted ? 'text-red-300 animate-pulse' : 'text-rose-100'
                }`}
              >
                {isFainted ? '기절' : hpValue}
              </span>
            </div>

            {progression && (
              <div className="w-full h-1 bg-[#1e120a] rounded-full overflow-hidden border border-[#5c422a]/80">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${expRatio}%`,
                    backgroundImage: 'linear-gradient(90deg, #2563eb 0%, #38bdf8 100%)',
                  }}
                />
              </div>
            )}
          </div>

          {waveState && (
            <>
              <div className="h-4 w-px bg-[#85532a]/70 shrink-0" />
              <div id="threat-mobile-badge" className="flex items-center gap-1 shrink-0">
                <img
                  src={HUD_STATUS_ICONS.threat}
                  alt="위협도"
                  className={`w-3 h-3 pixel-art shrink-0 ${
                    isSurging ? 'scale-125 brightness-125' : isWarning ? 'animate-pulse' : ''
                  }`}
                />
                <PixelThreatGauge
                  containerId="threat-mobile-gauge-container"
                  barId="threat-mobile-gauge-bar"
                  threatPercent={threat}
                  isWarning={isWarning}
                  isSurging={isSurging}
                  className="w-11 h-2"
                />
                <span
                  className={`font-mono font-black text-[9px] tabular-nums leading-none pixel-btn-shadow ${
                    isCountingDown
                      ? 'px-1 py-0.5 rounded bg-red-700 text-[#fef5df] animate-pulse'
                      : isWarning
                        ? 'text-red-300 animate-pulse'
                        : 'text-[#fde68a]'
                  }`}
                >
                  {isCountingDown ? `${countdown}s` : `${threat}%`}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Row 2: Slim Resource Bar + Online Count + Wave Monsters */}
        <div className="ts-wood-bar-compact self-start flex items-center gap-1 pointer-events-auto">
          {HUD_RESOURCE_SLOTS.map((slot) => (
            <div
              key={slot.key}
              className="flex items-center gap-0.5 px-1 py-0 rounded bg-[#24160e]/80 border border-[#85532a]/60"
            >
              <img src={slot.iconSrc} alt={slot.alt} className="w-3 h-3 pixel-art shrink-0" />
              <span
                className={`font-black ${slot.textColorClass} text-[10px] leading-tight tabular-nums pixel-btn-shadow`}
              >
                {inventory[slot.key]}
              </span>
            </div>
          ))}

          {waveState && (
            <span className="flex items-center gap-0.5 px-1 rounded bg-[#24160e]/80 border border-[#85532a]/60 text-[9px] font-black text-red-200 tabular-nums">
              <img src={HUD_STATUS_ICONS.boss} alt="보스" className="w-2.5 h-2.5 pixel-art" />
              <span>{waveState.wavesUntilBoss <= 1 ? 'BOSS' : `${waveState.wavesUntilBoss}W`}</span>
            </span>
          )}

          {onlineCount > 1 && (
            <span className="flex items-center gap-0.5 px-1 rounded bg-emerald-950/85 border border-emerald-400/45 text-[9px] font-black text-emerald-300 tabular-nums">
              <Users className="w-2.5 h-2.5" />
              <span>{onlineCount}</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. TOP-CENTER: Thin Contextual Wave/Boss HP & Alert Banner */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none max-w-[44vw]"
        style={{ top: 'max(0.3rem, env(safe-area-inset-top, 0.3rem))' }}
      >
        <WaveCenterStatusBanner
          waveState={waveState}
          centerVillageHp={centerVillageHp}
          variant="mobile"
        />

        {alertMessage && (
          <div
            id="game-alert-banner-mobile"
            className="ts-wood-bar-compact flex items-center justify-center gap-1 text-[#fde68a] text-[10px] font-black pointer-events-auto text-center pixel-btn-shadow"
          >
            <img src={HUD_STATUS_ICONS.alert} alt="" className="w-3 h-3 pixel-art shrink-0" />
            <span className="truncate max-w-[38vw]">{alertMessage}</span>
          </div>
        )}
      </div>

      {/* 3. TOP-RIGHT Sprite Buttons + Collapsible Mission Tracker */}
      <LandscapeTopRightMenu
        progression={progression}
        hasJobHallBuilt={hasJobHallBuilt}
        isNearJobHall={isNearJobHall}
        hasToolShopBuilt={hasToolShopBuilt}
        isNearToolShop={isNearToolShop}
        isMenuOpen={isMenuOpen}
        isMissionCollapsed={isMissionCollapsed}
        missionProgress={missionProgress}
        onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
        onToggleMissionCollapsed={() => setIsMissionCollapsed((prev) => !prev)}
        onOpenInventory={onOpenInventory}
        onOpenToolShop={onOpenToolShop}
        onOpenJobHall={onOpenJobHall}
      />

      {/* 4. Floating '+' Quick Menu Grid Popover */}
      <LandscapeQuickMenuPopover
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        isMuted={isMuted}
        copied={copied}
        unlockedCount={unlockedCount}
        totalIslands={totalIslands}
        roomMode={roomMode}
        showTestMenu={showTestMenu}
        onToggleSound={onToggleSound}
        onCopyLink={onCopyLink}
        onOpenMinimap={onOpenMinimap}
        onOpenSettings={onOpenSettings}
        onOpenHelp={onOpenHelp}
        onTogglePause={onTogglePause}
        onTriggerRegularWave={onTriggerRegularWave}
        onTriggerBossWave={onTriggerBossWave}
      />
    </div>
  );
};
