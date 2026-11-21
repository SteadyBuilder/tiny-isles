import React from 'react';
import { Check, HelpCircle, Pause, Share2, Volume2, VolumeX } from 'lucide-react';
import { HUD_STATUS_ICONS } from '../../data/hudIcons';
import { RoomMode } from '../../types/room';

export interface LandscapeQuickMenuPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  isMuted: boolean;
  copied: boolean;
  unlockedCount: number;
  totalIslands: number;
  roomMode?: RoomMode;
  showTestMenu?: boolean;
  onToggleSound: () => void;
  onCopyLink: () => void;
  onOpenMinimap?: () => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onTogglePause?: () => void;
  onTriggerRegularWave?: () => void;
  onTriggerBossWave?: () => void;
}

interface MenuGridItem {
  id: string;
  label: string;
  badge?: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

/**
 * 모바일 가로모드 우상단 '+' 메뉴 클릭 시 열리는 컴팩트 플로팅 그리드 팝오버.
 * 자주 누르지 않는 보조 기능(사운드·초대·전체 영지·설정·도움말·일시정지)을 직관적인 아이콘으로 수납한다.
 */
export const LandscapeQuickMenuPopover: React.FC<LandscapeQuickMenuPopoverProps> = ({
  isOpen,
  onClose,
  isMuted,
  copied,
  unlockedCount,
  totalIslands,
  roomMode,
  showTestMenu = false,
  onToggleSound,
  onCopyLink,
  onOpenMinimap,
  onOpenSettings,
  onOpenHelp,
  onTogglePause,
  onTriggerRegularWave,
  onTriggerBossWave,
}) => {
  if (!isOpen) return null;

  const items: MenuGridItem[] = [
    {
      id: 'landscape-menu-sound',
      label: isMuted ? '음소거됨' : '사운드',
      active: !isMuted,
      icon: isMuted ? (
        <VolumeX className="w-4 h-4 text-rose-300" />
      ) : (
        <Volume2 className="w-4 h-4 text-amber-200" />
      ),
      onClick: () => {
        onToggleSound();
      },
    },
    {
      id: 'landscape-menu-invite',
      label: copied ? '복사됨!' : '초대 링크',
      active: copied,
      icon: copied ? (
        <Check className="w-4 h-4 text-emerald-300" />
      ) : (
        <Share2 className="w-4 h-4 text-sky-200" />
      ),
      onClick: () => {
        onCopyLink();
      },
    },
    {
      id: 'landscape-menu-territory',
      label: '영지 지도',
      badge: `${unlockedCount}/${totalIslands}`,
      icon: (
        <img
          src={HUD_STATUS_ICONS.compass}
          alt="영지 지도"
          className="w-5 h-5 pixel-art object-contain"
        />
      ),
      onClick: () => {
        onClose();
        onOpenMinimap?.();
      },
    },
    {
      id: 'landscape-menu-settings',
      label: '설정',
      icon: (
        <img
          src={HUD_STATUS_ICONS.settings}
          alt="설정"
          className="w-5 h-5 pixel-art object-contain"
        />
      ),
      onClick: () => {
        onClose();
        onOpenSettings();
      },
    },
    {
      id: 'landscape-menu-help',
      label: '도움말',
      icon: <HelpCircle className="w-4 h-4 text-amber-200" />,
      onClick: () => {
        onClose();
        onOpenHelp();
      },
    },
  ];

  if (roomMode === 'solo' && onTogglePause) {
    items.push({
      id: 'landscape-menu-pause',
      label: '일시정지',
      icon: <Pause className="w-4 h-4 text-sky-200" />,
      onClick: () => {
        onClose();
        onTogglePause();
      },
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="landscape-quick-menu-popover"
        className="fixed z-50 pointer-events-auto rounded-2xl border border-[#c08a4b]/70 bg-[#18110c]/92 backdrop-blur-md shadow-[0_12px_32px_rgba(0,0,0,0.75)] p-2 w-[216px]"
        style={{
          top: 'max(3.35rem, calc(env(safe-area-inset-top, 0px) + 3.1rem))',
          right: 'max(6.75rem, calc(env(safe-area-inset-right, 0px) + 6.5rem))',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-3 gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              id={item.id}
              type="button"
              onClick={item.onClick}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 border transition active:scale-95 ${
                item.active
                  ? 'bg-[#3b2516]/90 border-[#f59e0b]/70 text-[#fef3c7]'
                  : 'bg-[#261a12]/85 border-[#6b472a]/70 text-[#e7d6be] hover:bg-[#352317]'
              }`}
            >
              <span className="flex items-center justify-center w-6 h-6">{item.icon}</span>
              <span className="text-[10px] font-black leading-none truncate max-w-full pixel-btn-shadow">
                {item.label}
              </span>
              {item.badge && (
                <span className="absolute -top-1 -right-1 px-1 rounded-full bg-[#1e3a8a] border border-[#93c5fd]/70 text-[8px] font-black text-[#fef3c7] tabular-nums leading-tight">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {showTestMenu && (onTriggerRegularWave || onTriggerBossWave) && (
          <div className="mt-2 pt-1.5 border-t border-[#6b472a]/60 flex items-center gap-1.5">
            {onTriggerRegularWave && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerRegularWave();
                }}
                className="flex-1 py-1 rounded-lg bg-[#4f803b] border border-[#a3e635]/50 text-[#fef5df] text-[10px] font-black active:scale-95"
              >
                +Wave
              </button>
            )}
            {onTriggerBossWave && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTriggerBossWave();
                }}
                className="flex-1 py-1 rounded-lg bg-[#991b1b] border border-[#f87171]/50 text-[#fef5df] text-[10px] font-black active:scale-95"
              >
                +Boss
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
