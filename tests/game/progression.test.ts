import { describe, it, expect } from "vitest";
import { xpForLevel, levelForXp, levelProgress, MAX_PLAYER_LEVEL } from "@/lib/game/progression";

describe("Player Level-Up and XP Progression System", () => {
  describe("xpForLevel", () => {
    it("should return 0 for Level 1 (starting level)", () => {
      expect(xpForLevel(1)).toBe(0);
    });

    it("should return correct cumulative XP for standard landmark levels", () => {
      // Curve: 50 * n * (n - 1)
      expect(xpForLevel(2)).toBe(100);    // 50 * 2 * 1
      expect(xpForLevel(3)).toBe(300);    // 50 * 3 * 2
      expect(xpForLevel(5)).toBe(1000);   // 50 * 5 * 4
      expect(xpForLevel(10)).toBe(4500);  // 50 * 10 * 9
      expect(xpForLevel(15)).toBe(10500); // 50 * 15 * 14
      expect(xpForLevel(20)).toBe(19000); // 50 * 20 * 19
      expect(xpForLevel(100)).toBe(495000); // 50 * 100 * 99
    });

    it("should clamp below Level 1 and above MAX_PLAYER_LEVEL", () => {
      expect(xpForLevel(0)).toBe(0);
      expect(xpForLevel(-5)).toBe(0);
      expect(xpForLevel(MAX_PLAYER_LEVEL + 5)).toBe(xpForLevel(MAX_PLAYER_LEVEL));
    });
  });

  describe("levelForXp", () => {
    it("should return Level 1 for 0 or negative XP", () => {
      expect(levelForXp(0)).toBe(1);
      expect(levelForXp(-100)).toBe(1);
    });

    it("should return correct levels for exact XP thresholds", () => {
      expect(levelForXp(100)).toBe(2);
      expect(levelForXp(300)).toBe(3);
      expect(levelForXp(1000)).toBe(5);
      expect(levelForXp(4500)).toBe(10);
      expect(levelForXp(495000)).toBe(MAX_PLAYER_LEVEL);
    });

    it("should return correct level for mid-threshold XP values", () => {
      expect(levelForXp(50)).toBe(1);     // Between L1 (0) and L2 (100)
      expect(levelForXp(250)).toBe(2);    // Between L2 (100) and L3 (300)
      expect(levelForXp(999)).toBe(4);    // Between L4 (600) and L5 (1000)
      expect(levelForXp(5000)).toBe(10);  // Between L10 (4500) and L11 (5500)
      expect(levelForXp(600000)).toBe(MAX_PLAYER_LEVEL); // Above MAX_PLAYER_LEVEL limit
    });
  });

  describe("levelProgress", () => {
    it("should calculate correct fractional progress and remaining requirements", () => {
      // Between L2 (100 XP) and L3 (300 XP)
      // Span is 200 XP
      const p = levelProgress(150);
      expect(p.level).toBe(2);
      expect(p.xpIntoLevel).toBe(50); // 150 - 100
      expect(p.xpForNext).toBe(200);   // 300 - 100
      expect(p.progress01).toBe(0.25); // 50 / 200
    });

    it("should handle boundary cases correctly (exact levels)", () => {
      const p = levelProgress(300);
      expect(p.level).toBe(3);
      expect(p.xpIntoLevel).toBe(0);
      expect(p.progress01).toBe(0);
    });

    it("should clamp progress at MAX_PLAYER_LEVEL", () => {
      const p = levelProgress(600000);
      expect(p.level).toBe(MAX_PLAYER_LEVEL);
      expect(p.xpIntoLevel).toBe(0);
      expect(p.xpForNext).toBe(0);
      expect(p.progress01).toBe(1.0);
    });
  });
});
