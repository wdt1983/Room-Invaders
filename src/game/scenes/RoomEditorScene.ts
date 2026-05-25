import * as Phaser from 'phaser';
import { EventBus } from '@/game/EventBus';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { RoomScene } from '@/game/scenes/RoomScene';
import { rangeTilesFor } from '@/lib/game/defense';
import { paintRangeBand, RANGE_FILL_COLOR } from '@/game/utils/rangeDraw';
import { useRoomStore } from '@/lib/store/useRoomStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ItemStats = Record<string, any>;

export class RoomEditorScene extends Phaser.Scene {
  private ghostSprite: Phaser.GameObjects.Image | null = null;
  private currentItemKey: string | null = null;
  private currentItemType: string | null = null;
  private currentItemStats: ItemStats = {};
  private rangeGraphics!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'RoomEditorScene' });
  }

  create() {
    const offsetX = this.scale.width / 2;
    const offsetY = this.scale.height / 4;

    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x4ade80, 0.5); // Highlight grid specifically in Edit Mode

    // Draw a semitransparent wireframe grid
    const size = useRoomStore.getState().gridSize ?? 10;
    for (let x = 0; x <= size; x++) {
      // Draw grid lines along Y axis
      const startPos1 = IsometricEngine.worldToScreen(x, 0, 0);
      const endPos1 = IsometricEngine.worldToScreen(x, size, 0);
      graphics.moveTo(startPos1.x + offsetX, startPos1.y + offsetY);
      graphics.lineTo(endPos1.x + offsetX, endPos1.y + offsetY);

      // Draw grid lines along X axis
      const startPos2 = IsometricEngine.worldToScreen(0, x, 0);
      const endPos2 = IsometricEngine.worldToScreen(size, x, 0);
      graphics.moveTo(startPos2.x + offsetX, startPos2.y + offsetY);
      graphics.lineTo(endPos2.x + offsetX, endPos2.y + offsetY);
    }
    graphics.strokePath();

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

    EventBus.on(
      'item-selected',
      (payload: { key: string; type: string; stats?: ItemStats } | null) => {
        this.currentItemKey = payload?.key ?? null;
        this.currentItemType = payload?.type ?? null;
        this.currentItemStats = payload?.stats ?? {};
        if (this.ghostSprite) {
          this.ghostSprite.destroy();
          this.ghostSprite = null;
        }

        // Any selection change invalidates the existing overlay. It'll be
        // repopulated on the next `pointermove` once the ghost has a tile
        // to anchor the range calculation against.
        this.rangeGraphics.clear();

        if (this.currentItemKey) {
          // Create the ghost, set alpha to 0.6
          this.ghostSprite = this.add.image(0, 0, this.currentItemKey).setOrigin(0.5, 1).setAlpha(0.6);
        }
      },
    );

    EventBus.on('placement-success', (payload: { key: string, x: number, y: number }) => {
      const roomScene = this.scene.get('RoomScene') as RoomScene;
      roomScene.placeFurniture(payload.key, payload.x, payload.y);
      if (this.ghostSprite) {
        this.ghostSprite.setTint(0xff0000); 
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.ghostSprite || !this.currentItemKey) return;

      const roomScene = this.scene.get('RoomScene') as RoomScene;

      const worldCoords = IsometricEngine.screenToWorld(
        pointer.worldX,
        pointer.worldY,
        roomScene.offsetX,
        roomScene.offsetY,
        roomScene.currentRotation
      );

      // Validate — type-aware (traps/barricades/furniture = floor, turrets = perimeter)
      const isValid = roomScene.isPlaceableFor(this.currentItemType, worldCoords.x, worldCoords.y);

      // Tint ghost
      this.ghostSprite.setTint(isValid ? 0x00ff00 : 0xff0000);

      // Project back to screen for snapping
      const snapCoords = IsometricEngine.worldToScreen(worldCoords.x, worldCoords.y, roomScene.currentRotation);
      this.ghostSprite.setPosition(snapCoords.x + roomScene.offsetX, snapCoords.y + roomScene.offsetY);

      // Correct isometric depth for the overlay
      this.ghostSprite.setDepth(worldCoords.x + worldCoords.y + 100);

      // Range/trigger-zone overlay — redraws anchored at the tile under the ghost.
      this.drawRangeOverlay(worldCoords.x, worldCoords.y, roomScene);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const roomScene = this.scene.get('RoomScene') as RoomScene;

      const worldCoords = IsometricEngine.screenToWorld(
        pointer.worldX, pointer.worldY,
        roomScene.offsetX, roomScene.offsetY,
        roomScene.currentRotation
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
        if (roomScene.isPlaceableFor(this.currentItemType, worldCoords.x, worldCoords.y)) {
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
          (f) => f.gridX === worldCoords.x && f.gridY === worldCoords.y,
        );
        const spriteKey = targetFurniture?.texture.key ?? 'placed_item';
        const isDamaged = targetFurniture ? targetFurniture.isDamaged : false;
        const screenPos = IsometricEngine.worldToScreen(
          worldCoords.x, worldCoords.y,
          roomScene.currentRotation,
        );

        EventBus.emit('open-context-menu', {
          spriteKey,
          x: screenPos.x + roomScene.offsetX,
          y: screenPos.y + roomScene.offsetY,
          gridX: worldCoords.x,
          gridY: worldCoords.y,
          isDamaged,
        });
      }
    });

    EventBus.on('change-mode', (mode: string) => {
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
        this.rangeGraphics.clear();
        this.scene.sleep();
      }
    });

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
  private drawRangeOverlay(originX: number, originY: number, roomScene: RoomScene): void {
    this.rangeGraphics.clear();
    if (!this.currentItemType) return;

    const { primary, alert } = rangeTilesFor(
      this.currentItemType,
      this.currentItemStats,
      originX,
      originY,
      useRoomStore.getState().gridSize ?? 10,
    );

    if (primary.length === 0 && alert.length === 0) return;

    paintRangeBand(
      this.rangeGraphics, primary, RANGE_FILL_COLOR.primary,
      roomScene.currentRotation, roomScene.offsetX, roomScene.offsetY,
    );
    paintRangeBand(
      this.rangeGraphics, alert, RANGE_FILL_COLOR.alert,
      roomScene.currentRotation, roomScene.offsetX, roomScene.offsetY,
    );
  }
}
