import { DEFAULT_META_PROGRESSION } from '../data/metaProgression';
import { AccountProgressSummary, AccountSaveSnapshot } from '../types/auth';
import { AuraEffectId, CostumeId, MetaProgressionState, TraitId } from '../types/metaProgression';
import { SavedProfile } from './storage';

function uniqueStrings<T extends string>(a: readonly T[], b: readonly T[]): T[] {
  return Array.from(new Set([...a, ...b]));
}

function sameStringSet(a: readonly string[], b: readonly string[]): boolean {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const item of setA) {
    if (!setB.has(item)) return false;
  }
  return true;
}

/**
 * 불완전하거나 구버전 스키마의 메타 진행 데이터를 안전하게 정규화합니다.
 */
export function normalizeMetaProgression(
  raw: Partial<MetaProgressionState> | null | undefined
): MetaProgressionState {
  const source = raw ?? {};
  const traitLevels = { ...DEFAULT_META_PROGRESSION.traitLevels };
  const rawTraits: Partial<Record<TraitId, number>> = source.traitLevels ?? {};
  for (const key of Object.keys(traitLevels) as TraitId[]) {
    const val = rawTraits[key];
    traitLevels[key] = typeof val === 'number' && Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
  }

  const unlockedTitleIds =
    Array.isArray(source.unlockedTitleIds) && source.unlockedTitleIds.length > 0
      ? uniqueStrings(DEFAULT_META_PROGRESSION.unlockedTitleIds, source.unlockedTitleIds)
      : [...DEFAULT_META_PROGRESSION.unlockedTitleIds];

  const unlockedCostumeIds =
    Array.isArray(source.unlockedCostumeIds) && source.unlockedCostumeIds.length > 0
      ? uniqueStrings(
          DEFAULT_META_PROGRESSION.unlockedCostumeIds,
          source.unlockedCostumeIds as CostumeId[]
        )
      : [...DEFAULT_META_PROGRESSION.unlockedCostumeIds];

  const unlockedAuraIds =
    Array.isArray(source.unlockedAuraIds) && source.unlockedAuraIds.length > 0
      ? uniqueStrings(
          DEFAULT_META_PROGRESSION.unlockedAuraIds,
          source.unlockedAuraIds as AuraEffectId[]
        )
      : [...DEFAULT_META_PROGRESSION.unlockedAuraIds];

  const equippedTitleId =
    typeof source.equippedTitleId === 'string' && unlockedTitleIds.includes(source.equippedTitleId)
      ? source.equippedTitleId
      : DEFAULT_META_PROGRESSION.equippedTitleId;

  const equippedCostumeId =
    typeof source.equippedCostumeId === 'string' &&
    unlockedCostumeIds.includes(source.equippedCostumeId as CostumeId)
      ? (source.equippedCostumeId as CostumeId)
      : DEFAULT_META_PROGRESSION.equippedCostumeId;

  const equippedAuraId =
    typeof source.equippedAuraId === 'string' &&
    unlockedAuraIds.includes(source.equippedAuraId as AuraEffectId)
      ? (source.equippedAuraId as AuraEffectId)
      : DEFAULT_META_PROGRESSION.equippedAuraId;

  const clearedMissionIds = Array.isArray(source.clearedMissionIds)
    ? uniqueStrings([], source.clearedMissionIds.filter((id): id is string => typeof id === 'string'))
    : [];

  return {
    points:
      typeof source.points === 'number' && Number.isFinite(source.points) && source.points > 0
        ? Math.floor(source.points)
        : 0,
    totalClears:
      typeof source.totalClears === 'number' &&
      Number.isFinite(source.totalClears) &&
      source.totalClears > 0
        ? Math.floor(source.totalClears)
        : 0,
    traitLevels,
    unlockedTitleIds,
    equippedTitleId,
    unlockedCostumeIds,
    equippedCostumeId,
    unlockedAuraIds,
    equippedAuraId,
    clearedMissionIds,
  };
}

