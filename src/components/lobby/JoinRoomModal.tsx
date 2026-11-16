import React, { useState } from 'react';
import { PixelGameButton } from '../ui/PixelGameButton';
import { WoodModalFrame } from '../ui/WoodModalFrame';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (inviteCode: string) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoin,
}) => {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return;
    onJoin(cleaned);
    onClose();
  };

  return (
    <WoodModalFrame
      title="초대 코드로 참가"
      ribbonVariant="blue"
      maxWidthClass="max-w-md"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="ts-paper-sheet p-2.5 space-y-2">
          <p className="text-xs font-bold text-[#4a301e]">
            방장이 공유한 6자리 초대 코드를 입력하면 즉시 협동 대기실에 합류합니다.
          </p>
          <input
            type="text"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            placeholder="예: A7K9P2"
            className="w-full px-3 py-2.5 rounded-lg bg-[#fff7e6] border-2 border-[#8c5a32] text-center font-pixel-display text-lg font-bold tracking-[0.25em] uppercase text-[#2b1810] outline-none focus:border-[#2563eb]"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <PixelGameButton label="닫기" variant="red" size="sm" onClick={onClose} />
          <PixelGameButton
            type="submit"
            label="대기실 합류"
            iconSrc="/assets/ui/Icons/Icon_05.png"
            variant="blue"
            size="sm"
            disabled={!code.trim()}
          />
        </div>
      </form>
    </WoodModalFrame>
  );
};
