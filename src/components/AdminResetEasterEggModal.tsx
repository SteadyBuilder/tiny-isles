import React, { useState } from 'react';
import { Lock, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { resetAllPlayData, verifyAdminResetCode } from '../lib/adminResetService';

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
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm bg-[#161c2e] border-2 border-red-500/60 rounded-3xl p-5 shadow-2xl text-white flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-red-500/20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" />
            <h3 className="font-black text-base text-red-300">관리자 전용 초기화</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isResetting}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition disabled:opacity-40"
          >
            <X className="w-4 h-4 text-slate-300" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Supabase 서버(월드 상태, 해금된 섬, 플레이어, 수비대)와 로컬 저장소의 모든 플레이
          데이터를 초기 상태로 되돌립니다.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="관리자 비밀 코드 입력"
              autoFocus
              disabled={isResetting}
              className="w-full bg-black/60 border border-white/20 focus:border-red-400 text-white pl-9 pr-3 py-2 rounded-xl text-sm outline-none"
            />
          </div>

          {error && <div className="text-xs text-red-400 font-semibold">{error}</div>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={isResetting}
              className="flex-1 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold text-slate-200 transition disabled:opacity-40"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isResetting || !passcode.trim()}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-900/40 disabled:text-red-300/50 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              {isResetting ? '초기화 중...' : '전체 데이터 초기화'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
