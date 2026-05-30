import * as Phaser from 'phaser';
import { EventBus } from '@/game/EventBus';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { RoomScene } from '@/game/scenes/RoomScene';
import { rangeTilesFor } from '@/lib/game/defense';
import { paintRangeBand, RANGE_FILL_COLOR } from '@/game/utils/rangeDraw';
import { useRoomStore } from '@/lib/store/useRoomStore';
import { useUIStore } from '@/lib/store/useUIStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ItemStats = Record<string, any>;

export class RoomEditorScene extends Phaser.Scene {
  private ghostSprite: Phaser.GameObjects.Image | null = null;
  private currentItemKey: string | null = null;
  private currentItemType: string | null = null;
  private currentItemStats: ItemStats = {};
  private currentItemFootprint: { w: number; h: number } | null = null;
  private rangeGraphics!: Phaser.GameObjects.Graphics;
  private gridGraphics: Phaser.GameObjects.Graphics | null = null;
  private activeGhostCoords: { x: number; y: number } | null = null;

  constructor() {
    super({ key: 'RoomEditorScene' });
  }

  create() {
    const offsetX = this.scale.width / 2;
    const offsetY = this.scale.height / 4;

    const roomScene = this.scene.get('RoomScene') as RoomScene;
    const initialRotation = roomScene ? roomScene.currentRotation : 0;
    this.drawEditorGrid(initialRotation);

    // Range/trigger-zone overlay for the selected defense item (task 2.0.10).
    // Redrawn on every `pointermove` and cleared on deselect / mode change.
    // Sits below the ghost sprite (ghost uses depth = worldX+worldY+100) so
    // the ghost always reads on top of its own zone.
    this.rangeGraphics = this.add.graphics().setDepth(0);

    // Visual text indicator
    this.add.text(16, 16, 'EDIT MODE ACTIVE', {
      fontFamily: 'var(--font-sans), sans-serif',
      fontSize: '24px',
      color: '#4ade80',
      stroke: '#000000',
      strokeThickness: 4,
    }).setScrollFactor(0); // Pin to camera

    const handleItemSelected = (payload: { key: string; type: string; stats?: ItemStats; footprint?: { w: number; h: number } } | null) => {
      if (!this.sys || !this.sys.isActive()) return;
      this.currentItemKey = payload?.key ?? null;
      this.currentItemType = payload?.type ?? null;
      this.currentItemStats = payload?.stats ?? {};
      this.currentItemFootprint = payload?.footprint ?? { w: 1, h: 1 };
      if (this.ghostSprite) {
        this.ghostSprite.destroy();
        this.ghostSprite = null;
      }

      this.rangeGraphics.clear();
      this.activeGhostCoords = null;

      if (this.currentItemKey) {
        // Create the ghost, set alpha to 0.6
        this.ghostSprite = this.add.image(0, 0, this.currentItemKey).setOrigin(0.5, 1).setAlpha(0.6);
      }
    };

    const handlePlacementSuccess = (payload: { key: string, x: number, y: number }) => {
      if (!this.sys || !this.sys.isActive()) return;
      const roomScene = this.scene.get('RoomScene') as RoomScene;
      if (roomScene && roomScene.placeFurniture) {
        roomScene.placeFurniture(payload.key, payload.x, payload.y);
      }
      if (this.ghostSprite) {
        this.ghostSprite.setTint(0xff0000); 
      }
    };

    const handleChangeMode = (mode: string) => {
      if (!this.sys || !this.sys.isActive()) return;
      // Sleep on any non-edit mode, not just 'view' — otherwise defense-view
      // (task 2.0.11) would leave the editor's pointermove/pointerdown
      // listeners active and conflicting with RoomScene interaction.
      if (mode !== 'edit') {
        if (this.ghostSprite) {
          this.ghostSprite.destroy();
          this.ghostSprite = null;
        }
        this.currentItemKey = null;
        this.currentItemType = null;
        this.currentItemStats = {};
        this.activeGhostCoords = null;
        if (this.rangeGraphics && this.rangeGraphics.clear) {
          this.rangeGraphics.clear();
        }
        if (this.scene && this.scene.sleep) {
          this.scene.sleep();
        }
      }
    };

    const handleGridRotated = (rotation: number) => {
      if (!this.sys || !this.sys.isActive()) return;
      this.drawEditorGrid(rotation);
    };

    const handleCosmeticsChanged = () => {
      if (!this.sys || !this.sys.isActive()) return;
      const roomScene = this.scene.get('RoomScene') as RoomScene;
      const rotation = roomScene ? roomScene.currentRotation : 0;
      this.drawEditorGrid(rotation);
    };

    EventBus.on('item-selected', handleItemSelected);
    EventBus.on('placement-success', handlePlacementSuccess);
    EventBus.on('change-mode', handleChangeMode);
    EventBus.on('grid-rotated', handleGridRotated);
    EventBus.on('cosmetics-changed', handleCosmeticsChanged);

    const cleanup = () => {
      EventBus.off('item-selected', handleItemSelected);
      EventBus.off('placement-success', handlePlacementSuccess);
      EventBus.off('change-mode', handleChangeMode);
      EventBus.off('grid-rotated', handleGridRotated);
      EventBus.off('cosmetics-changed', handleCosmeticsChanged);
    };

    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.ghostSprite || !this.currentItemKey) return;