/**
 * 기본 초기 상태 이상의 의미 있는 진행도가 있는지 판별합니다.
 */
export function hasMeaningfulProgress(meta: MetaProgressionState): boolean {
  const normalized = normalizeMetaProgression(meta);
  if (normalized.points > 0 || normalized.totalClears > 0) return true;
  if (normalized.clearedMissionIds.length > 0) return true;
  for (const key of Object.keys(normalized.traitLevels) as TraitId[]) {
    if ((normalized.traitLevels[key] ?? 0) > 0) return true;
  }
  if (normalized.unlockedTitleIds.length > DEFAULT_META_PROGRESSION.unlockedTitleIds.length) {
    return true;
  }
  if (normalized.unlockedCostumeIds.length > DEFAULT_META_PROGRESSION.unlockedCostumeIds.length) {
    return true;
  }
  if (normalized.unlockedAuraIds.length > DEFAULT_META_PROGRESSION.unlockedAuraIds.length) {
    return true;
  }
  return false;
}

/**
 * 두 메타 진행 상태가 실질적으로 동일한지 비교합니다.
 */
export function areMetaProgressionsEqual(
  a: MetaProgressionState,
  b: MetaProgressionState
): boolean {
  const na = normalizeMetaProgression(a);
  const nb = normalizeMetaProgression(b);
  if (na.points !== nb.points || na.totalClears !== nb.totalClears) return false;
  if (
    na.equippedTitleId !== nb.equippedTitleId ||
    na.equippedCostumeId !== nb.equippedCostumeId ||
    na.equippedAuraId !== nb.equippedAuraId
  ) {
    return false;
  }
  for (const key of Object.keys(DEFAULT_META_PROGRESSION.traitLevels) as TraitId[]) {
    if ((na.traitLevels[key] ?? 0) !== (nb.traitLevels[key] ?? 0)) return false;
  }
  return (
    sameStringSet(na.unlockedTitleIds, nb.unlockedTitleIds) &&
    sameStringSet(na.unlockedCostumeIds, nb.unlockedCostumeIds) &&
    sameStringSet(na.unlockedAuraIds, nb.unlockedAuraIds) &&
    sameStringSet(na.clearedMissionIds, nb.clearedMissionIds)
  );
}

/**
 * 두 계정 세이브 스냅샷(프로필 + 메타 진행도)이 동등한지 비교합니다.
 */
export function areAccountSnapshotsEquivalent(
  local: AccountSaveSnapshot,
  cloud: AccountSaveSnapshot
): boolean {
  if (local.profile.name !== cloud.profile.name || local.profile.color !== cloud.profile.color) {
    return false;
  }
  return areMetaProgressionsEqual(local.meta, cloud.meta);
}

/**
 * 로컬 게스트 진행도와 클라우드 진행도를 손실 없이 병합합니다.
 * - 포인트 / 클리어 횟수 / 각 특성 레벨: 더 높은 값(Math.max) 유지
 * - 해금된 칭호 / 코스튬 / 오라 / 클리어 미션: 합집합(Union)
 * - 장착 외형: 로컬에 기본값 외에 명시적으로 선택한 값이 있으면 로컬 우선, 아니면 클라우드 유지
 */
