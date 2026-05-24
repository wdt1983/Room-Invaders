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
import { entryTileFor } from '@/lib/game/entryPoints';
import { EntitySprite } from '@/game/objects/EntitySprite';
import { rangeTilesFor } from '@/lib/game/defense';
import { paintRangeBand, RANGE_FILL_COLOR } from '@/game/utils/rangeDraw';

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
  public gridSize: number = 10;

  constructor() {
    super({ key: 'RoomScene' });
    this.gridSystem = new GridSystem();
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
  public isPlaceableFor(type: string | null | undefined, gridX: number, gridY: number): boolean {
    if (!this.gridSystem.isTileWalkable(gridX, gridY)) return false;

    if (type === 'turret') {
      const max = this.gridSize - 1;
      return gridX === 0 || gridX === max || gridY === 0 || gridY === max;
    }

    return true;
  }

  create() {
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
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const screenPos = IsometricEngine.worldToScreen(x, y);
        // The tile's origin will default to 0.5, 0.5
        const tile = this.add.image(screenPos.x + this.offsetX, screenPos.y + this.offsetY, 'iso-tile');
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
      const screenPos = IsometricEngine.worldToScreen(tile.x, tile.y, this.currentRotation);
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

    // Centering the Camera
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

        // Clamp the zoom to prevent breaking the view
        newZoom = Phaser.Math.Clamp(newZoom, 0.5, 2.0);
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

    placedItems.forEach(item => {
      // Prevent placing items out of bounds just in case of stale DB state
      if (this.gridSystem.isTileWalkable(item.gridX, item.gridY)) {
        this.gridSystem.setTileState(item.gridX, item.gridY, 'occupied');

        const sprite = new FurnitureSprite(
            this,
            item.gridX,
            item.gridY,
            item.spriteKey,
            item.footprintW,
            item.footprintH
        );
        sprite.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
        sprite.setFurnitureRotation(item.rotation ?? 0);
        this.furnitureItems.push(sprite);
      }
    });

    // Keyboard listeners for rotation
    this.input.keyboard?.on('keydown-Q', () => this.rotateGrid(-1));
    this.input.keyboard?.on('keydown-E', () => this.rotateGrid(1));

    const handleChangeMode = (mode: string) => {
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
      const idx = this.furnitureItems.findIndex(
        (f) => f.gridX === payload.x && f.gridY === payload.y,
      );
      if (idx >= 0) {
        this.furnitureItems[idx].destroy();
        this.furnitureItems.splice(idx, 1);
      }
      this.gridSystem.setTileState(payload.x, payload.y, this.baseTileStateFor(payload.x, payload.y));
      useRoomStore.getState().removePlacedItemAt(payload.x, payload.y);
    };

    const handleRotationSuccess = (payload: { x: number; y: number; rotation: number }) => {
      const sprite = this.furnitureItems.find(
        (f) => f.gridX === payload.x && f.gridY === payload.y,
      );
      if (sprite) {
        sprite.setFurnitureRotation(payload.rotation);
      }
      useRoomStore.getState().rotatePlacedItemAt(payload.x, payload.y, payload.rotation);
    };

    const handleRoomUpgraded = () => {
      this.scene.restart();
    };

    EventBus.on('change-mode', handleChangeMode);
    EventBus.on('removal-success', handleRemovalSuccess);
    EventBus.on('rotation-success', handleRotationSuccess);
    EventBus.on('room-upgraded', handleRoomUpgraded);

    this.events.once('shutdown', () => {
      EventBus.off('change-mode', handleChangeMode);
      EventBus.off('removal-success', handleRemovalSuccess);
      EventBus.off('rotation-success', handleRotationSuccess);
      EventBus.off('room-upgraded', handleRoomUpgraded);
      this.exitDefenseView();
    });

    // Instantiate Player Entity
    this.playerEntity = new EntitySprite(this, 0, 0, 'entity_drone');
    this.playerEntity.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.currentMode !== 'view') return;

      const worldCoords = IsometricEngine.screenToWorld(pointer.worldX, pointer.worldY, this.offsetX, this.offsetY, this.currentRotation);

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
                  const targetFurniture = this.furnitureItems.find(f => f.gridX === worldCoords.x && f.gridY === worldCoords.y);
                  const spriteKey = targetFurniture ? targetFurniture.texture.key : 'placed_item';
                  const screenPos = IsometricEngine.worldToScreen(worldCoords.x, worldCoords.y, this.currentRotation);
                  
                  EventBus.emit('open-context-menu', {
                      spriteKey: spriteKey,
                      x: screenPos.x + this.offsetX,
                      y: screenPos.y + this.offsetY,
                      gridX: worldCoords.x,
                      gridY: worldCoords.y
                  });
              });
              this.focusCameraOnPlayer();
          }
      }
    });

    // Launch the editor scene in parallel but sleep it initially
    this.scene.launch('RoomEditorScene');
    this.scene.sleep('RoomEditorScene');

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
        this.currentRotation
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
      const target = IsometricEngine.worldToScreen(gridX, gridY, this.currentRotation);
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
  private drawDefenseViewOverlay(): void {
    this.defenseViewGraphics.clear();

    const catalog = useRoomStore.getState().catalog;
    const placedItems = useRoomStore.getState().placedItems;
    if (catalog.length === 0 || placedItems.length === 0) return;

    const catalogByKey = new Map(catalog.map((c) => [c.sprite_key, c]));

    for (const placed of placedItems) {
      const entry = catalogByKey.get(placed.spriteKey);
      if (!entry) continue;
      const { primary, alert } = rangeTilesFor(
        entry.type,
        entry.stats,
        placed.gridX,
        placed.gridY,
        this.gridSize,
      );
      if (primary.length === 0 && alert.length === 0) continue;

      paintRangeBand(
        this.defenseViewGraphics, primary, RANGE_FILL_COLOR.primary,
        this.currentRotation, this.offsetX, this.offsetY,
      );
      paintRangeBand(
        this.defenseViewGraphics, alert, RANGE_FILL_COLOR.alert,
        this.currentRotation, this.offsetX, this.offsetY,
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

    const colorFor = (wall: EntryPointWall, position: number): number => {
      const ep = entryPoints.find((e) => e.wall === wall && e.position === position);
      return ep ? ENTRY_WALL_COLORS[ep.type] : WALL_COLOR;
    };

    const segment = (
      wall: EntryPointWall,
      position: number,
      start: { x: number; y: number },
      end: { x: number; y: number },
    ): void => {
      const s = IsometricEngine.worldToScreen(start.x, start.y, this.currentRotation);
      const e = IsometricEngine.worldToScreen(end.x, end.y, this.currentRotation);
      this.wallGraphics.lineStyle(WALL_THICKNESS, colorFor(wall, position), 1.0);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + this.offsetX, s.y + this.offsetY);
      this.wallGraphics.lineTo(e.x + this.offsetX, e.y + this.offsetY);
      this.wallGraphics.strokePath();
    };

    for (let p = 0; p < size; p++) {
      segment('north', p, { x: p,        y: 0 },    { x: p + 1,    y: 0 });
      segment('south', p, { x: p,        y: size }, { x: p + 1,    y: size });
      segment('east',  p, { x: size,     y: p },    { x: size,     y: p + 1 });
      segment('west',  p, { x: 0,        y: p },    { x: 0,        y: p + 1 });
    }
  }

  public placeFurniture(key: string, gridX: number, gridY: number): boolean {
    // Verify it's still walkable (double-check)
    if (!this.gridSystem.isTileWalkable(gridX, gridY)) return false;

    // For MVP: Assume 1x1 footprint for grid occupation logic to maintain velocity. 
    // Advanced footprint iteration can be deferred to Phase 2.
    this.gridSystem.setTileState(gridX, gridY, 'occupied');

    // Retrieve footprint data (Mock for now, or pull from a constant dictionary if you built one)
    // Default to 1x1 if unknown
    const footprintW = 1; 
    const footprintH = 1;

    // Instantiate and position the sprite
    const item = new FurnitureSprite(this, gridX, gridY, key, footprintW, footprintH);
    item.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);

    this.furnitureItems.push(item);

    // Optional: Add a placement thump tween
    this.tweens.add({
      targets: item,
      y: item.y - 10,
      yoyo: true,
      duration: 100,
      ease: 'Quad.easeOut'
    });

    return true;
  }

  public drawDebugPath(path: {x: number, y: number}[] | null) {
    this.pathDebugGraphics.clear();
    if (!path || path.length === 0) return;

    this.pathDebugGraphics.lineStyle(4, 0x00ff00, 0.8);
    this.pathDebugGraphics.beginPath();

    path.forEach((node, index) => {
        // Project grid coordinates to screen coordinates
        const screenPos = IsometricEngine.worldToScreen(node.x, node.y, this.currentRotation);
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
}