      const roomScene = this.scene.get('RoomScene') as RoomScene;

      const worldCoords = IsometricEngine.screenToWorld(
        pointer.worldX,
        pointer.worldY,
        roomScene.offsetX,
        roomScene.offsetY,
        roomScene.currentRotation,
        roomScene.gridSize
      );

      // Determine the rotated footprint size of the selected blueprint/ghost item
      let fpW = 1;
      let fpH = 1;
      const movingItem = useUIStore.getState().movingItem;
      if (movingItem) {
        const placed = useRoomStore.getState().placedItems.find(
          (p) => p.gridX === movingItem.x && p.gridY === movingItem.y
        );
        if (placed) {
          const isRotatedOdd = placed.rotation === 1 || placed.rotation === 3;
          fpW = isRotatedOdd ? placed.footprintH : placed.footprintW;
          fpH = isRotatedOdd ? placed.footprintW : placed.footprintH;
        }
      } else {
        fpW = this.currentItemFootprint?.w ?? 1;
        fpH = this.currentItemFootprint?.h ?? 1;
      }

      // Validate — type-aware (traps/barricades/furniture = floor, turrets = perimeter)
      const isValid = roomScene.isPlaceableFor(this.currentItemType, worldCoords.x, worldCoords.y, fpW, fpH);

      // Tint ghost
      this.ghostSprite.setTint(isValid ? 0x00ff00 : 0xff0000);

      // Project back to screen for snapping
      const snapCoords = IsometricEngine.worldToScreen(worldCoords.x, worldCoords.y, roomScene.currentRotation, roomScene.gridSize);
      this.ghostSprite.setPosition(snapCoords.x + roomScene.offsetX, snapCoords.y + roomScene.offsetY);

      // Correct isometric depth for the overlay
      this.ghostSprite.setDepth(worldCoords.x + worldCoords.y + 100);

      // Range/trigger-zone overlay — redraws anchored at the tile under the ghost.
      this.activeGhostCoords = { x: worldCoords.x, y: worldCoords.y };
      this.drawRangeOverlay(worldCoords.x, worldCoords.y, roomScene);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const roomScene = this.scene.get('RoomScene') as RoomScene;

