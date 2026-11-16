import Phaser from 'phaser';
import { PERFORMANCE_CONFIG } from '../../../data/performanceConfig';
import {
  expandViewportRect,
  isPointInViewport,
  isRectInViewport,
  ViewportRect,
} from '../../utils/viewportCullingUtils';
import { ConstructedVisualRef } from '../../systems/TowerDefenseSystem';
import { EntityVisual } from '../renderers/ResourceEntityRenderer';

export interface IViewportCullingContext {
  scene: Phaser.Scene;
  getChunkImages: () => ReadonlyArray<Phaser.GameObjects.Image>;
  getResourceVisuals: () => ReadonlyMap<string, EntityVisual>;
  getTerritoryBuildingVisuals: () => ReadonlyArray<Phaser.GameObjects.Container>;
  getConstructedVisuals: () => Map<string, ConstructedVisualRef>;
  getAltarCardContainers: () => Phaser.GameObjects.Container[];
}

/**
 * 카메라 뷰포트(worldView) 바깥의 지형 청크, 자원 엔티티, 건물, 개척 제단 카드의
 * 렌더링 가시성(visible) 및 오프스크린 애니메이션 재생을 주기적으로 컬링하는 컨트롤러
 */
export class ViewportCullingController {
  private ctx: IViewportCullingContext;
  private lastCullTime = 0;
  private lastCamX = Number.NaN;
  private lastCamY = Number.NaN;
  private lastCamZoom = Number.NaN;

  constructor(ctx: IViewportCullingContext) {
    this.ctx = ctx;
  }

  public forceCullNow(): void {
    this.lastCamX = Number.NaN;
    this.cullToCamera();
  }

  public update(time: number): void {
    const cam = this.ctx.scene.cameras?.main;
    if (!cam) return;

    const view = cam.worldView;
    if (!view || view.width <= 0 || view.height <= 0) return;

    const movedDist = Math.hypot(view.x - this.lastCamX, view.y - this.lastCamY);
    const zoomChanged = Math.abs(cam.zoom - this.lastCamZoom) > 0.01;
    const intervalElapsed = time - this.lastCullTime >= PERFORMANCE_CONFIG.cullingIntervalMs;

    if (
      !Number.isNaN(this.lastCamX) &&
      !zoomChanged &&
      movedDist < PERFORMANCE_CONFIG.cameraMoveThresholdPx &&
      !intervalElapsed
    ) {
      return;
    }

    this.lastCullTime = time;
    this.lastCamX = view.x;
    this.lastCamY = view.y;
    this.lastCamZoom = cam.zoom;

    this.cullToCamera();
  }

  private cullToCamera(): void {
    const cam = this.ctx.scene.cameras?.main;
    if (!cam || !cam.worldView || cam.worldView.width <= 0) return;

    const wv = cam.worldView;
    const viewport = expandViewportRect(
      wv.x,
      wv.y,
      wv.width,
      wv.height,
      PERFORMANCE_CONFIG.cullingMarginPx
    );

    this.cullChunks(viewport);
    this.cullResourceEntities(viewport);
    this.cullContainers(this.ctx.getTerritoryBuildingVisuals(), viewport, 260);
    this.cullConstructedBuildings(viewport);
    this.cullContainers(this.ctx.getAltarCardContainers(), viewport, 120);
  }

  private cullChunks(viewport: ViewportRect): void {
    for (const img of this.ctx.getChunkImages()) {
      if (!img.scene) continue;
      const inView = isRectInViewport(
        img.x,
        img.y,
        img.displayWidth,
        img.displayHeight,
        viewport
      );
      if (img.visible !== inView) {
        img.setVisible(inView);
      }
    }
  }

  private cullResourceEntities(viewport: ViewportRect): void {
    for (const ev of this.ctx.getResourceVisuals().values()) {
      if (!ev.container.scene) continue;
      const inView = isPointInViewport(ev.container.x, ev.container.y, viewport, 120);
      if (ev.container.visible !== inView) {
        ev.container.setVisible(inView);
      }
      if (ev.sprite instanceof Phaser.GameObjects.Sprite && ev.sprite.anims) {
        if (!inView && ev.sprite.anims.isPlaying && !ev.sprite.anims.isPaused) {
          ev.sprite.anims.pause();
        } else if (inView && ev.sprite.anims.isPaused) {
          ev.sprite.anims.resume();
        }
      }
    }
  }

  private cullConstructedBuildings(viewport: ViewportRect): void {
    for (const cv of this.ctx.getConstructedVisuals().values()) {
      if (!cv.container.scene) continue;
      const padding = cv.building.category === 'wall' ? 680 : 180;
      const inView = isPointInViewport(cv.container.x, cv.container.y, viewport, padding);
      if (cv.container.visible !== inView) {
        cv.container.setVisible(inView);
        if (cv.extraVisuals) {
          for (const ev of cv.extraVisuals) {
            if (ev.scene) ev.setVisible(inView);
          }
        }
      }
    }
  }

  private cullContainers(
    containers: ReadonlyArray<Phaser.GameObjects.Container>,
    viewport: ViewportRect,
    paddingPx: number
  ): void {
    for (const c of containers) {
      if (!c.scene) continue;
      const inView = isPointInViewport(c.x, c.y, viewport, paddingPx);
      if (c.visible !== inView) {
        c.setVisible(inView);
      }
    }
  }
}
