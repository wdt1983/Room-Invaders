/**
 * Global dimensional constants for the Room Invaders isometric engine.
 *
 * These values define the core isometric tile geometry and default grid
 * dimensions used throughout all coordinate transformation and rendering logic.
 *
 * TILE_WIDTH / TILE_HEIGHT follow a standard 2:1 isometric ratio (64×32),
 * matching the architecture spec in docs/architecture.md §6.
 */

/** Width of a single isometric tile in pixels. */
export const TILE_WIDTH = 64;

/** Height of a single isometric tile in pixels. */
export const TILE_HEIGHT = 32;

/** Default grid size (rows × columns) for room layouts. */
export const DEFAULT_GRID_SIZE = 10;
