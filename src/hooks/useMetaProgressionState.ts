import { useCallback, useMemo, useState } from 'react';
import {
  AURA_DEFINITIONS,
  COSMETIC_TITLES,
  COSTUME_DEFINITIONS,
  DEFAULT_META_PROGRESSION,
  TRAIT_DEFINITIONS,
  calculateRefundableTraitPoints,
  computeMetaBonuses,
  getTraitUpgradeCost,
} from '../data/metaProgression';
import { saveRepository } from '../lib/repositories/LocalStorageSaveRepository';
import {
  AuraEffectId,
  CostumeId,
  MetaProgressionState,
  MissionResultPayload,
  TraitId,
} from '../types/room';

/**
 * 메타 성장(별의 파편, 특성, 칭호, 코스튬, 오라) 상태 관리 훅
 */
export function useMetaProgressionState() {
  const [meta, setMeta] = useState<MetaProgressionState>(() =>
    saveRepository.loadMetaProgression()
  );
  const metaBonuses = useMemo(() => computeMetaBonuses(meta), [meta]);

  const applyMissionResultReward = useCallback((result: MissionResultPayload) => {
    setMeta((prev) => {
      const nextTitles =
        result.unlockedTitleId && !prev.unlockedTitleIds.includes(result.unlockedTitleId)
          ? [...prev.unlockedTitleIds, result.unlockedTitleId]
          : prev.unlockedTitleIds;
      const nextCleared =
        result.victory &&
        (result.contribution?.isQualified ?? true) &&
        !prev.clearedMissionIds.includes(result.missionId)
          ? [...prev.clearedMissionIds, result.missionId]
          : prev.clearedMissionIds;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points + result.earnedPoints,
        totalClears:
          result.victory && (result.contribution?.isQualified ?? true)
            ? prev.totalClears + 1
            : prev.totalClears,
        unlockedTitleIds: nextTitles,
        clearedMissionIds: nextCleared,
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleUpgradeTrait = useCallback((traitId: TraitId) => {
    const def = TRAIT_DEFINITIONS.find((t) => t.id === traitId);
    if (!def) return;
    setMeta((prev) => {
      const lv = prev.traitLevels[traitId] ?? 0;
      if (lv >= def.maxLevel) return prev;
      const cost = getTraitUpgradeCost(def, lv);
      if (prev.points < cost) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - cost,
        traitLevels: { ...prev.traitLevels, [traitId]: lv + 1 },
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleSelectOrUnlockTitle = useCallback((titleId: string) => {
    const def = COSMETIC_TITLES.find((t) => t.id === titleId);
    if (!def) return;
    setMeta((prev) => {
      if (prev.unlockedTitleIds.includes(titleId)) {
        const next = { ...prev, equippedTitleId: titleId };
        saveRepository.saveMetaProgression(next);
        return next;
      }
      if (prev.points < def.costPoints) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - def.costPoints,
        unlockedTitleIds: [...prev.unlockedTitleIds, titleId],
        equippedTitleId: titleId,
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleSelectOrUnlockCostume = useCallback((costumeId: CostumeId) => {
    const def = COSTUME_DEFINITIONS.find((c) => c.id === costumeId);
    if (!def) return;
    setMeta((prev) => {
      if (prev.unlockedCostumeIds.includes(costumeId)) {
        const next: MetaProgressionState = { ...prev, equippedCostumeId: costumeId };
        saveRepository.saveMetaProgression(next);
        return next;
      }
      if (prev.points < def.costPoints) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - def.costPoints,
        unlockedCostumeIds: [...prev.unlockedCostumeIds, costumeId],
        equippedCostumeId: costumeId,
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleSelectOrUnlockAura = useCallback((auraId: AuraEffectId) => {
    const def = AURA_DEFINITIONS.find((a) => a.id === auraId);
    if (!def) return;
    setMeta((prev) => {
      if (prev.unlockedAuraIds.includes(auraId)) {
        const next: MetaProgressionState = { ...prev, equippedAuraId: auraId };
        saveRepository.saveMetaProgression(next);
        return next;
      }
      if (prev.points < def.costPoints) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points - def.costPoints,
        unlockedAuraIds: [...prev.unlockedAuraIds, auraId],
        equippedAuraId: auraId,
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleResetTraits = useCallback(() => {
    setMeta((prev) => {
      const refund = calculateRefundableTraitPoints(prev);
      if (refund <= 0) return prev;
      const next: MetaProgressionState = {
        ...prev,
        points: prev.points + refund,
        traitLevels: { ...DEFAULT_META_PROGRESSION.traitLevels },
      };
      saveRepository.saveMetaProgression(next);
      return next;
    });
  }, []);

  const handleApplyMetaProgression = useCallback((nextMeta: MetaProgressionState) => {
    saveRepository.saveMetaProgression(nextMeta);
    setMeta(nextMeta);
  }, []);

  return {
    meta,
    metaBonuses,
    applyMissionResultReward,
    handleUpgradeTrait,
    handleSelectOrUnlockTitle,
    handleSelectOrUnlockCostume,
    handleSelectOrUnlockAura,
    handleResetTraits,
    handleApplyMetaProgression,
  };
}
