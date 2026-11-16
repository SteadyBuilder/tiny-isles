import React from 'react';
import { AlertTriangle } from 'lucide-react';

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-500/50 bg-slate-900 p-6 shadow-2xl text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 border border-red-500/40">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-red-400">본진 파괴 알림</h2>
          <p className="text-base font-medium text-slate-100 leading-relaxed">
            방어에 실패하였습니다. 세계가 초기화 됩니다.
          </p>
          <p className="text-xs text-slate-400">
            확인 버튼을 누르면 초기화된 세계로 다시 진입합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          className="w-full rounded-xl bg-red-600 hover:bg-red-500 active:bg-red-700 px-5 py-3 text-sm font-bold text-white transition-colors shadow-lg"
        >
          확인
        </button>
      </div>
    </div>
  );
};
