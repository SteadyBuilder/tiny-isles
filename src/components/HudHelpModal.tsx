import React from 'react';

interface HudHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HudHelpModal: React.FC<HudHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#162238] border-2 border-amber-600/60 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-3">
          <h3 className="text-lg sm:text-xl font-black text-amber-300 flex items-center gap-2">
            <img src="/assets/ui/Icons/Icon_05.png" alt="sword" className="w-5 h-5 pixel-art" />
            <span>협동 실시간 마을 타워디펜스 가이드</span>
          </h3>
          <button
            onClick={onClose}
            className="relative w-8 h-8 active:scale-90 transition-transform flex items-center justify-center"
          >
            <img
              src="/assets/ui/Buttons/SmallRedRoundButton_Regular.png"
              alt="close"
              className="w-full h-full pixel-art select-none"
            />
            <img src="/assets/ui/Icons/Icon_09.png" alt="x" className="absolute w-3.5 h-3.5 pixel-art" />
          </button>
        </div>

        <div className="space-y-2.5 text-xs text-slate-200 leading-relaxed">
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl">
            <div className="font-extrabold text-amber-300 text-sm mb-1">
              🏰 핵심 게임 규칙 (멀티플레이 협동 실시간 타워디펜스)
            </div>
            <ul className="space-y-1 text-slate-300">
              <li>• <b>마을 단위 영지:</b> 중심 마을은 처음부터 <b>중소마을</b>이며 4방면에 <b>나무 방책</b>이 설치되어 있습니다.</li>
              <li>• <b>맵 전체 바이옴 & 균등 자원:</b> 초원·숲·바위 고원·신비의 습지와 호수가 어우러진 맵 전역에서 점령 여부와 무관하게 자원을 채집할 수 있으며, 채집된 자원은 맵 전체 빈 구역에 골고루 리스폰됩니다.</li>
              <li>• <b>마을 점령(건물 건설 거점):</b> 영지 점령은 <b>타워·성벽·생산건물·특수건물</b>을 세우고 마을을 발전시키기 위함입니다.</li>
              <li>• <b>마을 발전 6단계:</b> 점령한 땅은 <b>개척마을 → 중소마을 → 큰마을 → 소도시 → 중소도시 → 대도시</b>로 발전시킬 수 있습니다.</li>
              <li>• <b>30분 마물 & 60분 보스 침공:</b> 현실 시간 30분마다 좀비·스켈레톤 등 마물이, 60분마다 보스몬스터가 출현합니다.</li>
              <li>• <b>외곽 진입 & 코어 보석 파괴 시 땅 상실:</b> 마물 웨이브는 점령한 땅 외곽에서부터 진입하여 중심부를 노리며, 점령한 땅의 <b>코어 보석</b>이 부숴지면 해당 땅을 잃게 됩니다!</li>
            </ul>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl shadow-lg transition text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
