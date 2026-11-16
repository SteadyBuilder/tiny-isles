import React from 'react';

export interface PixelRangeSliderProps {
  label: string;
  iconSrc?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  accentVariant?: 'amber' | 'emerald';
  onChange: (nextValue: number) => void;
}

export const PixelRangeSlider: React.FC<PixelRangeSliderProps> = ({
  label,
  iconSrc,
  value,
  min = 0,
  max = 1,
  step = 0.05,
  accentVariant = 'amber',
  onChange,
}) => {
  const ratio = Math.min(1, Math.max(0, (value - min) / Math.max(0.0001, max - min)));
  const fillGradient =
    accentVariant === 'emerald'
      ? 'linear-gradient(90deg, #16a34a 0%, #4ade80 100%)'
      : 'linear-gradient(90deg, #b45309 0%, #facc15 100%)';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-extrabold text-[#3a200f]">
        <span className="flex items-center gap-1.5">
          {iconSrc && <img src={iconSrc} alt="" className="w-3.5 h-3.5 pixel-art" />}
          <span>{label}</span>
        </span>
        <span className="font-mono font-black text-[#7c2d12] tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </div>

      <div className="relative h-5 flex items-center">
        <div className="ts-bar-track w-full h-4 flex items-center overflow-hidden">
          <div className="w-full h-full bg-[#24160e] rounded-sm overflow-hidden">
            <div
              className="h-full transition-all duration-150"
              style={{
                width: `${ratio * 100}%`,
                backgroundImage: fillGradient,
              }}
            />
          </div>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="ts-range-slider absolute inset-0 w-full h-full m-0"
          aria-label={label}
        />
      </div>
    </div>
  );
};
