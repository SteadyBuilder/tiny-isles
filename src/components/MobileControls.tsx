import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Island, BuildingType } from '../types/game';
import { Swords, Wind, Hammer, Sparkles, Check, Castle } from 'lucide-react';

interface MobileControlsProps {
  onAction: () => void;
  onDash?: () => void;
  onBuildCurrent?: () => void;
  onToggleBuildHotbar?: () => void;
  selectedBuilding?: BuildingType | null;
  joystickRef: React.MutableRefObject<{ x: number; y: number }>;
  nearIsland?: Island | null;
  isNearCore?: boolean;
  onInteractCore?: () => void;
  isNearVillageCenter?: boolean;
  onUpgradeVillage?: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onAction,
  onDash,
  onBuildCurrent,
  onToggleBuildHotbar,
  selectedBuilding,
  joystickRef,
  nearIsland,
  isNearCore,
  onInteractCore,
  isNearVillageCenter,
  onUpgradeVillage,
}) => {
  // 플로팅 조이스틱 상태
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickCenter, setJoystickCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knobPos, setKnobPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  // 대시 쿨다운 상태
  const [dashOnCooldown, setDashOnCooldown] = useState(false);

  // 액션 버튼 연속 홀드 상태
  const [isActionHeld, setIsActionHeld] = useState(false);
  const actionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. 플로팅 조이스틱 터치 핸들러
  const handleTouchStartArea = (e: React.PointerEvent<HTMLDivElement>) => {
    // 이미 조이스틱이 활성화되어 있다면 무시
    if (activePointerId.current !== null) return;

    activePointerId.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setJoystickCenter({ x: e.clientX, y: e.clientY });
    setKnobPos({ x: 0, y: 0 });
    setJoystickActive(true);
    joystickRef.current = { x: 0, y: 0 };
  };

  const handleTouchMoveArea = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;

    const dx = e.clientX - joystickCenter.x;
    const dy = e.clientY - joystickCenter.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 50;

    let knobX = dx;
    let knobY = dy;

    if (dist > maxRadius) {
      knobX = (dx / dist) * maxRadius;
      knobY = (dy / dist) * maxRadius;
    }

    setKnobPos({ x: knobX, y: knobY });

    if (dist < 6) {
      joystickRef.current = { x: 0, y: 0 };
    } else {
      joystickRef.current = {
        x: Number((knobX / maxRadius).toFixed(3)),
        y: Number((knobY / maxRadius).toFixed(3)),
      };
    }
  };

  const handleTouchEndArea = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    activePointerId.current = null;
    setJoystickActive(false);
    setKnobPos({ x: 0, y: 0 });
    joystickRef.current = { x: 0, y: 0 };
  };

  // 2. 공격/채집 연속 홀드 핸들러
  const triggerSingleAction = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(12);
    }
    onAction();
  }, [onAction]);

  const handleActionDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsActionHeld(true);
    triggerSingleAction();

    if (actionTimerRef.current) clearInterval(actionTimerRef.current);
    actionTimerRef.current = setInterval(() => {
      triggerSingleAction();
    }, 180);
  };

  const handleActionUp = () => {
    setIsActionHeld(false);
    if (actionTimerRef.current) {
      clearInterval(actionTimerRef.current);
      actionTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (actionTimerRef.current) clearInterval(actionTimerRef.current);
    };
  }, []);

  // 3. 대시 핸들러
  const handleDash = () => {
    if (dashOnCooldown) return;
    setDashOnCooldown(true);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(20);
    }
    onDash?.();
    setTimeout(() => {
      setDashOnCooldown(false);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 pointer-events-none select-none z-30 overflow-hidden">
      {/* ────────────────────────────────────────────────────────── */}
      {/* A. 좌측 하단 플로팅 조이스틱 터치 영역 (모바일 화면 왼쪽 절반) */}
      {/* ────────────────────────────────────────────────────────── */}
      <div
        className="pointer-events-auto absolute left-0 bottom-0 w-1/2 h-[70vh] touch-none"
        onPointerDown={handleTouchStartArea}
        onPointerMove={handleTouchMoveArea}
        onPointerUp={handleTouchEndArea}
        onPointerCancel={handleTouchEndArea}
      >
        {/* 플로팅 조이스틱 UI (터치 시 터치 좌표에 렌더링) */}
        {joystickActive && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border-2 border-amber-400/50 bg-slate-900/60 backdrop-blur-sm pointer-events-none flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-in fade-in zoom-in-75 duration-100"
            style={{ left: joystickCenter.x, top: joystickCenter.y }}
          >
            {/* 가이드 링 */}
            <div className="w-14 h-14 rounded-full border border-amber-300/30 border-dashed" />

            {/* 조이스틱 노브 */}
            <div
              className="absolute w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 border-2 border-white shadow-lg pointer-events-none"
              style={{
                transform: `translate3d(${knobPos.x}px, ${knobPos.y}px, 0)`,
              }}
            />
          </div>
        )}

        {/* 조이스틱 기본 가이드 힌트 (터치 안 할 때 은은하게 표시) */}
        {!joystickActive && (
          <div className="absolute left-8 bottom-8 flex flex-col items-center opacity-30 pointer-events-none">
            <div className="w-20 h-20 rounded-full border border-dashed border-slate-300 flex items-center justify-center">
              <span className="text-[10px] text-slate-300 font-bold">이동 영역</span>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* B. 우측 하단 액션 버튼 클러스터 */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="pointer-events-auto absolute right-4 bottom-4 sm:right-8 sm:bottom-8 flex flex-col items-end gap-3 safe-right safe-bottom">
        {/* 1. 상황별 상호작용 버튼 (코어 보석 정화, 마을 승급 등) */}
        {isNearCore && (
          <button
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
              onInteractCore?.();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(6,182,212,0.7)] border-2 border-cyan-200 active:scale-95 animate-bounce mb-1"
          >
            <Sparkles className="w-4 h-4 fill-white" />
            <span>수호 코어 강화/수리</span>
          </button>
        )}

        {isNearVillageCenter && (
          <button
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25);
              onUpgradeVillage?.();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_20px_rgba(245,158,11,0.7)] border-2 border-amber-200 active:scale-95 animate-pulse mb-1"
          >
            <Castle className="w-4 h-4 fill-slate-950" />
            <span>마을 승급하기</span>
          </button>
        )}

        {/* 보조 버튼 라인: 대시(회피) & 건설 모드 */}
        <div className="flex items-center gap-3">
          {/* 건설 핫바 토글 또는 선택된 건물 즉시 배치 버튼 */}
          {selectedBuilding ? (
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(20);
                onBuildCurrent?.();
              }}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-90 flex flex-col items-center justify-center text-slate-950 font-black shadow-lg border-2 border-amber-200 animate-pulse"
              title="선택된 건물 설치"
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span className="text-[10px] font-black leading-none mt-0.5">설치</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
                onToggleBuildHotbar?.();
              }}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-amber-500/50 hover:border-amber-400 active:scale-90 flex flex-col items-center justify-center text-amber-300 shadow-md"
              title="건축 모드 열기"
            >
              <Hammer className="w-5 h-5" />
              <span className="text-[9px] font-bold mt-0.5">건축</span>
            </button>
          )}

          {/* 대시/회피 버튼 */}
          <button
            onClick={handleDash}
            disabled={dashOnCooldown}
            className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl backdrop-blur-md border flex flex-col items-center justify-center shadow-md transition-all active:scale-90 ${
              dashOnCooldown
                ? 'bg-slate-900/50 border-slate-700 text-slate-500 opacity-50'
                : 'bg-indigo-600/80 border-indigo-300 text-white hover:bg-indigo-500'
            }`}
            title="회피/대시 (Space)"
          >
            <Wind className="w-5 h-5" />
            <span className="text-[9px] font-bold mt-0.5">대시</span>
          </button>
        </div>

        {/* 2. 메인 공격/채집 버튼 (대형 터치 타겟: 76px) */}
        <button
          onPointerDown={handleActionDown}
          onPointerUp={handleActionUp}
          onPointerCancel={handleActionUp}
          className={`w-20 h-20 sm:w-22 sm:h-22 rounded-3xl border-3 flex flex-col items-center justify-center shadow-[0_10px_25px_rgba(0,0,0,0.5)] transition-all touch-none select-none ${
            isActionHeld
              ? 'bg-rose-500 border-white scale-95 shadow-[0_0_25px_rgba(244,63,94,0.8)]'
              : 'bg-gradient-to-tr from-rose-600 to-amber-500 border-rose-200/90 active:scale-90'
          }`}
          title="공격 및 자원 채집 (길게 누르면 연속 타격)"
        >
          <Swords className={`w-8 h-8 text-white stroke-[2.5] ${isActionHeld ? 'rotate-12' : ''}`} />
          <span className="text-[10px] sm:text-xs font-black text-white mt-1 uppercase tracking-tight">
            {isActionHeld ? '타격 중!' : '공격/채집'}
          </span>
        </button>
      </div>
    </div>
  );
};
