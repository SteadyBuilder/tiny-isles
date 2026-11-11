import React from 'react';
import { Skull, Clock, Trophy, Sparkles, Shield, Play } from 'lucide-react';

interface SessionModalProps {
  isOpen: boolean;
  onSelectMode: (minutes: 30 | 60) => void;
  isGameOver?: boolean;
  isVictory?: boolean;
  onRestart?: () => void;
  survivedTime?: number;
}

export const SessionModal: React.FC<SessionModalProps> = ({
  isOpen,
  onSelectMode,
  isGameOver,
  isVictory,
  onRestart,
  survivedTime = 0,
}) => {
  if (!isOpen) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}분 ${secs}초`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-7 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
        {/* 승리 / 패배 / 모드 선택 분기 */}
        {isVictory ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
            </div>
            <h2 className="text-2xl font-black text-amber-300 mb-1">미션 완수! 수도 수호 성공</h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-4">
              모든 마물의 침공과 보스를 격퇴하고 중심 수도를 지켜냈습니다!
            </p>

            <div className="w-full bg-slate-800/80 rounded-2xl p-3 border border-amber-500/20 mb-5 flex flex-col gap-2 text-left">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                획득 보상
              </span>
              <div className="text-xs text-slate-200 flex items-center justify-between">
                <span>👑 수호자의 왕관 코스튬 해금</span>
                <span className="text-amber-300 font-bold">완료</span>
              </div>
              <div className="text-xs text-slate-200 flex items-center justify-between">
                <span>🛡️ 다음 세션 어드밴티지 (시작 목재/석재 +50)</span>
                <span className="text-emerald-400 font-bold">활성화</span>
              </div>
            </div>

            <button
              onClick={onRestart}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-sm shadow-lg hover:from-amber-400 hover:to-yellow-400 active:scale-95 transition-all"
            >
              새로운 방 생성 / 다시 도전
            </button>
          </>
        ) : isGameOver ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-400 flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(244,63,94,0.5)]">
              <Skull className="w-8 h-8 text-rose-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-rose-400 mb-1">수도 코어 파괴됨</h2>
            <p className="text-xs sm:text-sm text-slate-300 mb-2">
              중심 수도 마을의 코어 보석이 마물들에게 무너졌습니다.
            </p>
            <p className="text-xs font-mono text-amber-300 mb-5">
              생존 시간: {formatTime(survivedTime)}
            </p>

            <button
              onClick={onRestart}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 text-white font-black text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              다시 방 생성하기
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-3">
              <Shield className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white mb-1">
              디펜스 세션 시간 선택
            </h2>
            <p className="text-xs text-slate-400 mb-5">
              특정 시간마다 마물이 중심 수도로 쳐들어옵니다. 세션 길이를 선택하세요.
            </p>

            <div className="flex flex-col gap-3 w-full mb-4">
              {/* 30분 모드 버튼 */}
              <button
                onClick={() => onSelectMode(30)}
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 hover:bg-amber-500/15 border border-slate-700 hover:border-amber-400 transition-all text-left active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-black">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-amber-300">
                      30분 모드 (속전속결)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      10분 주기 웨이브 + 30분 최종 보스전
                    </div>
                  </div>
                </div>
                <Play className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
              </button>

              {/* 60분 모드 버튼 */}
              <button
                onClick={() => onSelectMode(60)}
                className="group flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/80 hover:bg-indigo-500/15 border border-slate-700 hover:border-indigo-400 transition-all text-left active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-black">
                    <Skull className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white group-hover:text-indigo-300">
                      60분 모드 (대서사시 / 하드코어)
                    </div>
                    <div className="text-[11px] text-slate-400">
                      15분 주기 웨이브 + 60분 월드 보스 레이드
                    </div>
                  </div>
                </div>
                <Play className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </button>
            </div>

            <div className="text-[11px] text-slate-500">
              💡 미션 완수 시 캐릭터 치장 코스튬과 다음 세션 어드밴티지가 지급됩니다.
            </div>
          </>
        )}
      </div>
    </div>
  );
};
