import React from 'react';
import { summarizeAccountSnapshot } from '../../lib/accountMergeUtils';
import { sound } from '../../lib/sound';
import {
  AccountConflictResolution,
  AccountConflictState,
  AccountProgressSummary,
} from '../../types/auth';
import { PixelGameButton } from '../ui/PixelGameButton';
import { WoodModalFrame } from '../ui/WoodModalFrame';

interface AccountConflictModalProps {
  conflict: AccountConflictState | null;
  isBusy: boolean;
  onResolve: (choice: AccountConflictResolution) => void;
}

interface SummaryCardProps {
  title: string;
  badgeText: string;
  badgeClass: string;
  summary: AccountProgressSummary;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, badgeText, badgeClass, summary }) => (
  <div className="rounded-lg border-2 border-[#b89568] bg-[#f7ebd6] p-2 space-y-1.5">
    <div className="flex items-center justify-between gap-1">
      <span className="text-[11px] font-black text-[#3a200f]">{title}</span>
      <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${badgeClass}`}>
        {badgeText}
      </span>
    </div>
    <div className="text-xs font-black text-[#2b1810] truncate">{summary.name}</div>
    <div className="space-y-0.5 text-[10px] font-bold text-[#5c3c24]">
      <div className="flex justify-between">
        <span>별의 파편</span>
        <span className="font-black text-[#92400e]">✨ {summary.points}P</span>
      </div>
      <div className="flex justify-between">
        <span>총 클리어</span>
        <span className="font-black text-[#166534]">{summary.totalClears}회</span>
      </div>
      <div className="flex justify-between">
        <span>특성 합계</span>
        <span className="font-black text-[#1d4ed8]">Lv.{summary.totalTraitLevels}</span>
      </div>
      <div className="flex justify-between">
        <span>해금 외형</span>
        <span className="font-black text-[#7c2d12]">{summary.unlockedCosmeticCount}개</span>
      </div>
    </div>
  </div>
);

export const AccountConflictModal: React.FC<AccountConflictModalProps> = ({
  conflict,
  isBusy,
  onResolve,
}) => {
  if (!conflict) return null;

  const localSummary = summarizeAccountSnapshot(conflict.local);
  const cloudSummary = summarizeAccountSnapshot(conflict.cloud);
  const mergedSummary = summarizeAccountSnapshot(conflict.mergedPreview);

  const handleSelect = (choice: AccountConflictResolution) => {
    sound.playClick();
    onResolve(choice);
  };

  return (
    <WoodModalFrame
      title="기존 데이터 연동 방법 선택"
      ribbonVariant="red"
      frameVariant="wood"
      maxWidthClass="max-w-lg"
    >
      <div className="ts-paper-sheet p-2.5 space-y-2">
        <p className="text-[11px] font-bold text-[#4a301e] leading-relaxed">
          현재 기기의 게스트 데이터와 로그인한 계정의 클라우드 데이터가 모두 존재합니다.
          어떻게 이어서 플레이할지 선택해 주세요.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SummaryCard
            title="현재 기기 (게스트)"
            badgeText="로컬"
            badgeClass="bg-[#fef3c7] text-[#92400e] border-[#d97706]"
            summary={localSummary}
          />
          <SummaryCard
            title="클라우드 계정"
            badgeText="계정"
            badgeClass="bg-[#dbeafe] text-[#1e40af] border-[#2563eb]"
            summary={cloudSummary}
          />
        </div>

        <div className="rounded-lg border-2 border-[#16a34a] bg-[#ecfdf5] px-2.5 py-1.5 text-[10px] font-bold text-[#166534]">
          <span className="font-black">추천 병합 결과 미리보기: </span>
          ✨ {mergedSummary.points}P · 클리어 {mergedSummary.totalClears}회 · 특성 합계 Lv.
          {mergedSummary.totalTraitLevels} · 해금 외형 {mergedSummary.unlockedCosmeticCount}개
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <PixelGameButton
          label="두 데이터 병합하기 (추천)"
          subtitle="더 높은 성장 수치와 모든 해금 내역을 손실 없이 합칩니다"
          variant="blue"
          size="md"
          fullWidth
          disabled={isBusy}
          onClick={() => handleSelect('merge')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <PixelGameButton
            label="현재 기기 데이터 유지"
            subtitle="게스트 기록으로 덮어쓰기"
            variant="red"
            size="sm"
            fullWidth
            disabled={isBusy}
            onClick={() => handleSelect('use_local')}
          />
          <PixelGameButton
            label="클라우드 데이터 불러오기"
            subtitle="계정 기록으로 덮어쓰기"
            variant="blue"
            size="sm"
            fullWidth
            disabled={isBusy}
            onClick={() => handleSelect('use_cloud')}
          />
        </div>
      </div>
    </WoodModalFrame>
  );
};
