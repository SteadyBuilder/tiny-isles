import React, { useEffect, useState } from 'react';
import { AUTH_PROVIDER_MAP } from '../data/authProviders';
import { AuthUserSummary } from '../types/auth';
import { PlayerColor } from '../types/game';
import { sound, SoundSettings } from '../lib/sound';
import { GameEvents } from '../game/events/gameEvents';
import { ADMIN_RESET_CONFIG } from '../data/adminReset';
import { TEST_MENU_EASTER_EGG_CONFIG } from '../data/testMenuEasterEgg';
import { useMultiClickTrigger } from '../hooks/useMultiClickTrigger';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import { AdminResetEasterEggModal } from './AdminResetEasterEggModal';
import { WoodModalFrame } from './ui/WoodModalFrame';
import { PixelGameButton } from './ui/PixelGameButton';
import { PixelSquareButton } from './ui/PixelSquareButton';
import { PixelRangeSlider } from './ui/PixelRangeSlider';

interface HudSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerColor: PlayerColor;
  setPlayerColor: (color: PlayerColor) => void;
  soundSettings: SoundSettings;
  isMuted: boolean;
  onToggleSound: () => void;
  onOpenSoundModal: () => void;
  onOpenHelp: () => void;
  authUser?: AuthUserSummary | null;
  onOpenAccountModal?: () => void;
  isTestMenuVisible?: boolean;
  onToggleTestMenu?: () => void;
  hasSubModalOpen?: boolean;
}

const ZOOM_PRESETS: ReadonlyArray<number> = [0.75, 1.0, 1.25, 1.5];

