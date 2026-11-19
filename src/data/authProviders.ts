import { AuthProviderMeta, SocialAuthProvider } from '../types/auth';

/**
 * 지원하는 소셜 계정 연동 제공자 메타데이터 (Data-Driven)
 */
export const AUTH_PROVIDERS: ReadonlyArray<AuthProviderMeta> = [
  {
    id: 'google',
    label: 'Google 계정으로 연동',
    shortLabel: 'Google',
    description: '구글 계정으로 진행 데이터를 안전하게 백업하고 이어갑니다.',
    bgClass: 'bg-[#ffffff]',
    hoverBgClass: 'hover:bg-[#f8fafc]',
    textClass: 'text-[#1f2937]',
    borderClass: 'border-[#cbd5e1]',
    badgeClass: 'bg-[#eff6ff] text-[#1d4ed8] border-[#93c5fd]',
  },
  {
    id: 'kakao',
    label: '카카오톡으로 연동',
    shortLabel: '카카오톡',
    description: '카카오 계정으로 간편하게 로그인하고 기존 정보를 이어갑니다.',
    bgClass: 'bg-[#FEE500]',
    hoverBgClass: 'hover:bg-[#f5dc00]',
    textClass: 'text-[#191919]',
    borderClass: 'border-[#d4b800]',
    badgeClass: 'bg-[#fef9c3] text-[#713f12] border-[#eab308]',
  },
];

export const AUTH_PROVIDER_MAP: Record<SocialAuthProvider, AuthProviderMeta> = {
  google: AUTH_PROVIDERS[0],
  kakao: AUTH_PROVIDERS[1],
};

/** OAuth 로그인/연동 직후 리다이렉트 복귀 시 상태를 판별하기 위한 세션 키 */
export const ACCOUNT_SYNC_STORAGE_KEYS = {
  SYNCED_USER_ID: 'tiny_isles_synced_user_id',
  LOCAL_UPDATED_AT: 'tiny_isles_local_save_updated_at',
  PENDING_OAUTH_INTENT: 'tiny_isles_pending_oauth_intent',
} as const;