export function mergeMetaProgressions(
  local: MetaProgressionState,
  cloud: MetaProgressionState
): MetaProgressionState {
  const nl = normalizeMetaProgression(local);
  const nc = normalizeMetaProgression(cloud);

  const traitLevels = { ...DEFAULT_META_PROGRESSION.traitLevels };
  for (const key of Object.keys(traitLevels) as TraitId[]) {
    traitLevels[key] = Math.max(nl.traitLevels[key] ?? 0, nc.traitLevels[key] ?? 0);
  }

  const unlockedTitleIds = uniqueStrings(nc.unlockedTitleIds, nl.unlockedTitleIds);
  const unlockedCostumeIds = uniqueStrings(nc.unlockedCostumeIds, nl.unlockedCostumeIds);
  const unlockedAuraIds = uniqueStrings(nc.unlockedAuraIds, nl.unlockedAuraIds);
  const clearedMissionIds = uniqueStrings(nc.clearedMissionIds, nl.clearedMissionIds);

  const equippedTitleId =
    nl.equippedTitleId !== DEFAULT_META_PROGRESSION.equippedTitleId
      ? nl.equippedTitleId
      : nc.equippedTitleId;
  const equippedCostumeId =
    nl.equippedCostumeId !== DEFAULT_META_PROGRESSION.equippedCostumeId
      ? nl.equippedCostumeId
      : nc.equippedCostumeId;
  const equippedAuraId =
    nl.equippedAuraId !== DEFAULT_META_PROGRESSION.equippedAuraId
      ? nl.equippedAuraId
      : nc.equippedAuraId;

  return {
    points: Math.max(nl.points, nc.points),
    totalClears: Math.max(nl.totalClears, nc.totalClears),
    traitLevels,
    unlockedTitleIds,
    equippedTitleId,
    unlockedCostumeIds,
    equippedCostumeId,
    unlockedAuraIds,
    equippedAuraId,
    clearedMissionIds,
  };
}

function isDefaultGuestName(name: string): boolean {
  return /^수호자_\d{3}$/.test(name.trim());
}

/**
 * 로컬 프로필과 클라우드 프로필을 병합합니다.
 * 사용자가 직접 지은 닉네임을 기본 랜덤 닉네임(수호자_123)보다 우선합니다.
 */
export function mergeProfiles(local: SavedProfile, cloud: SavedProfile): SavedProfile {
  const localCustom = !isDefaultGuestName(local.name);
  const cloudCustom = !isDefaultGuestName(cloud.name);
  if (localCustom && !cloudCustom) {
    return { ...cloud, name: local.name, color: local.color };
  }
  return { ...local, name: cloud.name, color: cloud.color };
}

/**
 * 로컬 스냅샷과 클라우드 스냅샷을 병합한 새 스냅샷을 생성합니다.
 */
export function mergeAccountSnapshots(
  local: AccountSaveSnapshot,
  cloud: AccountSaveSnapshot,
  nowIso: string = new Date().toISOString()
): AccountSaveSnapshot {
  return {
    profile: mergeProfiles(local.profile, cloud.profile),
    meta: mergeMetaProgressions(local.meta, cloud.meta),
    updatedAt: nowIso,
    legacyGuestId: cloud.legacyGuestId ?? local.legacyGuestId,
  };
}

/**
 * 충돌 선택 모달이나 계정 요약 카드에서 보여줄 핵심 수치를 계산합니다.
 */
export function summarizeAccountSnapshot(snapshot: AccountSaveSnapshot): AccountProgressSummary {
  const meta = normalizeMetaProgression(snapshot.meta);
  const totalTraitLevels = (Object.values(meta.traitLevels) as number[]).reduce(
    (sum, lv) => sum + lv,
    0
  );
  const extraTitles = Math.max(
    0,
    meta.unlockedTitleIds.length - DEFAULT_META_PROGRESSION.unlockedTitleIds.length
  );
  const extraCostumes = Math.max(
    0,
    meta.unlockedCostumeIds.length - DEFAULT_META_PROGRESSION.unlockedCostumeIds.length
  );
  const extraAuras = Math.max(
    0,
    meta.unlockedAuraIds.length - DEFAULT_META_PROGRESSION.unlockedAuraIds.length
  );

  return {
    name: snapshot.profile.name,
    color: snapshot.profile.color,
    points: meta.points,
    totalClears: meta.totalClears,
    totalTraitLevels,
    clearedMissionCount: meta.clearedMissionIds.length,
    unlockedCosmeticCount: extraTitles + extraCostumes + extraAuras,
    updatedAt: snapshot.updatedAt,
  };
}
