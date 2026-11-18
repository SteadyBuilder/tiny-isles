import Phaser from 'phaser';

const SANCTUARY_AURA_PULSE_INTERVAL_MS = 1600;
const SANCTUARY_YELLOW_PRIMARY = 0xfde047;
const SANCTUARY_YELLOW_BRIGHT = 0xfef08a;

/**
 * 신성 치유 성소(special_sanctuary) 컨테이너에 밝은 노란 빛이 뿜어져 나오는 오라 스프라이트 연출을 부착한다.
 * 컨테이너가 파괴될 때 타이머와 트윈을 자동으로 정리한다.
 */
export function attachSanctuaryAuraEffect(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container
): void {
  let baseAura: Phaser.GameObjects.Sprite | null = null;

  if (scene.textures.exists('magicCircleFx') && scene.anims.exists('magic_circle_anim')) {
    baseAura = scene.add.sprite(0, 4, 'magicCircleFx');
    baseAura.setDisplaySize(176, 176);
    baseAura.setTint(SANCTUARY_YELLOW_BRIGHT);
    baseAura.setAlpha(0.55);
    baseAura.setBlendMode(Phaser.BlendModes.ADD);
    baseAura.play('magic_circle_anim');
    container.addAt(baseAura, 0);

    scene.tweens.add({
      targets: baseAura,
      scaleX: { from: 0.92, to: 1.12 },
      scaleY: { from: 0.92, to: 1.12 },
      alpha: { from: 0.38, to: 0.68 },
      duration: 1300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  const spawnRadiateBurst = () => {
    if (!scene.sys?.isActive() || !container.scene || !container.visible) return;

    if (scene.textures.exists('shockwaveRingFx') && scene.anims.exists('shockwave_ring_anim')) {
      const ring = scene.add.sprite(0, 0, 'shockwaveRingFx');
      ring.setDisplaySize(90, 90);
      ring.setTint(SANCTUARY_YELLOW_PRIMARY);
      ring.setAlpha(0.8);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      container.add(ring);
      ring.play('shockwave_ring_anim');

      scene.tweens.add({
        targets: ring,
        displayWidth: 260,
        displayHeight: 260,
        alpha: 0,
        duration: 750,
        ease: 'Cubic.easeOut',
      });
      ring.once('animationcomplete', () => {
        if (ring.scene) ring.destroy();
      });
    }

    if (scene.textures.exists('healFx') && scene.anims.exists('heal_anim')) {
      const glow = scene.add.sprite(0, -14, 'healFx');
      glow.setDisplaySize(165, 165);
      glow.setTint(SANCTUARY_YELLOW_BRIGHT);
      glow.setAlpha(0.75);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
      glow.play('heal_anim');
      glow.once('animationcomplete', () => {
        if (glow.scene) glow.destroy();
      });
    }
  };

  spawnRadiateBurst();

  const timer = scene.time.addEvent({
    delay: SANCTUARY_AURA_PULSE_INTERVAL_MS,
    loop: true,
    callback: spawnRadiateBurst,
  });

  container.once('destroy', () => {
    timer.remove(false);
    if (baseAura) {
      scene.tweens.killTweensOf(baseAura);
    }
  });
}
