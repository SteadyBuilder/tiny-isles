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
