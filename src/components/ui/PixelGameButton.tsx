import React, { useState } from 'react';
import { sound } from '../../lib/sound';

export interface PixelGameButtonProps {
  label: string;
  subtitle?: string;
  iconSrc?: string;
  variant?: 'blue' | 'red';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  title?: string;
}

const SIZE_CLASSES: Record<NonNullable<PixelGameButtonProps['size']>, string> = {
  sm: 'min-h-[46px] text-xs px-1',
  md: 'min-h-[54px] text-sm px-2',
  lg: 'min-h-[60px] text-base px-3',
};

export const PixelGameButton: React.FC<PixelGameButtonProps> = ({
  label,
  subtitle,
  iconSrc,
  variant = 'blue',
  size = 'md',
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  className = '',
  title,
}) => {
  const [pressed, setPressed] = useState(false);

  const spriteClass =
    variant === 'red'
      ? pressed && !disabled
        ? 'ts-btn-red-pressed'
        : 'ts-btn-red'
      : pressed && !disabled
        ? 'ts-btn-blue-pressed'
        : 'ts-btn-blue';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    sound.playClick();
    onClick?.(e);
  };

  return (
    <button
      type={type}
      disabled={disabled}
      title={title}
      onClick={handleClick}
      onPointerDown={() => {
        if (!disabled) setPressed(true);
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      className={[
        'relative inline-flex items-center justify-center bg-transparent select-none transition-[filter,transform] duration-75',
        spriteClass,
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        disabled
          ? 'opacity-55 grayscale cursor-not-allowed'
          : 'cursor-pointer hover:brightness-110',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={`flex items-center justify-center gap-2 transition-transform duration-75 ${
          pressed && !disabled ? 'translate-y-[2px]' : ''
        }`}
      >
        {iconSrc && (
          <img
            src={iconSrc}
            alt=""
            className="w-5 h-5 pixel-art shrink-0 drop-shadow-[0_2px_0_rgba(0,0,0,0.65)]"
          />
        )}
        <span className="flex flex-col items-center leading-tight">
          <span className="font-black tracking-wide text-[#fef5df] pixel-btn-shadow">
            {label}
          </span>
          {subtitle && (
            <span className="text-[10px] font-bold text-[#fde68a] pixel-btn-shadow opacity-95 mt-0.5">
              {subtitle}
            </span>
          )}
        </span>
      </span>
    </button>
  );
};
