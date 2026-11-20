import { AuthUserSummary, SocialAuthProvider } from '../../types/auth';
import { AuthActionResult, IAuthService } from '../contracts/IAuthService';
import { supabase } from '../supabase';
import { mapSupabaseUser } from './authUserMapper';

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

/**
 * Supabase Auth 기반 Google / Kakao 소셜 로그인 및 다중 계정 연동 구현체
 */
export class SupabaseAuthService implements IAuthService {
  public async getCurrentUser(): Promise<AuthUserSummary | null> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        return mapSupabaseUser(sessionData.session.user);
      }
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
