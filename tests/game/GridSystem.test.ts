import { describe, it, expect } from "vitest";
import { GridSystem } from "@/game/systems/GridSystem";

describe("Grid System & Pathfinding logic", () => {
  it("should initialize correct default 10x10 grids", () => {
    const grid = new GridSystem(10);
    expect(grid.size).toBe(10);
    
    // Check that every grid tile is empty initially
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        expect(grid.isTileWalkable(x, y)).toBe(true);
      }
    }
  });

  it("should successfully identify non-walkable tile obstacles", () => {
    const grid = new GridSystem(10);
    grid.setTileState(2, 3, "occupied");
    
    expect(grid.isTileWalkable(2, 3)).toBe(false);
    expect(grid.isTileWalkable(2, 4)).toBe(true);
  });

  it("should enforce bounds checking correctly", () => {
    const grid = new GridSystem(5);
    expect(grid.isInBounds(0, 0)).toBe(true);
    expect(grid.isInBounds(4, 4)).toBe(true);
    expect(grid.isInBounds(-1, 0)).toBe(false);
    expect(grid.isInBounds(0, 5)).toBe(false);
    expect(grid.isInBounds(5, 5)).toBe(false);
  });

  it("should resolve deterministic A* paths around obstacles", () => {
    const grid = new GridSystem(5);
    
    // Place a wall at (1, 0), (1, 1), and (1, 2)
    grid.setTileState(1, 0, "occupied");
    grid.setTileState(1, 1, "occupied");
    grid.setTileState(1, 2, "occupied");

    // Path from (0, 1) to (2, 1) should divert around column wall
    const path = grid.findPath(0, 1, 2, 1);
    expect(path).not.toBeNull();
    
    // Path should avoid blocked coordinates
    const containsBlocked = path!.some(p => p.x === 1 && p.y <= 2);
    expect(containsBlocked).toBe(false);
  });

  it("should find the shortest path to an adjacent tile using findPathToAdjacent", () => {
    const grid = new GridSystem(5);
    
    // Target is (2, 2) which has obstacles/occupied states
    grid.setTileState(2, 2, "occupied");
    
    // We want to walk adjacent to (2, 2) from (0, 2)
    const path = grid.findPathToAdjacent(0, 2, 2, 2);
    expect(path).not.toBeNull();
    
    // The path should end at one of (2,2)'s empty neighbors: (1, 2), (3, 2), (2, 1), (2, 3)
    const destination = path![path!.length - 1];
    expect(
      (destination.x === 1 && destination.y === 2) ||
      (destination.x === 3 && destination.y === 2) ||
      (destination.x === 2 && destination.y === 1) ||
      (destination.x === 2 && destination.y === 3)
    ).toBe(true);
  });
});
