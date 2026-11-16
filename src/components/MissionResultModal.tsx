import React from 'react';
import { Trophy, AlertTriangle, RotateCcw } from 'lucide-react';
import { COSMETIC_TITLES } from '../data/metaProgression';
import { MISSION_DIFFICULTIES } from '../data/missions';
import { MissionResultPayload } from '../types/room';

interface MissionResultModalProps {
  result: MissionResultPayload | null;
  onReturnToLobby: () => void;
}

export const MissionResultModal: React.FC<MissionResultModalProps> = ({
  result,
  onReturnToLobby,
}) => {
  if (!result) return null;

  const diffLabel = MISSION_DIFFICULTIES[result.difficulty]?.label ?? result.difficulty;
  const unlockedTitle = result.unlockedTitleId
    ? COSMETIC_TITLES.find((t) => t.id === result.unlockedTitleId)?.label
    : undefined;
  const mins = Math.floor(result.elapsedSec / 60);
  const secs = result.elapsedSec % 60;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
      <div
        className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl text-center space-y-5 bg-slate-900 ${
          result.victory ? 'border-amber-400/60' : 'border-red-500/50'
        }`}
      >
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${
            result.victory
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
              : 'bg-red-500/20 border-red-500/40 text-red-400'
          }`}
        >
          {result.victory ? <Trophy className="w-8 h-8" /> : <AlertTriangle className="w-8 h-8" />}
        </div>

        <div className="space-y-1.5">
          <h2
            className={`text-2xl font-black ${
              result.victory ? 'text-amber-300' : 'text-red-400'
            }`}
          >
            {result.victory ? '원정 미션 클리어!' : '원정 실패'}
          </h2>
          <p className="text-sm font-bold text-white">
            {result.missionTitle} ({diffLabel})
          </p>
          {result.reason && <p className="text-xs text-slate-300">{result.reason}</p>}
        </div>

        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2 text-xs">
          <div className="flex justify-between text-slate-300">
            <span>소요 시간</span>
            <span className="font-bold text-white">
              {mins}분 {secs}초
            </span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>획득 별의 파편</span>
            <span className="font-black text-emerald-300">+{result.earnedPoints}P</span>
          </div>
          {unlockedTitle && (
            <div className="flex justify-between text-slate-300">
              <span>칭호 해금</span>
              <span className="font-bold text-amber-300">🏅 {unlockedTitle}</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onReturnToLobby}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition shadow-lg"
        >
          <RotateCcw className="w-4 h-4" />
          <span>로비로 돌아가기</span>
        </button>
      </div>
    </div>
  );
};
