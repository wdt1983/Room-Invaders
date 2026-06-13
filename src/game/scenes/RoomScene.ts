import * as Phaser from 'phaser';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { FurnitureSprite } from '@/game/objects/FurnitureSprite';
import { EventBus } from '@/game/EventBus';
import { GridSystem } from '@/game/systems/GridSystem';
import {
  useRoomStore,
  EntryPointType,
  EntryPointWall,
} from '@/lib/store/useRoomStore';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { useUIStore } from '@/lib/store/useUIStore';
import { entryTileFor } from '@/lib/game/entryPoints';
import { EntitySprite } from '@/game/objects/EntitySprite';
import { rangeTilesFor } from '@/lib/game/defense';
import { paintRangeBand, RANGE_FILL_COLOR } from '@/game/utils/rangeDraw';
import { SoundManager } from '@/game/objects/SoundManager';
import { BootScene } from './BootScene';

const WALL_COLOR = 0x888888;
const WALL_THICKNESS = 6;
const ENTRY_WALL_COLORS: Record<EntryPointType, number> = {
  door: 0xa0522d,
  window: 0x5dade2,
  vent: 0x34495e,
};
const ENTRY_SPRITE_KEYS: Record<EntryPointType, string> = {
  door: 'entry_door',
  window: 'entry_window',
  vent: 'entry_vent',
};

/** Alpha-pulse params for defense sprites in defense-view mode. Duration and
 *  ease match the entry-point marker pulse (RoomScene.create) so the two
 *  visual "hey, look here" cues share the same rhythm. */
const DEFENSE_PULSE_FROM = 0.5;
const DEFENSE_PULSE_TO = 1.0;
const DEFENSE_PULSE_DURATION = 1000;

