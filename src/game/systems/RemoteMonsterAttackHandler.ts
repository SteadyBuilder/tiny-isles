import type { MonsterPlayerAttackPayload } from '../../types/monsterSync';

export interface IRemoteAttackProjectilePlayer {
  fireProjectile: (params: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    durationMs?: number;
    tint?: number;
    size?: number;
    isMagic?: boolean;
    onArrive: () => void;
  }) => void;
  spawnTelegraphZone: (params: {
    x: number;
    y: number;
    radius: number;
    durationMs: number;
    color?: number;
    onDetonate: () => void;
  }) => void;
}

export interface RemoteMonsterPlayerAttackDeps {
  getLocalPlayerId: () => string;
  getLocalPlayerPosition: () => { x: number; y: number };
  isLocalPlayerFainted: () => boolean;
  damageLocalPlayer: (damage: number, attackerName: string) => void;
  playExplosionAt: (x: number, y: number) => void;
  projectileSystem?: IRemoteAttackProjectilePlayer;
  onMonsterAttackVisual?: (monsterId: string, targetX: number) => void;
}

/**
 * 호스트가 브로드캐스트한 몬스터 원거리·장판·근접 공격을 게스트 화면에서 연출 및 피격 판정합니다.
 */
export function executeRemoteMonsterPlayerAttack(
  payload: MonsterPlayerAttackPayload,
  deps: RemoteMonsterPlayerAttackDeps
): void {
  const localId = deps.getLocalPlayerId();
  if (payload.targetPlayerId !== '*' && payload.targetPlayerId !== localId) return;

  deps.onMonsterAttackVisual?.(payload.monsterId, payload.targetX);

  const ps = deps.projectileSystem;
  if (payload.telegraphRadius && payload.telegraphDurationMs && ps) {
    if (payload.role === 'mage' && !payload.isBossSkill) {
      ps.fireProjectile({
        startX: payload.startX,
        startY: payload.startY,
        targetX: payload.targetX,
        targetY: payload.targetY,
        durationMs: 320,
        tint: 0xd946ef,
        size: 42,
        isMagic: true,
        onArrive: () => {},
      });
    }
    const radius = payload.telegraphRadius;
    ps.spawnTelegraphZone({
      x: payload.targetX,
      y: payload.targetY,
      radius,
      durationMs: payload.telegraphDurationMs,
      color: payload.telegraphColor ?? 0xa855f7,
      onDetonate: () => {
        deps.playExplosionAt(payload.targetX, payload.targetY);
        if (!deps.isLocalPlayerFainted()) {
          const cur = deps.getLocalPlayerPosition();
          if (Math.hypot(cur.x - payload.targetX, cur.y - payload.targetY) <= radius + 4) {
            deps.damageLocalPlayer(payload.damage, payload.monsterName);
          }
        }
      },
    });
    return;
  }

  if (ps && (payload.role === 'ranged' || payload.isBossSkill)) {
    const isMagic = payload.role === 'mage' || Boolean(payload.isBossSkill);
    const hitRadius = isMagic ? 64 : 58;
    ps.fireProjectile({
      startX: payload.startX,
      startY: payload.startY,
      targetX: payload.targetX,
      targetY: payload.targetY,
      durationMs: payload.isBossSkill ? 520 : 260,
      tint: payload.isBossSkill ? 0xfbbf24 : 0xf87171,
      size: payload.isBossSkill ? 40 : 32,
      isMagic,
      onArrive: () => {
        if (!deps.isLocalPlayerFainted()) {
          const cur = deps.getLocalPlayerPosition();
          if (Math.hypot(cur.x - payload.targetX, cur.y - payload.targetY) <= hitRadius) {
            deps.damageLocalPlayer(payload.damage, payload.monsterName);
          }
        }
      },
    });
    return;
  }

  if (!deps.isLocalPlayerFainted()) {
    deps.damageLocalPlayer(payload.damage, payload.monsterName);
  }
}
