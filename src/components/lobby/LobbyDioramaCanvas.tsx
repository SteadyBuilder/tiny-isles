import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { LobbyDioramaScene } from '../../game/phaser/scenes/LobbyDioramaScene';

/**
 * Full-bleed live Phaser diorama canvas behind the Necesse-style title screen.
 * Cleanly destroys its Phaser instance on unmount before WorldScene boots.
 */
export const LobbyDioramaCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#256c78',
      pixelArt: true,
      roundPixels: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [LobbyDioramaScene],
    });

    return () => {
      game.destroy(true);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-0 bg-[#256c78]">
      <div ref={containerRef} className="w-full h-full" />
      {/* Subtle atmospheric vignette for crisp title readability without hiding the world */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(10, 22, 28, 0.14) 0%, rgba(8, 16, 22, 0.56) 100%)',
        }}
      />
    </div>
  );
};
