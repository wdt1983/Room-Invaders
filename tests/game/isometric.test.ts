import { describe, it, expect } from "vitest";
import { IsometricEngine } from "@/game/systems/IsometricEngine";

describe("Isometric Coordinate Engine Mappings", () => {
  it("should calculate correct screen coordinates from world grid coordinates (0 deg)", () => {
    // Standard formulas:
    // screenX = (x - y) * 32
    // screenY = (x + y) * 16
    
    const p1 = IsometricEngine.worldToScreen(0, 0);
    expect(p1.x).toBe(0);
    expect(p1.y).toBe(0);

    const p2 = IsometricEngine.worldToScreen(2, 1);
    expect(p2.x).toBe((2 - 1) * 32); // 32
    expect(p2.y).toBe((2 + 1) * 16); // 48
  });

  it("should calculate correct screen coordinates with rotations", () => {
    // 90 degrees CW rotation
    // rotX = (gridSize - 1) - cartesianY = 9 - y
    // rotY = cartesianX = x
    // For (2, 1) with gridSize = 10, rotation = 1:
    // rotX = 9 - 1 = 8
    // rotY = 2
    // screenX = (8 - 2) * 32 = 192
    // screenY = (8 + 2) * 16 = 160
    const pRot1 = IsometricEngine.worldToScreen(2, 1, 1, 10);
    expect(pRot1.x).toBe(192);
    expect(pRot1.y).toBe(160);
  });

  it("should calculate correct world grid coordinates from screen coordinates", () => {
    // Standard inverse with zero offset and rotation 0
    const w1 = IsometricEngine.screenToWorld(0, 0, 0, 0, 0, 10);
    expect(w1.x).toBeCloseTo(0);
    expect(w1.y).toBeCloseTo(0);

    const w2 = IsometricEngine.screenToWorld(32, 48, 0, 0, 0, 10);
    expect(w2.x).toBeCloseTo(2);
    expect(w2.y).toBeCloseTo(1);
  });

  it("should calculate correct world grid coordinates with offset and rotations", () => {
    // With offset and rotation 1 (90 deg CW)
    // screenToWorld input: screenX, screenY, offsetX, offsetY, rotation, gridSize
    // For input screenX = 292, screenY = 260, offset = 100, 100, rotation = 1, gridSize = 10:
    // adjX = 292 - 100 = 192
    // adjY = 260 - 100 = 160
    // mapX = (192 / 32 + 160 / 16) / 2 = (6 + 10) / 2 = 8
    // mapY = (160 / 16 - 192 / 32) / 2 = (10 - 6) / 2 = 2
    // cartX = 8, cartY = 2
    // Reverse rotation 1: x = cartY = 2, y = MAX - cartX = 9 - 8 = 1
    // Expected output: { x: 2, y: 1 }
    const wRot = IsometricEngine.screenToWorld(292, 260, 100, 100, 1, 10);
    expect(wRot.x).toBe(2);
    expect(wRot.y).toBe(1);
  });
});
