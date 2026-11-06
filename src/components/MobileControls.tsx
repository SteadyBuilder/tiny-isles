import React from 'react';

interface MobileControlsProps {
  onAction: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ onAction }) => {
  return (
    <div className="sm:hidden absolute bottom-6 right-6 z-30 pointer-events-auto">
      <button
        onClick={onAction}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 active:scale-95 text-white font-black text-2xl shadow-2xl border-2 border-white/50 flex items-center justify-center"
      >
        ⚔️
      </button>
    </div>
  );
};
