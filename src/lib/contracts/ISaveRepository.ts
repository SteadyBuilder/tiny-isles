import { SavedProfile } from '../storage';
import { MetaProgressionState } from '../../types/room';

/**
 * 플레이어 프로필 및 메타 성장 데이터 저장소 인터페이스 (Contract-First)
 * - 웹/오프라인: LocalStorageSaveRepository
 * - 스팀 출시 단계: Electron 로컬 파일 + SteamCloudSaveRepository로 교체
 */
export interface ISaveRepository {
  getPlayerId(): string;
  loadProfile(): SavedProfile;
  saveProfile(profile: SavedProfile): void;
  loadZoom(): number;
  saveZoom(zoom: number): void;
  loadMetaProgression(): MetaProgressionState;
  saveMetaProgression(state: MetaProgressionState): void;
}
