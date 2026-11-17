export interface DioramaBuildingPlacement {
  /** Offset from world center X */
  dx: number;
  /** Offset from world center Y */
  dy: number;
  /** Phaser texture key */
  key: string;
  width: number;
  height: number;
  tint?: number;
  /** Optional subtle aura/range ring for magic towers & sanctuary */
  auraColor?: number;
  auraRadius?: number;
  depthBias?: number;
}

export interface DioramaTreePlacement {
  dx: number;
  dy: number;
  tex: 'd_tree1' | 'd_tree3';
  anim: 'd_tree1_anim' | 'd_tree3_anim';
  scale?: number;
}

export interface DioramaDecorPlacement {
  dx: number;
  dy: number;
  key: 'd_bush1' | 'd_bush2' | 'd_rock1' | 'd_rock3';
  scale: number;
}

export interface DioramaActorPlacement {
  dx: number;
  dy: number;
  tex: string;
  idleAnim: string;
  runAnim: string;
  speed: number;
  scale: number;
}

export interface DioramaCloudPlacement {
  dx: number;
  dy: number;
  key: 'd_cloud1' | 'd_cloud2';
  speed: number;
  alpha: number;
}

export const DIORAMA_WORLD = {
  width: 2560,
  height: 1664,
  tileSize: 64,
  /** Stone wall perimeter half-extents around center */
  wallHalfW: 520,
  wallHalfH: 390,
} as const;

/**
 * Lv.6 대도시(최고 단계) 메인 성채 + 특수건물 + 방어 포탑 배치 데이터
 * 중앙 타이틀 메뉴와 겹치지 않고 좌우/상하로 웅장하게 펼쳐지도록 설계
 */
export const DIORAMA_BUILDINGS: DioramaBuildingPlacement[] = [
  // 1. 최고 레벨 중앙 대도시 성채
  {
    dx: 0,
    dy: -215,
    key: 'd_castle',
    width: 320,
    height: 250,
    depthBias: 95,
  },

  // 2. Lv.6 핵심 특수건물 (병영, 성소, 연금술 공방, 벌목/석공 작업장)
  {
    dx: -245,
    dy: -165,
    key: 'd_barracks',
    width: 145,
    height: 190,
    depthBias: 70,
  },
  {
    dx: 245,
    dy: -170,
    key: 'd_monastery',
    width: 145,
    height: 195,
    auraColor: 0x34d399,
    auraRadius: 95,
    depthBias: 75,
  },
  {
    dx: -365,
    dy: -40,
    key: 'd_alchemistLab',
    width: 128,
    height: 160,
    tint: 0xfde047,
    auraColor: 0xfacc15,
    auraRadius: 82,
    depthBias: 55,
  },
  {
    dx: 365,
    dy: -35,
    key: 'd_blacksmith',
    width: 138,
    height: 142,
    depthBias: 55,
  },
  {
    dx: -380,
    dy: 140,
    key: 'd_lumberCamp',
    width: 132,
    height: 142,
    depthBias: 50,
  },
  {
    dx: 375,
    dy: 140,
    key: 'd_stoneWorks',
    width: 132,
    height: 142,
    depthBias: 50,
  },

  // 3. 대도시 시가지 (상점가, 풍차, 궁술장, 가옥)
  {
    dx: -220,
    dy: 40,
    key: 'd_market',
    width: 142,
    height: 142,
    depthBias: 48,
  },
  {
    dx: 220,
    dy: 40,
    key: 'd_windmill',
    width: 130,
    height: 175,
    depthBias: 55,
  },
  {
    dx: -250,
    dy: 255,
    key: 'd_archery',
    width: 132,
    height: 170,
    depthBias: 55,
  },
  {
    dx: 245,
    dy: 255,
    key: 'd_house3',
    width: 118,
    height: 170,
    depthBias: 50,
  },
  {
    dx: -125,
    dy: 265,
    key: 'd_house1',
    width: 112,
    height: 165,
    depthBias: 50,
  },
  {
    dx: 125,
    dy: 265,
    key: 'd_house2',
    width: 112,
    height: 165,
    depthBias: 50,
  },

  // 4. 성내 & 외곽 요충지 방어 포탑 (궁수 타워 + 마법 포격 타워)
  {
    dx: -465,
    dy: -325,
    key: 'd_magicTower',
    width: 112,
    height: 176,
    tint: 0xc084fc,
    auraColor: 0xc084fc,
    auraRadius: 155,
    depthBias: 70,
  },
  {
    dx: 465,
    dy: -325,
    key: 'd_magicTower',
    width: 112,
    height: 176,
    tint: 0xc084fc,
    auraColor: 0xc084fc,
    auraRadius: 155,
    depthBias: 70,
  },
  {
    dx: -465,
    dy: 320,
    key: 'd_tower',
    width: 108,
    height: 170,
    auraColor: 0x38bdf8,
    auraRadius: 135,
    depthBias: 70,
  },
  {
    dx: 465,
    dy: 320,
    key: 'd_tower',
    width: 108,
    height: 170,
    auraColor: 0x38bdf8,
    auraRadius: 135,
    depthBias: 70,
  },
  // 성문 좌우 전진 방어 포탑
  {
    dx: -155,
    dy: -315,
    key: 'd_tower',
    width: 100,
    height: 158,
    depthBias: 65,
  },
  {
    dx: 155,
    dy: -315,
    key: 'd_tower',
    width: 100,
    height: 158,
    depthBias: 65,
  },
  // 외곽 초원 보루 마법 포탑
  {
    dx: -620,
    dy: 20,
    key: 'd_magicTower',
    width: 108,
    height: 170,
    tint: 0xc084fc,
    auraColor: 0xc084fc,
    auraRadius: 145,
    depthBias: 70,
  },
  {
    dx: 620,
    dy: 20,
    key: 'd_magicTower',
    width: 108,
    height: 170,
    tint: 0xc084fc,
    auraColor: 0xc084fc,
    auraRadius: 145,
    depthBias: 70,
  },
];

