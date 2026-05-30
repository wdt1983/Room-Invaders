import { describe, it, expect } from "vitest";

// Define settings interface
interface HologramSettings {
  color: string;
  flicker: number;
  scanlines: number;
  noise: number;
}

const DEFAULT_HOLOGRAM_SETTINGS: HologramSettings = {
  color: "#06b6d4",
  flicker: 0.15,
  scanlines: 0.40,
  noise: 0.10
};

// Hologram settings validator
function validateHologramSettings(settings: any): HologramSettings {
  const color = typeof settings?.color === "string" ? settings.color : DEFAULT_HOLOGRAM_SETTINGS.color;
  const flicker = typeof settings?.flicker === "number" && !isNaN(settings.flicker)
    ? Math.min(1.0, Math.max(0.0, settings.flicker))
    : DEFAULT_HOLOGRAM_SETTINGS.flicker;
  const scanlines = typeof settings?.scanlines === "number" && !isNaN(settings.scanlines)
    ? Math.min(1.0, Math.max(0.0, settings.scanlines))
    : DEFAULT_HOLOGRAM_SETTINGS.scanlines;
  const noise = typeof settings?.noise === "number" && !isNaN(settings.noise)
    ? Math.min(1.0, Math.max(0.0, settings.noise))
    : DEFAULT_HOLOGRAM_SETTINGS.noise;

  return { color, flicker, scanlines, noise };
}

