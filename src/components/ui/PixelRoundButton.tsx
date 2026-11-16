import React, { useState } from 'react';
import { sound } from '../../lib/sound';

export interface PixelRoundButtonProps {
  iconSrc?: string;
  label?: string;
  alt: string;
  title?: string;
  variant?: 'blue' | 'red';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  mutedCross?: boolean;
  iconDimmed?: boolean;
  onClick?: () => void;
  className?: string;
  iconClassName?: string;
}

const ROUND_SIZE: Record<NonNullable<PixelRoundButtonProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const ICON_SIZE: Record<NonNullable<PixelRoundButtonProps['size']>, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-4 h-4',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export const PixelRoundButton: React.FC<PixelRoundButtonProps> = ({
  iconSrc,
  label,
  alt,
  title,
  variant = 'blue',
  size = 'md',
  mutedCross = false,
  iconDimmed = false,
  onClick,
  className = '',
  iconClassName = '',
}) => {
  const [pressed, setPressed] = useState(false);

  const spriteSrc =
    variant === 'red'
      ? pressed
        ? '/assets/ui/round_red_pressed.png'
        : '/assets/ui/round_red.png'
      : pressed
        ? '/assets/ui/round_blue_pressed.png'
        : '/assets/ui/round_blue.png';

  return (
    <button
      type="button"
      title={title ?? alt}
      aria-label={alt}
      onClick={() => {
        sound.playClick();
        onClick?.();
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={`relative flex items-center justify-center shrink-0 hover:brightness-110 transition-[filter] select-none ${ROUND_SIZE[size]} ${className}`}
    >
      <img
        src={spriteSrc}
        alt=""
        className="w-full h-full object-contain pixel-art drop-shadow-[0_3px_5px_rgba(0,0,0,0.65)]"
      />
      {iconSrc && (
        <img
          src={iconSrc}
          alt={alt}
          className={`absolute pixel-art transition-transform duration-75 drop-shadow-[0_1px_0_rgba(0,0,0,0.7)] ${ICON_SIZE[size]} ${
            pressed ? 'translate-y-[2px]' : '-translate-y-[1px]'
          } ${iconDimmed ? 'opacity-40 grayscale' : ''} ${iconClassName}`}
        />
      )}
      {label && !iconSrc && (
        <span
          className={`absolute text-xs font-black text-[#fef5df] pixel-btn-shadow ${
            pressed ? 'translate-y-[2px]' : '-translate-y-[1px]'
          }`}
        >
          {label}
        </span>
      )}
      {mutedCross && (
        <span className="absolute text-red-500 font-black text-base pixel-btn-shadow pointer-events-none">
          ✕
        </span>
      )}
    </button>
  );
};
