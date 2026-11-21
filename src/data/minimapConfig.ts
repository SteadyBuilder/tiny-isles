import { BiomeId } from './biomes';
import { PlayerColor } from '../types/game';

/**
 * 실시간 미니맵 UI 크기, 갱신 주기, 레이더 반경, 색상 팔레트 설정 (Data-Driven)
 */
export const MINIMAP_CONFIG = {
  /** PC 캔버스 논리 크기 (px) */
  desktopCanvasSize: 168,
  /** 모바일 세로 캔버스 논리 크기 (px) */
  mobileCanvasSize: 96,
  /** 모바일 가로 우상단 코너 캔버스 논리 크기 (px) */
  landscapeMobileCanvasSize: 84,
  /** 확장 미니맵 최대 캔버스 크기 (px) */
  expandedMaxCanvasSizeDesktop: 460,
  expandedMaxCanvasSizeMobile: 320,
  /** 오프스크린 정적 지형 베이크 해상도 (px) */
  terrainBakeResolution: 384,
  /** 정적 지형 셀 샘플링 간격 (1=전체, 2=2x2 격자 단위) */
  terrainSampleStep: 2,
  /** PC 스냅샷 발행 주기 (ms) */
  desktopUpdateIntervalMs: 100,
  /** 모바일 스냅샷 발행 주기 (ms) */
  mobileUpdateIntervalMs: 150,
  /** 모바일 저높이 가로모드 자동 접힘 임계 높이 (px) */
  compactLandscapeMaxHeightPx: 430,
  /** 모바일 브레이크포인트 (px, Tailwind md 기준) */
  mobileBreakpointPx: 768,
  /** 레이더 모드 시 플레이어 기준 반경 (월드 px) */
  radarRadiusPx: 2900,
  /** 레이더 모드에서 범위 밖 중요 마커 가장자리 여백 (px) */
  edgeClampPaddingPx: 6,
  /** 마커 크기 (px, 168px 기준 비율로 스케일) */
  markerBaseSizes: {
    playerRadius: 4.5,
    teammateRadius: 3.8,
    monsterRadius: 2.1,
    bossRadius: 4.8,
    portalRadius: 4.2,
  },
  /** 바이옴별 미니맵 지형 색상 */
  biomeColors: {
    water: '#1d4ed8',
    plains: '#4b8a42',
    forest: '#2b5e2e',
    highland: '#78716c',
    mystic: '#4c5f8a',
    gold_mine: '#a16207',
  } satisfies Record<BiomeId, string>,
  /** 지형/구역/마커 팔레트 */
  palette: {
    background: '#162c1c',
    waterFill: '#1e4e8c',
    waterBorder: '#3b82f6',
    roadFill: '#9c7c52',
    bridgeFill: '#c08a4b',
    goldMineFill: 'rgba(234, 179, 8, 0.28)',
    goldMineStroke: '#facc15',
    centerTerritoryFill: 'rgba(59, 130, 246, 0.28)',
    centerTerritoryStroke: '#60a5fa',
    unlockedTerritoryFill: 'rgba(34, 197, 94, 0.24)',
    unlockedTerritoryStroke: '#4ade80',
    lockedTerritoryFill: 'rgba(15, 23, 42, 0.22)',
    lockedTerritoryStroke: 'rgba(203, 213, 225, 0.35)',
    campActiveFill: 'rgba(220, 38, 38, 0.35)',
    campActiveStroke: '#f87171',
    campClearedFill: 'rgba(34, 197, 94, 0.22)',
    campClearedStroke: '#86efac',
    coreWarningStroke: '#ef4444',
    cameraViewStroke: 'rgba(255, 255, 255, 0.78)',
    cameraViewFill: 'rgba(255, 255, 255, 0.08)',
    localPlayerFill: '#38bdf8',
    localPlayerStroke: '#ffffff',
    localPlayerFaintedFill: '#94a3b8',
    teammateColorFill: {
      blue: '#22d3ee',
      red: '#fb7185',
    } satisfies Record<PlayerColor, string>,
    teammateRingStroke: '#fef08a',
    teammateFaintedFill: '#94a3b8',
    monsterFill: '#fb923c',
    bossFill: '#ef4444',
    bossRingStroke: '#fde047',
    portalFill: '#a855f7',
    portalRingStroke: '#e9d5ff',
  },
} as const;
