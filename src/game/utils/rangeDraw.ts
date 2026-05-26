import * as Phaser from 'phaser';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { TILE_WIDTH, TILE_HEIGHT } from '@/game/utils/constants';
import type { RangeTile } from '@/lib/game/defense';

/**
 * Shared tint palette for defense range / trigger-zone overlays.
 * Consumed by both the edit-mode ghost range (task 2.0.10) and the
 * defense-view mode coverage map (task 2.0.11) — keeping the vocabulary
 * consistent across both contexts.
 *
 * - `primary` (orange) — lethal effect radius (turret firing arc).
 * - `alert`   (yellow) — advisory radius (trap alarm range).
 */
export const RANGE_FILL_COLOR = {
  primary: 0xf97316,
  alert:   0xeab308,
} as const;

export const RANGE_FILL_ALPHA = 0.25;
export const RANGE_STROKE_ALPHA = 0.75;

/**
 * Paint a batch of grid tiles as filled isometric diamonds into the provided
 * graphics object.
 *
 * The helper is scene-agnostic — caller supplies the `graphics` target,
 * current camera offset, and grid rotation. Used by:
 *
 * - `RoomEditorScene` to draw the selected item's ghost-range (one tile set).
 * - `RoomScene` to draw every placed defense's coverage in defense-view mode
 *   (unioned across all defenses — overlapping tiles stack alpha, which
 *   reads as "denser coverage here", an intentional visual signal).
 *
 * Iso-diamond geometry is hard-coded to `TILE_WIDTH`/`TILE_HEIGHT` so it
 * stays in lockstep with the floor sprite generated in {@link BootScene}.
 */
export function paintRangeBand(
  graphics: Phaser.GameObjects.Graphics,
  tiles: ReadonlyArray<RangeTile>,
  color: number,
  rotation: number,
  offsetX: number,
  offsetY: number,
  fillAlpha: number = RANGE_FILL_ALPHA,
  strokeAlpha: number = RANGE_STROKE_ALPHA,
): void {
  if (tiles.length === 0) return;
  const halfW = TILE_WIDTH / 2;
  const halfH = TILE_HEIGHT / 2;
  graphics.fillStyle(color, fillAlpha);
  graphics.lineStyle(1, color, strokeAlpha);

  for (const tile of tiles) {
    const gridSize = (graphics.scene as any).gridSize || (graphics.scene as any).grid_size || 10;
    const pos = IsometricEngine.worldToScreen(tile.x, tile.y, rotation, gridSize);
    const cx = pos.x + offsetX;
    const cy = pos.y + offsetY;
    graphics.beginPath();
    graphics.moveTo(cx, cy - halfH);
    graphics.lineTo(cx + halfW, cy);
    graphics.lineTo(cx, cy + halfH);
    graphics.lineTo(cx - halfW, cy);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
  }
}