export class RoomScene extends Phaser.Scene {
  public gridSystem: GridSystem;
  public currentRotation: number = 0;
  private floorTiles: Phaser.GameObjects.Image[] = [];
  public furnitureItems: FurnitureSprite[] = [];
  public offsetX: number = 0;
  public offsetY: number = 0;
  private pathDebugGraphics!: Phaser.GameObjects.Graphics;
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private entryPointSprites: Phaser.GameObjects.Image[] = [];
  private entryPointTiles: Set<string> = new Set();
  public playerEntity!: EntitySprite;
  public currentMode: string = 'view';
  private defenseViewActive: boolean = false;
  private defenseViewGraphics!: Phaser.GameObjects.Graphics;
  private defenseViewTweens: Phaser.Tweens.Tween[] = [];
  private holographicMarkers: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private activeCustomPosters: Map<FurnitureSprite, { item: any; texKey: string; imgKey: string }> = new Map();
  public activeBossPedestals: Map<FurnitureSprite, { projection: Phaser.GameObjects.Sprite; settings: any; lastSpinTime: number; dir: number }> = new Map();
  public glitchIntensity: number = 0;
  private lastScanlineUpdateTime: number = 0;
  public gridSize: number = 10;
  private lastCameraScrollX: number = 0;
  private lastCameraScrollY: number = 0;
  private lastCameraZoom: number = 0;
  private ambientOverlay!: Phaser.GameObjects.Graphics;
  private lightGlowOverlay!: Phaser.GameObjects.Graphics;
  private shadowGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'RoomScene' });
    this.gridSystem = new GridSystem();
  }

  public adjustColor(color: number, factor: number): number {
    const r = Math.min(255, Math.max(0, Math.floor(((color >> 16) & 0xff) * factor)));
    const g = Math.min(255, Math.max(0, Math.floor(((color >> 8) & 0xff) * factor)));
    const b = Math.min(255, Math.max(0, Math.floor((color & 0xff) * factor)));
    return (r << 16) | (g << 8) | b;
  }

  /** Tile-state to restore when an occupant is removed — preserves entry-point invariant. */
  public baseTileStateFor(gridX: number, gridY: number): 'empty' | 'entry_point' {
    return this.entryPointTiles.has(`${gridX},${gridY}`) ? 'entry_point' : 'empty';
  }

  /**
   * Type-aware placement predicate (task 2.0.6).
   *
   * All types must pass the base `isTileWalkable` check — that alone already
   * excludes occupied tiles AND entry-point tiles (since `'entry_point'`
   * ≠ `'empty'`). Turrets additionally require the tile to sit on the outer
   * perimeter (any edge row or column) — i.e., wall-adjacent.
   *
   * Unknown / unhandled types fall through to the base walkable check.
   *
   * Mirrored server-side in `buyAndPlaceFurniture` — both sides must agree.
   */
  public isPlaceableFor(
    type: string | null | undefined,
    gridX: number,
    gridY: number,
    footprintW: number = 1,
    footprintH: number = 1
  ): boolean {
    const movingItem = useUIStore.getState().movingItem;
    let originalX = -1;
    let originalY = -1;
    let originalW = 0;
    let originalH = 0;

    if (movingItem) {
      const placed = useRoomStore.getState().placedItems.find(
        (p) => p.gridX === movingItem.x && p.gridY === movingItem.y
      );
      if (placed) {
        originalX = placed.gridX;
        originalY = placed.gridY;
        const isRotatedOdd = placed.rotation === 1 || placed.rotation === 3;
        originalW = isRotatedOdd ? placed.footprintH : placed.footprintW;
        originalH = isRotatedOdd ? placed.footprintW : placed.footprintH;
      }
    }

    // Scan target bounding box
    for (let x = gridX; x < gridX + footprintW; x++) {
      for (let y = gridY; y < gridY + footprintH; y++) {
        // Bounds check
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return false;

        // Skip check if it is part of the item's original footprint
        const isSelfPart =
          movingItem &&
          x >= originalX &&
          x < originalX + originalW &&
          y >= originalY &&
          y < originalY + originalH;

        if (!isSelfPart && !this.gridSystem.isTileWalkable(x, y)) {
          return false;
        }
      }
    }

    if (type === 'turret') {
      const max = this.gridSize - 1;
      for (let x = gridX; x < gridX + footprintW; x++) {
        for (let y = gridY; y < gridY + footprintH; y++) {
          const onPerimeter = x === 0 || x === max || y === 0 || y === max;
          if (!onPerimeter) return false;
        }
      }
    }

    return true;
  }

  create() {
    SoundManager.getInstance().playMusic('safe_room');
    BootScene.regenerateEnemyTextures(this, null);
    this.gridSize = useRoomStore.getState().gridSize ?? 10;
    this.gridSystem = new GridSystem(this.gridSize);

    // Calculate visual offset to center the grid
    this.offsetX = this.scale.width / 2;
    this.offsetY = this.scale.height / 4;

    this.pathDebugGraphics = this.add.graphics().setDepth(1000);

    // Defense-view coverage overlay (task 2.0.11). Depth 0.25 so it sits
    // above the floor (default 0) but below entry-point markers (0.5) and
    // all furniture (x+y+1). Empty until `enterDefenseView()` is called.
    this.defenseViewGraphics = this.add.graphics().setDepth(0.25);

    // Render Floor
    const cosmetics = useRoomStore.getState().cosmetics;
    const activeRoomSkin = usePlayerStore.getState().activeRoomSkin;
    const floorType = activeRoomSkin === 'neon_glitch' ? 'neon_glitch' : (cosmetics?.floorType || 'tile');
    const floorKey = `floor_${floorType}`;

    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const screenPos = IsometricEngine.worldToScreen(x, y, 0, this.gridSize);
        // The tile's origin will default to 0.5, 0.5
        const tile = this.add.image(screenPos.x + this.offsetX, screenPos.y + this.offsetY, floorKey);
        tile.setData('gridX', x);
        tile.setData('gridY', y);
        this.floorTiles.push(tile);
      }
    }

    // Hydrate entry points into the grid (must run before placed-item hydration so
    // a legacy DB row on an entry tile gets defensively skipped, and before the
    // wall draw so it can color per-segment by entry type).
    const entryPoints = useRoomStore.getState().entryPoints;
    for (const ep of entryPoints) {
      const tile = entryTileFor(ep, this.gridSize);
      if (tile) {
        this.gridSystem.setTileState(tile.x, tile.y, 'entry_point');
        this.entryPointTiles.add(`${tile.x},${tile.y}`);
      }
    }

    // Per-segment walls (grey, with per-entry tint at entry positions).
    this.wallGraphics = this.add.graphics();
    this.wallGraphics.setDepth(0.5);
    this.drawWalls();

    // Entry-point floor markers — one diamond per entry tile, rendered above the
    // floor but below furniture (depth = x + y + 0.5, with furniture at x + y + 1).
    for (const ep of entryPoints) {
      const tile = entryTileFor(ep, this.gridSize);
      if (!tile) continue;
      const screenPos = IsometricEngine.worldToScreen(tile.x, tile.y, this.currentRotation, this.gridSize);
      const sprite = this.add.image(
        screenPos.x + this.offsetX,
        screenPos.y + this.offsetY,
        ENTRY_SPRITE_KEYS[ep.type],
      );
      sprite.setData('gridX', tile.x);
      sprite.setData('gridY', tile.y);
      sprite.setDepth(tile.x + tile.y + 0.5);
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0.6, to: 1.0 },
        yoyo: true,
        repeat: -1,
        duration: 1200,
        ease: 'Sine.easeInOut',
      });
      this.entryPointSprites.push(sprite);
    }

    // Create a 2x2 white dot texture for particles
    const dotGraphics = new Phaser.GameObjects.Graphics(this);
    dotGraphics.fillStyle(0xffffff, 1);
    dotGraphics.fillCircle(2, 2, 2);
    dotGraphics.generateTexture('glow_particle', 4, 4);
    dotGraphics.destroy();

    // Floating blueprint particles to give the room scene some high-tech cyberpunk flare
    const particleEmitter = this.add.particles(0, 0, 'glow_particle', {
        x: { min: this.offsetX - 400, max: this.offsetX + 400 },
        y: { min: this.offsetY - 150, max: this.offsetY + 350 },
        lifespan: { min: 4000, max: 8000 },
        speedY: { min: -10, max: -35 },
        speedX: { min: -8, max: 8 },
        scale: { start: 0.3, end: 1.2 },
        alpha: { start: 0.6, end: 0 },
        tint: [0x06b6d4, 0x00ffcc, 0x3b82f6],
        frequency: 220,
        maxParticles: 40
    });
    particleEmitter.setDepth(0.35); // Sit above floor (0) and below furniture/markers

    // Centering the Camera & Dynamic Zoom Auto-Scaling (Task 9.0.24)
    const baseZoom = 10 / this.gridSize;
    this.cameras.main.setZoom(baseZoom);
    this.cameras.main.centerOn(this.offsetX, this.offsetY);

    // Zoom (Mouse Wheel)
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        const currentZoom = this.cameras.main.zoom;
        // Determine zoom factor based on wheel direction
        const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
        let newZoom = currentZoom * zoomFactor;

        // Clamp the zoom relative to dynamic grid size to maintain base scale
        const minZoom = 0.5 * baseZoom;
        const maxZoom = 2.0;
        newZoom = Phaser.Math.Clamp(newZoom, minZoom, maxZoom);
        this.cameras.main.zoom = newZoom;
      }
    );

    // Pan (Pointer Drag)
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;

      this.cameras.main.stopFollow();

      // Adjust for camera zoom so dragging feels 1:1 with the pointer
      this.cameras.main.scrollX -=
        (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -=
        (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
    });

    const placedItems = useRoomStore.getState().placedItems;

    placedItems.forEach((item, index) => {
      // Prevent placing items out of bounds just in case of stale DB state
      if (this.gridSystem.isTileWalkable(item.gridX, item.gridY)) {
        const sprite = new FurnitureSprite(
            this,
            item.gridX,
            item.gridY,
            item.spriteKey,
            item.footprintW,
            item.footprintH,
            { isDamaged: item.isDamaged }
        );
        sprite.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
        sprite.setFurnitureRotation(item.rotation ?? 0);
        if (item.isDamaged) {
          sprite.setTint(0x664444);
          sprite.setAlpha(0.7);
        }
        this.furnitureItems.push(sprite);
        
        // Occupy all tiles covered by the rotated footprint
        for (let x = sprite.gridX; x < sprite.gridX + sprite.footprintW; x++) {
          for (let y = sprite.gridY; y < sprite.gridY + sprite.footprintH; y++) {
            this.gridSystem.setTileState(x, y, 'occupied');
          }
        }
        
        // Dynamic custom poster rendering checks
        this.applyCustomPosterTexture(sprite, item, index * 40 + 400);
        
        // Holographic boss pedestal projection check
        this.applyHologramProjection(sprite, item, index * 40 + 400);

        // Cyber-pop staggered cascade intro animation
        sprite.setScale(0);
        sprite.setAlpha(0);
        this.tweens.add({
          targets: sprite,
          scaleX: 1,
          scaleY: 1,
          alpha: item.isDamaged ? 0.7 : 1,
          duration: 400,
          delay: index * 40, // 40ms stagger per item
          ease: 'Back.easeOut',
          easeParams: [1.2]
        });
      }
    });

    // Keyboard listeners for rotation
    this.input.keyboard?.on('keydown-Q', () => this.rotateGrid(-1));
    this.input.keyboard?.on('keydown-E', () => this.rotateGrid(1));

    const handleChangeMode = (mode: string) => {
      if (!this.sys || !this.sys.isActive()) return;
      SoundManager.getInstance().playSfx('click');
      const wasDefenseView = this.defenseViewActive;
      this.currentMode = mode;
      if (mode === 'edit') {
        this.scene.wake('RoomEditorScene');
      }
      if (mode === 'defense-view' && !wasDefenseView) {
        this.enterDefenseView();
      } else if (mode !== 'defense-view' && wasDefenseView) {
        this.exitDefenseView();
      }
    };

    const handleRemovalSuccess = (payload: { x: number; y: number }) => {
      if (!this.sys || !this.sys.isActive()) return;
      const idx = this.furnitureItems.findIndex(
        (f) => f.gridX === payload.x && f.gridY === payload.y,
      );
      if (idx >= 0) {
        const sprite = this.furnitureItems[idx];
        this.stopHologramFlicker(sprite);
        
        const pedestalInfo = this.activeBossPedestals.get(sprite);
        if (pedestalInfo) {
          pedestalInfo.projection.destroy();
          this.stopHologramFlicker(pedestalInfo.projection);
          this.activeBossPedestals.delete(sprite);
        }

        this.furnitureItems.splice(idx, 1);

        // Reset all grid tiles in the footprint
        for (let x = sprite.gridX; x < sprite.gridX + sprite.footprintW; x++) {
          for (let y = sprite.gridY; y < sprite.gridY + sprite.footprintH; y++) {
            this.gridSystem.setTileState(x, y, this.baseTileStateFor(x, y));
          }
        }

        SoundManager.getInstance().playSfx('click');
        this.tweens.add({
          targets: sprite,
          scaleX: 0,
          scaleY: 0,
          alpha: 0,
          angle: 45,
          duration: 250,
          ease: 'Back.easeIn',
          onComplete: () => {
            sprite.destroy();
          }
        });
      }
      useRoomStore.getState().removePlacedItemAt(payload.x, payload.y);
    };

    const handleRotationSuccess = (payload: { x: number; y: number; rotation: number }) => {
      if (!this.sys || !this.sys.isActive()) return;
      const sprite = this.furnitureItems.find(
        (f) => f.gridX === payload.x && f.gridY === payload.y,
      );
      if (sprite) {
        sprite.setFurnitureRotation(payload.rotation);

        SoundManager.getInstance().playSfx('click');
        sprite.setScale(1.15, 0.85);
        this.tweens.add({
          targets: sprite,
          scaleX: 1,
          scaleY: 1,
          duration: 300,
          ease: 'Back.easeOut',
          easeParams: [1.5]
        });
      }
      useRoomStore.getState().rotatePlacedItemAt(payload.x, payload.y, payload.rotation);
    };

    const handleRoomUpgraded = () => {
      if (!this.sys || !this.sys.isActive()) return;
      this.scene.restart();
    };

    const handleCosmeticsChanged = (payload: { wallColor: number; floorType: string }) => {
      if (!this.sys || !this.sys.isActive()) return;
      // 1. Redraw walls
      this.drawWalls();
      // 2. Swapping tile texture
      const activeSkin = usePlayerStore.getState().activeRoomSkin;
      const floorType = activeSkin === 'neon_glitch' ? 'neon_glitch' : payload.floorType;
      const floorKey = `floor_${floorType}`;
      this.floorTiles.forEach((tile) => {
        if (tile && tile.scene && tile.setTexture) {
          tile.setTexture(floorKey);
        }
      });
    };

    const handleRepairSuccess = (payload: { x: number; y: number }) => {
      if (!this.sys || !this.sys.isActive()) return;
      const sprite = this.furnitureItems.find(
        (f) => f.gridX === payload.x && f.gridY === payload.y,
      );
      if (sprite) {
        sprite.isDamaged = false;
        sprite.clearTint();
        sprite.setAlpha(1.0);
        SoundManager.getInstance().playSfx('place_item');
      }
    };

    const handlePvpBreachStarted = () => {
      if (!this.sys || !this.sys.isActive()) return;
      SoundManager.getInstance().playMusic('combat_tension');
      SoundManager.getInstance().playSfx('alarm');
      this.cameras.main.flash(500, 255, 0, 0);
      this.triggerGlitchDecal(1.0);
    };

    const handlePvpAttackerMoved = (payload: { memberIndex: number; x: number; y: number }) => {
      if (!this.sys || !this.sys.isActive()) return;
      this.updateHolographicMarker(payload.memberIndex, payload.x, payload.y);
    };

    const handlePvpRaidCompleted = () => {
      if (!this.sys || !this.sys.isActive()) return;
      SoundManager.getInstance().playMusic('safe_room');
      this.holographicMarkers.forEach(marker => marker.destroy());
      this.holographicMarkers.clear();
    };

    const handlePosterUpdated = (payload: { id: string; gridX: number; gridY: number; customImageUrl: string; moderationStatus: string; moderationError?: string | null; hologramSettings?: any }) => {
      if (!this.sys || !this.sys.isActive()) return;
      const sprite = this.furnitureItems.find(f => f.gridX === payload.gridX && f.gridY === payload.gridY);
      if (sprite) {
        const mockItem = {
          id: payload.id,
          spriteKey: 'furniture_custom_poster',
          customImageUrl: payload.customImageUrl,
          moderationStatus: payload.moderationStatus,
          moderationError: payload.moderationError,
          hologramSettings: payload.hologramSettings,
        };
        this.applyCustomPosterTexture(sprite, mockItem);
      }
    };

    const handlePedestalUpdated = (payload: { id: string; gridX: number; gridY: number; hologramSettings: any }) => {
      if (!this.sys || !this.sys.isActive()) return;
      const sprite = this.furnitureItems.find(f => f.gridX === payload.gridX && f.gridY === payload.gridY);
      if (sprite) {
        this.applyHologramProjection(sprite, { hologram_settings: payload.hologramSettings, spriteKey: 'furniture_boss_pedestal' });
      }
    };

    const handleMoveSuccess = (payload: { oldX: number; oldY: number; newX: number; newY: number }) => {
      if (!this.sys || !this.sys.isActive()) return;
      const sprite = this.furnitureItems.find(
        (f) => f.gridX === payload.oldX && f.gridY === payload.oldY,
      );
      if (sprite) {
        // Reset all grid tiles in the old footprint
        for (let x = sprite.gridX; x < sprite.gridX + sprite.footprintW; x++) {
          for (let y = sprite.gridY; y < sprite.gridY + sprite.footprintH; y++) {
            this.gridSystem.setTileState(x, y, this.baseTileStateFor(x, y));
          }
        }

        // Update coordinate properties on the sprite
        sprite.gridX = payload.newX;
        sprite.gridY = payload.newY;
        sprite.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);

        // Occupy all grid tiles in the new footprint
        for (let x = sprite.gridX; x < sprite.gridX + sprite.footprintW; x++) {
          for (let y = sprite.gridY; y < sprite.gridY + sprite.footprintH; y++) {
            this.gridSystem.setTileState(x, y, 'occupied');
          }
        }

        SoundManager.getInstance().playSfx('place_item');
        sprite.setScale(0.8, 1.25);
        this.tweens.add({
          targets: sprite,
          scaleX: 1,
          scaleY: 1,
          duration: 400,
          ease: 'Back.easeOut',
          easeParams: [1.5],
        });

        // Spawn a beautiful visual holographic particle burst in custom wallColor
        const wallColor = useRoomStore.getState().cosmetics?.wallColor ?? 0x06b6d4;
        const particles = this.add.particles(sprite.x, sprite.y - 16, 'glow_particle', {
          speed: { min: 40, max: 130 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 0.85, end: 0 },
          lifespan: 500,
          tint: wallColor,
          maxParticles: 12,
          blendMode: 'ADD',
        });
        this.time.delayedCall(600, () => {
          particles.destroy();
        });
      }
      useRoomStore.getState().movePlacedItemAt(payload.oldX, payload.oldY, payload.newX, payload.newY);
    };

    EventBus.on('change-mode', handleChangeMode);
    EventBus.on('removal-success', handleRemovalSuccess);
    EventBus.on('rotation-success', handleRotationSuccess);
    EventBus.on('room-upgraded', handleRoomUpgraded);
    EventBus.on('cosmetics-changed', handleCosmeticsChanged);
    EventBus.on('repair-success', handleRepairSuccess);
    EventBus.on('pvp-breach-started', handlePvpBreachStarted);
    EventBus.on('pvp-attacker-moved', handlePvpAttackerMoved);
    EventBus.on('pvp-raid-completed', handlePvpRaidCompleted);
    EventBus.on('poster-updated', handlePosterUpdated);
    EventBus.on('pedestal-updated', handlePedestalUpdated);
    EventBus.on('move-success', handleMoveSuccess);

    const cleanup = () => {
      SoundManager.getInstance().stopMusic();
      EventBus.off('change-mode', handleChangeMode);
      EventBus.off('removal-success', handleRemovalSuccess);
      EventBus.off('rotation-success', handleRotationSuccess);
      EventBus.off('room-upgraded', handleRoomUpgraded);
      EventBus.off('cosmetics-changed', handleCosmeticsChanged);
      EventBus.off('repair-success', handleRepairSuccess);
      EventBus.off('pvp-breach-started', handlePvpBreachStarted);
      EventBus.off('pvp-attacker-moved', handlePvpAttackerMoved);
      EventBus.off('pvp-raid-completed', handlePvpRaidCompleted);
      EventBus.off('poster-updated', handlePosterUpdated);
      EventBus.off('pedestal-updated', handlePedestalUpdated);
      EventBus.off('move-success', handleMoveSuccess);
      this.holographicMarkers.forEach(marker => marker.destroy());
      this.holographicMarkers.clear();
      this.activeBossPedestals.forEach(info => {
        info.projection.destroy();
        this.stopHologramFlicker(info.projection);
      });
      this.activeBossPedestals.clear();
      this.exitDefenseView();
    };

    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);

    // Instantiate Player Entity
    const playerTexture = this.textures.exists('entity_drone_slot_1') ? 'entity_drone_slot_1' : 'entity_drone';
    this.playerEntity = new EntitySprite(this, 0, 0, playerTexture);
    this.playerEntity.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);

    // Disable default browser context menu on canvas
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Right Click Context Menu (Direct selection bypassing player walking and out-of-bounds restrictions)
      if (pointer.rightButtonDown() || pointer.button === 2) {
        const worldCoords = IsometricEngine.screenToWorld(
          pointer.worldX, pointer.worldY,
          this.offsetX, this.offsetY,
          this.currentRotation,
          this.gridSize
        );
        const targetFurniture = this.furnitureItems.find(f => f.occupies(worldCoords.x, worldCoords.y));
        if (targetFurniture) {
          const spriteKey = targetFurniture.texture.key;
          const isDamaged = targetFurniture.isDamaged;
          const targetX = targetFurniture.gridX;
          const targetY = targetFurniture.gridY;
          
          EventBus.emit('open-context-menu', {
            spriteKey: spriteKey,
            x: pointer.x,
            y: pointer.y,
            gridX: targetX,
            gridY: targetY,
            isDamaged
          });
        }
        return;
      }

      if (this.currentMode !== 'view') return;

      const worldCoords = IsometricEngine.screenToWorld(pointer.worldX, pointer.worldY, this.offsetX, this.offsetY, this.currentRotation, this.gridSize);

      const tileState = this.gridSystem.getTileState(worldCoords.x, worldCoords.y);

      if (tileState === 'empty') {
          const path = this.gridSystem.findPath(
              this.playerEntity.currentGridX, 
              this.playerEntity.currentGridY, 
              worldCoords.x, 
              worldCoords.y
          );

          if (path && path.length > 0) {
              this.drawDebugPath(path);
              this.playerEntity.walkPath(path, this.offsetX, this.offsetY, this.currentRotation);
              this.focusCameraOnPlayer();
          }
      } else if (tileState === 'occupied') {
          const path = this.gridSystem.findPathToAdjacent(
              this.playerEntity.currentGridX, 
              this.playerEntity.currentGridY, 
              worldCoords.x, 
              worldCoords.y
          );

          if (path) {
              this.drawDebugPath(path);
              this.playerEntity.walkPath(path, this.offsetX, this.offsetY, this.currentRotation, () => {
                  const targetFurniture = this.furnitureItems.find(f => f.occupies(worldCoords.x, worldCoords.y));
                  const spriteKey = targetFurniture ? targetFurniture.texture.key : 'placed_item';
                  const isDamaged = targetFurniture ? targetFurniture.isDamaged : false;
                  const targetX = targetFurniture ? targetFurniture.gridX : worldCoords.x;
                  const targetY = targetFurniture ? targetFurniture.gridY : worldCoords.y;
                  const screenPos = IsometricEngine.worldToScreen(targetX, targetY, this.currentRotation, this.gridSize);
                  
                  EventBus.emit('open-context-menu', {
                      spriteKey: spriteKey,
                      x: screenPos.x + this.offsetX,
                      y: screenPos.y + this.offsetY,
                      gridX: targetX,
                      gridY: targetY,
                      isDamaged
                  });
              });
              this.focusCameraOnPlayer();
          }
      }
    });

    // Launch the editor scene in parallel but sleep it initially
    this.scene.launch('RoomEditorScene');
    this.scene.sleep('RoomEditorScene');

    // Initialize ambient and light glow overlays
    this.shadowGraphics = this.add.graphics().setDepth(0.1);
    this.ambientOverlay = this.add.graphics().setDepth(900);
    this.lightGlowOverlay = this.add.graphics().setDepth(901);
    this.lightGlowOverlay.setBlendMode(Phaser.BlendModes.ADD);

    this.focusCameraOnPlayer();
  }

  public focusCameraOnPlayer() {
    this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);
  }

  rotateGrid(direction: 1 | -1) {
    this.currentRotation = (this.currentRotation + direction + 4) % 4;

    this.floorTiles.forEach(tile => {
      const gridX = tile.getData('gridX');
      const gridY = tile.getData('gridY');

      const target = IsometricEngine.worldToScreen(
        gridX,
        gridY,
        this.currentRotation,
        this.gridSize
      );

      this.tweens.add({
        targets: tile,
        x: target.x + this.offsetX,
        y: target.y + this.offsetY,
        duration: 300,
        ease: Phaser.Math.Easing.Quadratic.Out,
      });
    });

    this.furnitureItems.forEach(item => {
      // Rather than snap, we compute the new target and tween it so the furniture rotates
      // smoothly alongside the floor grid visually. We still call updateIsometricPosition
      // eventually if needed, but depth update happens during grid orientation.

      // Calculate depth based on original grid position mapped through rotation?
      // Actually, depth sorting changes when the grid rotates.
      // For MVP snap, let's just snap it as strictly instructed.
      item.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
    });

    // Re-tween entry-point markers and redraw walls in the new orientation.
    this.entryPointSprites.forEach((sprite) => {
      const gridX = sprite.getData('gridX');
      const gridY = sprite.getData('gridY');
      const target = IsometricEngine.worldToScreen(gridX, gridY, this.currentRotation, this.gridSize);
      this.tweens.add({
        targets: sprite,
        x: target.x + this.offsetX,
        y: target.y + this.offsetY,
        duration: 300,
        ease: Phaser.Math.Easing.Quadratic.Out,
      });
      sprite.setDepth(gridX + gridY + 0.5);
    });
    this.drawWalls();

    if (this.playerEntity) {
      this.playerEntity.scene.tweens.killTweensOf(this.playerEntity);
      this.playerEntity.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
    }

    // Defense-view coverage is tile-positional — redraw it at the new rotation
    // so orange/yellow bands stay anchored to their owning sprites.
    if (this.defenseViewActive) {
      this.drawDefenseViewOverlay();
    }

    EventBus.emit('grid-rotated', this.currentRotation);
  }

  /**
   * Enter defense-view (task 2.0.11): start an alpha pulse on every placed
   * furniture sprite and render each defense item's range/trigger zone
   * simultaneously on the grid. Intended to be a read-only visualization —
   * pathfinding pointerdown is gated on `currentMode === 'view'` so clicks
   * in this mode are inert.
   *
   * NOTE: pulses every placed item (furniture + defenses) so the player's
   * placed-item set reads as "all live, all visible". If that proves noisy
   * we can filter to defense-type only — catalog lookup already happens in
   * `drawDefenseViewOverlay` so the metadata is already available.
   */
  private enterDefenseView(): void {
    this.defenseViewActive = true;
    this.drawDefenseViewOverlay();

    for (const item of this.furnitureItems) {
      const tween = this.tweens.add({
        targets: item,
        alpha: { from: DEFENSE_PULSE_FROM, to: DEFENSE_PULSE_TO },
        yoyo: true,
        repeat: -1,
        duration: DEFENSE_PULSE_DURATION,
        ease: 'Sine.easeInOut',
      });
      this.defenseViewTweens.push(tween);
    }
  }

  /** Exit defense-view cleanly — kill pulse tweens, reset alpha to 1 on every
   *  sprite (tweens left running would leave alphas at random points in the
   *  yoyo cycle), clear the overlay. Idempotent: safe to call when inactive. */
  private exitDefenseView(): void {
    this.defenseViewActive = false;
    this.defenseViewGraphics.clear();
    for (const tween of this.defenseViewTweens) {
      tween.stop();
    }
    this.defenseViewTweens = [];
    for (const item of this.furnitureItems) {
      this.tweens.killTweensOf(item);
      item.setAlpha(1);
    }
  }

  /**
   * Union every placed defense's range / trigger zone into the overlay.
   *
   * Data flow: `useRoomStore.placedItems` carries grid coords + spriteKey.
   * `useRoomStore.catalog` is keyed to look up `type` + `stats` per spriteKey.
   * For each placed defense we feed those into {@link rangeTilesFor} and
   * paint the two bands via the shared {@link paintRangeBand} helper — same
   * drawing primitive used by `RoomEditorScene` for the ghost-sprite range,
   * so the two views share visual vocabulary.
   *
   * Overlapping tiles stack alpha — denser coverage reads as denser color,
   * which is a useful signal rather than a bug.
   */
  private drawDefenseViewOverlay(scanlineOffset = 0): void {
    this.defenseViewGraphics.clear();

    const catalog = useRoomStore.getState().catalog;
    const placedItems = useRoomStore.getState().placedItems;
    if (catalog.length === 0 || placedItems.length === 0) return;

    const catalogByKey = new Map(catalog.map((c) => [c.sprite_key, c]));

    for (const placed of placedItems) {
      const entry = catalogByKey.get(placed.spriteKey);
      if (!entry) continue;

      const isRotatedOdd = placed.rotation === 1 || placed.rotation === 3;
      const fpW = isRotatedOdd ? placed.footprintH : placed.footprintW;
      const fpH = isRotatedOdd ? placed.footprintW : placed.footprintH;

      const { primary, alert } = rangeTilesFor(
        entry.type,
        entry.stats,
        placed.gridX,
        placed.gridY,
        this.gridSize,
        fpW,
        fpH
      );
      if (primary.length === 0 && alert.length === 0) continue;

      paintRangeBand(
        this.defenseViewGraphics, primary, RANGE_FILL_COLOR.primary,
        this.currentRotation, this.offsetX, this.offsetY,
        undefined, undefined, scanlineOffset,
      );
      paintRangeBand(
        this.defenseViewGraphics, alert, RANGE_FILL_COLOR.alert,
        this.currentRotation, this.offsetX, this.offsetY,
        undefined, undefined, scanlineOffset,
      );
    }
  }

  /**
   * Draw the four outer walls as `grid_size` thick line segments per wall, one
   * per tile-length along the edge. Segments that coincide with an entry-point
   * `position` are tinted with that entry's color.
   *
   * Called in {@link create} and on every {@link rotateGrid}.
   */
  private drawWalls(): void {
    this.wallGraphics.clear();
    const size = this.gridSize;
    const entryPoints = useRoomStore.getState().entryPoints;
    const cosmetics = useRoomStore.getState().cosmetics;
    const wallColor = cosmetics?.wallColor ?? WALL_COLOR;

    // Calculate back corner based on actual screen projections
    const corners = [
      { name: 'A', x: 0,    y: 0 },
      { name: 'B', x: size, y: 0 },
      { name: 'C', x: size, y: size },
      { name: 'D', x: 0,    y: size }
    ];

    const projected = corners.map(c => {
      const pos = IsometricEngine.worldToScreen(c.x, c.y, this.currentRotation, size);
      return { ...c, screenX: pos.x, screenY: pos.y };
    });

    projected.sort((a, b) => a.screenY - b.screenY);
    const backCorner = projected[0];

    const isBackWall = (wall: EntryPointWall): boolean => {
      if (backCorner.name === 'A') return wall === 'north' || wall === 'west';
      if (backCorner.name === 'B') return wall === 'north' || wall === 'east';
      if (backCorner.name === 'C') return wall === 'south' || wall === 'east';
      if (backCorner.name === 'D') return wall === 'south' || wall === 'west';
      return false;
    };

    const segment = (
      wall: EntryPointWall,
      position: number,
      start: { x: number; y: number },
      end: { x: number; y: number },
    ): void => {
      const s = IsometricEngine.worldToScreen(start.x, start.y, this.currentRotation, this.gridSize);
      const e = IsometricEngine.worldToScreen(end.x, end.y, this.currentRotation, this.gridSize);
      const startX = s.x + this.offsetX;
      const startY = s.y + this.offsetY;
      const endX = e.x + this.offsetX;
      const endY = e.y + this.offsetY;

      const ep = entryPoints.find((item) => item.wall === wall && item.position === position);

      if (isBackWall(wall)) {
        // High-Fidelity 3D Wall Segment
        const H = 64; // Wall Height

        // Dynamic Lighting: Lighter shade for back-right, darker for back-left based on cosmetics
        const faceColor = (startX < endX)
          ? this.adjustColor(wallColor, 0.22)
          : this.adjustColor(wallColor, 0.15);
        const panelOutlineColor = (startX < endX)
          ? this.adjustColor(wallColor, 0.28)
          : this.adjustColor(wallColor, 0.20);

        // 1. Draw solid wall background polygon
        this.wallGraphics.fillStyle(faceColor, 1.0);
        this.wallGraphics.beginPath();
        this.wallGraphics.moveTo(startX, startY);
        this.wallGraphics.lineTo(endX, endY);
        this.wallGraphics.lineTo(endX, endY - H);
        this.wallGraphics.lineTo(startX, startY - H);
        this.wallGraphics.closePath();
        this.wallGraphics.fillPath();

        // 2. Custom inserts for entry points
        if (ep) {
          if (ep.type === 'door') {
            // Door Segment: draw high-tech sliding door frame
            this.wallGraphics.fillStyle(0x0a0f1d, 1.0);
            // Draw inset door panel
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - 5);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - 5);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - H + 10);
            this.wallGraphics.lineTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - H + 10);
            this.wallGraphics.closePath();
            this.wallGraphics.fillPath();

            // Draw glowing door arch
            this.wallGraphics.lineStyle(4, 0xf97316, 1.0); // Neon Orange Door Frame
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15);
            this.wallGraphics.lineTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - H + 10);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - H + 10);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15);
            this.wallGraphics.strokePath();

            // Hazard stripe indicators
            this.wallGraphics.lineStyle(2, 0xffcc00, 0.8);
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.3, startY + (endY - startY) * 0.3 - H + 18);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.3, endY - (endY - startY) * 0.3 - H + 18);
            this.wallGraphics.strokePath();
            
            // Indicator light
            this.wallGraphics.fillStyle(0x10b981, 1.0); // Active Green
            this.wallGraphics.fillCircle((startX + endX) / 2, (startY + endY) / 2 - H + 25, 3);
          } else if (ep.type === 'window') {
            // Window Segment: semi-transparent glowing laser pane
            this.wallGraphics.fillStyle(0x06b6d4, 0.3); // Cyan laser glass
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.1, startY + (endY - startY) * 0.1 - 10);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.1, endY - (endY - startY) * 0.1 - 10);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.1, endY - (endY - startY) * 0.1 - H + 10);
            this.wallGraphics.lineTo(startX + (endX - startX) * 0.1, startY + (endY - startY) * 0.1 - H + 10);
            this.wallGraphics.closePath();
            this.wallGraphics.fillPath();

            // Window frame border
            this.wallGraphics.lineStyle(3, 0x334155, 1.0);
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.1, startY + (endY - startY) * 0.1 - 10);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.1, endY - (endY - startY) * 0.1 - 10);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.1, endY - (endY - startY) * 0.1 - H + 10);
            this.wallGraphics.lineTo(startX + (endX - startX) * 0.1, startY + (endY - startY) * 0.1 - H + 10);
            this.wallGraphics.closePath();
            this.wallGraphics.strokePath();

            // Laser grids
            this.wallGraphics.lineStyle(1, 0x06b6d4, 0.7);
            const midY = (startY + endY) / 2 - H / 2;
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.1, midY);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.1, midY);
            this.wallGraphics.strokePath();

            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo((startX + endX) / 2, (startY + endY) / 2 - 10);
            this.wallGraphics.lineTo((startX + endX) / 2, (startY + endY) / 2 - H + 10);
            this.wallGraphics.strokePath();
          } else if (ep.type === 'vent') {
            // Vent Segment: orange backlight + louvers
            this.wallGraphics.fillStyle(0xf97316, 0.7); // Orange glow
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - 12);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - 12);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - H + 12);
            this.wallGraphics.lineTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - H + 12);
            this.wallGraphics.closePath();
            this.wallGraphics.fillPath();

            // Charcoal grill blades
            this.wallGraphics.lineStyle(3, 0x0f172a, 1.0);
            for (let i = 1; i <= 4; i++) {
              const fraction = i / 5;
              const hOffset = H * fraction;
              this.wallGraphics.beginPath();
              this.wallGraphics.moveTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - hOffset);
              this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - hOffset);
              this.wallGraphics.strokePath();
            }

            // Vent Frame border
            this.wallGraphics.lineStyle(2, 0x475569, 1.0);
            this.wallGraphics.beginPath();
            this.wallGraphics.moveTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - 12);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - 12);
            this.wallGraphics.lineTo(endX - (endX - startX) * 0.15, endY - (endY - startY) * 0.15 - H + 12);
            this.wallGraphics.lineTo(startX + (endX - startX) * 0.15, startY + (endY - startY) * 0.15 - H + 12);
            this.wallGraphics.closePath();
            this.wallGraphics.strokePath();
          }
        } else {
          // Standard Wall: Draw sleek bulkhead panels
          this.wallGraphics.lineStyle(1.5, panelOutlineColor, 1.0);
          this.wallGraphics.beginPath();
          this.wallGraphics.moveTo(startX + (endX - startX) * 0.1, startY + (endY - startY) * 0.1 - 10);
          this.wallGraphics.lineTo(endX - (endX - startX) * 0.1, endY - (endY - startY) * 0.1 - 10);
          this.wallGraphics.lineTo(endX - (endX - startX) * 0.1, endY - (endY - startY) * 0.1 - H + 10);
          this.wallGraphics.lineTo(startX + (endX - startX) * 0.1, startY + (endY - startY) * 0.1 - H + 10);
          this.wallGraphics.closePath();
          this.wallGraphics.strokePath();

          // Draw an aesthetic vertical conduit line inside the panel
          this.wallGraphics.lineStyle(1.0, panelOutlineColor, 0.6);
          this.wallGraphics.beginPath();
          this.wallGraphics.moveTo((startX + endX) / 2, (startY + endY) / 2 - 10);
          this.wallGraphics.lineTo((startX + endX) / 2, (startY + endY) / 2 - H + 10);
          this.wallGraphics.strokePath();
        }

        // 3. Glowing neon tube border along the top
        const neonColor = ep ? ENTRY_WALL_COLORS[ep.type] : wallColor; // Custom vibrant wallColor default
        this.wallGraphics.lineStyle(4, neonColor, 1.0);
        this.wallGraphics.beginPath();
        this.wallGraphics.moveTo(startX, startY - H);
        this.wallGraphics.lineTo(endX, endY - H);
        this.wallGraphics.strokePath();

        // 4. Double vertical seam between panels
        this.wallGraphics.lineStyle(2, 0x0a0f1d, 1.0);
        this.wallGraphics.beginPath();
        this.wallGraphics.moveTo(startX, startY);
        this.wallGraphics.lineTo(startX, startY - H);
        this.wallGraphics.strokePath();
      } else {
        // Low-Profile Glowing Boundary Laser Rail for Front Walls
        const laserColor = ep ? ENTRY_WALL_COLORS[ep.type] : 0x00ffcc; // Light Teal/Cyan Laser border
        this.wallGraphics.lineStyle(3, laserColor, 0.7);
        this.wallGraphics.beginPath();
        this.wallGraphics.moveTo(startX, startY);
        this.wallGraphics.lineTo(endX, endY);
        this.wallGraphics.strokePath();

        // Draw a tiny neon node at start and end
        this.wallGraphics.fillStyle(laserColor, 0.9);
        this.wallGraphics.fillCircle(startX, startY, 2);
      }
    };

    for (let p = 0; p < size; p++) {
      segment('north', p, { x: p,        y: 0 },    { x: p + 1,    y: 0 });
      segment('south', p, { x: p,        y: size }, { x: p + 1,    y: size });
      segment('east',  p, { x: size,     y: p },    { x: size,     y: p + 1 });
      segment('west',  p, { x: 0,        y: p },    { x: 0,        y: p + 1 });
    }
  }

  public placeFurniture(key: string, gridX: number, gridY: number): boolean {
    const catalogItem = useRoomStore.getState().catalog.find((c) => c.sprite_key === key);
    const footprintW = catalogItem?.footprint?.w ?? 1;
    const footprintH = catalogItem?.footprint?.h ?? 1;

    // Verify all tiles are walkable
    for (let x = gridX; x < gridX + footprintW; x++) {
      for (let y = gridY; y < gridY + footprintH; y++) {
        if (!this.gridSystem.isTileWalkable(x, y)) return false;
      }
    }

    // Occupy all tiles in the footprint
    for (let x = gridX; x < gridX + footprintW; x++) {
      for (let y = gridY; y < gridY + footprintH; y++) {
        this.gridSystem.setTileState(x, y, 'occupied');
      }
    }

    // Instantiate and position the sprite
    const item = new FurnitureSprite(this, gridX, gridY, key, footprintW, footprintH);
    item.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);

    this.furnitureItems.push(item);

    // Satisfying vertical spring squeeze/pop scale bounce
    item.setScale(0.8, 1.25);
    item.setAlpha(0.2);
    this.tweens.add({
      targets: item,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 350,
      ease: 'Back.easeOut',
      easeParams: [2.0]
    });

    SoundManager.getInstance().playSfx('place_item');
    this.triggerGlitchDecal(0.35);

    return true;
  }

  public drawDebugPath(path: {x: number, y: number}[] | null) {
    this.pathDebugGraphics.clear();
    if (!path || path.length === 0) return;

    this.pathDebugGraphics.lineStyle(4, 0x00ff00, 0.8);
    this.pathDebugGraphics.beginPath();

    path.forEach((node, index) => {
        // Project grid coordinates to screen coordinates
        const screenPos = IsometricEngine.worldToScreen(node.x, node.y, this.currentRotation, this.gridSize);
        const targetX = screenPos.x + this.offsetX;
        const targetY = screenPos.y + this.offsetY;

        if (index === 0) {
            this.pathDebugGraphics.moveTo(targetX, targetY);
        } else {
            this.pathDebugGraphics.lineTo(targetX, targetY);
        }
    });
    this.pathDebugGraphics.strokePath();
  }

  private updateHolographicMarker(memberIndex: number, gridX: number, gridY: number): void {
    const key = `marker_${memberIndex}`;
    let marker = this.holographicMarkers.get(key);

    const screenPos = IsometricEngine.worldToScreen(gridX, gridY, this.currentRotation, this.gridSize);
    const targetX = screenPos.x + this.offsetX;
    const targetY = screenPos.y + this.offsetY;

    if (!marker) {
      marker = this.add.graphics();
      marker.setDepth(1000); // Overlay on top of everything
      this.holographicMarkers.set(key, marker);

      marker.setScale(0);
      this.tweens.add({
        targets: marker,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        ease: 'Back.easeOut'
      });
    }

    this.tweens.add({
      targets: marker,
      x: targetX,
      y: targetY,
      duration: 200,
      ease: 'Quad.easeOut'
    });

    marker.clear();

    marker.lineStyle(2, 0xff3333, 0.9);
    marker.fillStyle(0xff3333, 0.4);
    marker.beginPath();
    marker.moveTo(0, -12);
    marker.lineTo(16, 0);
    marker.lineTo(0, 12);
    marker.lineTo(-16, 0);
    marker.closePath();
    marker.fillPath();
    marker.strokePath();

    marker.lineStyle(1, 0xff5555, 0.6);
    marker.strokeCircle(0, 0, 18);
  }

  public applyCustomPosterTexture(sprite: FurnitureSprite, item: any, flickerDelay = 0) {
    if (!item || item.spriteKey !== 'furniture_custom_poster') return;

    const settings = item.hologramSettings || item.hologram_settings;

    if (item.moderationStatus === 'approved' && item.customImageUrl) {
      const texKey = `custom_poster_tex_${item.id}`;
      const imgKey = `custom_poster_img_${item.id}`;

      // Start/update the dynamic alpha flicker loop
      this.applyHologramFlicker(sprite, settings, flickerDelay);

      // Register for dynamic scrolling scanlines animation
      this.activeCustomPosters.set(sprite, { item, texKey, imgKey });

      // Fast-path: if source image is already loaded, redraw and refresh immediately
      if (this.textures.exists(imgKey)) {
        this.projectPosterImage(texKey, imgKey, settings);
        sprite.setTexture(texKey);
        return;
      }

      this.load.image(imgKey, item.customImageUrl);
      this.load.once(`filecomplete-image-${imgKey}`, () => {
        this.projectPosterImage(texKey, imgKey, settings);
        if (sprite.active) {
          sprite.setTexture(texKey);
        }
      });
      this.load.start();
    } else {
      this.activeCustomPosters.delete(sprite);
      this.stopHologramFlicker(sprite);
      if (item.moderationStatus === 'pending') {
        sprite.setTexture('furniture_custom_poster_pending');
      } else if (item.moderationStatus === 'rejected') {
        sprite.setTexture('furniture_custom_poster_rejected');
      } else {
        sprite.setTexture('furniture_custom_poster');
      }
    }
  }

  public applyHologramProjection(sprite: FurnitureSprite, item: any, flickerDelay = 0) {
    if (!item || item.spriteKey !== 'furniture_boss_pedestal') return;

    const settings = item.hologramSettings || item.hologram_settings || {
      color: '#06b6d4',
      flicker: 0.15,
      scanlines: 0.40,
      noise: 0.10,
      boss: 'boss-ironjaw'
    };

    const boss = settings.boss || 'boss-ironjaw';
    const color = settings.color || '#06b6d4';

    const existing = this.activeBossPedestals.get(sprite);
    if (existing) {
      existing.projection.destroy();
      this.stopHologramFlicker(existing.projection);
    }

    const bossKey = `hologram_${boss}`;
    const initialTexture = this.textures.exists(`${bossKey}_dir_0`) ? `${bossKey}_dir_0` : 'boss_ironjaw_dir_0';

    const projection = this.add.sprite(sprite.x, sprite.y - 18, initialTexture);
    projection.setOrigin(0.5, 1);
    projection.setAlpha(0.6);
    projection.setDepth(sprite.depth + 1);

    const tintColor = Phaser.Display.Color.HexStringToColor(color).color;
    projection.setTint(tintColor);

    this.applyHologramFlicker(projection, settings, flickerDelay);

    this.activeBossPedestals.set(sprite, {
      projection,
      settings,
      lastSpinTime: this.time ? this.time.now : Date.now(),
      dir: 0
    });
  }

  public triggerGlitchDecal(intensity: number) {
    this.glitchIntensity = Math.max(this.glitchIntensity, intensity);
  }

  private applyHologramFlicker(sprite: any, settings: any, flickerDelay = 0) {
    this.stopHologramFlicker(sprite);

    const hologram = settings || {
      color: '#06b6d4',
      flicker: 0.15,
      scanlines: 0.40,
      noise: 0.10
    };

    if (!hologram.flicker || hologram.flicker <= 0) {
      return;
    }

    const startTween = () => {
      if (!sprite.active) return;

      const duration = Math.max(50, 100 / hologram.flicker);
      const minAlpha = Math.max(0.6, 1.0 - hologram.flicker * 0.35);

      sprite.hologramFlickerTween = this.tweens.add({
        targets: sprite,
        alpha: minAlpha,
        duration: duration,
        yoyo: true,
        repeat: -1,
        ease: 'Power1',
        onUpdate: () => {
          // Micro-flickers for hardware instability aesthetics
          if (Math.random() < 0.02 * hologram.flicker) {
            sprite.alpha = minAlpha * 0.7;
          }
        }
      });
    };

    if (flickerDelay > 0) {
      sprite.hologramFlickerTimer = this.time.delayedCall(flickerDelay, startTween);
    } else {
      startTween();
    }
  }

  private stopHologramFlicker(sprite: any) {
    if (this.activeCustomPosters) {
      this.activeCustomPosters.delete(sprite);
    }
    if (sprite.hologramFlickerTween) {
      sprite.hologramFlickerTween.stop();
      sprite.hologramFlickerTween = null;
    }
    if (sprite.hologramFlickerTimer) {
      sprite.hologramFlickerTimer.remove();
      sprite.hologramFlickerTimer = null;
    }
    sprite.setAlpha(1);
  }

  private projectPosterImage(texKey: string, imgKey: string, settings: any, scanlineOffset = 0) {
    let canvasTexture: Phaser.Textures.CanvasTexture | null = null;
    if (this.textures.exists(texKey)) {
      canvasTexture = this.textures.get(texKey) as Phaser.Textures.CanvasTexture;
      if (canvasTexture && canvasTexture.context) {
        canvasTexture.context.clearRect(0, 0, 64, 64);
      }
    } else {
      canvasTexture = this.textures.createCanvas(texKey, 64, 64);
    }
    if (!canvasTexture) return;
    const ctx = canvasTexture.context;
    
    // Copy the base custom poster pre-rendered block onto our CanvasTexture
    const baseTexture = this.textures.get('furniture_custom_poster').getSourceImage() as HTMLCanvasElement;
    if (baseTexture) {
      ctx.drawImage(baseTexture, 0, 0);
    }

    const loadedImg = this.textures.get(imgKey).getSourceImage() as HTMLImageElement;
    if (!loadedImg) return;

    const hologram = settings || {
      color: '#06b6d4',
      flicker: 0.15,
      scanlines: 0.40,
      noise: 0.10
    };

    // Tiny offscreen processing canvas for dynamic color tints, scanlines, and noise grain
    const width = loadedImg.width || 32;
    const height = loadedImg.height || 32;
    
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const oCtx = offscreen.getContext('2d');
    
    if (oCtx) {
      // 1. Base image
      oCtx.drawImage(loadedImg, 0, 0, width, height);

      // 2. Color tint overlay (source-atop preserves transparent details)
      if (hologram.color) {
        oCtx.save();
        oCtx.globalCompositeOperation = 'source-atop';
        oCtx.fillStyle = hologram.color;
        oCtx.fillRect(0, 0, width, height);
        oCtx.restore();
      }

      // 3. Scanline pattern overlay with scrolling offset
      if (hologram.scanlines > 0) {
        oCtx.save();
        oCtx.globalCompositeOperation = 'source-atop';
        oCtx.strokeStyle = `rgba(0, 0, 0, ${hologram.scanlines})`;
        oCtx.lineWidth = 1;
        
        const offset = Math.floor(scanlineOffset) % 4;
        for (let y = -4 + offset; y < height; y += 2) {
          if (y >= 0) {
            oCtx.beginPath();
            oCtx.moveTo(0, y);
            oCtx.lineTo(width, y);
            oCtx.stroke();
          }
        }
        oCtx.restore();
      }

      // 4. Digital static grain overlay
      if (hologram.noise > 0) {
        oCtx.save();
        oCtx.globalCompositeOperation = 'source-atop';
        const imgData = oCtx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const noiseAmount = hologram.noise * 255;
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() < hologram.noise) {
            const randNoise = (Math.random() - 0.5) * noiseAmount;
            data[i] = Math.min(255, Math.max(0, data[i] + randNoise));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + randNoise));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + randNoise));
          }
        }
        oCtx.putImageData(imgData, 0, 0);
        oCtx.restore();
      }

      // 5. Dynamic horizontal pixel screen tearing / glitch decals
      if (this.glitchIntensity > 0) {
        const numSlices = 5;
        const sliceHeight = height / numSlices;
        oCtx.save();
        const temp = document.createElement('canvas');
        temp.width = width;
        temp.height = height;
        const tCtx = temp.getContext('2d');
        if (tCtx) {
          tCtx.drawImage(offscreen, 0, 0);
          oCtx.clearRect(0, 0, width, height);
          for (let i = 0; i < numSlices; i++) {
            const sliceY = i * sliceHeight;
            const shift = (Math.random() - 0.5) * width * 0.3 * this.glitchIntensity;
            oCtx.drawImage(temp, 0, sliceY, width, sliceHeight, shift, sliceY, width, sliceHeight);
          }
        }
        oCtx.restore();
      }
    }

    const sourceCanvas = oCtx ? offscreen : loadedImg;

    // Skew and project onto Left face (facing South-East, parallel NW wall)
    ctx.save();
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.drawImage(sourceCanvas, 7, 2, 18, 18);
    ctx.restore();

    // Skew and project onto Right face (facing South-West, parallel NE wall)
    ctx.save();
    ctx.transform(1, -0.5, 0, 1, 0, 0);
    ctx.drawImage(sourceCanvas, 39, 34, 18, 18);
    ctx.restore();

    canvasTexture.refresh();
  }

  private cullTiles(): void {
    const cam = this.cameras.main;
    if (
      cam.scrollX === this.lastCameraScrollX &&
      cam.scrollY === this.lastCameraScrollY &&
      cam.zoom === this.lastCameraZoom
    ) {
      return;
    }

    this.lastCameraScrollX = cam.scrollX;
    this.lastCameraScrollY = cam.scrollY;
    this.lastCameraZoom = cam.zoom;

    const bounds = cam.worldView;
    const padding = 128; // Padding prevents visual pop-in near borders

    for (const tile of this.floorTiles) {
      if (tile) {
        const visible = (
          tile.x >= bounds.x - padding &&
          tile.x <= bounds.x + bounds.width + padding &&
          tile.y >= bounds.y - padding &&
          tile.y <= bounds.y + bounds.height + padding
        );
        tile.setVisible(visible);
      }
    }

    for (const item of this.furnitureItems) {
      if (item) {
        const visible = (
          item.x >= bounds.x - padding &&
          item.x <= bounds.x + bounds.width + padding &&
          item.y >= bounds.y - padding &&
          item.y <= bounds.y + bounds.height + padding
        );
        item.setVisible(visible);
      }
    }
  }

  update(time: number): void {
    this.cullTiles();

    // Glitch intensity decay (approx 300ms fully back to 0)
    if (this.glitchIntensity > 0) {
      const deltaFactor = this.sys.game.loop.delta / 16.66;
      this.glitchIntensity -= 0.05 * deltaFactor;
      if (this.glitchIntensity < 0) this.glitchIntensity = 0;
    }

    // Throttled scanline scroll crawler (Updates at ~20 FPS/every 50ms)
    const currentTime = time || Date.now();
    if ((this.activeCustomPosters.size > 0 || this.defenseViewActive) && currentTime - this.lastScanlineUpdateTime > 50) {
      this.lastScanlineUpdateTime = currentTime;
      const scanlineOffset = currentTime / 100;
      
      // 1. Scrolling custom posters
      if (this.activeCustomPosters.size > 0) {
        this.activeCustomPosters.forEach((data, sprite) => {
          if (sprite.active && sprite.visible) {
            const settings = data.item.hologramSettings || data.item.hologram_settings;
            this.projectPosterImage(data.texKey, data.imgKey, settings, scanlineOffset);
          }
        });
      }

      // 2. Scrolling defense view coverage overlays
      if (this.defenseViewActive) {
        this.drawDefenseViewOverlay(scanlineOffset);
      }
    }

    // 3. Spinning boss projections
    if (this.activeBossPedestals.size > 0) {
      this.activeBossPedestals.forEach((info, pedestal) => {
        if (!pedestal.active) {
          info.projection.destroy();
          this.activeBossPedestals.delete(pedestal);
          return;
        }

        // Spin projection: cycle texture every 500ms
        const now = time || Date.now();
        if (now - info.lastSpinTime > 500) {
          info.dir = (info.dir + 1) % 4;
          const boss = info.settings.boss || 'boss-ironjaw';
          const bossKey = `hologram_${boss}`;
          const tex = `${bossKey}_dir_${info.dir}`;
          if (this.textures.exists(tex)) {
            info.projection.setTexture(tex);
          }
          info.lastSpinTime = now;
        }

        // Sync coordinate position and depth layer above pedestal
        const shiftX = this.glitchIntensity > 0 ? (Math.random() - 0.5) * 8 * this.glitchIntensity : 0;
        const scaleX = this.glitchIntensity > 0 ? 1.0 + (Math.random() - 0.5) * 0.4 * this.glitchIntensity : 1.0;
        const alphaDrop = this.glitchIntensity > 0 && Math.random() < 0.1 * this.glitchIntensity ? 0.35 : 1.0;

        info.projection.x = pedestal.x + shiftX;
        info.projection.scaleX = scaleX;
        info.projection.setAlpha(Math.max(0.1, 0.6 * (1.0 - this.glitchIntensity * 0.5) * alphaDrop));

        info.projection.y = pedestal.y - 18;
        info.projection.setDepth(pedestal.depth + 1);

        // Viewport Culling check
        if (pedestal.visible !== info.projection.visible) {
          info.projection.setVisible(pedestal.visible);
        }
      });
    }

    this.updateLighting(time);
    this.updateShadows(time);
  }
  private updateLighting(time: number): void {
    if (!this.ambientOverlay || !this.lightGlowOverlay) return;

    this.ambientOverlay.clear();
    this.lightGlowOverlay.clear();

    const cam = this.cameras.main;
    const view = cam.worldView;

    // Draw the ambient darkness rectangle covering the current camera view (soft room dimming)
    this.ambientOverlay.fillStyle(0x060913, 0.25);
    this.ambientOverlay.fillRect(view.x - 200, view.y - 200, view.width + 400, view.height + 400);

    // List of active light sources
    const lightSources: Array<{
      cx: number;
      cy: number;
      radius: number;
      angle: number;
      spread: number;
      color: number;
      alpha: number;
      type: 'flashlight' | 'searchlight';
    }> = [];

    // 1. Player flashlight
    if (this.playerEntity && this.playerEntity.active) {
      const cx = this.playerEntity.x;
      const cy = this.playerEntity.y - 28;

      let dir = 0;
      if (this.playerEntity.texture && this.playerEntity.texture.key) {
        const match = this.playerEntity.texture.key.match(/_dir_(\d)/);
        if (match) {
          dir = parseInt(match[1]);
        }
      }

      const angle = dir * 0.5 * Math.PI + 0.25 * Math.PI;

      lightSources.push({
        cx,
        cy,
        radius: 110,
        angle,
        spread: 0.45,
        color: 0xe0f7fa,
        alpha: 0.12,
        type: 'flashlight',
      });
    }

    // 2. Placed friendly guard drones
    this.furnitureItems.forEach((item) => {
      if (!item.active || !item.visible) return;

      const key = item.texture.key;
      if (key === 'guard_drone' || key.startsWith('guard_drone_dir_')) {
        const cx = item.x;
        const cy = item.y - 16; // Drone hovers

        let dir = 0;
        const match = key.match(/_dir_(\d)/);
        if (match) {
          dir = parseInt(match[1]);
        }
        const baseAngle = dir * 0.5 * Math.PI + 0.25 * Math.PI;
        const sweep = Math.sin(time / 800) * 0.5;

        // Friendly sentinel searchlight (green)
        lightSources.push({
          cx,
          cy,
          radius: 140,
          angle: baseAngle + sweep,
          spread: 0.80,
          color: 0x10b981,
          alpha: 0.15,
          type: 'searchlight',
        });
      }
    });

    // A. CUT OUT LIGHT CHANNELS
    this.ambientOverlay.setBlendMode(Phaser.BlendModes.ERASE);

    lightSources.forEach((light) => {
      this.ambientOverlay.fillStyle(0xffffff, 1.0);
      if (light.spread >= Math.PI * 2) {
        this.ambientOverlay.fillCircle(light.cx, light.cy, light.radius);
      } else {
        this.ambientOverlay.beginPath();
        this.ambientOverlay.moveTo(light.cx, light.cy);
        this.ambientOverlay.slice(
          light.cx,
          light.cy,
          light.radius,
          light.angle - light.spread / 2,
          light.angle + light.spread / 2,
          false
        );
        this.ambientOverlay.closePath();
        this.ambientOverlay.fillPath();
      }

      this.ambientOverlay.fillCircle(light.cx, light.cy, 35);
    });

    this.ambientOverlay.setBlendMode(Phaser.BlendModes.NORMAL);

    // B. DRAW GLOWING VOLUMETRIC LIGHT CONES
    lightSources.forEach((light) => {
      const alpha = light.alpha;

      this.lightGlowOverlay.fillStyle(light.color, alpha);
      if (light.spread >= Math.PI * 2) {
        this.lightGlowOverlay.fillCircle(light.cx, light.cy, light.radius);
      } else {
        this.lightGlowOverlay.beginPath();
        this.lightGlowOverlay.moveTo(light.cx, light.cy);
        this.lightGlowOverlay.slice(
          light.cx,
          light.cy,
          light.radius,
          light.angle - light.spread / 2,
          light.angle + light.spread / 2,
          false
        );
        this.lightGlowOverlay.closePath();
        this.lightGlowOverlay.fillPath();
      }

      if (light.spread < Math.PI * 2) {
        this.lightGlowOverlay.lineStyle(1.0, light.color, alpha * 2.2);
        this.lightGlowOverlay.beginPath();
        this.lightGlowOverlay.slice(
          light.cx,
          light.cy,
          light.radius,
          light.angle - light.spread / 2,
          light.angle + light.spread / 2,
          false
        );
        this.lightGlowOverlay.strokePath();
      }
    });
  }

  private updateShadows(time: number): void {
    if (!this.shadowGraphics) return;
    this.shadowGraphics.clear();

    const lights: Array<{ cx: number; cy: number; radius: number; Lz: number }> = [];

    // Player flashlight
    if (this.playerEntity && this.playerEntity.active) {
      lights.push({
        cx: this.playerEntity.x,
        cy: this.playerEntity.y - 28,
        radius: 110,
        Lz: 100
      });
    }

    // Friendly guard drones
    this.furnitureItems.forEach((item) => {
      if (!item.active || !item.visible) return;
      const key = item.texture.key;
      if (key === 'guard_drone' || key.startsWith('guard_drone_dir_')) {
        lights.push({
          cx: item.x,
          cy: item.y - 16,
          radius: 140,
          Lz: 80
        });
      }
    });

    if (lights.length === 0) return;

    const HEIGHT_MAP: Record<string, number> = {
      'furniture_bed_twin': 16,
      'furniture_desk_wooden': 32,
      'furniture_chair_office': 32,
      'furniture_shelf_metal': 64,
      'furniture_dresser_wooden': 40,
      'furniture_tv_flatscreen': 24,
      'furniture_rug_area': 0,
      'furniture_lamp_floor': 48,
      'furniture_plant_potted': 32,
      'furniture_table_folding': 20,
      'furniture_custom_poster': 40,
      'furniture_custom_poster_pending': 40,
      'furniture_custom_poster_rejected': 40,
      'furniture_boss_pedestal': 32,
      'barricade_bookshelf': 56,
      'barricade_flipped_table': 24,
      'barricade_sandbags': 20,
      'turret_nailgun': 40,
      'turret_taser': 40,
      'turret_tesla': 56,
      'turret_autocannon': 64,
      'turret_shotgun': 44,
      'turret_autocannon_mk2': 64,
      'turret_power_node': 40,
      'entity_drone': 40,
      'guard_drone': 40,
      'guard_dog': 30,
      'guard_decoy': 32,
      'boss_ironjaw': 56,
      'boss_whisper': 48,
      'boss_volkov': 52,
      'boss_circuit': 48,
      'boss_warden': 60,
      'loot_stash': 14
    };

    const getObjectHeight = (textureKey: string): number => {
      let base = textureKey.replace(/_slot_\d/g, '');
      base = base.replace(/_dir_\d/g, '');
      return HEIGHT_MAP[base] ?? 0;
    };

    lights.forEach((light) => {
      this.furnitureItems.forEach((sprite) => {
        if (!sprite.active || !sprite.visible) return;
        const H = getObjectHeight(sprite.texture.key);
        if (H <= 0) return;

        if (sprite.texture.key.startsWith('trap_')) return;

        const corners = this.getFurnitureScreenCorners(sprite);
        this.drawShadowVolume(light, corners, H);
      });

      if (this.playerEntity && this.playerEntity.active && this.playerEntity.visible) {
        const H = getObjectHeight(this.playerEntity.texture.key) || 40;
        const corners = this.getEntityScreenCorners(this.playerEntity);
        this.drawShadowVolume(light, corners, H);
      }
    });
  }

  private getFurnitureScreenCorners(sprite: any): { x: number; y: number }[] {
    const rotation = this.currentRotation;
    const gridSize = this.gridSize || 10;
    const corners = [
      { gx: sprite.gridX, gy: sprite.gridY },
      { gx: sprite.gridX + sprite.footprintW, gy: sprite.gridY },
      { gx: sprite.gridX + sprite.footprintW, gy: sprite.gridY + sprite.footprintH },
      { gx: sprite.gridX, gy: sprite.gridY + sprite.footprintH }
    ];

    let shiftX = 0;
    let shiftY = 0;
    let rotX = sprite.gridX;
    let rotY = sprite.gridY;
    const MAX = gridSize - 1;

    switch (rotation % 4) {
      case 1:
        rotX = MAX - sprite.gridY;
        rotY = sprite.gridX;
        break;
      case 2:
        rotX = MAX - sprite.gridX;
        rotY = MAX - sprite.gridY;
        break;
      case 3:
        rotX = sprite.gridY;
        rotY = MAX - sprite.gridX;
        break;
      default:
        break;
    }

    if (rotY === 0) {
      shiftX += 2;
      shiftY += 4;
    }
    if (rotX === 0) {
      shiftX -= 2;
      shiftY += 4;
    }

    return corners.map(c => {
      const pos = IsometricEngine.worldToScreen(c.gx, c.gy, rotation, gridSize);
      return {
        x: pos.x + this.offsetX + shiftX,
        y: pos.y + this.offsetY + shiftY
      };
    });
  }

  private getEntityScreenCorners(entity: any): { x: number; y: number }[] {
    return [
      { x: entity.x, y: entity.y - 32 },
      { x: entity.x + 32, y: entity.y - 16 },
      { x: entity.x, y: entity.y },
      { x: entity.x - 32, y: entity.y - 16 }
    ];
  }

  private drawShadowVolume(
    light: { cx: number; cy: number; radius: number; Lz: number },
    corners: { x: number; y: number }[],
    H: number
  ): void {
    const SL_x = light.cx;
    const SL_y = light.cy;
    const Lz = light.Lz;

    const projectedCorners: { x: number; y: number }[] = [];

    for (let i = 0; i < 4; i++) {
      const Bi = corners[i];
      const dx = Bi.x - SL_x;
      const dy = Bi.y - SL_y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 5) return;

      if (dist > light.radius * 1.5) return;

      const clampLz = Math.max(Lz, H + 20);
      const scale = clampLz / (clampLz - H);
      projectedCorners.push({
        x: SL_x + dx * scale,
        y: SL_y + dy * scale
      });
    }

    this.shadowGraphics.fillStyle(0x000000, 0.18);
    
    // Draw top face shadow
    this.shadowGraphics.beginPath();
    this.shadowGraphics.moveTo(projectedCorners[0].x, projectedCorners[0].y);
    for (let i = 1; i < projectedCorners.length; i++) {
      this.shadowGraphics.lineTo(projectedCorners[i].x, projectedCorners[i].y);
    }
    this.shadowGraphics.closePath();
    this.shadowGraphics.fillPath();

    // Draw side wall shadows
    for (let i = 0; i < 4; i++) {
      const nextIdx = (i + 1) % 4;
      const Bi = corners[i];
      const Bnext = corners[nextIdx];
      const Si = projectedCorners[i];
      const Snext = projectedCorners[nextIdx];

      this.shadowGraphics.beginPath();
      this.shadowGraphics.moveTo(Bi.x, Bi.y);
      this.shadowGraphics.lineTo(Bnext.x, Bnext.y);
      this.shadowGraphics.lineTo(Snext.x, Snext.y);
      this.shadowGraphics.lineTo(Si.x, Si.y);
      this.shadowGraphics.closePath();
      this.shadowGraphics.fillPath();
    }
  }
}