export const HudSettingsModal: React.FC<HudSettingsModalProps> = ({
  isOpen,
  onClose,
  playerName,
  setPlayerName,
  playerColor,
  setPlayerColor,
  soundSettings,
  isMuted,
  onToggleSound,
  onOpenSoundModal,
  onOpenHelp,
  authUser = null,
  onOpenAccountModal,
  isTestMenuVisible = false,
  onToggleTestMenu,
  hasSubModalOpen = false,
}) => {
  const [tempName, setTempName] = useState(playerName);
  const [selectedZoom, setSelectedZoom] = useState<number>(1.0);
  const [showAdminReset, setShowAdminReset] = useState(false);

  useEffect(() => {
    setTempName(playerName);
  }, [playerName]);

  useEscapeToClose(isOpen && !showAdminReset && !hasSubModalOpen, onClose);

  const handleSecretTitleClick = useMultiClickTrigger({
    requiredClicks: ADMIN_RESET_CONFIG.requiredClicks,
    clickWindowMs: ADMIN_RESET_CONFIG.clickWindowMs,
    isActive: isOpen,
    onTrigger: () => setShowAdminReset(true),
  });

  const handleSecretTestMenuClick = useMultiClickTrigger({
    requiredClicks: TEST_MENU_EASTER_EGG_CONFIG.requiredClicks,
    clickWindowMs: TEST_MENU_EASTER_EGG_CONFIG.clickWindowMs,
    isActive: isOpen,
    onTrigger: () => {
      sound.playClick();
      onToggleTestMenu?.();
    },
  });

  if (!isOpen) return null;

  const isRed = playerColor === 'red';
  const avatarSrc = isRed
    ? '/assets/ui/Human Avatars/Avatars_06.png'
    : '/assets/ui/Human Avatars/Avatars_01.png';

  const commitName = () => {
    setPlayerName(tempName.trim() || '수호자');
  };

  return (
    <>
      <WoodModalFrame
        title="게임 설정 & 메뉴"
        ribbonVariant="blue"
        frameVariant="wood"
        maxWidthClass="max-w-md"
        onClose={onClose}
        onTitleClick={handleSecretTitleClick}
        headerRight={
          <div className="flex items-center gap-1.5 text-[11px] font-black text-[#fef3c7] pixel-btn-shadow">
            <img src="/assets/ui/Icons/Icon_10.png" alt="" className="w-4 h-4 pixel-art" />
            <span>수호자 환경설정</span>
          </div>
        }
      >
        {/* Guardian Profile Sheet */}
        <div className="ts-paper-sheet p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-[#3a200f] flex items-center gap-1.5">
              <img src="/assets/ui/Icons/Icon_06.png" alt="" className="w-4 h-4 pixel-art" />
              <span>내 수호자 프로필</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                isRed
                  ? 'bg-[#fee2e2] text-[#991b1b] border-[#dc2626]'
                  : 'bg-[#dbeafe] text-[#1e40af] border-[#2563eb]'
              }`}
            >
              {isRed ? '홍기사단' : '청기사단'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <PixelSquareButton
              variant={isRed ? 'red' : 'blue'}
              size="md"
              iconSrc={avatarSrc}
              iconClassName="w-7 h-7 object-contain"
              alt="기사단 진영 전환"
              title="클릭하여 청기사단 / 홍기사단 전환"
              onClick={() => setPlayerColor(isRed ? 'blue' : 'red')}
            />
            <div className="flex-1 min-w-0 space-y-1">
              <input
                type="text"
                value={tempName}
                maxLength={10}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitName();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full px-2.5 py-1 rounded-lg bg-[#fff7e6] border-2 border-[#8c5a32] text-[#2b1810] text-sm font-black outline-none focus:border-[#2563eb] select-text"
                placeholder="수호자 이름"
              />
              <p className="text-[10px] font-bold text-[#6e4625]">
                초상화 클릭 시 진영(청/홍) 전환
              </p>
            </div>
          </div>
        </div>

        {/* Social Account Linking & Cloud Save Sheet */}
        {onOpenAccountModal && (
          <div className="ts-paper-sheet p-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-[#3a200f]">계정 연동 & 클라우드 저장</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                  authUser
                    ? 'bg-[#dcfce7] text-[#166534] border-[#16a34a]'
                    : 'bg-[#fef3c7] text-[#92400e] border-[#d97706]'
                }`}
              >
                {authUser
                  ? `✓ ${
                      authUser.providers.length > 0
                        ? authUser.providers.map((p) => AUTH_PROVIDER_MAP[p].shortLabel).join(' · ')
                        : '소셜'
                    } 연동 완료`
                  : '미연동 (게스트)'}
              </span>
            </div>
            {authUser ? (
              <div className="rounded-lg bg-[#ecfdf5] border border-[#86efac] px-2 py-1.5 space-y-0.5">
                <p className="text-[11px] font-black text-[#166534] truncate">
                  {authUser.email || authUser.displayName || '소셜 계정 연결됨'}
                </p>
                <p className="text-[10px] font-bold text-[#15803d]">
                  이미 계정이 연동되어 진행 데이터가 클라우드에 자동 저장됩니다.
                </p>
              </div>
            ) : (
              <p className="text-[10px] font-bold text-[#6e4625]">
                구글 또는 카카오톡을 연동해 기존 진행 정보를 안전하게 이어가세요.
              </p>
            )}
            <PixelGameButton
              label={authUser ? '내 연동 계정 관리 (동기화 · 로그아웃)' : '구글 / 카카오톡 계정 연동하기'}
              variant="blue"
              size="sm"
              fullWidth
              onClick={() => {
                onClose();
                onOpenAccountModal();
              }}
            />
          </div>
        )}

        {/* Audio & Volume Sheet */}
        <div className="ts-paper-sheet p-2 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-[#3a200f] flex items-center gap-1.5">
              <img src="/assets/ui/Icons/Icon_12.png" alt="" className="w-4 h-4 pixel-art" />
              <span>사운드 & 배경음악</span>
            </span>
            <button
              type="button"
              onClick={onToggleSound}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border-2 text-[11px] font-black transition active:scale-95 ${
                isMuted
                  ? 'bg-[#fee2e2] border-[#b91c1c] text-[#991b1b]'
                  : 'bg-[#dcfce7] border-[#15803d] text-[#166534]'
              }`}
            >
              <img
                src="/assets/ui/Icons/Icon_12.png"
                alt=""
                className={`w-3.5 h-3.5 pixel-art ${isMuted ? 'grayscale opacity-50' : ''}`}
              />
              <span>{isMuted ? '음소거 중' : '소리 켜짐'}</span>
            </button>
          </div>

          <div className="p-2 rounded-lg bg-[#e6cfab] border border-[#b89568] space-y-1.5">
            <PixelRangeSlider
              label="배경음악 (BGM)"
              iconSrc="/assets/ui/Icons/Icon_12.png"
              value={soundSettings.bgmVolume}
              accentVariant="amber"
              onChange={(val) => sound.setBgmVolume(val)}
            />
            <PixelRangeSlider
              label="효과음 (SFX)"
              iconSrc="/assets/ui/Icons/Icon_05.png"
              value={soundSettings.sfxVolume}
              accentVariant="emerald"
              onChange={(val) => sound.setSfxVolume(val)}
            />
          </div>

          <PixelGameButton
            label="BGM 트랙 & 효과음 테스트"
            iconSrc="/assets/ui/Icons/Icon_12.png"
            variant="blue"
            size="sm"
            fullWidth
            onClick={() => {
              onClose();
              onOpenSoundModal();
            }}
          />
        </div>

        {/* Camera Zoom Presets Sheet */}
        <div className="ts-paper-sheet p-2 space-y-1.5">
          <div
            className="text-xs font-black text-[#3a200f] select-none cursor-default flex items-center justify-between"
            onClick={handleSecretTestMenuClick}
          >
            <span className="flex items-center gap-1.5">
              <img src="/assets/ui/Icons/Icon_Compass.png" alt="" className="w-4 h-4 pixel-art" />
              <span>화면 & 카메라 줌 프리셋</span>
            </span>
            {isTestMenuVisible && (
              <span className="text-[10px] font-black text-[#b45309]">🧪 테스트 활성</span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {ZOOM_PRESETS.map((z) => {
              const active = selectedZoom === z;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setSelectedZoom(z);
                    GameEvents.emit('set-zoom', z);
                  }}
                  className={`py-1 rounded-lg border-2 text-xs font-black transition active:scale-95 ${
                    active
                      ? 'bg-[#fde68a] border-[#92400e] text-[#3a200f] shadow-inner'
                      : 'bg-[#e6cfab] border-[#b89568] text-[#5c3c24] hover:bg-[#f3e2c7]'
                  }`}
                >
                  {z}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Guide Button */}
        <PixelGameButton
          label="게임 가이드 & 조작법"
          iconSrc="/assets/ui/Icons/Icon_11.png"
          variant="red"
          size="sm"
          fullWidth
          onClick={() => {
            onClose();
            onOpenHelp();
          }}
        />
      </WoodModalFrame>

      <AdminResetEasterEggModal
        isOpen={showAdminReset}
        onClose={() => setShowAdminReset(false)}
      />
    </>
  );
};
