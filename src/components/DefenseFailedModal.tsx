import React from 'react';
import { WoodModalFrame } from './ui/WoodModalFrame';
import { PixelGameButton } from './ui/PixelGameButton';

interface DefenseFailedModalProps {
  isOpen: boolean;
  onConfirm: () => void;
}

export const DefenseFailedModal: React.FC<DefenseFailedModalProps> = ({
  isOpen,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <WoodModalFrame
      title="본진 파괴 알림"
      ribbonVariant="red"
      frameVariant="special"
      maxWidthClass="max-w-md"
      closeOnBackdrop={false}
      zIndexClass="z-[100]"
    >
      <div className="ts-paper-sheet p-3 text-center space-y-2">
        <div className="flex items-center justify-center">
          <img src="/assets/ui/Icons/Icon_Boss.png" alt="" className="w-10 h-10 pixel-art" />
        </div>
        <p className="text-sm font-black text-[#7f1d1d]">
          방어에 실패하였습니다. 세계가 초기화됩니다.
        </p>
        <p className="text-xs font-bold text-[#5c3c24]">
          확인 버튼을 누르면 초기화된 세계로 다시 진입합니다.
        </p>
      </div>

      <PixelGameButton
        label="확인"
        iconSrc="/assets/ui/Icons/Icon_06.png"
        variant="red"
        size="md"
        fullWidth
        onClick={onConfirm}
      />
    </WoodModalFrame>
  );
};