describe("HologramPoster Filter Configurations", () => {
  it("should return default hologram settings when input is empty or null", () => {
    const validated = validateHologramSettings(null);
    expect(validated).toEqual(DEFAULT_HOLOGRAM_SETTINGS);
  });

  it("should clamp out-of-range slider inputs between 0.0 and 1.0", () => {
    const validated = validateHologramSettings({
      flicker: 2.5,
      scanlines: -0.5,
      noise: 1.2,
      color: "#ff00ff"
    });
    
    expect(validated.flicker).toBe(1.0);
    expect(validated.scanlines).toBe(0.0);
    expect(validated.noise).toBe(1.0);
    expect(validated.color).toBe("#ff00ff");
  });

  it("should preserve valid slider and color preset selections", () => {
    const custom = {
      color: "#10b981", // Neon Green preset
      flicker: 0.45,
      scanlines: 0.25,
      noise: 0.05
    };
    const validated = validateHologramSettings(custom);
    expect(validated).toEqual(custom);
  });

  it("should fallback to defaults for NaN or invalid type parameters", () => {
    const validated = validateHologramSettings({
      color: 12345, // Invalid type
      flicker: "very-fast", // Invalid type
      scanlines: NaN,
      noise: undefined
    });
    
    expect(validated.color).toBe(DEFAULT_HOLOGRAM_SETTINGS.color);
    expect(validated.flicker).toBe(DEFAULT_HOLOGRAM_SETTINGS.flicker);
    expect(validated.scanlines).toBe(DEFAULT_HOLOGRAM_SETTINGS.scanlines);
    expect(validated.noise).toBe(DEFAULT_HOLOGRAM_SETTINGS.noise);
  });

  describe("Scanline Scrolling Math Calculations", () => {
    function calculateScanlineOffsetModulo(scanlineOffset: number): number {
      return Math.floor(scanlineOffset) % 4;
    }

    it("should compute wrapping pixel modulos correctly for incremental scanline offsets", () => {
      expect(calculateScanlineOffsetModulo(0)).toBe(0);
      expect(calculateScanlineOffsetModulo(1)).toBe(1);
      expect(calculateScanlineOffsetModulo(2.5)).toBe(2);
      expect(calculateScanlineOffsetModulo(3.9)).toBe(3);
      expect(calculateScanlineOffsetModulo(4.1)).toBe(0); // Wrap-around
      expect(calculateScanlineOffsetModulo(17.8)).toBe(1); // 17 % 4 = 1
    });

    it("should handle negative offsets gracefully", () => {
      expect(calculateScanlineOffsetModulo(-1)).toBe(-1);
    });
  });

  describe("Isometric Range Band Vector Geometry Math", () => {
    function calculateLineHalfWidth(dy: number, halfW: number, halfH: number): number {
      return halfW * (1 - Math.abs(dy) / halfH);
    }

    it("should compute absolute line half widths correctly at landmarks", () => {
      const halfW = 32;
      const halfH = 16;

      // 1. Center of the diamond (dy = 0) should span the full width
      expect(calculateLineHalfWidth(0, halfW, halfH)).toBe(32);

      // 2. Midway up/down (dy = ±8) should span exactly half the width
      expect(calculateLineHalfWidth(8, halfW, halfH)).toBe(16);
      expect(calculateLineHalfWidth(-8, halfW, halfH)).toBe(16);

      // 3. Extremes/tips of the diamond (dy = ±16) should converge to 0 width
      expect(calculateLineHalfWidth(16, halfW, halfH)).toBe(0);
      expect(calculateLineHalfWidth(-16, halfW, halfH)).toBe(0);
    });

    it("should clamp or handle fractional distances correctly", () => {
      const halfW = 32;
      const halfH = 16;
      
      expect(calculateLineHalfWidth(4, halfW, halfH)).toBe(24);  // 32 * (1 - 4/16) = 24
      expect(calculateLineHalfWidth(-12, halfW, halfH)).toBe(8); // 32 * (1 - 12/16) = 8
    });
  });

  describe("Holographic Boss Pedestal Customizer", () => {
    interface PedestalHologramSettings extends HologramSettings {
      boss: string;
    }

    const DEFAULT_PEDESTAL_SETTINGS: PedestalHologramSettings = {
      color: "#06b6d4",
      flicker: 0.15,
      scanlines: 0.40,
      noise: 0.10,
      boss: "boss-ironjaw"
    };

    function validatePedestalSettings(settings: any): PedestalHologramSettings {
      const base = validateHologramSettings(settings);
      const allowedBosses = ["boss-ironjaw", "boss-whisper", "boss-volkov", "boss-circuit", "boss-warden"];
      const boss = typeof settings?.boss === "string" && allowedBosses.includes(settings.boss)
        ? settings.boss
        : DEFAULT_PEDESTAL_SETTINGS.boss;

      return { ...base, boss };
    }

    it("should fallback to default boss 'boss-ironjaw' if boss is missing or invalid", () => {
      const validated1 = validatePedestalSettings(null);
      expect(validated1.boss).toBe("boss-ironjaw");

      const validated2 = validatePedestalSettings({ boss: "boss-fake" });
      expect(validated2.boss).toBe("boss-ironjaw");
    });

    it("should accept valid boss configurations", () => {
      const custom = {
        color: "#a855f7",
        flicker: 0.25,
        scanlines: 0.50,
        noise: 0.05,
        boss: "boss-volkov"
      };
      const validated = validatePedestalSettings(custom);
      expect(validated).toEqual(custom);
    });

    it("should cycle spinning steps correctly inside modulo 4 space", () => {
      let step = 0;
      const getNextStep = (s: number) => (s + 1) % 4;

      step = getNextStep(step); // 1
      expect(step).toBe(1);
      step = getNextStep(step); // 2
      expect(step).toBe(2);
      step = getNextStep(step); // 3
      expect(step).toBe(3);
      step = getNextStep(step); // 0 (wrap around)
      expect(step).toBe(0);
    });
  });

  describe("Cybernetic Glitch & Tearing Math", () => {
    // 1. Decay loop
    function decayGlitch(intensity: number, delta: number): number {
      const deltaFactor = delta / 16.66;
      const nextVal = intensity - 0.05 * deltaFactor;
      return nextVal < 0 ? 0 : nextVal;
    }

    it("should decay glitch intensity correctly based on framerate delta scale factor", () => {
      // At standard 60fps (delta = 16.66ms), decay should be exactly 0.05
      expect(decayGlitch(1.0, 16.66)).toBeCloseTo(0.95, 4);

      // At 30fps (delta = 33.32ms), decay should be double (0.10)
      expect(decayGlitch(1.0, 33.32)).toBeCloseTo(0.90, 4);

      // At very high framerate (delta = 8.33ms), decay should be half (0.025)
      expect(decayGlitch(1.0, 8.33)).toBeCloseTo(0.975, 4);

      // Glitch intensity should never drop below 0
      expect(decayGlitch(0.02, 16.66)).toBe(0);
    });

    // 2. Horizontal Screen-Tearing shift
    function getGlitchTearingShiftBounds(width: number, intensity: number): { min: number; max: number } {
      const maxShift = 0.5 * width * 0.3 * intensity;
      return { min: maxShift === 0 ? 0 : -maxShift, max: maxShift };
    }

    it("should compute correct shift boundaries for screen tearing slices", () => {
      const width = 18; // standard poster size
      
      // With 0 glitch intensity, tearing shift should be zero
      const boundsZero = getGlitchTearingShiftBounds(width, 0);
      expect(boundsZero.min).toBe(0);
      expect(boundsZero.max).toBe(0);

      // With 1.0 glitch intensity, tearing shift should be within [-2.7, 2.7]
      // 0.5 * 18 * 0.3 * 1.0 = 2.7
      const boundsMax = getGlitchTearingShiftBounds(width, 1.0);
      expect(boundsMax.min).toBeCloseTo(-2.7, 4);
      expect(boundsMax.max).toBeCloseTo(2.7, 4);

      // With 0.5 glitch intensity, tearing shift should be within [-1.35, 1.35]
      const boundsHalf = getGlitchTearingShiftBounds(width, 0.5);
      expect(boundsHalf.min).toBeCloseTo(-1.35, 4);
      expect(boundsHalf.max).toBeCloseTo(1.35, 4);
    });

    // 3. Pedestal projection jitter
    function getPedestalJitterBounds(intensity: number): {
      minShiftX: number;
      maxShiftX: number;
      minScaleX: number;
      maxScaleX: number;
    } {
      const maxShiftX = 0.5 * 8 * intensity;
      const maxScaleWobble = 0.5 * 0.4 * intensity;
      return {
        minShiftX: maxShiftX === 0 ? 0 : -maxShiftX,
        maxShiftX,
        minScaleX: 1.0 - maxScaleWobble,
        maxScaleX: 1.0 + maxScaleWobble
      };
    }

    it("should compute accurate coordinate shift and scale wobble ranges for pedestal projections", () => {
      // With 0 glitch, no jitter should be present
      const boundsZero = getPedestalJitterBounds(0);
      expect(boundsZero.minShiftX).toBe(0);
      expect(boundsZero.maxShiftX).toBe(0);
      expect(boundsZero.minScaleX).toBe(1.0);
      expect(boundsZero.maxScaleX).toBe(1.0);

      // With 1.0 glitch intensity
      // ShiftX bounds should be [-4, 4]
      // ScaleX bounds should be [0.8, 1.2]
      const boundsMax = getPedestalJitterBounds(1.0);
      expect(boundsMax.minShiftX).toBe(-4);
      expect(boundsMax.maxShiftX).toBe(4);
      expect(boundsMax.minScaleX).toBeCloseTo(0.8, 4);
      expect(boundsMax.maxScaleX).toBeCloseTo(1.2, 4);

      // With 0.5 glitch intensity
      // ShiftX bounds should be [-2, 2]
      // ScaleX bounds should be [0.9, 1.1]
      const boundsHalf = getPedestalJitterBounds(0.5);
      expect(boundsHalf.minShiftX).toBe(-2);
      expect(boundsHalf.maxShiftX).toBe(2);
      expect(boundsHalf.minScaleX).toBeCloseTo(0.9, 4);
      expect(boundsHalf.maxScaleX).toBeCloseTo(1.1, 4);
    });

    // 4. Alpha drops and minimum alpha safety bounds
    function getPedestalAlphaBounds(intensity: number): { minAlpha: number; maxAlpha: number } {
      // Alpha without drop: 0.6 * (1.0 - intensity * 0.5)
      // Alpha with drop: 0.6 * (1.0 - intensity * 0.5) * 0.35 (gated on intensity > 0)
      // Clamped by Math.max(0.1, alpha)
      const baseAlpha = 0.6 * (1.0 - intensity * 0.5);
      const droppedAlpha = intensity > 0 ? baseAlpha * 0.35 : baseAlpha;
      return {
        minAlpha: Math.max(0.1, droppedAlpha),
        maxAlpha: Math.max(0.1, baseAlpha)
      };
    }

    it("should calculate correct projection transparency ranges and safety clamping", () => {
      // With 0 glitch: alpha should be exactly 0.6
      const alphaZero = getPedestalAlphaBounds(0);
      expect(alphaZero.minAlpha).toBe(0.6);
      expect(alphaZero.maxAlpha).toBe(0.6);

      // With 1.0 glitch intensity:
      // Base alpha = 0.6 * (1.0 - 0.5) = 0.3
      // Dropped alpha = 0.3 * 0.35 = 0.105
      // Min alpha should be 0.105, Max alpha should be 0.3
      const alphaMax = getPedestalAlphaBounds(1.0);
      expect(alphaMax.minAlpha).toBeCloseTo(0.105, 4);
      expect(alphaMax.maxAlpha).toBeCloseTo(0.3, 4);

      // With extremely high glitch intensity (e.g. 2.0 override)
      // Base alpha = 0.6 * (1.0 - 1.0) = 0
      // Clamped min/max alpha should respect safety floor of 0.1
      const alphaSuper = getPedestalAlphaBounds(2.0);
      expect(alphaSuper.minAlpha).toBe(0.1);
      expect(alphaSuper.maxAlpha).toBe(0.1);
    });
  });
});

