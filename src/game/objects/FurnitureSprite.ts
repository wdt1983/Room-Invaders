import * as Phaser from 'phaser';
import { IsometricEngine } from '@/game/systems/IsometricEngine';

export class FurnitureSprite extends Phaser.GameObjects.Image {
  public gridX: number;
  public gridY: number;
  /** Effective footprint width — swapped with footprintH when rotation is odd. */
  public footprintW: number;
  /** Effective footprint height — swapped with footprintW when rotation is odd. */
  public footprintH: number;
  /** Base footprint dims as authored in the catalog — preserved for round-trips. */
  private readonly baseFootprintW: number;
  private readonly baseFootprintH: number;
  /** Discrete 90° step: 0=0°, 1=90°, 2=180°, 3=270°. */
  public rotationStep: number = 0;
  /** Current HP when destructible. `null` means indestructible — the
   *  CombatSystem skips damage for these (furniture / cosmetics / traps
   *  without a durability concept default here). Barricades and any
   *  future destructible defense opt in by passing an `hp` option. */
  public hp: number | null = null;
  /** Authored max HP (or `null` for indestructible items). */
  public maxHp: number | null = null;
  public isDamaged: boolean = false;

  constructor(
    scene: Phaser.Scene,
    cartesianX: number,
    cartesianY: number,
    textureKey: string,
    footprintW: number,
    footprintH: number,
    options: { hp?: number | null; isDamaged?: boolean } = {},
  ) {
    super(scene, 0, 0, textureKey);
    this.isDamaged = !!options.isDamaged;

    // Anchor to the bottom center so it sits correctly on the grid floor
    this.setOrigin(0.5, 1);

    this.gridX = cartesianX;
    this.gridY = cartesianY;
    this.footprintW = footprintW;
    this.footprintH = footprintH;
    this.baseFootprintW = footprintW;
    this.baseFootprintH = footprintH;

    // HP — if caller passes a finite positive number, the item is
    // destructible and starts at full HP. Otherwise both fields stay null
    // and the CombatSystem ignores damage calls.
    const hpOption = options.hp;
    if (typeof hpOption === 'number' && Number.isFinite(hpOption) && hpOption > 0) {
      this.maxHp = hpOption;
      this.hp = hpOption;
    }

    this.updateIsometricPosition(0);

    scene.add.existing(this);
  }

  updateIsometricPosition(
    rotation: number,
    offsetX: number = 0,
    offsetY: number = 0
  ): void {
    const gridSize = (this.scene as any).gridSize || (this.scene as any).grid_size || 10;
    const screenPos = IsometricEngine.worldToScreen(this.gridX, this.gridY, rotation, gridSize);
    this.x = screenPos.x + offsetX;
    this.y = screenPos.y + offsetY;

    // Depth Sorting
    // Floor tiles are at depth 0. Furniture sits above them.
    this.setDepth(this.gridX + this.gridY + 1);
  }

  /**
   * Apply a discrete 90° rotation step (0-3). Updates the Phaser image angle
   * so the sprite visually rotates, and swaps the effective footprint
   * dimensions when the rotation is odd (1 or 3) so future multi-tile
   * occupancy checks see the correct orientation.
   *
   * Keeps `baseFootprintW`/`baseFootprintH` (catalog values) intact so
   * successive rotations stay round-trip-consistent.
   */
  public setFurnitureRotation(step: number): void {
    const normalized = ((step % 4) + 4) % 4;
    this.rotationStep = normalized;
    this.setAngle(normalized * 90);
    if (normalized % 2 === 1) {
      this.footprintW = this.baseFootprintH;
      this.footprintH = this.baseFootprintW;
    } else {
      this.footprintW = this.baseFootprintW;
      this.footprintH = this.baseFootprintH;
    }
  }
}
