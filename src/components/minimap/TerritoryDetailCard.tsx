import React from 'react';
import { VILLAGE_TIER_CONFIGS } from '../../game/constants';
import { canBuildInTerritory } from '../../game/territoryAccessRules';
import { Inventory, Island } from '../../types/game';
import { PixelGameButton } from '../ui/PixelGameButton';

export interface TerritoryDetailCardProps {
  selectedIsland: Island;
  isUnlocked: boolean;
  canAfford: boolean;
  inventory: Inventory;
  playerId: string;
  playerStandingTerritoryId: number | null;
  onCloseModal: () => void;
  onManageTerritory?: (territoryId: number) => void;
}

export const TerritoryDetailCard: React.FC<TerritoryDetailCardProps> = ({
  selectedIsland,
  isUnlocked,
  canAfford,
  inventory,
  playerId,
  playerStandingTerritoryId,
  onCloseModal,
  onManageTerritory,
}) => {
  const selectedTierCfg = VILLAGE_TIER_CONFIGS[selectedIsland.villageTier || 0];
  const buildAccess = canBuildInTerritory(selectedIsland, playerId, playerStandingTerritoryId);

  const isCamp = Boolean(selectedIsland.isMonsterCamp);
  const campCleared = Boolean(selectedIsland.campDestroyed);

  const emblemSrc =
    selectedIsland.id === 0
      ? '/assets/buildings/Castle.png'
      : isCamp
        ? '/assets/buildings/Black_Castle.png'
        : isUnlocked
          ? '/assets/buildings/House1.png'
          : '/assets/ui/Icons/Icon_06.png';

  return (
    <div className="ts-paper-sheet p-2.5 space-y-2 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={emblemSrc}
            alt=""
            className={`w-8 h-8 object-contain pixel-art shrink-0 ${
              !isUnlocked && !isCamp ? 'opacity-65 grayscale' : ''
            }`}
          />
          <div className="min-w-0">
            <h3 className="font-black text-[#2b1810] text-xs sm:text-sm leading-snug">
              #{selectedIsland.id} {selectedIsland.name}
            </h3>
            <p className="text-[11px] font-bold text-[#6e4625] leading-snug">
              {isCamp
                ? `몬스터 부락 (Lv.${selectedIsland.campLevel || 1} · ${selectedIsland.campRing || 1}링)`
                : selectedIsland.resourceRichLabel || '마을 영지'}
              {selectedIsland.id !== 0 && isUnlocked && selectedIsland.ownerName
                ? ` · 점령: ${selectedIsland.ownerName}`
                : ''}
            </p>
          </div>
        </div>

        <span
          className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 border ${
            isCamp
              ? campCleared
                ? 'bg-[#16a34a] text-[#fef5df] border-[#14532d]'
                : 'bg-[#dc2626] text-[#fef5df] border-[#7f1d1d]'
              : isUnlocked
                ? 'bg-[#4f803b] text-[#fef5df] border-[#2d4d21]'
                : canAfford
                  ? 'bg-[#d97706] text-[#fef5df] border-[#92400e]'
                  : 'bg-[#a89070] text-[#3a200f] border-[#785e42]'
          }`}
        >
          {isCamp
            ? campCleared
              ? '토벌 완료 (재건 대기)'
              : `Lv.${selectedIsland.campLevel || 1} 부락`
            : isUnlocked
              ? selectedTierCfg.name
              : canAfford
                ? '점령 가능'
                : '미점령'}
        </span>
      </div>

      {isCamp ? (
        <div className="pt-2 border-t border-[#c7a97e] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#3a200f]">
            <img src="/assets/ui/Icons/Icon_05.png" alt="" className="w-4 h-4 pixel-art" />
            <span>부락 본진 내구도:</span>
            <span className="font-black text-[#b91c1c] tabular-nums">
              {selectedIsland.coreHp} / {selectedIsland.coreMaxHp}
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#78350f]">
            {campCleared
              ? '⏳ 3분 뒤 상위 레벨 부락으로 재건됩니다'
              : '🎁 본진 파괴 시 개인 장비 전리품 + 경험치 획득'}
          </span>
        </div>
      ) : isUnlocked ? (
        <div className="pt-2 border-t border-[#c7a97e] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#3a200f]">
            <img src="/assets/ui/Icons/Icon_07.png" alt="" className="w-4 h-4 pixel-art" />
            <span>코어 체력:</span>
            <span className="font-black text-[#166534] tabular-nums">
              {selectedIsland.coreHp} / {selectedIsland.coreMaxHp}
            </span>
          </div>

          {onManageTerritory && buildAccess.allowed ? (
            <PixelGameButton
              label="마을 발전 & 건설"
              iconSrc="/assets/ui/Icons/Tool_Hammer.png"
              variant="blue"
              size="sm"
              onClick={() => {
                onCloseModal();
                onManageTerritory(selectedIsland.id);
              }}
            />
          ) : (
            <span className="text-[11px] font-bold text-[#6e4625]">
              {buildAccess.reason || '건설 불가'}
            </span>
          )}
        </div>
      ) : (
        <div className="pt-2 border-t border-[#c7a97e] space-y-1.5">
          <div className="text-[11px] font-black text-[#3a200f]">땅 점령 필요 자원</div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              {
                label: '목재',
                icon: '/assets/ui/Icons/Icon_02.png',
                have: inventory.wood,
                need: selectedIsland.costWood,
              },
              {
                label: '석재',
                icon: '/assets/decorations/Rock2.png',
                have: inventory.stone,
                need: selectedIsland.costStone,
              },
              {
                label: '금화',
                icon: '/assets/ui/Icons/Icon_03.png',
                have: inventory.gold,
                need: selectedIsland.costGold,
              },
            ].map((res) => {
              const ok = res.have >= res.need;
              return (
                <div
                  key={res.label}
                  className={`p-1.5 rounded-lg text-center border-2 ${
                    ok
                      ? 'bg-[#e6cfab] border-[#4f803b] text-[#14532d]'
                      : 'bg-[#ead2cb] border-[#b91c1c]/60 text-[#7f1d1d]'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 text-[10px] font-black">
                    <img src={res.icon} alt="" className="w-3.5 h-3.5 pixel-art" />
                    <span>{res.label}</span>
                  </div>
                  <div className="font-black text-xs tabular-nums mt-0.5">
                    {res.have}/{res.need}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
