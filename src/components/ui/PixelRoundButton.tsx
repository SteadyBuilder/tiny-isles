import React, { useState } from 'react';
import { sound } from '../../lib/sound';

export interface PixelRoundButtonProps {
  iconSrc?: string;
  label?: string;
  alt: string;
  title?: string;
  variant?: 'blue' | 'red';
  size?: 'sm' | 'md';
  mutedCross?: boolean;
  iconDimmed?: boolean;
  onClick?: () => void;
  className?: string;
}

const ROUND_SIZE: Record<NonNullable<PixelRoundButtonProps['size']>, string> = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
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
}) => {
  const [pressed, setPressed] = useState(false);

  const spriteSrc =
    variant === 'red'
      ? pressed
        ? '/assets/ui/Buttons/SmallRedRoundButton_Pressed.png'
        : '/assets/ui/Buttons/SmallRedRoundButton_Regular.png'
      : pressed
        ? '/assets/ui/Buttons/SmallBlueRoundButton_Pressed.png'
        : '/assets/ui/Buttons/SmallBlueRoundButton_Regular.png';

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
        className="w-full h-full pixel-art drop-shadow-[0_3px_5px_rgba(0,0,0,0.65)]"
      />
      {iconSrc && (
        <img
          src={iconSrc}
          alt={alt}
          className={`absolute w-4 h-4 pixel-art transition-transform duration-75 ${
            pressed ? 'translate-y-[2px]' : '-translate-y-[1px]'
          } ${iconDimmed ? 'opacity-40 grayscale' : ''}`}
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
