import React, { useState } from 'react';
import { resetAllPlayData, verifyAdminResetCode } from '../lib/adminResetService';
import { WoodModalFrame } from './ui/WoodModalFrame';
import { PixelGameButton } from './ui/PixelGameButton';

interface AdminResetEasterEggModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminResetEasterEggModal: React.FC<AdminResetEasterEggModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isResetting) return;
    setPasscode('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResetting) return;

    setError(null);
    const isValid = await verifyAdminResetCode(passcode);
    if (!isValid) {
      setError('비밀 코드가 올바르지 않습니다.');
      return;
    }

    setIsResetting(true);
    const result = await resetAllPlayData();
    if (!result.ok) {
      setIsResetting(false);
      setError(`일부 서버 초기화 실패: ${result.errors[0] ?? '알 수 없는 오류'}`);
      return;
    }

    window.location.reload();
  };

  return (
    <WoodModalFrame
      title="관리자 전용 초기화"
      ribbonVariant="red"
      frameVariant="special"
      maxWidthClass="max-w-sm"
      zIndexClass="z-[60]"
      onClose={handleClose}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="ts-paper-sheet p-2.5 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-black text-[#991b1b]">
            <img src="/assets/ui/Icons/Icon_Boss.png" alt="" className="w-4 h-4 pixel-art" />
            <span>서버 & 로컬 저장소 전체 초기화</span>
          </div>
          <p className="text-[11px] font-bold text-[#4a301e] leading-relaxed">
            Supabase 서버(월드 상태, 해금된 섬, 플레이어, 수비대)와 로컬 저장소의 모든 플레이
            데이터를 초기 상태로 되돌립니다.
          </p>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="관리자 비밀 코드 입력"
            autoFocus
            disabled={isResetting}
            className="w-full px-3 py-2 rounded-lg bg-[#fff7e6] border-2 border-[#8c5a32] text-[#2b1810] text-sm font-black outline-none focus:border-[#dc2626] select-text"
          />
          {error && <div className="text-xs font-black text-[#b91c1c]">{error}</div>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PixelGameButton
            label="취소"
            variant="blue"
            size="sm"
            fullWidth
            disabled={isResetting}
            onClick={handleClose}
          />
          <PixelGameButton
            type="submit"
            label={isResetting ? '초기화 중...' : '전체 초기화'}
            iconSrc="/assets/ui/Icons/Icon_09.png"
            variant="red"
            size="sm"
            fullWidth
            disabled={isResetting || !passcode.trim()}
          />
        </div>
      </form>
    </WoodModalFrame>
  );
};
