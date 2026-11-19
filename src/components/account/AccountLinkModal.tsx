import React from 'react';
import { AUTH_PROVIDERS, AUTH_PROVIDER_MAP } from '../../data/authProviders';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { sound } from '../../lib/sound';
import { AccountSyncStatus, AuthUserSummary, SocialAuthProvider } from '../../types/auth';
import { MetaProgressionState } from '../../types/metaProgression';
import { PixelGameButton } from '../ui/PixelGameButton';
import { WoodModalFrame } from '../ui/WoodModalFrame';
import { ProviderBrandIcon } from './ProviderBrandIcon';

interface AccountLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  meta: MetaProgressionState;
  user: AuthUserSummary | null;
  syncStatus: AccountSyncStatus;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  statusMessage: string | null;
  onConnectProvider: (provider: SocialAuthProvider) => void;
  onSyncNow: () => void;
  onSignOut: () => void;
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return '아직 동기화 기록 없음';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '동기화 완료';
  return date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AccountLinkModal: React.FC<AccountLinkModalProps> = ({
  isOpen,
  onClose,
  playerName,
  meta,
  user,
  syncStatus,
  lastSyncedAt,
  errorMessage,
  statusMessage,
  onConnectProvider,
  onSyncNow,
  onSignOut,
}) => {
  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  const isBusy = syncStatus === 'loading' || syncStatus === 'syncing';

  return (
    <WoodModalFrame
      title="계정 연동 & 클라우드 저장"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-md"
      onClose={onClose}
      headerRight={
        <span className="text-[11px] font-black text-[#fef3c7] pixel-btn-shadow">
          {user ? '연동 완료' : '게스트 모드'}
        </span>
      }
    >
      {/* Current Account Status */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-[#3a200f] truncate">{playerName}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-black border ${
                  user
                    ? 'bg-[#dcfce7] text-[#166534] border-[#16a34a]'
                    : 'bg-[#fef3c7] text-[#92400e] border-[#d97706]'
                }`}
              >
                {user ? '클라우드 보호 중' : '게스트 (기기 저장)'}
              </span>
            </div>
            {user && (
              <p className="text-[11px] font-bold text-[#6e4625] truncate mt-0.5">
                {user.email || user.displayName || '소셜 계정 연동됨'}
              </p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] font-black text-[#7c2d12]">✨ {meta.points}P</div>
            <div className="text-[10px] font-bold text-[#6e4625]">클리어 {meta.totalClears}회</div>
          </div>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-[#c4a276]">
            <div className="flex flex-wrap items-center gap-1">
              {user.providers.map((providerId) => {
                const providerMeta = AUTH_PROVIDER_MAP[providerId];
                return (
                  <span
                    key={providerId}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${providerMeta.badgeClass}`}
                  >
                    <ProviderBrandIcon provider={providerId} className="w-3 h-3" />
                    <span>{providerMeta.shortLabel} 연동됨</span>
                  </span>
                );
              })}
            </div>
            <span className="text-[10px] font-bold text-[#6e4625]">
              최근 저장: {formatSyncTime(lastSyncedAt)}
            </span>
          </div>
        ) : (
          <p className="text-[11px] font-bold text-[#5c3c24] leading-relaxed pt-1 border-t border-[#c4a276]">
            구글 또는 카카오톡 계정을 연동하면 현재 기기의 <strong>별의 파편·특성·칭호·코스튬·클리어 기록</strong>을
            그대로 이어가며 다른 기기에서도 플레이할 수 있습니다.
          </p>
        )}
      </div>

      {/* Feedback Banners */}
      {statusMessage && (
        <div className="rounded-lg border-2 border-[#15803d] bg-[#dcfce7] px-2.5 py-2 text-[11px] font-black text-[#166534]">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="rounded-lg border-2 border-[#b91c1c] bg-[#fee2e2] px-2.5 py-2 text-[11px] font-black text-[#991b1b]">
          {errorMessage}
        </div>
      )}

      {/* Provider Connect / Link Buttons */}
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="text-xs font-black text-[#3a200f]">
          {user ? '소셜 계정 연동 관리' : '기존 정보를 이어갈 계정 선택'}
        </div>

        <div className="flex flex-col gap-2">
          {AUTH_PROVIDERS.map((provider) => {
            const isLinked = user?.providers.includes(provider.id) ?? false;
            const buttonLabel = isLinked
              ? `${provider.shortLabel} 계정 연동 완료`
              : user
                ? `${provider.shortLabel} 계정 추가 연동`
                : provider.label;

            return (
              <button
                key={provider.id}
                type="button"
                disabled={isBusy || isLinked}
                onClick={() => {
                  sound.playClick();
                  onConnectProvider(provider.id);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-black transition active:scale-[0.99] disabled:opacity-65 disabled:cursor-not-allowed ${provider.bgClass} ${provider.hoverBgClass} ${provider.textClass} ${provider.borderClass}`}
              >
                <span className="flex items-center gap-2">
                  <ProviderBrandIcon provider={provider.id} className="w-4 h-4" />
                  <span>{buttonLabel}</span>
                </span>
                <span className="text-[10px] font-extrabold opacity-80">
                  {isLinked ? '✓ 연결됨' : isBusy ? '처리 중...' : '연동 →'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions for Linked User */}
      {user && (
        <div className="grid grid-cols-2 gap-2">
          <PixelGameButton
            label={syncStatus === 'syncing' ? '동기화 중...' : '지금 동기화'}
            variant="blue"
            size="sm"
            fullWidth
            disabled={isBusy}
            onClick={() => {
              sound.playClick();
              onSyncNow();
            }}
          />
          <PixelGameButton
            label="로그아웃"
            variant="red"
            size="sm"
            fullWidth
            disabled={isBusy}
            onClick={() => {
              sound.playClick();
              onSignOut();
            }}
          />
        </div>
      )}
    </WoodModalFrame>
  );
};
