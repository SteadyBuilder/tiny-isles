import Phaser from 'phaser';
import { PlayerClassId, PlayerColor } from '../../../types/game';

interface ClassSpriteSpec {
  readonly key: string;
  readonly idleEnd: number;
  readonly runEnd: number;
  readonly atkEnd: number;
  readonly frameSize: number;
  readonly hasCast?: boolean;
  readonly hasHit?: boolean;
}

const CLASS_SPRITE_SPECS: Record<Exclude<PlayerClassId, 'pawn'>, ClassSpriteSpec> = {
  guardian: { key: 'Warrior', idleEnd: 7, runEnd: 5, atkEnd: 3, frameSize: 192 },
  lancer: { key: 'Lancer', idleEnd: 11, runEnd: 5, atkEnd: 2, frameSize: 320 },
  ranger: { key: 'Archer', idleEnd: 5, runEnd: 3, atkEnd: 7, frameSize: 192 },
  archmage: {
    key: 'Archmage',
    idleEnd: 5,
    runEnd: 5,
    atkEnd: 5,
    frameSize: 192,
    hasCast: true,
    hasHit: true,
  },
};

function registerClassAnimations(
  scene: Phaser.Scene,
  color: PlayerColor,
  classId: Exclude<PlayerClassId, 'pawn'>
): void {
  const spec = CLASS_SPRITE_SPECS[classId];
  const createIfNeeded = (animKey: string, texKey: string, end: number, frameRate: number, repeat: number) => {
    if (!scene.textures.exists(texKey) || scene.anims.exists(animKey)) return;
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(texKey, { start: 0, end }),
      frameRate,
      repeat,
    });
  };

  createIfNeeded(`${color}_${classId}_idle`, `${color}${spec.key}Idle`, spec.idleEnd, 7, -1);
  createIfNeeded(`${color}_${classId}_run`, `${color}${spec.key}Run`, spec.runEnd, 9, -1);
  createIfNeeded(`${color}_${classId}_axe`, `${color}${spec.key}Attack`, spec.atkEnd, 15, 0);
  createIfNeeded(`${color}_${classId}_pickaxe`, `${color}${spec.key}Attack`, spec.atkEnd, 15, 0);
  if (spec.hasCast) {
    createIfNeeded(`${color}_${classId}_cast`, `${color}${spec.key}Cast`, 4, 11, 0);
  }
  if (spec.hasHit) {
    createIfNeeded(`${color}_${classId}_hit`, `${color}${spec.key}Hit`, 4, 16, 0);
  }
}

/**
 * 기본(pawn) 이후 전직 시 해당 클래스·색상에 필요한 스프라이트시트만 온디맨드로 로드하여
 * 초기 부팅 시 미사용 전직 시트(24종+)로 인한 GPU/메모리 점유를 방지합니다.
 */
export function ensureClassSpritesLoaded(
  scene: Phaser.Scene,
  color: PlayerColor,
  classId: PlayerClassId,
  onReady?: () => void
): void {
  if (classId === 'pawn') {
    onReady?.();
    return;
  }
  if (!scene.sys || !scene.scene?.isActive()) return;

  const spec = CLASS_SPRITE_SPECS[classId];
  const suffixes: Array<'Idle' | 'Run' | 'Attack' | 'Cast' | 'Hit'> = ['Idle', 'Run', 'Attack'];
  if (spec.hasCast) suffixes.push('Cast');
  if (spec.hasHit) suffixes.push('Hit');

  let missingCount = 0;
  for (const suffix of suffixes) {
    const texKey = `${color}${spec.key}${suffix}`;
    if (!scene.textures.exists(texKey)) {
      missingCount++;
      scene.load.spritesheet(texKey, `/assets/units/${color}/${spec.key}_${suffix}.png`, {
        frameWidth: spec.frameSize,
        frameHeight: spec.frameSize,
      });
    }
  }

  if (missingCount === 0) {
    registerClassAnimations(scene, color, classId);
    onReady?.();
    return;
  }

  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (!scene.sys || !scene.scene?.isActive()) return;
    registerClassAnimations(scene, color, classId);
    onReady?.();
  });

  if (!scene.load.isLoading()) {
    scene.load.start();
  }
}
