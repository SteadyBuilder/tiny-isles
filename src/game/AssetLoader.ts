export interface GameAssets {
  bluePawnIdle: HTMLImageElement;
  bluePawnRun: HTMLImageElement;
  bluePawnAxe: HTMLImageElement;
  bluePawnPickaxe: HTMLImageElement;
  redPawnIdle: HTMLImageElement;
  redPawnRun: HTMLImageElement;
  redPawnAxe: HTMLImageElement;
  redPawnPickaxe: HTMLImageElement;
  tilemap: HTMLImageElement;
  waterBg: HTMLImageElement;
  waterFoam: HTMLImageElement;
  tree: HTMLImageElement;
  rock1: HTMLImageElement;
  rock2: HTMLImageElement;
  bush: HTMLImageElement;
}

export async function loadGameAssets(onProgress?: (ratio: number) => void): Promise<GameAssets> {
  const assetPaths: Record<keyof GameAssets, string> = {
    bluePawnIdle: '/assets/units/blue/Pawn_Idle.png',
    bluePawnRun: '/assets/units/blue/Pawn_Run.png',
    bluePawnAxe: '/assets/units/blue/Pawn_Interact_Axe.png',
    bluePawnPickaxe: '/assets/units/blue/Pawn_Interact_Pickaxe.png',
    redPawnIdle: '/assets/units/red/Pawn_Idle.png',
    redPawnRun: '/assets/units/red/Pawn_Run.png',
    redPawnAxe: '/assets/units/red/Pawn_Interact_Axe.png',
    redPawnPickaxe: '/assets/units/red/Pawn_Interact_Pickaxe.png',
    tilemap: '/assets/terrain/Tilemap_color1.png',
    waterBg: '/assets/terrain/Water_Background_color.png',
    waterFoam: '/assets/terrain/Water_Foam.png',
    tree: '/assets/decorations/Tree1.png',
    rock1: '/assets/decorations/Rock1.png',
    rock2: '/assets/decorations/Rock2.png',
    bush: '/assets/decorations/Bushe1.png',
  };

  const keys = Object.keys(assetPaths) as (keyof GameAssets)[];
  const total = keys.length;
  let loaded = 0;

  const assets: Partial<GameAssets> = {};

  const promises = keys.map((key) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = assetPaths[key];
      img.onload = () => {
        assets[key] = img;
        loaded++;
        if (onProgress) onProgress(loaded / total);
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load asset: ${assetPaths[key]}, creating fallback`);
        // Create 1x1 transparent fallback
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        img.src = canvas.toDataURL();
        assets[key] = img;
        loaded++;
        if (onProgress) onProgress(loaded / total);
        resolve();
      };
    });
  });

  await Promise.all(promises);
  return assets as GameAssets;
}
