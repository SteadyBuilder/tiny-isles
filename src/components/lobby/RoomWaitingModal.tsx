import React, { useState } from 'react';
import { Copy, Check, Play, LogOut, Users, Crown } from 'lucide-react';
import { getDifficultyConfig, getMissionById } from '../../data/missions';
import { RoomConfig, RoomMember } from '../../types/room';

interface RoomWaitingModalProps {
  roomConfig: RoomConfig;
  members: RoomMember[];
  isHost: boolean;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
}

export const RoomWaitingModal: React.FC<RoomWaitingModalProps> = ({
  roomConfig,
  members,
  isHost,
  onStartMatch,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const mission = getMissionById(roomConfig.missionId);
  const difficulty = getDifficultyConfig(roomConfig.difficulty);

  const inviteCode = roomConfig.inviteCode ?? roomConfig.roomId;

  const handleCopyInvite = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', inviteCode);
    url.searchParams.set('mission', roomConfig.missionId);
    url.searchParams.set('diff', roomConfig.difficulty);
    void navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-3xl border border-blue-500/40 bg-slate-900 p-6 shadow-2xl text-white space-y-5">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/40">
              코옵 대기실 (최대 {roomConfig.maxPlayers}인)
            </span>
            <h2 className="text-xl font-black text-amber-300 mt-2">{mission.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              난이도: {difficulty.label} · 예상 시간: {mission.estimatedMinutes}
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopyInvite}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '링크 복사됨' : `코드: ${inviteCode}`}</span>
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" />
              참여 중인 수호자 ({members.length} / {roomConfig.maxPlayers})
            </span>
            {!isHost && (
              <span className="text-amber-300 animate-pulse">방장이 시작하기를 기다리는 중...</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {members.map((m) => (
              <div
                key={m.playerId}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      m.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="text-xs font-bold">{m.name}</span>
                </div>
                {m.isHost && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300">
                    <Crown className="w-3.5 h-3.5" />
                    방장
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-bold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>나가기</span>
          </button>

          {isHost && (
            <button
              type="button"
              onClick={onStartMatch}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black shadow-lg transition"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>원정 시작하기</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
