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
  tilemap2: HTMLImageElement;
  tilemap3: HTMLImageElement;
  tilemap4: HTMLImageElement;
  tilemap5: HTMLImageElement;
  waterBg: HTMLImageElement;
  waterFoam: HTMLImageElement;
  waterRock1: HTMLImageElement;
  waterRock2: HTMLImageElement;
  tree: HTMLImageElement;
  tree3: HTMLImageElement;
  rock1: HTMLImageElement;
  rock2: HTMLImageElement;
  rock3: HTMLImageElement;
  rock4: HTMLImageElement;
  bush: HTMLImageElement;
  bush2: HTMLImageElement;
  castle: HTMLImageElement;
  house1: HTMLImageElement;
  house2: HTMLImageElement;
  house3: HTMLImageElement;
  tower: HTMLImageElement;
  barracks: HTMLImageElement;
  archery: HTMLImageElement;
  monastery: HTMLImageElement;
  sheep: HTMLImageElement;
  goldResource: HTMLImageElement;
  woodResource: HTMLImageElement;
  grassSeamless: HTMLImageElement;
  cloud1: HTMLImageElement;
  cloud2: HTMLImageElement;
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
    tilemap2: '/assets/terrain/Tilemap_color2.png',
    tilemap3: '/assets/terrain/Tilemap_color3.png',
    tilemap4: '/assets/terrain/Tilemap_color4.png',
    tilemap5: '/assets/terrain/Tilemap_color5.png',
    waterBg: '/assets/terrain/Water_Background_color.png',
    waterFoam: '/assets/terrain/Water_Foam.png',
    waterRock1: '/assets/terrain/Water_Rocks_01.png',
    waterRock2: '/assets/terrain/Water_Rocks_02.png',
    tree: '/assets/decorations/Tree1.png',
    tree3: '/assets/decorations/Tree3.png',
    rock1: '/assets/decorations/Rock1.png',
    rock2: '/assets/decorations/Rock2.png',
    rock3: '/assets/decorations/Rock3.png',
    rock4: '/assets/decorations/Rock4.png',
    bush: '/assets/decorations/Bushe1.png',
    bush2: '/assets/decorations/Bushe2.png',
    castle: '/assets/buildings/Castle.png',
    house1: '/assets/buildings/House1.png',
    house2: '/assets/buildings/House2.png',
    house3: '/assets/buildings/House3.png',
    tower: '/assets/buildings/Tower.png',
    barracks: '/assets/buildings/Barracks.png',
    archery: '/assets/buildings/Archery.png',
    monastery: '/assets/buildings/Monastery.png',
    sheep: '/assets/resources/Sheep_Idle.png',
    goldResource: '/assets/resources/Gold_Stone_6.png',
    woodResource: '/assets/resources/Wood Resource.png',
    grassSeamless: '/assets/terrain/Grass_Seamless.png',
    cloud1: '/assets/decorations/Clouds_01.png',
    cloud2: '/assets/decorations/Clouds_02.png',
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
