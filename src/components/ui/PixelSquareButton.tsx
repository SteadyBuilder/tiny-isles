import React, { useState } from 'react';
import { sound } from '../../lib/sound';

export interface PixelSquareButtonProps {
  id?: string;
  iconSrc?: string;
  label?: string;
  alt: string;
  title?: string;
  variant?: 'blue' | 'red';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  className?: string;
  iconClassName?: string;
}

const SQUARE_SIZE: Record<NonNullable<PixelSquareButtonProps['size']>, string> = {
  xs: 'w-8 h-8',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-13 h-13',
};

const ICON_SIZE: Record<NonNullable<PixelSquareButtonProps['size']>, string> = {
  xs: 'w-4 h-4',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const PixelSquareButton: React.FC<PixelSquareButtonProps> = ({
  id,
  iconSrc,
  label,
  alt,
  title,
  variant = 'blue',
  size = 'md',
  disabled = false,
  onClick,
  onPointerDown,
  className = '',
  iconClassName = '',
}) => {
  const [pressed, setPressed] = useState(false);

  const spriteSrc =
    variant === 'red'
      ? pressed && !disabled
        ? '/assets/ui/square_red_pressed.png'
        : '/assets/ui/square_red.png'
      : pressed && !disabled
        ? '/assets/ui/square_blue_pressed.png'
        : '/assets/ui/square_blue.png';

  return (
    <button
      id={id}
      type="button"
      disabled={disabled}
      title={title ?? alt}
      aria-label={alt}
      onClick={() => {
        if (disabled) return;
        sound.playClick();
        onClick?.();
      }}
      onPointerDown={(e) => {
        if (!disabled) setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={`relative flex items-center justify-center shrink-0 select-none transition-[filter] ${
        SQUARE_SIZE[size]
      } ${disabled ? 'opacity-55 grayscale cursor-not-allowed' : 'hover:brightness-110 cursor-pointer'} ${className}`}
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
          className={`absolute pixel-art transition-transform duration-75 drop-shadow-[0_1px_0_rgba(0,0,0,0.7)] ${
            ICON_SIZE[size]
          } ${pressed && !disabled ? 'translate-y-[2px]' : '-translate-y-[1px]'} ${iconClassName}`}
        />
      )}
      {label && !iconSrc && (
        <span
          className={`absolute text-[11px] font-black text-[#fef5df] pixel-btn-shadow ${
            pressed && !disabled ? 'translate-y-[2px]' : '-translate-y-[1px]'
          }`}
        >
          {label}
        </span>
      )}
    </button>
  );
};
