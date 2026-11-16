import React, { useState } from 'react';
import { Play, Users, Sparkles, KeyRound, Shield, Clock } from 'lucide-react';
import {
  MISSION_CATALOG,
  MISSION_DIFFICULTIES,
} from '../../data/missions';
import { COSMETIC_TITLES } from '../../data/metaProgression';
import {
  MetaProgressionState,
  RoomDifficultyId,
} from '../../types/room';
import { PlayerColor } from '../../types/game';

interface LobbyScreenProps {
  playerName: string;
  playerColor: PlayerColor;
  meta: MetaProgressionState;
  onStartSolo: (missionId: string, difficulty: RoomDifficultyId) => void;
  onCreateCoopRoom: (missionId: string, difficulty: RoomDifficultyId) => void;
  onJoinCoopRoom: (inviteCode: string) => void;
  onOpenMetaModal: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerName,
  playerColor,
  meta,
  onStartSolo,
  onCreateCoopRoom,
  onJoinCoopRoom,
  onOpenMetaModal,
}) => {
  const [selectedMissionId, setSelectedMissionId] = useState<string>(MISSION_CATALOG[0].id);
  const [selectedDifficulty, setSelectedDifficulty] = useState<RoomDifficultyId>('normal');
  const [inviteInput, setInviteInput] = useState<string>('');

  const equippedTitle =
    COSMETIC_TITLES.find((t) => t.id === meta.equippedTitleId)?.label ?? '초보 수호자';
  const selectedMission =
    MISSION_CATALOG.find((m) => m.id === selectedMissionId) ?? MISSION_CATALOG[0];

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = inviteInput.trim().toUpperCase();
    if (!cleaned) return;
    onJoinCoopRoom(cleaned);
  };

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-gradient-to-br from-slate-950 via-[#102016] to-slate-900 text-white flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl space-y-6">
        {/* 상단 헤더 & 프로필 요약 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-emerald-500/30 rounded-3xl p-5 shadow-2xl">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🏝️</span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-300">
                TINY ISLES
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                1~4인 인스턴스 원정
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              자원을 채집하고 방어선을 구축해 마물 군단으로부터 섬을 지켜내세요.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-black/40 border border-white/10 rounded-2xl px-3.5 py-2 text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs font-bold">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    playerColor === 'blue' ? 'bg-blue-400' : 'bg-red-400'
                  }`}
                />
                <span>{playerName}</span>
                <span className="text-amber-300">[{equippedTitle}]</span>
              </div>
              <div className="text-xs text-emerald-300 font-semibold mt-0.5">
                ✨ 별의 파편 {meta.points}P · 클리어 {meta.totalClears}회
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenMetaModal}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-bold transition active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>특성 · 칭호</span>
            </button>
          </div>
        </div>

        {/* 미션 선택 */}
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>원정 미션 선택 (30분~1시간)</span>
            </h2>
            <span className="text-xs text-slate-400">
              난이도에 따라 보상 배율 적용
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MISSION_CATALOG.map((mission) => {
              const active = mission.id === selectedMissionId;
              const cleared = meta.clearedMissionIds.includes(mission.id);
              return (
                <button
                  key={mission.id}
                  type="button"
                  onClick={() => setSelectedMissionId(mission.id)}
                  className={`text-left p-4 rounded-2xl border transition flex flex-col justify-between gap-2 ${
                    active
                      ? 'bg-emerald-500/15 border-emerald-400 shadow-lg shadow-emerald-950/50'
                      : 'bg-black/30 border-white/10 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-white">{mission.title}</span>
                      {cleared && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                          CLEARED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-300 mt-0.5">{mission.subtitle}</p>
                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {mission.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-white/10">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {mission.estimatedMinutes}
                    </span>
                    <span className="font-bold text-amber-300">
                      기본 {mission.baseRewardPoints}P
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 난이도 선택 */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {(['normal', 'hard', 'nightmare'] as RoomDifficultyId[]).map((diffId) => {
              const cfg = MISSION_DIFFICULTIES[diffId];
              const active = selectedDifficulty === diffId;
              return (
                <button
                  key={diffId}
                  type="button"
                  onClick={() => setSelectedDifficulty(diffId)}
                  className={`p-3 rounded-2xl border text-left transition ${
                    active
                      ? 'bg-amber-500/20 border-amber-400 text-amber-100'
                      : 'bg-black/30 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span>{cfg.label}</span>
                    <span className="text-amber-300">x{cfg.rewardMultiplier.toFixed(1)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{cfg.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 실행 액션: 솔플 즉시 시작 / 코옵 방 개설 / 초대 코드 입장 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onStartSolo(selectedMission.id, selectedDifficulty)}
            className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] font-bold text-sm shadow-lg transition"
          >
            <Play className="w-5 h-5 fill-current" />
            <div className="text-left">
              <div>솔로 플레이 즉시 시작</div>
              <div className="text-[11px] font-normal text-emerald-100">오프라인 · ESC 일시정지</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onCreateCoopRoom(selectedMission.id, selectedDifficulty)}
            className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] font-bold text-sm shadow-lg transition"
          >
            <Users className="w-5 h-5" />
            <div className="text-left">
              <div>코옵 방 만들기 (1~4인)</div>
              <div className="text-[11px] font-normal text-blue-100">초대 코드 & 링크 생성</div>
            </div>
          </button>

          <form
            onSubmit={handleJoinSubmit}
            className="flex items-center gap-2 p-3 rounded-2xl bg-slate-900/90 border border-white/15"
          >
            <KeyRound className="w-5 h-5 text-amber-400 shrink-0 ml-1" />
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="초대 코드 (6자리)"
              className="w-full bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-xs font-bold tracking-widest uppercase text-white outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shrink-0 transition"
            >
              참가
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
