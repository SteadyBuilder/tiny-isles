import React, { useState, useEffect } from 'react';
import {
  BuildingCategory,
  ConstructableType,
  ConstructedBuilding,
  Inventory,
  Island,
  VillageTier,
} from '../types/game';
import {
  CONSTRUCTABLE_BLUEPRINTS,
  VILLAGE_TIER_CONFIGS,
} from '../game/constants';
import { Shield, Hammer, Sparkles, Heart, AlertTriangle, ArrowUpCircle } from 'lucide-react';

interface VillageBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  territories: Island[];
  selectedTerritoryId: number;
  onSelectTerritory: (id: number) => void;
  constructedBuildings: ConstructedBuilding[];
  inventory: Inventory;
  onUpgradeVillage: (territoryId: number) => void;
  onConstructBuilding: (territoryId: number, type: ConstructableType) => void;
  onRepairCore: (territoryId: number) => void;
  onTestDestroyCore?: (territoryId: number) => void;
}

const ALL_TIERS: VillageTier[] = [0, 1, 2, 3, 4, 5, 6];

const BUILDING_SPRITE_SRC: Record<string, string> = {
  woodPalisade: '/assets/buildings/Wood_Palisade.png',
  castle: '/assets/buildings/Castle.png',
  house1: '/assets/buildings/House1.png',
  house2: '/assets/buildings/House2.png',
  house3: '/assets/buildings/House3.png',
  tower: '/assets/buildings/Tower.png',
  barracks: '/assets/buildings/Barracks.png',
  archery: '/assets/buildings/Archery.png',
  monastery: '/assets/buildings/Monastery.png',
};

