import React from 'react';
import { WoodModalFrame } from './ui/WoodModalFrame';
import { PixelGameButton } from './ui/PixelGameButton';
import { useEscapeToClose } from '../hooks/useEscapeToClose';

interface HudHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDE_ITEMS: ReadonlyArray<{
  iconSrc: string;
  title: string;
  body: string;
}> = [
  {
    iconSrc: '/assets/buildings/Castle.png',
    title: '마을 단위 영지 거점',
    body: '중심 마을은 처음부터 중소마을이며 4방면에 나무 방책이 설치되어 있습니다.',
  },
  {
    iconSrc: '/assets/ui/Icons/Icon_02.png',
    title: '맵 전체 바이옴 & 자원 리스폰',
    body: '초원·숲·바위 고원·습지 전역에서 점령 여부와 무관하게 자원을 채집할 수 있으며 빈 구역에 균등하게 리스폰됩니다.',
  },
  {
    iconSrc: '/assets/ui/Icons/Tool_Hammer.png',
    title: '영지 점령 & 6단계 마을 발전',
    body: '타워·성벽·생산건물을 세우고 개척마을 → 중소마을 → 큰마을 → 소도시 → 중소도시 → 대도시로 발전시키세요.',
  },
  {
    iconSrc: '/assets/ui/Icons/Icon_Boss.png',
    title: '마물 & 보스 웨이브 방어',
    body: '위협도가 차오르면 외곽에서 마물과 보스가 침공합니다. 본진과 점령 마을의 코어 보석을 지켜내세요!',
  },
  {
    iconSrc: '/assets/ui/Icons/Icon_05.png',
    title: 'PC 키보드 조작법 & 빠른 건설',
    body: '이동: WASD / 방향키 · 공격·채집: Space / E / Z / F · 자동 공격·채집 토글: C · 스킬: Q · 대시: Shift · 건설: B (모달 내 Q/E·←→ 탭 전환, 1~8 건물 즉시 선택). 일부 키보드에서 대각선+Space가 막힐 때는 Z/F 또는 [C] 자동 공격을 활용하세요.',
  },
];

export const HudHelpModal: React.FC<HudHelpModalProps> = ({ isOpen, onClose }) => {
  useEscapeToClose(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <WoodModalFrame
      title="협동 타워디펜스 가이드"
      ribbonVariant="blue"
      frameVariant="wood"
      maxWidthClass="max-w-lg"
      onClose={onClose}
      headerRight={
        <div className="flex items-center gap-1.5 text-[11px] font-black text-[#fef3c7] pixel-btn-shadow">
          <img src="/assets/ui/Icons/Icon_11.png" alt="" className="w-4 h-4 pixel-art" />
          <span>수호자 원정 교본</span>
        </div>
      }
    >
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <div className="text-xs font-black text-[#3a200f] flex items-center gap-1.5">
          <img src="/assets/ui/Icons/Icon_05.png" alt="" className="w-4 h-4 pixel-art" />
          <span>핵심 게임 규칙 (1~4인 실시간 협동)</span>
        </div>

        <div className="space-y-1.5">
          {GUIDE_ITEMS.map((item) => (
            <div
              key={item.title}
              className="flex items-start gap-2.5 p-2 rounded-lg bg-[#e6cfab] border border-[#b89568]"
            >
              <img
                src={item.iconSrc}
                alt=""
                className="w-6 h-6 object-contain pixel-art shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-xs font-black text-[#2b1810]">{item.title}</div>
                <p className="text-[11px] font-semibold text-[#5c3c24] leading-snug mt-0.5">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PixelGameButton
        label="확인"
        iconSrc="/assets/ui/Icons/Icon_06.png"
        variant="blue"
        size="md"
        fullWidth
        onClick={onClose}
      />
    </WoodModalFrame>
  );
};
