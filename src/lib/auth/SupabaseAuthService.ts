import type { User } from '@supabase/supabase-js';
import { AuthUserSummary, LinkedIdentityInfo, SocialAuthProvider } from '../../types/auth';
import { AuthActionResult, IAuthService } from '../contracts/IAuthService';
import { supabase } from '../supabase';

const SUPPORTED_PROVIDERS: ReadonlySet<string> = new Set<SocialAuthProvider>(['google', 'kakao']);

function isSupportedProvider(value: string | undefined): value is SocialAuthProvider {
  return typeof value === 'string' && SUPPORTED_PROVIDERS.has(value);
}

function getDefaultRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
}

function formatAuthError(rawMessage: string | undefined): string {
  if (!rawMessage) return '계정 연동 중 알 수 없는 오류가 발생했습니다.';
  const lower = rawMessage.toLowerCase();
  if (lower.includes('provider is not enabled') || lower.includes('unsupported provider')) {
    return '해당 소셜 로그인 제공자가 Supabase 대시보드에 아직 활성화되지 않았습니다.';
  }
  if (lower.includes('identity_already_exists') || lower.includes('already linked')) {
    return '이 소셜 계정은 이미 다른 계정에 연동되어 있습니다.';
  }
  if (lower.includes('manual linking is disabled')) {
    return '추가 소셜 계정 연결을 위해 Supabase Auth 설정에서 Manual Linking을 활성화해 주세요.';
  }
  return rawMessage;
}

function mapSupabaseUser(user: User | null): AuthUserSummary | null {
  if (!user) return null;

  const rawIdentities = Array.isArray(user.identities) ? user.identities : [];
  const identities: LinkedIdentityInfo[] = [];

  for (const identity of rawIdentities) {
    if (!isSupportedProvider(identity.provider)) continue;
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

  const providers = Array.from(new Set(identities.map((item) => item.provider)));
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
 * Supabase Auth 기반 Google / Kakao 소셜 로그인 및 다중 계정 연동 구현체
 */
export class SupabaseAuthService implements IAuthService {
  public async getCurrentUser(): Promise<AuthUserSummary | null> {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return mapSupabaseUser(data.user);
    } catch {
      return null;
    }
  }

  public onAuthStateChange(listener: (user: AuthUserSummary | null) => void): () => void {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      listener(mapSupabaseUser(session?.user ?? null));
    });
    return () => subscription.unsubscribe();
  }

  public async signInWithProvider(
    provider: SocialAuthProvider,
    redirectTo?: string
  ): Promise<AuthActionResult> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectTo || getDefaultRedirectUrl(),
        },
      });
      if (error) {
        return { ok: false, error: formatAuthError(error.message) };
      }
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: formatAuthError(e instanceof Error ? e.message : undefined),
      };
    }
  }

  public async linkProvider(
    provider: SocialAuthProvider,
    redirectTo?: string
  ): Promise<AuthActionResult> {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: {
          redirectTo: redirectTo || getDefaultRedirectUrl(),
        },
      });
      if (error) {
        return { ok: false, error: formatAuthError(error.message) };
      }
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: formatAuthError(e instanceof Error ? e.message : undefined),
      };
    }
  }

  public async signOut(): Promise<AuthActionResult> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { ok: false, error: formatAuthError(error.message) };
      }
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: formatAuthError(e instanceof Error ? e.message : undefined),
      };
    }
  }
}

export const authService: IAuthService = new SupabaseAuthService();
