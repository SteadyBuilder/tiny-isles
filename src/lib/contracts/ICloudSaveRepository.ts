import { AccountSaveSnapshot } from '../../types/auth';

/**
 * 클라우드 계정 세이브 저장소 인터페이스 (Contract-First)
 * - 웹 구현체: SupabaseCloudSaveRepository
 */
export interface ICloudSaveRepository {
  loadAccountSave(userId: string): Promise<AccountSaveSnapshot | null>;
  saveAccountSave(userId: string, snapshot: AccountSaveSnapshot): Promise<void>;
}