      // Right Click: cancel ghost placement and/or open context menu directly under pointer
      if (pointer.rightButtonDown() || pointer.button === 2) {
        const worldCoords = IsometricEngine.screenToWorld(
          pointer.worldX, pointer.worldY,
          roomScene.offsetX, roomScene.offsetY,
          roomScene.currentRotation,
          roomScene.gridSize
        );
        const targetFurniture = roomScene.furnitureItems.find(f => f.occupies(worldCoords.x, worldCoords.y));

        // Cancel ghost selection
        if (this.ghostSprite) {
          this.ghostSprite.destroy();
          this.ghostSprite = null;
        }
        this.currentItemKey = null;
        this.currentItemType = null;
        this.currentItemStats = {};
        this.currentItemFootprint = null;
        this.activeGhostCoords = null;
        this.rangeGraphics.clear();
        EventBus.emit('item-selected', null);

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

      const worldCoords = IsometricEngine.screenToWorld(
        pointer.worldX, pointer.worldY,
        roomScene.offsetX, roomScene.offsetY,
        roomScene.currentRotation,
        roomScene.gridSize
      );

      // Debug: Shift+Click traces an A* path from origin
      if (pointer.event.shiftKey) {
        const path = roomScene.gridSystem.findPath(0, 0, worldCoords.x, worldCoords.y);
        roomScene.drawDebugPath(path);
        return;
      }

      // Placement: with a ghost selected, attempt to place on a valid tile
      // (type-specific — see `RoomScene.isPlaceableFor`).
      if (this.ghostSprite && this.currentItemKey) {
        // Determine the rotated footprint size of the selected blueprint/ghost item
        let fpW = 1;
        let fpH = 1;
        const movingItem = useUIStore.getState().movingItem;
        if (movingItem) {
          const placed = useRoomStore.getState().placedItems.find(
            (p) => p.gridX === movingItem.x && p.gridY === movingItem.y
          );
          if (placed) {
            const isRotatedOdd = placed.rotation === 1 || placed.rotation === 3;
            fpW = isRotatedOdd ? placed.footprintH : placed.footprintW;
            fpH = isRotatedOdd ? placed.footprintW : placed.footprintH;
          }
        } else {
          fpW = this.currentItemFootprint?.w ?? 1;
          fpH = this.currentItemFootprint?.h ?? 1;
        }

        if (roomScene.isPlaceableFor(this.currentItemType, worldCoords.x, worldCoords.y, fpW, fpH)) {
          EventBus.emit('request-placement', {
            key: this.currentItemKey,
            x: worldCoords.x,
            y: worldCoords.y
          });
        }
        return;
      }

      // No ghost selected → tapping an occupied tile opens the removal context menu
      if (roomScene.gridSystem.getTileState(worldCoords.x, worldCoords.y) === 'occupied') {
        const targetFurniture = roomScene.furnitureItems.find(
          (f) => f.occupies(worldCoords.x, worldCoords.y),
        );
        const spriteKey = targetFurniture?.texture.key ?? 'placed_item';
        const isDamaged = targetFurniture ? targetFurniture.isDamaged : false;
        const targetX = targetFurniture ? targetFurniture.gridX : worldCoords.x;
        const targetY = targetFurniture ? targetFurniture.gridY : worldCoords.y;
        const screenPos = IsometricEngine.worldToScreen(
          targetX, targetY,
          roomScene.currentRotation,
          roomScene.gridSize,
        );

        EventBus.emit('open-context-menu', {
          spriteKey,
          x: screenPos.x + roomScene.offsetX,
          y: screenPos.y + roomScene.offsetY,
          gridX: targetX,
          gridY: targetY,
          isDamaged,
        });
      }
    });

    // Done EventBus lifecycle bindings above

    this.cameras.main.centerOn(offsetX, offsetY);
  }

  /**
   * Paint the currently-selected item's range / trigger zone on the grid,
   * anchored at `(originX, originY)`. Driven by {@link rangeTilesFor} so the
   * shape rules live alongside the defense-rating formula.
   *
   * Two bands:
   * - `primary` (orange) — lethal/effect radius (turret firing range).
   * - `alert`   (yellow) — advisory radius (trap alert, alerts other defenses).
   *
   * Each tile is drawn as a filled isometric diamond matching the 64×32 tile
   * geometry. Drawn at scene depth 0 so the ghost sprite (depth worldX+worldY+100)
   * always renders on top.
   */
  private drawRangeOverlay(originX: number, originY: number, roomScene: RoomScene, scanlineOffset = 0): void {
    this.rangeGraphics.clear();
    if (!this.currentItemType) return;

    // Determine the rotated footprint size of the selected blueprint/ghost item
    let fpW = 1;
    let fpH = 1;
    const movingItem = useUIStore.getState().movingItem;
    if (movingItem) {
      const placed = useRoomStore.getState().placedItems.find(
        (p) => p.gridX === movingItem.x && p.gridY === movingItem.y
      );
      if (placed) {
        const isRotatedOdd = placed.rotation === 1 || placed.rotation === 3;
        fpW = isRotatedOdd ? placed.footprintH : placed.footprintW;
        fpH = isRotatedOdd ? placed.footprintW : placed.footprintH;
      }
    } else {
      fpW = this.currentItemFootprint?.w ?? 1;
      fpH = this.currentItemFootprint?.h ?? 1;
    }

    const { primary, alert } = rangeTilesFor(
      this.currentItemType,
      this.currentItemStats,
      originX,
      originY,
      useRoomStore.getState().gridSize ?? 10,
      fpW,
      fpH
    );

    if (primary.length === 0 && alert.length === 0) return;

    paintRangeBand(
      this.rangeGraphics, primary, RANGE_FILL_COLOR.primary,
      roomScene.currentRotation, roomScene.offsetX, roomScene.offsetY,
      undefined, undefined, scanlineOffset,
    );
    paintRangeBand(
      this.rangeGraphics, alert, RANGE_FILL_COLOR.alert,
      roomScene.currentRotation, roomScene.offsetX, roomScene.offsetY,
      undefined, undefined, scanlineOffset,
    );
  }

  update(time: number) {
    const roomScene = this.scene.get('RoomScene') as RoomScene;
    if (roomScene && roomScene.sys.isActive() && this.cameras && this.cameras.main) {
      this.cameras.main.scrollX = roomScene.cameras.main.scrollX;
      this.cameras.main.scrollY = roomScene.cameras.main.scrollY;
      this.cameras.main.zoom = roomScene.cameras.main.zoom;

      // Real-time scrolling scanline range overlay crawling
      if (this.activeGhostCoords && this.ghostSprite) {
        const scanlineOffset = time / 100;
        this.drawRangeOverlay(this.activeGhostCoords.x, this.activeGhostCoords.y, roomScene, scanlineOffset);
      }
    }
  }

  private drawEditorGrid(rotation: number): void {
    if (this.gridGraphics) {
      this.tweens.killTweensOf(this.gridGraphics);
      this.gridGraphics.destroy();
    }
    this.gridGraphics = this.add.graphics();

    const roomScene = this.scene.get('RoomScene') as RoomScene;
    const offsetX = roomScene ? roomScene.offsetX : this.scale.width / 2;
    const offsetY = roomScene ? roomScene.offsetY : this.scale.height / 4;
    const size = useRoomStore.getState().gridSize ?? 10;
    const wallColor = useRoomStore.getState().cosmetics?.wallColor ?? 0x4ade80;

    // Layer 1: Beveled glowing base
    this.gridGraphics.lineStyle(4, wallColor, 0.25);
    for (let x = 0; x <= size; x++) {
      // Draw grid lines along Y axis
      const startPos1 = IsometricEngine.worldToScreen(x, 0, rotation, size);
      const endPos1 = IsometricEngine.worldToScreen(x, size, rotation, size);
      this.gridGraphics.moveTo(startPos1.x + offsetX, startPos1.y + offsetY);
      this.gridGraphics.lineTo(endPos1.x + offsetX, endPos1.y + offsetY);

      // Draw grid lines along X axis
      const startPos2 = IsometricEngine.worldToScreen(0, x, rotation, size);
      const endPos2 = IsometricEngine.worldToScreen(size, x, rotation, size);
      this.gridGraphics.moveTo(startPos2.x + offsetX, startPos2.y + offsetY);
      this.gridGraphics.lineTo(endPos2.x + offsetX, endPos2.y + offsetY);
    }
    this.gridGraphics.strokePath();

    // Layer 2: Vibrant sharp core
    this.gridGraphics.lineStyle(1.5, wallColor, 0.65);
    for (let x = 0; x <= size; x++) {
      // Draw grid lines along Y axis
      const startPos1 = IsometricEngine.worldToScreen(x, 0, rotation, size);
      const endPos1 = IsometricEngine.worldToScreen(x, size, rotation, size);
      this.gridGraphics.moveTo(startPos1.x + offsetX, startPos1.y + offsetY);
      this.gridGraphics.lineTo(endPos1.x + offsetX, endPos1.y + offsetY);

      // Draw grid lines along X axis
      const startPos2 = IsometricEngine.worldToScreen(0, x, rotation, size);
      const endPos2 = IsometricEngine.worldToScreen(size, x, rotation, size);
      this.gridGraphics.moveTo(startPos2.x + offsetX, startPos2.y + offsetY);
      this.gridGraphics.lineTo(endPos2.x + offsetX, endPos2.y + offsetY);
    }
    this.gridGraphics.strokePath();

    this.gridGraphics.setDepth(0.1); // Sit above floor but below items

    // Pulsing breathing alpha tween on the reactive neon grid lines
    this.gridGraphics.setAlpha(0.5);
    this.tweens.add({
      targets: this.gridGraphics,
      alpha: { from: 0.5, to: 0.95 },
      yoyo: true,
      repeat: -1,
      duration: 1800,
      ease: 'Sine.easeInOut',
    });
  }
}
