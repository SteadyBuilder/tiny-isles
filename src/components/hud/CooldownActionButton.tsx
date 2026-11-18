import React, { useEffect, useRef, useState } from 'react';

export type CooldownAccentTheme = 'emerald' | 'blue' | 'cyan';

export interface CooldownActionButtonProps {
  id?: string;
  onClick?: () => void;
  disabled?: boolean;
  isOutOfStock?: boolean;
  cooldownRemainingMs: number;
  cooldownMaxMs: number;
  spritePath: string;
  alt: string;
  hotkey?: string;
  badgeText?: string;
  title?: string;
  ariaLabel?: string;
  accentTheme?: CooldownAccentTheme;
  shape?: 'square' | 'round';
  sizeClass?: string;
  iconSizeClass?: string;
  isPressed?: boolean;
  onTouchStart?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchCancel?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLButtonElement>) => void;
}

const THEME_STYLES: Record<
  CooldownAccentTheme,
  {
    activeContainer: string;
    gaugeFill: string;
    hotkeyText: string;
    flashBg: string;
  }
> = {
  emerald: {
    activeContainer: 'bg-[#14532d]/90 border-[#4ade80] shadow-[0_0_10px_rgba(74,222,128,0.22)]',
    gaugeFill: 'bg-gradient-to-t from-[#166534]/85 via-[#22c55e]/60 to-[#86efac]/75',
    hotkeyText: 'text-[#86efac]',
    flashBg: 'bg-[#86efac]/60',
  },
  blue: {
    activeContainer: 'bg-[#1e3a8a]/95 border-[#60a5fa] shadow-[0_0_10px_rgba(96,165,250,0.28)]',
    gaugeFill: 'bg-gradient-to-t from-[#1d4ed8]/85 via-[#3b82f6]/60 to-[#93c5fd]/80',
    hotkeyText: 'text-[#93c5fd]',
    flashBg: 'bg-[#93c5fd]/65',
  },
  cyan: {
    activeContainer: 'bg-[#0f4c5c]/95 border-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.28)]',
    gaugeFill: 'bg-gradient-to-t from-[#0e7490]/85 via-[#06b6d4]/60 to-[#67e8f9]/80',
    hotkeyText: 'text-[#67e8f9]',
    flashBg: 'bg-[#67e8f9]/65',
  },
};

export const CooldownActionButton: React.FC<CooldownActionButtonProps> = ({
  id,
  onClick,
  disabled = false,
  isOutOfStock = false,
  cooldownRemainingMs,
  cooldownMaxMs,
  spritePath,
  alt,
  hotkey,
  badgeText,
  title,
  ariaLabel,
  accentTheme = 'blue',
  shape = 'square',
  sizeClass = 'w-12 h-12',
  iconSizeClass = 'w-7 h-7',
  isPressed = false,
  onTouchStart,
  onTouchEnd,
  onTouchCancel,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  onPointerCancel,
}) => {
  const isCoolingDown = cooldownRemainingMs > 0 && cooldownMaxMs > 0;
  const chargePercent = isOutOfStock
    ? 0
    : isCoolingDown
      ? Math.max(0, Math.min(100, (1 - cooldownRemainingMs / cooldownMaxMs) * 100))
      : 100;

  const [justReady, setJustReady] = useState(false);
  const wasCoolingRef = useRef(isCoolingDown);

  useEffect(() => {
    if (wasCoolingRef.current && !isCoolingDown && !isOutOfStock) {
      setJustReady(true);
      const timer = window.setTimeout(() => setJustReady(false), 440);
      wasCoolingRef.current = isCoolingDown;
      return () => window.clearTimeout(timer);
    }
    wasCoolingRef.current = isCoolingDown;
  }, [isCoolingDown, isOutOfStock]);

  const theme = THEME_STYLES[accentTheme];
  const isDisabled = disabled || isCoolingDown || isOutOfStock;
  const roundedClass = shape === 'round' ? 'rounded-full' : 'rounded-xl';

  const containerStateClass = isOutOfStock
    ? 'bg-[#1c130d]/85 border-[#4a3525] cursor-not-allowed opacity-70'
    : isCoolingDown
      ? 'bg-[#1e1510]/95 border-[#6b5138] cursor-not-allowed'
      : `${theme.activeContainer} hover:brightness-110 active:scale-95`;

  return (
    <button
      id={id}
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      title={title}
      aria-label={ariaLabel ?? title ?? alt}
      className={`relative overflow-hidden border-2 flex items-center justify-center select-none touch-none transition-all duration-150 ${roundedClass} ${sizeClass} ${containerStateClass} ${
        justReady ? 'cooldown-ready-pop' : ''
      } ${isPressed && !isDisabled ? 'scale-95 translate-y-[1px]' : ''}`}
    >
      {/* Rising charge gauge when cooling down */}
      {isCoolingDown && !isOutOfStock && (
        <div
          className={`absolute bottom-0 left-0 right-0 pointer-events-none transition-[height] duration-200 ease-linear ${theme.gaugeFill}`}
          style={{ height: `${chargePercent}%` }}
        >
          <div className="w-full h-[2px] bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
        </div>
      )}

      {/* Ready flash burst when cooldown finishes */}
      {justReady && (
        <span
          className={`absolute inset-0 pointer-events-none ${roundedClass} ${theme.flashBg} cooldown-ready-flash`}
        />
      )}

      {/* Pixel sprite icon */}
      <img
        src={spritePath}
        alt={alt}
        className={`relative z-10 object-contain pixel-art drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)] transition-all duration-150 ${iconSizeClass} ${
          isOutOfStock
            ? 'grayscale opacity-35'
            : isCoolingDown
              ? 'grayscale opacity-60 scale-95'
              : 'opacity-100 scale-100'
        }`}
      />

      {/* Top-left hotkey badge */}
      {hotkey && (
        <span
          className={`absolute top-0.5 left-0.5 z-20 px-1 py-[1px] rounded bg-black/70 text-[9px] font-black leading-none border border-white/10 ${
            isDisabled ? 'text-[#9ca3af]' : theme.hotkeyText
          }`}
        >
          {hotkey}
        </span>
      )}

      {/* Bottom-right quantity/counter badge */}
      {badgeText !== undefined && (
        <span
          className={`absolute bottom-0.5 right-0.5 z-20 px-1 py-[1px] rounded bg-black/75 text-[10px] font-black leading-none tabular-nums ${
            isOutOfStock ? 'text-[#78716c]' : 'text-[#fef3c7]'
          }`}
        >
          {badgeText}
        </span>
      )}
    </button>
  );
};
