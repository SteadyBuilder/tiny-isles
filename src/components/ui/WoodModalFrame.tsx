import React from 'react';
import { PixelRoundButton } from './PixelRoundButton';

export interface WoodModalFrameProps {
  id?: string;
  title: string;
  ribbonVariant?: 'blue' | 'red';
  frameVariant?: 'wood' | 'special';
  maxWidthClass?: string;
  onClose?: () => void;
  onTitleClick?: () => void;
  closeOnBackdrop?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  zIndexClass?: string;
}

export const WoodModalFrame: React.FC<WoodModalFrameProps> = ({
  id,
  title,
  ribbonVariant = 'blue',
  frameVariant = 'wood',
  maxWidthClass = 'max-w-xl',
  onClose,
  onTitleClick,
  closeOnBackdrop = true,
  headerRight,
  children,
  zIndexClass = 'z-50',
}) => {
  const ribbonSrc =
    ribbonVariant === 'red'
      ? '/assets/ui/ribbon_red_256.png'
      : '/assets/ui/ribbon_blue_320.png';

  const frameClass =
    frameVariant === 'special' ? 'ts-special-frame' : 'ts-wood-frame';

  return (
    <div
      id={id}
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/65 backdrop-blur-[2px] p-3 sm:p-5 animate-fadeIn`}
      onClick={closeOnBackdrop ? onClose : undefined}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={`relative w-full ${maxWidthClass} ${frameClass} max-h-[88vh] flex flex-col pt-3`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Overlapping Tiny Swords Ribbon Title */}
        <div
          className={`relative -mt-10 mb-2 flex items-center justify-center shrink-0 ${
            onTitleClick ? 'pointer-events-auto cursor-default select-none' : 'pointer-events-none'
          }`}
          onClick={onTitleClick}
        >
          <div className="relative inline-flex items-center justify-center px-10 py-2 min-w-[230px] sm:min-w-[290px] max-w-[90%]">
            <img
              src={ribbonSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-fill pixel-art drop-shadow-[0_5px_8px_rgba(0,0,0,0.7)]"
            />
            <h2 className="relative z-10 text-sm sm:text-base font-black text-[#fef5df] pixel-btn-shadow tracking-wide text-center px-3">
              {title}
            </h2>
          </div>
        </div>

        {/* Optional Secondary Header Bar (Points / Close Button) */}
        {(headerRight || onClose) && (
          <div className="flex items-center justify-between gap-2 mb-2 px-1 shrink-0">
            <div className="flex items-center gap-2 min-w-0">{headerRight}</div>
            {onClose && (
              <PixelRoundButton
                variant="red"
                size="sm"
                iconSrc="/assets/ui/Icons/Icon_09.png"
                alt="닫기"
                onClick={onClose}
              />
            )}
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y pr-1 space-y-3 wood-modal-scroll">
          {children}
        </div>
      </div>
    </div>
  );
};
