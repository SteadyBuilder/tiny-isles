import React from 'react';

export interface PixelThreatGaugeProps {
  containerId: string;
  barId: string;
  threatPercent: number;
  isWarning: boolean;
  isSurging: boolean;
  className?: string;
}

export const PixelThreatGauge: React.FC<PixelThreatGaugeProps> = ({
  containerId,
  barId,
  threatPercent,
  isWarning,
  isSurging,
  className = 'flex-1 h-4',
}) => {
  const clamped = Math.min(100, Math.max(0, threatPercent));

  return (
    <div
      id={containerId}
      className={`ts-bar-track overflow-hidden transition-all duration-300 ${
        isSurging ? 'threat-liquid-surge scale-y-110 brightness-125' : ''
      } ${className}`}
    >
      <div className="w-full h-full bg-[#24160e] rounded-[2px] overflow-hidden">
        <div
          id={barId}
          className="h-full threat-liquid-fill transition-all duration-700 ease-out rounded-[2px]"
          style={{
            width: `${clamped}%`,
            backgroundImage: isWarning
              ? 'linear-gradient(90deg, #ea580c 0%, #ef4444 35%, #facc15 50%, #ef4444 65%, #ea580c 100%)'
              : 'linear-gradient(90deg, #ca8a04 0%, #facc15 35%, #fef08a 50%, #f59e0b 65%, #ca8a04 100%)',
          }}
        />
      </div>
    </div>
  );
};
