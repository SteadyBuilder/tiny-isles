import Phaser from 'phaser';
import { GameEvents } from '../../events/gameEvents';

export interface WebGLContextGuardOptions {
  scene: Phaser.Scene;
  onRestored?: () => void;
}

/**
 * Phaser 4 WebGLRenderer 컨텍스트 손실(LOSE_WEBGL) 및 복구(RESTORE_WEBGL) 감지 가드.
 * VRAM 압박 등으로 컨텍스트가 일시 유실될 때 물리/트윈 상태를 안전하게 보호하고,
 * 복구 시 CanvasTexture 재업로드를 트리거합니다.
 */
export function attachWebGLContextGuard(options: WebGLContextGuardOptions): () => void {
  const { scene, onRestored } = options;
  const renderer = scene.game?.renderer;

  if (!renderer || typeof renderer.on !== 'function') {
    return () => {};
  }

  let wasPhysicsPaused = false;

  const handleLost = () => {
    if (scene.physics?.world) {
      wasPhysicsPaused = scene.physics.world.isPaused;
      scene.physics.pause();
    }
    GameEvents.emit(
      'game-alert',
      '⚠️ 그래픽(WebGL) 컨텍스트가 일시 중단되었습니다. 복구 중입니다...'
    );
  };

  const handleRestored = () => {
    if (scene.physics?.world && !wasPhysicsPaused) {
      scene.physics.resume();
    }
    onRestored?.();
    GameEvents.emit('game-alert', '✅ 그래픽(WebGL) 렌더링이 정상 복구되었습니다.');
  };

  renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, handleLost);
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, handleRestored);

  return () => {
    renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, handleLost);
    renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, handleRestored);
  };
}
