/**
 * IsometricEngine — Pure math utility for isometric coordinate transformations.
 *
 * Provides static methods to convert between Cartesian grid coordinates
 * and screen-space pixel coordinates using the standard 2:1 isometric
 * projection defined in the architecture spec (64×32 tile geometry).
 *
 * This class is rendering-agnostic — it has no dependency on Phaser,
 * React, or any other framework.
 *
 * @see docs/architecture.md §6 — Isometric Engine Spec
 */

import { TILE_WIDTH, TILE_HEIGHT, DEFAULT_GRID_SIZE } from '@/game/utils/constants';

export class IsometricEngine {
  /**
   * Convert Cartesian grid coordinates to isometric screen-space coordinates.
   *
   * The origin (0, 0) in grid space maps to (0, 0) in screen space.
   * Callers should apply their own camera offset on top of the returned values.
   *
   * @param cartesianX - Column index in the grid (0-based).
   * @param cartesianY - Row index in the grid (0-based).
   * @returns Screen-space pixel position `{ x, y }`.
   */
  static worldToScreen(
    cartesianX: number,
    cartesianY: number,
    rotation: number = 0
  ): { x: number; y: number } {
    let rotX = cartesianX;
    let rotY = cartesianY;
    const MAX = DEFAULT_GRID_SIZE - 1;

    // Map coordinates based on rotation state
    switch (rotation % 4) {
      case 1: // 90 deg CW
        rotX = MAX - cartesianY;
        rotY = cartesianX;
        break;
      case 2: // 180 deg
        rotX = MAX - cartesianX;
        rotY = MAX - cartesianY;
        break;
      case 3: // 270 deg CW
        rotX = cartesianY;
        rotY = MAX - cartesianX;
        break;
      default: // 0 deg
        break;
    }

    const screenX = (rotX - rotY) * (TILE_WIDTH / 2);
    const screenY = (rotX + rotY) * (TILE_HEIGHT / 2);
    return { x: screenX, y: screenY };
  }

  /**
   * Convert isometric screen-space coordinates back to Cartesian grid indices.
   *
   * The returned values are floored to produce whole-number grid indices
   * suitable for tile lookups. Pass screen coordinates relative to the
   * same origin used by {@link worldToScreen} (i.e. after subtracting
   * any camera offset).
   *
   * @param screenX - Horizontal pixel position in screen space.
   * @param screenY - Vertical pixel position in screen space.
   * @returns Grid indices `{ x, y }` (floored to integers).
   */
  static screenToWorld(
    screenX: number,
    screenY: number,
    offsetX: number,
    offsetY: number,
    rotation: number = 0
  ): { x: number; y: number } {
    // Remove the visual offset first
    const adjX = screenX - offsetX;
    const adjY = screenY - offsetY;

    // Standard isometric inverse
    const mapX = (adjX / (TILE_WIDTH / 2) + adjY / (TILE_HEIGHT / 2)) / 2;
    const mapY = (adjY / (TILE_HEIGHT / 2) - adjX / (TILE_WIDTH / 2)) / 2;

    const cartX = Math.round(mapX);
    const cartY = Math.round(mapY);
    const MAX = DEFAULT_GRID_SIZE - 1;

    // Reverse the rotation mapping to get true underlying coordinates
    switch (rotation % 4) {
      case 1: // Reverse of 90 CW
        return { x: cartY, y: MAX - cartX };
      case 2: // Reverse of 180
        return { x: MAX - cartX, y: MAX - cartY };
      case 3: // Reverse of 270 CW
        return { x: MAX - cartY, y: cartX };
      default: // 0 deg
        return { x: cartX, y: cartY };
    }
  }
}