export const DIORAMA_TREES: DioramaTreePlacement[] = [
  { dx: -680, dy: -360, tex: 'd_tree1', anim: 'd_tree1_anim', scale: 0.9 },
  { dx: -640, dy: -220, tex: 'd_tree3', anim: 'd_tree3_anim', scale: 0.88 },
  { dx: -670, dy: 240, tex: 'd_tree1', anim: 'd_tree1_anim', scale: 0.92 },
  { dx: -590, dy: 430, tex: 'd_tree3', anim: 'd_tree3_anim', scale: 0.86 },
  { dx: 680, dy: -350, tex: 'd_tree3', anim: 'd_tree3_anim', scale: 0.9 },
  { dx: 650, dy: -210, tex: 'd_tree1', anim: 'd_tree1_anim', scale: 0.88 },
  { dx: 675, dy: 250, tex: 'd_tree3', anim: 'd_tree3_anim', scale: 0.92 },
  { dx: 595, dy: 435, tex: 'd_tree1', anim: 'd_tree1_anim', scale: 0.86 },
  { dx: -320, dy: -460, tex: 'd_tree1', anim: 'd_tree1_anim', scale: 0.88 },
  { dx: 320, dy: -460, tex: 'd_tree3', anim: 'd_tree3_anim', scale: 0.88 },
  { dx: -240, dy: 475, tex: 'd_tree3', anim: 'd_tree3_anim', scale: 0.85 },
  { dx: 240, dy: 475, tex: 'd_tree1', anim: 'd_tree1_anim', scale: 0.85 },
];

export const DIORAMA_DECORS: DioramaDecorPlacement[] = [
  { dx: -575, dy: -155, key: 'd_bush1', scale: 0.7 },
  { dx: 575, dy: -155, key: 'd_bush2', scale: 0.7 },
  { dx: -580, dy: 165, key: 'd_rock1', scale: 0.75 },
  { dx: 580, dy: 165, key: 'd_bush1', scale: 0.72 },
  { dx: -140, dy: -435, key: 'd_bush2', scale: 0.68 },
  { dx: 140, dy: -435, key: 'd_bush1', scale: 0.68 },
  { dx: -135, dy: 445, key: 'd_rock3', scale: 0.8 },
  { dx: 135, dy: 445, key: 'd_bush2', scale: 0.7 },
];

export const DIORAMA_ACTORS: DioramaActorPlacement[] = [
  {
    dx: -165,
    dy: -85,
    tex: 'd_blueIdle',
    idleAnim: 'd_blue_idle',
    runAnim: 'd_blue_run',
    speed: 56,
    scale: 0.68,
  },
  {
    dx: 165,
    dy: -85,
    tex: 'd_redIdle',
    idleAnim: 'd_red_idle',
    runAnim: 'd_red_run',
    speed: 54,
    scale: 0.68,
  },
  {
    dx: -295,
    dy: 145,
    tex: 'd_blueIdle',
    idleAnim: 'd_blue_idle',
    runAnim: 'd_blue_run',
    speed: 50,
    scale: 0.66,
  },
  {
    dx: 295,
    dy: 145,
    tex: 'd_redIdle',
    idleAnim: 'd_red_idle',
    runAnim: 'd_red_run',
    speed: 50,
    scale: 0.66,
  },
  {
    dx: -565,
    dy: 325,
    tex: 'd_sheep',
    idleAnim: 'd_sheep_anim',
    runAnim: 'd_sheep_anim',
    speed: 24,
    scale: 0.72,
  },
  {
    dx: 565,
    dy: 335,
    tex: 'd_sheep',
    idleAnim: 'd_sheep_anim',
    runAnim: 'd_sheep_anim',
    speed: 22,
    scale: 0.72,
  },
];

export const DIORAMA_CLOUDS: DioramaCloudPlacement[] = [
  { dx: -480, dy: -290, key: 'd_cloud1', speed: 14, alpha: 0.42 },
  { dx: 220, dy: 250, key: 'd_cloud2', speed: 11, alpha: 0.36 },
  { dx: -90, dy: -380, key: 'd_cloud2', speed: 9, alpha: 0.32 },
];
