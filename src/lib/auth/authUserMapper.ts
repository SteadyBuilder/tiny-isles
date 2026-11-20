import type { User } from '@supabase/supabase-js';
import { AuthUserSummary, LinkedIdentityInfo, SocialAuthProvider } from '../../types/auth';

const SUPPORTED_PROVIDERS: ReadonlySet<string> = new Set<SocialAuthProvider>(['google', 'kakao']);

export function isSupportedProvider(value: unknown): value is SocialAuthProvider {
  return typeof value === 'string' && SUPPORTED_PROVIDERS.has(value);
}

/**
 * Supabase User 객체를 앱 내부 표준 AuthUserSummary로 변환하는 순수 함수.
 * - `user.identities`뿐만 아니라 `app_metadata.providers` / `app_metadata.provider`까지
 *   모두 확인하여 OAuth 직후 세션에서도 연동 제공자가 누락되지 않도록 보장합니다.
 */
export function mapSupabaseUser(user: User | null): AuthUserSummary | null {
  if (!user) return null;

  const rawIdentities = Array.isArray(user.identities) ? user.identities : [];
  const identities: LinkedIdentityInfo[] = [];
  const providerSet = new Set<SocialAuthProvider>();

  for (const identity of rawIdentities) {
    if (!isSupportedProvider(identity.provider)) continue;
    providerSet.add(identity.provider);
    const data = (identity.identity_data ?? {}) as Record<string, unknown>;
    identities.push({
      provider: identity.provider,
      identityId: identity.identity_id ?? identity.id,
      email: typeof data.email === 'string' ? data.email : undefined,
      displayName:
        typeof data.full_name === 'string'
          ? data.full_name
          : typeof data.name === 'string'
            ? data.name
            : typeof data.preferred_username === 'string'
              ? data.preferred_username
              : undefined,
      linkedAt: identity.created_at,
    });
  }

  const appMetadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  if (Array.isArray(appMetadata.providers)) {
    for (const p of appMetadata.providers) {
      if (isSupportedProvider(p)) providerSet.add(p);
    }
  }
  if (isSupportedProvider(appMetadata.provider)) {
    providerSet.add(appMetadata.provider);
  }

  const providers = Array.from(providerSet);
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : typeof metadata.preferred_username === 'string'
          ? metadata.preferred_username
          : identities[0]?.displayName;
  const avatarUrl =
    typeof metadata.avatar_url === 'string'
      ? metadata.avatar_url
      : typeof metadata.picture === 'string'
        ? metadata.picture
        : undefined;

  return {
    userId: user.id,
    email: user.email ?? identities[0]?.email,
    displayName,
    avatarUrl,
    providers,
    identities,
  };
}

/**
 * OAuth 로그인/연동 리다이렉트 복귀 URL의 query(?error=...) 또는 hash(#error=...)에서
 * 에러 메시지를 추출하고 사용자 친화적인 한국어 안내로 변환합니다.
 */
export function parseOAuthCallbackError(search: string, hash: string): string | null {
  const searchParams = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  const errorCode = searchParams.get('error') || hashParams.get('error');
  const errorDesc =
    searchParams.get('error_description') || hashParams.get('error_description') || '';

  if (!errorCode && !errorDesc) return null;

  const combined = `${errorCode ?? ''} ${errorDesc}`.toLowerCase();
  if (combined.includes('unable to exchange external code')) {
    return '소셜 인증 코드 교환에 실패했습니다. Supabase의 Client ID/Secret 오타나 공백, 또는 Redirect URI 설정을 확인해 주세요.';
  }
  if (combined.includes('access_denied')) {
    return '소셜 로그인이 취소되었거나 접근이 거부되었습니다. (Google 앱이 테스트 상태라면 테스트 사용자에 이메일이 등록되어 있어야 합니다.)';
  }
  if (combined.includes('redirect_uri_mismatch')) {
    return 'Redirect URI가 일치하지 않습니다. Google/Kakao 콘솔에 https://glupmjigierisxtzjfgn.supabase.co/auth/v1/callback 이 정확히 등록되어 있는지 확인해 주세요.';
  }
  if (combined.includes('provider is not enabled')) {
    return 'Supabase 대시보드에서 해당 소셜 로그인 제공자가 활성화되지 않았습니다.';
  }

  return `소셜 로그인에 실패했습니다: ${errorDesc || errorCode}`;
}

