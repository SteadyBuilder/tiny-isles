import { RoomMember } from '../types/room';
import { isDevBuild } from './versionGuard';

export const LEGACY_APP_VERSION = 'legacy';

export interface RoomVersionCompatibility {
  /** 모든 참여자가 호환되는 최신 버전인지 여부 */
  isCompatible: boolean;
  /** 대기실 멤버 간 버전이 서로 다른지 여부 (구버전 미전송 포함) */
  hasMemberMismatch: boolean;
  /** 현재 로컬 클라이언트가 서버 최신 버전보다 오래되었는지 여부 */
  isLocalOutdated: boolean;
  /** 기준 버전(서버 최신 또는 방장 버전)과 다른 멤버 ID 목록 */
  outdatedMemberIds: string[];
  /** 기준이 되는 목표 버전 문자열 */
  referenceVersion: string;
}

export function normalizeMemberAppVersion(version?: string): string {
  const trimmed = version?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : LEGACY_APP_VERSION;
}

/**
 * 협동 대기실 멤버들의 앱 버전 호환성을 순수 함수로 분석합니다.
 * - 배포 직전 구버전 클라이언트는 appVersion을 전송하지 않으므로 'legacy'로 분류해 불일치를 감지합니다.
 * - 개발 모드('dev')에서는 버전 불일치로 인한 차단을 비활성화합니다.
 */
export function analyzeRoomVersionCompatibility(params: {
  members: RoomMember[];
  localPlayerId: string;
  localBuildId: string;
  latestServerBuildId: string | null;
}): RoomVersionCompatibility {
  const { members, localBuildId, latestServerBuildId } = params;

  if (isDevBuild(localBuildId)) {
    return {
      isCompatible: true,
      hasMemberMismatch: false,
      isLocalOutdated: false,
      outdatedMemberIds: [],
      referenceVersion: localBuildId,
    };
  }

  const isLocalOutdated = Boolean(
    latestServerBuildId &&
      !isDevBuild(latestServerBuildId) &&
      latestServerBuildId !== localBuildId
  );

  const hostMember = members.find((m) => m.isHost);
  const hostVersion = hostMember ? normalizeMemberAppVersion(hostMember.appVersion) : null;
  const referenceVersion =
    (latestServerBuildId && !isDevBuild(latestServerBuildId) ? latestServerBuildId : null) ??
    (hostVersion && hostVersion !== LEGACY_APP_VERSION ? hostVersion : null) ??
    localBuildId;

  const outdatedMemberIds: string[] = [];
  const distinctVersions = new Set<string>();

  for (const member of members) {
    const memberVer = normalizeMemberAppVersion(member.appVersion);
    distinctVersions.add(memberVer);
    if (memberVer !== referenceVersion) {
      outdatedMemberIds.push(member.playerId);
    }
  }

  const hasMemberMismatch =
    distinctVersions.size > 1 ||
    (members.length > 0 && outdatedMemberIds.length > 0);

  return {
    isCompatible: !isLocalOutdated && !hasMemberMismatch,
    hasMemberMismatch,
    isLocalOutdated,
    outdatedMemberIds,
    referenceVersion,
  };
}
