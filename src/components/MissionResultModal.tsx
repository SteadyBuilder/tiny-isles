import React from 'react';
import { COSMETIC_TITLES } from '../data/metaProgression';
import { MISSION_DIFFICULTIES } from '../data/missions';
import { MissionResultPayload } from '../types/room';
import { PixelGameButton } from './ui/PixelGameButton';
import { WoodModalFrame } from './ui/WoodModalFrame';

interface MissionResultModalProps {
  result: MissionResultPayload | null;
  onReturnToLobby: () => void;
}

export const MissionResultModal: React.FC<MissionResultModalProps> = ({
  result,
  onReturnToLobby,
}) => {
  if (!result) return null;

  const diffLabel = MISSION_DIFFICULTIES[result.difficulty]?.label ?? result.difficulty;
  const unlockedTitle = result.unlockedTitleId
    ? COSMETIC_TITLES.find((t) => t.id === result.unlockedTitleId)?.label
    : undefined;
  const mins = Math.floor(result.elapsedSec / 60);
  const secs = result.elapsedSec % 60;
  const contrib = result.contribution;
  const pMins = contrib ? Math.floor(contrib.participatedSec / 60) : mins;
  const pSecs = contrib ? contrib.participatedSec % 60 : secs;
  const pRatioPct = contrib ? Math.round(contrib.participationRatio * 100) : 100;

  return (
    <WoodModalFrame
      title={result.victory ? '원정 미션 클리어!' : '원정 실패'}
      ribbonVariant={result.victory ? 'blue' : 'red'}
      frameVariant={result.victory ? 'special' : 'wood'}
      maxWidthClass="max-w-md"
      closeOnBackdrop={false}
      zIndexClass="z-[100]"
    >
      <div className="ts-paper-sheet p-3 text-center space-y-2">
        <div className="flex items-center justify-center">
          <img
            src={result.victory ? '/assets/ui/Icons/Icon_03.png' : '/assets/ui/Icons/Icon_05.png'}
            alt=""
            className="w-10 h-10 pixel-art"
          />
        </div>
        <div className="text-base font-black text-[#2b1810]">
          {result.missionTitle} ({diffLabel})
        </div>
        {result.reason && <p className="text-xs font-bold text-[#6e4625]">{result.reason}</p>}
      </div>

      <div className="ts-paper-sheet p-3 space-y-2 text-xs font-bold text-[#3a200f]">
        <div className="flex justify-between">
          <span>원정 총 소요 시간</span>
          <span className="font-black">
            {mins}분 {secs}초
          </span>
        </div>

        {contrib && (
          <>
            <div className="flex justify-between">
              <span>내 참여 시간 (비율)</span>
              <span className="font-black">
                {pMins}분 {pSecs}초 ({pRatioPct}%)
              </span>
            </div>
            <div className="flex justify-between">
              <span>전투·개척 기여도 점수</span>
              <span className={`font-black ${contrib.isQualified ? 'text-[#1d4ed8]' : 'text-[#dc2626]'}`}>
                {contrib.contributionScore}점 ({contrib.isQualified ? '자격 충족' : '활동 미달'})
              </span>
            </div>
          </>
        )}

        <div className="flex justify-between pt-1 border-t border-[#c4a274]">
          <span>획득 별의 파편</span>
          <span className="font-black text-[#166534]">
            +{result.earnedPoints}P
            {contrib?.hasPioneerBonus && ' (🌟선구자 완주 +15%)'}
          </span>
        </div>

        {contrib && !contrib.isQualified && (
          <div className="p-2 rounded bg-[#fef2f2] border border-[#dc2626] text-[11px] font-bold text-[#991b1b]">
            ⚠️ 최소 활동 기여도 기준에 미달(잠수/무기여)하여 클리어 보상 및 칭호가 지급되지 않았습니다.
          </div>
        )}

        {unlockedTitle && (
          <div className="flex justify-between">
            <span>칭호 해금</span>
            <span className="font-black text-[#92400e]">🏅 {unlockedTitle}</span>
          </div>
        )}
      </div>

      <PixelGameButton
        label="로비로 돌아가기"
        iconSrc="/assets/ui/Icons/Icon_08.png"
        variant="blue"
        size="md"
        fullWidth
        onClick={onReturnToLobby}
      />
    </WoodModalFrame>
  );
};