export const VillageBuildModal: React.FC<VillageBuildModalProps> = ({
  isOpen,
  onClose,
  territories,
  selectedTerritoryId,
  onSelectTerritory,
  constructedBuildings,
  inventory,
  onUpgradeVillage,
  onConstructBuilding,
  onRepairCore,
  onTestDestroyCore,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | BuildingCategory>('all');

  const unlockedTerritories = territories.filter((t) => t.unlocked);
  const currentTerritory =
    unlockedTerritories.find((t) => t.id === selectedTerritoryId) ||
    unlockedTerritories[0] ||
    territories[0];

  useEffect(() => {
    if (isOpen && !currentTerritory?.unlocked && unlockedTerritories.length > 0) {
      onSelectTerritory(unlockedTerritories[0].id);
    }
  }, [isOpen, currentTerritory, unlockedTerritories, onSelectTerritory]);

  if (!isOpen || !currentTerritory) return null;

  const tierCfg = VILLAGE_TIER_CONFIGS[currentTerritory.villageTier];
  const nextTier =
    currentTerritory.villageTier < 6
      ? ((currentTerritory.villageTier + 1) as VillageTier)
      : null;
  const nextTierCfg = nextTier !== null ? VILLAGE_TIER_CONFIGS[nextTier] : null;

  const canAffordUpgrade =
    nextTierCfg !== null &&
    inventory.wood >= nextTierCfg.costWood &&
    inventory.stone >= nextTierCfg.costStone &&
    inventory.gold >= nextTierCfg.costGold;

  const territoryBuildings = constructedBuildings.filter(
    (b) => b.territoryId === currentTerritory.id
  );

  const filteredBlueprints =
    selectedCategory === 'all'
      ? CONSTRUCTABLE_BLUEPRINTS
      : CONSTRUCTABLE_BLUEPRINTS.filter((b) => b.category === selectedCategory);

  const coreHpPercent = Math.round(
    (Math.max(0, currentTerritory.coreHp) / Math.max(1, currentTerritory.coreMaxHp)) * 100
  );

  return (
    <div
      id="village-build-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-[#111c2d] border-2 border-amber-500/50 rounded-3xl p-4 sm:p-6 shadow-2xl text-white flex flex-col max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 rounded-xl text-amber-300 border border-amber-400/30">
              <Hammer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-xl font-black text-amber-300">
                🏘️ 마을 발전 & 방어 기지 건설
              </h2>
              <p className="text-xs text-slate-300">
                점령한 땅에 마을을 세우고(중소마을→큰마을→소도시→중소도시→대도시) 방어타워·성벽·기본/특수건물을 건설하세요.
              </p>
            </div>
          </div>
          <button
            id="close-village-modal-btn"
            onClick={onClose}
            className="relative w-8 h-8 active:scale-90 transition-transform flex items-center justify-center shrink-0"
            title="닫기"
          >
            <img
              src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png"
              alt="close"
              className="w-full h-full pixel-art select-none"
            />
            <img
              src="/assets/ui/Icons/Icon_09.png"
              alt="x"
              className="absolute w-3.5 h-3.5 pixel-art"
            />
          </button>
        </div>

        {/* Occupied Territory Selector Tabs */}
        <div className="mt-3 flex flex-wrap items-center gap-2 pb-1 shrink-0">
          <span className="text-xs font-bold text-slate-400 shrink-0">점령한 땅 선택:</span>
          {unlockedTerritories.map((t) => {
            const active = t.id === currentTerritory.id;
            const tCfg = VILLAGE_TIER_CONFIGS[t.villageTier];
            return (
              <button
                key={t.id}
                id={`select-territory-tab-${t.id}`}
                onClick={() => onSelectTerritory(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md'
                    : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{t.id === 0 ? '🏰' : '🚩'}</span>
                <span>#{t.id} {t.name.split(' ')[0]}</span>
                <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] text-emerald-300">
                  {tCfg.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Core Gem Status & Village Tier Upgrade Card */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0">
          {/* Left: Core Gem Status */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-cyan-300 flex items-center gap-1">
                  💎 점령지 코어 보석 (파괴 시 땅 상실!)
                </span>
                <span className="text-xs font-bold text-white shrink-0">
                  {currentTerritory.coreHp} / {currentTerritory.coreMaxHp} HP ({coreHpPercent}%)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mt-2 border border-white/10">
                <div
                  className={`h-full transition-all duration-300 ${
                    coreHpPercent > 50
                      ? 'bg-emerald-500'
                      : coreHpPercent > 25
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${coreHpPercent}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                ⚠️ 마물 웨이브가 코어 보석을 부수면 점령한 땅과 건물을 잃게 됩니다! 성벽과 방어 타워로 코어 보석을 보호하세요.
              </p>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                id="repair-core-btn"
                onClick={() => onRepairCore(currentTerritory.id)}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/45 border border-emerald-400/50 text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Heart className="w-3.5 h-3.5 text-emerald-400" />
                <span>코어 보석 & 방책 수리 (🪵5 🪨5)</span>
              </button>

              {currentTerritory.id !== 0 && onTestDestroyCore && (
                <button
                  id="test-destroy-core-btn"
                  onClick={() => onTestDestroyCore(currentTerritory.id)}
                  className="py-2 px-2.5 rounded-xl bg-red-600/25 hover:bg-red-600/40 border border-red-400/50 text-red-200 text-[11px] font-bold flex items-center gap-1 transition active:scale-95"
                  title="코어 보석 파괴 시 땅 상실 처리 검증"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>코어 파괴 테스트</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: Village Development Progression */}
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300">
                  📈 마을 발전 단계 ({tierCfg.badge})
                </span>
                <span className="text-[11px] text-emerald-300 font-bold">
                  건물 슬롯: {territoryBuildings.length} / {tierCfg.maxBuildings + 4}
                </span>
              </div>

              {/* 7-Stage Progression Chips */}
              <div className="mt-2 flex flex-wrap items-center gap-1">
                {ALL_TIERS.map((t) => {
                  const cfg = VILLAGE_TIER_CONFIGS[t];
                  const isCurrent = currentTerritory.villageTier === t;
                  const isPassed = currentTerritory.villageTier > t;
                  return (
                    <span
                      key={t}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${
                        isCurrent
                          ? 'bg-amber-500 text-black border-amber-200 font-black'
                          : isPassed
                          ? 'bg-emerald-900/50 text-emerald-300 border-emerald-600/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {cfg.name}
                    </span>
                  );
                })}
              </div>

              <p className="text-[11px] text-slate-300 mt-2">{tierCfg.description}</p>
            </div>

            <div className="mt-3">
              {nextTierCfg ? (
                <button
                  id="upgrade-village-btn"
                  onClick={() => onUpgradeVillage(currentTerritory.id)}
                  className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-between transition active:scale-95 border ${
                    canAffordUpgrade
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-black border-amber-200 shadow-lg'
                      : 'bg-slate-800 text-slate-300 border-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>
                      {currentTerritory.villageTier === 0
                        ? `🏡 마을 세우기 (${nextTierCfg.name})`
                        : `⬆️ '${nextTierCfg.name}'(으)로 발전`}
                    </span>
                  </span>
                  <span className="font-bold">
                    🪵{nextTierCfg.costWood} 🪨{nextTierCfg.costStone}
                    {nextTierCfg.costGold > 0 ? ` 🪙${nextTierCfg.costGold}` : ''}
                  </span>
                </button>
              ) : (
                <div className="w-full py-2 text-center rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-black">
                  👑 최고 발전 단계 (대도시) 달성 완료!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Built Defenses & Buildings in this Territory */}
        <div className="mt-3 bg-black/35 border border-white/10 rounded-2xl p-3 shrink-0">
          <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
            <span>
              🛡️ [{currentTerritory.name}] 배치된 방어 시설 및 건물 ({territoryBuildings.length}개)
            </span>
            {currentTerritory.id === 0 && (
              <span className="text-[11px] text-amber-300 font-semibold">
                ✨ 중심 마을 기본 혜택: 중소마을 + 나무 방책 4방면 배치됨
              </span>
            )}
          </div>
          {territoryBuildings.length === 0 ? (
            <p className="text-xs text-slate-400">
              아직 건설된 건물이 없습니다. 아래에서 방어 타워, 성벽, 기본건물, 특수건물을 건설하세요!
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {territoryBuildings.map((b) => {
                const bp = CONSTRUCTABLE_BLUEPRINTS.find((x) => x.type === b.type);
                return (
                  <div
                    key={b.id}
                    className="px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-600/70 text-[11px] flex items-center gap-1.5"
                  >
                    {bp?.spriteKey && BUILDING_SPRITE_SRC[bp.spriteKey] ? (
                      <img
                        src={BUILDING_SPRITE_SRC[bp.spriteKey]}
                        alt={b.name}
                        className="w-4 h-4 object-contain"
                      />
                    ) : (
                      <span>{bp?.icon || '🏗️'}</span>
                    )}
                    <span className="font-bold text-white">{b.name}</span>
                    <span className="text-emerald-300 font-mono text-[10px]">
                      HP {b.hp}/{b.maxHp}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Construction Category Filter (방어 타워 / 성벽 / 기본건물 / 특수건물) */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pb-1 shrink-0">
          {[
            { key: 'all', label: '전체 건물 (10)' },
            { key: 'tower', label: '🏹 방어 타워' },
            { key: 'wall', label: '🪵 성벽 / 방책' },
            { key: 'basic', label: '🏠 기본건물' },
            { key: 'special', label: '✨ 특수건물' },
          ].map((cat) => (
            <button
              key={cat.key}
              id={`filter-cat-${cat.key}`}
              onClick={() => setSelectedCategory(cat.key as 'all' | BuildingCategory)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 ${
                selectedCategory === cat.key
                  ? 'bg-teal-600 text-white border-teal-300 shadow'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Blueprints Grid */}
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
          {filteredBlueprints.map((bp) => {
            const affordable =
              inventory.wood >= bp.costWood &&
              inventory.stone >= bp.costStone &&
              inventory.gold >= bp.costGold;

            return (
              <div
                key={bp.type}
                className="bg-slate-900/90 border border-white/10 rounded-2xl p-3 flex flex-col justify-between hover:border-amber-400/40 transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-center p-1 overflow-hidden shrink-0 relative">
                        {BUILDING_SPRITE_SRC[bp.spriteKey] ? (
                          <img
                            src={BUILDING_SPRITE_SRC[bp.spriteKey]}
                            alt={bp.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-xl">{bp.icon}</span>
                        )}
                        <span className="absolute bottom-0 right-0 text-[10px] leading-none bg-black/60 rounded px-0.5">
                          {bp.icon}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm text-white">{bp.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-amber-500/30 font-bold">
                            {bp.categoryLabel}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          내구도 HP {bp.maxHp}
                          {bp.attack ? ` · 공격력 ${bp.attack} · 사거리 ${bp.range}` : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{bp.description}</p>
                </div>

                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className={inventory.wood >= bp.costWood ? 'text-amber-200' : 'text-red-400'}>
                      🪵{bp.costWood}
                    </span>
                    <span className={inventory.stone >= bp.costStone ? 'text-slate-200' : 'text-red-400'}>
                      🪨{bp.costStone}
                    </span>
                    {bp.costGold > 0 && (
                      <span className={inventory.gold >= bp.costGold ? 'text-yellow-300' : 'text-red-400'}>
                        🪙{bp.costGold}
                      </span>
                    )}
                  </div>

                  <button
                    id={`build-btn-${bp.type}`}
                    onClick={() => onConstructBuilding(currentTerritory.id, bp.type)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition active:scale-95 flex items-center gap-1 ${
                      affordable
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>건설하기</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
