import { SavedProfile } from '../lib/storage';
import { MetaProgressionState } from './metaProgression';

/** 지원하는 소셜 로그인 / 계정 연동 제공자 */
export type SocialAuthProvider = 'google' | 'kakao';

/** Supabase Auth 계정에 연결된 개별 소셜 아이덴티티 정보 */
export interface LinkedIdentityInfo {
  provider: SocialAuthProvider;
  identityId: string;
  email?: string;
  displayName?: string;
  linkedAt?: string;
}

/** UI 및 동기화 레이어에서 사용하는 표준 로그인 유저 요약 정보 */
export interface AuthUserSummary {
  userId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  providers: SocialAuthProvider[];
  identities: LinkedIdentityInfo[];
}

/** 클라우드와 로컬 간 동기화되는 계정 세이브 스냅샷 */
export interface AccountSaveSnapshot {
  profile: SavedProfile;
  meta: MetaProgressionState;
  updatedAt: string;
  legacyGuestId?: string;
}

/** 충돌 모달 및 요약 UI에서 보여줄 핵심 진행도 요약 */
export interface AccountProgressSummary {
  name: string;
  color: SavedProfile['color'];
  points: number;
  totalClears: number;
  totalTraitLevels: number;
  clearedMissionCount: number;
  unlockedCosmeticCount: number;
  updatedAt: string;
}

/** 로컬 게스트 데이터와 클라우드 계정 데이터 충돌 시 선택 옵션 */
export type AccountConflictResolution = 'use_local' | 'use_cloud' | 'merge';

/** 계정 동기화 상태 */
export type AccountSyncStatus = 'idle' | 'loading' | 'syncing' | 'conflict' | 'error';

/** 충돌 해결 모달 표시용 상태 */
export interface AccountConflictState {
  local: AccountSaveSnapshot;
  cloud: AccountSaveSnapshot;
  mergedPreview: AccountSaveSnapshot;
}

/** 소셜 제공자 UI 메타데이터 */
export interface AuthProviderMeta {
  id: SocialAuthProvider;
  label: string;
  shortLabel: string;
  description: string;
  bgClass: string;
  hoverBgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
}
