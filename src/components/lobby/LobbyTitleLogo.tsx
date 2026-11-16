import React from 'react';

export const LobbyTitleLogo: React.FC = () => {
  return (
    <div className="flex flex-col items-center select-none animate-float-slow pointer-events-none">
      {/* Crest Badge */}
      <div className="relative flex items-center justify-center mb-1">
        <img
          src="/assets/buildings/Castle.png"
          alt="Tiny Isles Crest"
          className="w-16 h-14 sm:w-20 sm:h-16 object-contain pixel-art drop-shadow-[0_6px_10px_rgba(0,0,0,0.75)]"
        />
      </div>

      {/* Main Pixel Outlined Game Title */}
      <h1 className="font-pixel-display text-4xl sm:text-6xl font-bold tracking-wider text-[#fde68a] pixel-title-outline leading-none text-center">
        TINY ISLES
      </h1>

      {/* Ribbon Subtitle */}
      <div className="relative -mt-1 inline-flex items-center justify-center px-10 py-1.5 min-w-[260px] sm:min-w-[320px]">
        <img
          src="/assets/ui/ribbon_blue_320.png"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pixel-art drop-shadow-[0_4px_8px_rgba(0,0,0,0.65)]"
        />
        <span className="relative z-10 text-xs sm:text-sm font-black tracking-wide text-[#fef5df] pixel-btn-shadow">
          협동 섬 방어 원정 · 1~4인
        </span>
      </div>
    </div>
  );
};
