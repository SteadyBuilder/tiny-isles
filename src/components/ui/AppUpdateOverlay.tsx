import React from 'react';
import { RoomSessionStatus } from '../../types/room';
import { PixelGameButton } from './PixelGameButton';

interface AppUpdateOverlayProps {
  isUpdating: boolean;
  updateAvailable: boolean;
  sessionStatus: RoomSessionStatus;
  onApplyUpdateNow: () => void;
}

export const AppUpdateOverlay: React.FC<AppUpdateOverlayProps> = ({
  isUpdating,
  updateAvailable,
  sessionStatus,
  onApplyUpdateNow,
}) => {
  if (isUpdating) {
    return (
      <div className="fixed inset-0 z-[120] bg-[#0f172a]/85 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="ts-paper-sheet max-w-xs w-full p-5 text-center space-y-2 border-4 border-[#5c3a21] shadow-2xl">
          <div className="text-sm font-black text-[#3a200f]">
            최신 버전으로 업데이트 중...
          </div>
          <p className="text-xs font-bold text-[#6e4625]">
            잠시 후 최신 게임 데이터로 자동 접속됩니다.
          </p>
        </div>
      </div>
    );
  }

  if (!updateAvailable) return null;

  const isInGame = sessionStatus === 'playing' || sessionStatus === 'paused';

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[110] px-3 py-2 rounded-xl bg-[#2b1810]/95 border-2 border-[#f59e0b] shadow-xl flex items-center gap-2.5 max-w-[92vw]">
      <span className="text-[11px] sm:text-xs font-black text-[#fef3c7]">
        {isInGame
          ? '새 버전이 배포되었습니다. 로비 복귀 시 자동 반영됩니다.'
          : '새 버전이 배포되었습니다. 최신 버전으로 갱신해 주세요.'}
      </span>
      {!isInGame && (
        <PixelGameButton
          label="업데이트"
          variant="blue"
          size="sm"
          onClick={onApplyUpdateNow}
        />
      )}
    </div>
  );
};
