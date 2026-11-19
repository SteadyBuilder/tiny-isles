import React, { useEffect, useState } from 'react';
import { AUTH_PROVIDER_MAP } from '../../data/authProviders';
import { PublicRoomListing } from '../../data/dropInConfig';
import { COSMETIC_TITLES, COSTUME_DEFINITIONS } from '../../data/metaProgression';
import { sound, SoundSettings } from '../../lib/sound';
import { AuthUserSummary } from '../../types/auth';
import { PlayerColor } from '../../types/game';
import { MetaProgressionState, RoomDifficultyId } from '../../types/room';
import { PixelGameButton } from '../ui/PixelGameButton';
import { PixelRoundButton } from '../ui/PixelRoundButton';
import { LobbyDioramaCanvas } from './LobbyDioramaCanvas';
import { LobbyTitleLogo } from './LobbyTitleLogo';
import { MissionLaunchMode, MissionSelectModal } from './MissionSelectModal';
import { JoinRoomModal } from './JoinRoomModal';

interface LobbyScreenProps {
  playerName: string;
  playerColor: PlayerColor;
  meta: MetaProgressionState;
  authUser: AuthUserSummary | null;
  publicRooms: PublicRoomListing[];
  joinErrorMessage: string | null;
  onClearJoinError: () => void;
  onStartSolo: (missionId: string, difficulty: RoomDifficultyId) => void;
  onCreateCoopRoom: (missionId: string, difficulty: RoomDifficultyId) => void;
  onJoinCoopRoom: (inviteCode: string) => boolean;
  onJoinPublicRoomListing: (listing: PublicRoomListing) => boolean;
  onOpenMetaModal: () => void;
  onOpenAccountModal: () => void;
  onOpenSettingsModal: () => void;
  onOpenHelpModal: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerName,
  playerColor,
  meta,
  authUser,
  publicRooms,
  joinErrorMessage,
  onClearJoinError,
  onStartSolo,
  onCreateCoopRoom,
  onJoinCoopRoom,
  onJoinPublicRoomListing,
  onOpenMetaModal,
  onOpenAccountModal,
  onOpenSettingsModal,
  onOpenHelpModal,
}) => {
  const [missionModalMode, setMissionModalMode] = useState<MissionLaunchMode | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>(() => sound.getSettings());

  useEffect(() => {
    const unsub = sound.subscribe((next) => setSoundSettings(next));
    return () => unsub();
  }, []);

  const equippedTitle =
    COSMETIC_TITLES.find((t) => t.id === meta.equippedTitleId)?.label ?? '초보 수호자';
  const equippedCostume = COSTUME_DEFINITIONS.find((c) => c.id === meta.equippedCostumeId);
  const avatarSrc =
    equippedCostume?.avatarPath ??
    (playerColor === 'red'
      ? '/assets/ui/Human Avatars/Avatars_06.png'
      : '/assets/ui/Human Avatars/Avatars_01.png');

  const openRoomCount = publicRooms.filter((r) => r.lockReason === 'open').length;

  const handleConfirmMission = (missionId: string, difficulty: RoomDifficultyId) => {
    if (missionModalMode === 'solo') {
      setMissionModalMode(null);
      onStartSolo(missionId, difficulty);
    } else if (missionModalMode === 'coop') {
      setMissionModalMode(null);
      onCreateCoopRoom(missionId, difficulty);
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      {/* Live Animated Island Settlement Diorama */}
      <LobbyDioramaCanvas />

      {/* Center Necesse-style Title & Vertical Menu Stack */}
      <div className="relative z-10 h-full w-full flex flex-col items-center justify-center px-4 pb-20 sm:pb-8 pointer-events-none">
        <div className="w-full max-w-[300px] sm:max-w-[330px] flex flex-col items-center gap-5 pointer-events-auto">
          <LobbyTitleLogo />

          <nav className="w-full flex flex-col gap-2">
            <PixelGameButton
              label="싱글플레이"
              subtitle="1인 오프라인 원정"
              iconSrc="/assets/ui/Icons/Icon_05.png"
              variant="blue"
              size="lg"
              fullWidth
              onClick={() => setMissionModalMode('solo')}
            />
            <PixelGameButton
              label="멀티플레이 호스트"
              subtitle="1~4인 협동 방 개설"
              iconSrc="/assets/ui/Icons/Icon_06.png"
              variant="blue"
              size="md"
              fullWidth
              onClick={() => setMissionModalMode('coop')}
            />
            <PixelGameButton
              label="협동 방 탐색 · 참가"
              subtitle={
                openRoomCount > 0
                  ? `합류 가능한 공개 방 ${openRoomCount}개 · 초대 코드`
                  : '공개 방 목록 탐색 및 초대 코드 합류'
              }
              iconSrc="/assets/ui/Icons/Icon_08.png"
              variant="blue"
              size="md"
              fullWidth
              onClick={() => {
                onClearJoinError();
                setShowJoinModal(true);
              }}
            />
            <PixelGameButton
              label="별의 파편 성장소"
              subtitle={`별의 파편 ${meta.points}P · 코스튬/스탯/특화`}
              iconSrc="/assets/ui/Icons/Icon_07.png"
              variant="red"
              size="md"
              fullWidth
              onClick={onOpenMetaModal}
            />
            <PixelGameButton
              label="게임 설정"
              iconSrc="/assets/ui/Icons/Icon_10.png"
              variant="blue"
              size="sm"
              fullWidth
              onClick={onOpenSettingsModal}
            />
          </nav>
        </div>
      </div>

      {/* Bottom-Left: Guardian Profile Wood Plate (Click to open Account Link Modal) */}
      <button
        type="button"
        onClick={() => {
          sound.playClick();
          onOpenAccountModal();
        }}
        title="계정 연동 및 클라우드 저장 관리"
        className="fixed bottom-3 left-3 sm:bottom-5 sm:left-5 z-20 flex items-center gap-1.5 sm:gap-2 ts-wood-bar pr-2.5 pl-1.5 sm:pr-3.5 sm:pl-2 py-0.5 sm:py-1 max-w-[calc(100vw-10.25rem)] sm:max-w-none text-left transition hover:brightness-110 active:scale-[0.98] cursor-pointer"
      >
        <img
          src={avatarSrc}
          alt={playerName}
          className="w-8 h-8 sm:w-11 sm:h-11 object-contain pixel-art shrink-0 -ml-1 sm:-ml-2 drop-shadow"
        />
        <div className="leading-tight min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm font-black text-[#fef5df] pixel-btn-shadow min-w-0">
            <span className="truncate">{playerName}</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-[#fde68a] shrink-0 whitespace-nowrap">
              [{equippedTitle}]
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] font-bold text-[#d1fae5] pixel-btn-shadow mt-0.5 whitespace-nowrap">
            <span>✨ {meta.points}P</span>
            <span className="opacity-70">·</span>
            <span>클리어 {meta.totalClears}회</span>
            <span className="opacity-70">·</span>
            <span className={authUser ? 'text-[#86efac]' : 'text-[#fde68a]'}>
              {authUser && authUser.providers.length > 0
                ? `${authUser.providers.map((p) => AUTH_PROVIDER_MAP[p].shortLabel).join('+')} 연동`
                : '계정 연동 ↗'}
            </span>
          </div>
        </div>
      </button>

      {/* Bottom-Right: Pixel Audio / Guide / Settings Controls + Version Stamp */}
      <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-20 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <PixelRoundButton
            iconSrc="/assets/ui/Icons/Icon_12.png"
            alt="사운드 음소거 전환"
            title={soundSettings.muted ? '음소거 해제' : '음소거'}
            mutedCross={soundSettings.muted}
            iconDimmed={soundSettings.muted}
            className="!w-10 !h-10 sm:!w-11 sm:!h-11"
            onClick={() => sound.toggleMute()}
          />
          <PixelRoundButton
            iconSrc="/assets/ui/Icons/Icon_11.png"
            alt="게임 가이드"
            title="게임 가이드"
            className="!w-10 !h-10 sm:!w-11 sm:!h-11"
            onClick={onOpenHelpModal}
          />
          <PixelRoundButton
            iconSrc="/assets/ui/Icons/Icon_10.png"
            alt="설정"
            title="프로필 및 사운드 설정"
            className="!w-10 !h-10 sm:!w-11 sm:!h-11"
            onClick={onOpenSettingsModal}
          />
        </div>
        <span className="text-[10px] font-pixel-display font-bold text-[#fef5df]/85 pixel-btn-shadow tracking-wider">
          v0.1.0 · STEAM PREP
        </span>
      </div>

      {/* Sub-Modals */}
      <MissionSelectModal
        isOpen={missionModalMode !== null}
        launchMode={missionModalMode ?? 'solo'}
        clearedMissionIds={meta.clearedMissionIds}
        onClose={() => setMissionModalMode(null)}
        onConfirm={handleConfirmMission}
      />

      <JoinRoomModal
        isOpen={showJoinModal}
        publicRooms={publicRooms}
        joinErrorMessage={joinErrorMessage}
        onClearError={onClearJoinError}
        onClose={() => setShowJoinModal(false)}
        onJoinByCode={onJoinCoopRoom}
        onJoinListing={onJoinPublicRoomListing}
      />
    </div>
  );
};

