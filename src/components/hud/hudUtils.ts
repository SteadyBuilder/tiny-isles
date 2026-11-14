import { Inventory } from '../../types/game';

export interface HudResourceSlotMeta {
  key: keyof Inventory;
  iconSrc: string;
  alt: string;
  desktopSpanId: string;
  textColorClass: string;
}

export const HUD_RESOURCE_SLOTS: ReadonlyArray<HudResourceSlotMeta> = [
  {
    key: 'wood',
    iconSrc: '/assets/ui/Icons/Icon_02.png',
    alt: 'Wood',
    desktopSpanId: 'hud-wood-count',
    textColorClass: 'text-amber-200',
  },
  {
    key: 'stone',
    iconSrc: '/assets/decorations/Rock2.png',
    alt: 'Stone',
    desktopSpanId: 'hud-stone-count',
    textColorClass: 'text-slate-200',
  },
  {
    key: 'gold',
    iconSrc: '/assets/ui/Icons/Icon_03.png',
    alt: 'Gold',
    desktopSpanId: 'hud-gold-count',
    textColorClass: 'text-yellow-300',
  },
];

export function formatHudSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}
