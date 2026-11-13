import React from 'react';
import { ShieldCheck, ShieldAlert, X, Swords, PackagePlus } from 'lucide-react';
import { OfflineResolutionReport } from '../types/game';

interface OfflineReportModalProps {
  report: OfflineResolutionReport | null;
  onClose: () => void;
}

function formatElapsed(sec: number): string {
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${mins}분`;
  return `${Math.max(1, mins)}분`;
}

export const OfflineReportModal: React.FC<OfflineReportModalProps> = ({ report, onClose }) => {
  if (!report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-400/50 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b border-white/10 ${
            report.victory ? 'bg-emerald-950/70' : 'bg-amber-950/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {report.victory ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <ShieldAlert className="w-6 h-6 text-amber-400" />
            )}
            <div>
              <h2 className="text-base font-black text-white">부재중 마을 방어 결산</h2>
              <p className="text-xs text-slate-300">경과 시간: {formatElapsed(report.elapsedSec)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          <p className="rounded-xl bg-slate-800/80 border border-white/10 px-3.5 py-2.5 text-slate-200 leading-relaxed">
            {report.summaryMessage}
          </p>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3">
              <div className="text-slate-400 mb-1 flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-rose-400" />
                <span>침공 횟수</span>
              </div>
              <div className="font-black text-white text-sm">
                일반 {report.simulatedRegularWaves}회 · 보스 {report.simulatedBossWaves}회
              </div>
            </div>

            <div className="rounded-xl bg-slate-800/60 border border-white/10 p-3">
              <div className="text-slate-400 mb-1">방어력 vs 위협</div>
              <div className="font-black text-sm">
                <span className="text-cyan-300">{report.defensePower}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span className="text-rose-300">{report.threatPower}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-800/60 border border-emerald-500/25 p-3">
            <div className="text-xs text-emerald-300 font-bold mb-1.5 flex items-center gap-1.5">
              <PackagePlus className="w-4 h-4" />
              <span>마을 패시브 생산 정산</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-black">
              <span className="text-amber-300">🪵 +{report.passiveGain.wood}</span>
              <span className="text-slate-200">🪨 +{report.passiveGain.stone}</span>
              <span className="text-yellow-300">🪙 +{report.passiveGain.gold}</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300">
            <div>
              🛡️ 함께 싸운 오프라인 수비대:{' '}
              <span className="font-bold text-cyan-300">{report.activeGarrisonsHelped}명</span>
            </div>
            <div>
              🏰 중심 마을(#0) 코어 내구도:{' '}
              <span className="font-bold text-amber-300">
                {report.homeCoreHpAfter} / {report.homeCoreMaxHp}
              </span>
            </div>
            {report.damagedBuildingsCount > 0 && (
              <div>
                🔨 손상된 건물:{' '}
                <span className="font-bold text-orange-300">{report.damagedBuildingsCount}채</span>
              </div>
            )}
            {report.lostOuterIslandNames.length > 0 && (
              <div className="text-rose-300 font-semibold">
                🚩 상실한 외곽 섬: {report.lostOuterIslandNames.join(', ')}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition active:scale-98"
          >
            마을 수호 계속하기
          </button>
        </div>
      </div>
    </div>
  );
};
