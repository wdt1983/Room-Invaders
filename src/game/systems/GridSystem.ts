/**
 * GridSystem — Logical 2D grid data structure for room tile management.
 *
 * Maintains a `size × size` grid of {@link TileState} values and exposes
 * safe accessor / mutator methods with built-in bounds checking.
 *
 * This class is rendering-agnostic — it has no dependency on Phaser,
 * React, or any other framework.
 *
 * @see docs/architecture.md §6 — Tile states
 */

import { DEFAULT_GRID_SIZE } from '@/game/utils/constants';

/** Possible states for a single tile in the room grid. */
export type TileState = 'empty' | 'occupied' | 'entry_point';

export class GridSystem {
  /** The side-length of the square grid. */
  readonly size: number;

  /** Internal 2D grid storage — row-major: `grid[y][x]`. */
  private grid: TileState[][];

  /**
   * Create a new grid with every tile initialized to `'empty'`.
   *
   * @param size - Side-length of the square grid (defaults to {@link DEFAULT_GRID_SIZE}).
   */
  constructor(size: number = DEFAULT_GRID_SIZE) {
    this.size = size;
    this.grid = Array.from({ length: size }, () =>
      Array.from<TileState>({ length: size }).fill('empty'),
    );
  }

  // ──────────────────────────────────────────────
  //  Bounds checking
  // ──────────────────────────────────────────────

  /** Returns `true` if the given coordinates are inside the grid. */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.size && y >= 0 && y < this.size;
  }

  // ──────────────────────────────────────────────
  //  State accessors
  // ──────────────────────────────────────────────

  /**
   * Get the state of the tile at `(x, y)`.
   *
   * @returns The {@link TileState}, or `null` if the coordinates are out of bounds.
   */
  getTileState(x: number, y: number): TileState | null {
    if (!this.isInBounds(x, y)) return null;
    return this.grid[y][x];
  }

  /**
   * Set the state of the tile at `(x, y)`.
   *
   * @returns `true` if the state was set, `false` if the coordinates are out of bounds.
   */
  setTileState(x: number, y: number, state: TileState): boolean {
    if (!this.isInBounds(x, y)) return false;
    this.grid[y][x] = state;
    return true;
  }

  /**
   * Check whether a tile is walkable.
   *
   * A tile is considered walkable only if it is strictly `'empty'`.
   * Out-of-bounds coordinates are never walkable.
   *
   * @returns `true` if the tile exists and is `'empty'`.
   */
  isTileWalkable(x: number, y: number): boolean {
    return this.getTileState(x, y) === 'empty';
  }

  // ──────────────────────────────────────────────
  //  Pathfinding
  // ──────────────────────────────────────────────

  /**
   * Finds the shortest path between two coordinates using A*.
   * Only walkable coordinates are considered.
   */
  public findPath(startX: number, startY: number, targetX: number, targetY: number): { x: number, y: number }[] | null {
    if (!this.isInBounds(startX, startY) || !this.isInBounds(targetX, targetY)) return null;
    if (!this.isTileWalkable(targetX, targetY)) return null;

    type Node = { x: number; y: number; g: number; h: number; f: number; parent: Node | null };
    const openList: Node[] = [];
    const closedList: boolean[][] = Array.from({ length: this.size }, () => Array(this.size).fill(false));

    const startNode: Node = {
      x: startX,
      y: startY,
      g: 0,
      h: Math.abs(startX - targetX) + Math.abs(startY - targetY),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;

    openList.push(startNode);

    const getNeighbors = (node: Node): { x: number; y: number }[] => {
      const neighbors: { x: number; y: number }[] = [];
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // Up, Down, Left, Right
      for (const [dx, dy] of dirs) {
        const nx = node.x + dx;
        const ny = node.y + dy;
        if (this.isInBounds(nx, ny) && this.isTileWalkable(nx, ny)) {
          neighbors.push({ x: nx, y: ny });
        }
      }
      return neighbors;
    };

    while (openList.length > 0) {
      openList.sort((a, b) => a.f - b.f);
      const current = openList.shift()!;

      if (current.x === targetX && current.y === targetY) {
        const path: { x: number; y: number }[] = [];
        let curr: Node | null = current;
        while (curr !== null) {
          path.push({ x: curr.x, y: curr.y });
          curr = curr.parent;
        }
        return path.reverse();
      }

      closedList[current.y][current.x] = true;

      const neighbors = getNeighbors(current);
      for (const neighborPos of neighbors) {
        if (closedList[neighborPos.y][neighborPos.x]) continue;

        const gScore = current.g + 1;
        const hScore = Math.abs(neighborPos.x - targetX) + Math.abs(neighborPos.y - targetY);
        const fScore = gScore + hScore;

        const existingNode = openList.find((n) => n.x === neighborPos.x && n.y === neighborPos.y);

        if (!existingNode) {
          openList.push({
            x: neighborPos.x,
            y: neighborPos.y,
            g: gScore,
            h: hScore,
            f: fScore,
            parent: current,
          });
        } else if (gScore < existingNode.g) {
          existingNode.g = gScore;
          existingNode.f = fScore;
          existingNode.parent = current;
        }
      }
    }

    return null;
  }

  /**
   * Finds the shortest path to any adjacent walkable tile of the target coordinates.
   */
  public findPathToAdjacent(startX: number, startY: number, targetX: number, targetY: number): { x: number, y: number }[] | null {
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // Up, Down, Left, Right
    let shortestPath: { x: number, y: number }[] | null = null;

    for (const [dx, dy] of dirs) {
      const nx = targetX + dx;
      const ny = targetY + dy;

      if (this.isInBounds(nx, ny) && this.isTileWalkable(nx, ny)) {
        if (nx === startX && ny === startY) return []; // Already adjacent

        const path = this.findPath(startX, startY, nx, ny);
        if (path) {
          if (!shortestPath || path.length < shortestPath.length) {
            shortestPath = path;
          }
        }
      }
    }

    return shortestPath;
  }
}
