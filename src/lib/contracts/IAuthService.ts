import { AuthUserSummary, SocialAuthProvider } from '../../types/auth';

export interface AuthActionResult {
  ok: boolean;
  error?: string;
}

/**
 * 소셜 인증 및 계정 연동 서비스 인터페이스 (Contract-First)
 * - 웹 구현체: SupabaseAuthService (Google / Kakao OAuth)
 */
export interface IAuthService {
  getCurrentUser(): Promise<AuthUserSummary | null>;
  onAuthStateChange(listener: (user: AuthUserSummary | null) => void): () => void;
  signInWithProvider(provider: SocialAuthProvider, redirectTo?: string): Promise<AuthActionResult>;
  linkProvider(provider: SocialAuthProvider, redirectTo?: string): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
}
