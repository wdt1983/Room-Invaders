import * as Phaser from "phaser";

/**
 * Placeholder-sprite descriptor — `(key, w, h, heightPx, color)`.
 *
 * `key` must match `items.sprite_key` in `supabase/seed.sql`. `w`/`h` mirror
 * `items.footprint` so the generated block visually occupies the correct
 * isometric footprint.
 */
type SpriteDescriptor = readonly [string, number, number, number, number];

const FURNITURE: readonly SpriteDescriptor[] = [
  ['furniture_bed_twin',      2, 1, 16, 0x4a90e2],
  ['furniture_desk_wooden',   2, 1, 32, 0x8b5a2b],
  ['furniture_chair_office',  1, 1, 32, 0x95a5a6],
  ['furniture_shelf_metal',   1, 2, 64, 0x7f8c8d],
  ['furniture_dresser_wooden',2, 1, 40, 0x5c4033],
  ['furniture_tv_flatscreen', 2, 1, 24, 0x2c3e50],
  ['furniture_rug_area',      2, 2,  0, 0xc0392b],
  ['furniture_lamp_floor',    1, 1, 48, 0xf1c40f],
  ['furniture_plant_potted',  1, 1, 32, 0x2ecc71],
  ['furniture_table_folding', 2, 1, 20, 0xd2b48c],
  ['furniture_custom_poster', 1, 1, 40, 0x334155],
  ['furniture_custom_poster_pending', 1, 1, 40, 0xd97706],
  ['furniture_custom_poster_rejected', 1, 1, 40, 0x7f1d1d],
  ['cosmetic_warden_key',     1, 1, 16, 0x8b5cf6],
];

const TRAPS: readonly SpriteDescriptor[] = [
  ['trap_pressure_plate',  1, 1,  4, 0xe67e22],
  ['trap_spike_strip',     1, 1,  6, 0x7f8c8d],
  ['trap_shock_pad',       1, 1,  4, 0x3498db],
  ['trap_glue',            1, 1,  2, 0xf39c12],
  ['trap_tripwire_alarm',  1, 1,  8, 0xe74c3c],
  ['trap_flame_vent',      1, 1, 10, 0xd35400],
  ['trap_laser_grid',      1, 1,  4, 0x1abc9c],
  ['trap_shock_wire',      2, 1,  6, 0x9b59b6],
  ['trap_emp_mine',        1, 1,  5, 0x2980b9],
  ['trap_bear_trap',       1, 1,  6, 0xef4444],
  ['trap_ghost_wire',      1, 1,  4, 0x10b981],
  ['trap_circuit_emp_mine', 1, 1,  5, 0x06b6d4],
];

const TURRETS: readonly SpriteDescriptor[] = [
  ['turret_nailgun',    1, 1, 40, 0x34495e],
  ['turret_taser',      1, 1, 40, 0x9b59b6],
  ['turret_tesla',      1, 1, 56, 0x9b59b6],
  ['turret_autocannon', 2, 2, 64, 0x2c3e50],
  ['turret_shotgun',    1, 1, 44, 0xd35400],
  ['turret_autocannon_mk2', 2, 2, 64, 0x3b82f6],
  ['turret_power_node', 1, 1, 40, 0x3b82f6],
];

const BARRICADES: readonly SpriteDescriptor[] = [
  ['barricade_bookshelf',     2, 1, 56, 0x5c4033],
  ['barricade_flipped_table', 2, 1, 24, 0xa0522d],
  ['barricade_sandbags',      1, 1, 20, 0xbdc3c7],
];

const ENTITIES: readonly SpriteDescriptor[] = [
  ['entity_drone', 1, 1, 40, 0xf1c40f],
  ['guard_drone',  1, 1, 40, 0xf1c40f],
  ['guard_dog',    1, 1, 30, 0x9a3412],
  ['guard_decoy',  1, 1, 32, 0xa855f7],
  ['boss_ironjaw', 1, 1, 56, 0xef4444],
  ['boss_whisper', 1, 1, 48, 0x10b981],
  ['boss_volkov',  1, 1, 52, 0x3b82f6],
  ['boss_circuit', 1, 1, 48, 0xeab308],
  ['boss_warden',  1, 1, 60, 0x8b5cf6],
];

const STASH: readonly SpriteDescriptor[] = [
  ['loot_stash', 1, 1, 6, 0xfbbf24],
];

// Entry-point floor markers — flat diamond tiles drawn on top of the floor
// at each `entry_point` grid tile. Colors mirror the per-segment wall tint so
// the room reads as "wall breaks for a door/window/vent here".
const ENTRY_POINTS: readonly SpriteDescriptor[] = [
  ['entry_door',   1, 1, 0, 0xa0522d], // sienna
  ['entry_window', 1, 1, 0, 0x5dade2], // sky blue
  ['entry_vent',   1, 1, 0, 0x34495e], // slate
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    // 1. Preload gorgeous procedural floor tiles (Wood, Carpet, Cyber Grid, Concrete)
    this.generateFloorTexture("floor_wood", 0x5c4033, "wood");
    this.generateFloorTexture("floor_carpet", 0x242b35, "carpet");
    this.generateFloorTexture("floor_tile", 0x0f172a, "tile"); // glowing cyber-grid
    this.generateFloorTexture("floor_concrete", 0x475569, "concrete");
    this.generateFloorTexture("floor_neon_glitch", 0x180828, "neon_glitch");

    // Standard fallback tile is our cyberpunk glowing tile
    this.generateFloorTexture("iso-tile", 0x0f172a, "tile");

    // 2. Catalog sprites — keys must match supabase/seed.sql::items.sprite_key.
    // Entry-point textures are room-structure markers (not catalog items).
    for (const group of [FURNITURE, TRAPS, TURRETS, BARRICADES, ENTITIES, ENTRY_POINTS, STASH]) {
      for (const [key, w, h, heightPx, color] of group) {
        // Generate base key as direction 0
        this.generateIsoBlock(key, w, h, heightPx, color, 0);
        // Generate all four direction keys
        for (let dir = 0; dir < 4; dir++) {
          this.generateIsoBlock(`${key}_dir_${dir}`, w, h, heightPx, color, dir);
        }
      }
    }
  }

  create() {
    // Route by URL path through the high-fidelity decryption PreloaderScene
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    const targetScene = pathname.startsWith('/raid/') ? 'RaidScene' : 'RoomScene';
    this.scene.start('PreloaderScene', { targetScene });
  }

  /**
   * Generates procedural floor tile diamonds with distinct isometric styles
   */
  private generateFloorTexture(key: string, color: number, type: "wood" | "carpet" | "tile" | "concrete" | "neon_glitch"): void {
    const graphics = this.make.graphics();
    const TILE_W = 64;
    const TILE_H = 32;

    const ptTop = { x: TILE_W / 2, y: 0 };
    const ptRight = { x: TILE_W, y: TILE_H / 2 };
    const ptBottom = { x: TILE_W / 2, y: TILE_H };
    const ptLeft = { x: 0, y: TILE_H / 2 };

    const darken = (c: number, f: number) => {
      const r = Math.floor(((c >> 16) & 0xff) * f);
      const g = Math.floor(((c >> 8) & 0xff) * f);
      const b = Math.floor((c & 0xff) * f);
      return (r << 16) | (g << 8) | b;
    };

    // Draw main diamond floor face
    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(ptTop.x, ptTop.y);
    graphics.lineTo(ptRight.x, ptRight.y);
    graphics.lineTo(ptBottom.x, ptBottom.y);
    graphics.lineTo(ptLeft.x, ptLeft.y);
    graphics.closePath();
    graphics.fillPath();

    if (type === "neon_glitch") {
      // Sleek Neon Glitch: Dark purple base with cybernetic glowing lines in green & pink
      const neonGreen = 0x22c55e;
      const neonPink = 0xec4899;

      // Draw glitchy offset outlines
      graphics.lineStyle(1.5, neonPink, 0.6);
      graphics.beginPath();
      graphics.moveTo(ptTop.x - 2, ptTop.y);
      graphics.lineTo(ptRight.x - 2, ptRight.y);
      graphics.lineTo(ptBottom.x - 2, ptBottom.y);
      graphics.lineTo(ptLeft.x - 2, ptLeft.y);
      graphics.closePath();
      graphics.strokePath();

      graphics.lineStyle(1.5, neonGreen, 0.7);
      graphics.beginPath();
      graphics.moveTo(ptTop.x + 2, ptTop.y);
      graphics.lineTo(ptRight.x + 2, ptRight.y);
      graphics.lineTo(ptBottom.x + 2, ptBottom.y);
      graphics.lineTo(ptLeft.x + 2, ptLeft.y);
      graphics.closePath();
      graphics.strokePath();

      // Cyber micro circuit detail inside the tile
      graphics.lineStyle(1, 0xffffff, 0.3);
      graphics.beginPath();
      graphics.moveTo(TILE_W * 0.5, TILE_H * 0.2);
      graphics.lineTo(TILE_W * 0.5, TILE_H * 0.8);
      graphics.strokePath();
    } else if (type === "tile") {
      // Sleek Cyber Grid: Draw gorgeous glowing border edges (neon cyan!)
      const neonColor = 0x06b6d4; 
      
      // Thick soft glow outline
      graphics.lineStyle(2.5, neonColor, 0.45);
      graphics.beginPath();
      graphics.moveTo(ptTop.x, ptTop.y);
      graphics.lineTo(ptRight.x, ptRight.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptLeft.x, ptLeft.y);
      graphics.closePath();
      graphics.strokePath();

      // Sharp central grid line
      graphics.lineStyle(1.0, neonColor, 0.95);
      graphics.strokePath();
      
      // Draw subgrid crossing lines for micro-circuit detail
      graphics.lineStyle(1, neonColor, 0.15);
      graphics.beginPath();
      graphics.moveTo(TILE_W * 0.25, TILE_H * 0.25);
      graphics.lineTo(TILE_W * 0.75, TILE_H * 0.75);
      graphics.moveTo(TILE_W * 0.75, TILE_H * 0.25);
      graphics.lineTo(TILE_W * 0.25, TILE_H * 0.75);
      graphics.strokePath();
    } else if (type === "wood") {
      // Wood Planks: Draw parallel lines along the diamond face to look like planks
      graphics.lineStyle(1, darken(color, 0.65), 0.85);
      for (let f = 0.2; f <= 0.8; f += 0.2) {
        graphics.beginPath();
        graphics.moveTo(ptTop.x + (ptLeft.x - ptTop.x) * f, ptTop.y + (ptLeft.y - ptTop.y) * f);
        graphics.lineTo(ptRight.x + (ptBottom.x - ptRight.x) * f, ptRight.y + (ptBottom.y - ptRight.y) * f);
        graphics.strokePath();
      }
      
      // Border outline
      graphics.lineStyle(1, darken(color, 0.75), 0.9);
      graphics.beginPath();
      graphics.moveTo(ptTop.x, ptTop.y);
      graphics.lineTo(ptRight.x, ptRight.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptLeft.x, ptLeft.y);
      graphics.closePath();
      graphics.strokePath();
    } else if (type === "carpet") {
      // Cozy Carpet: Draw border and stipple speckle noise
      graphics.lineStyle(1, darken(color, 0.85), 0.7);
      graphics.beginPath();
      graphics.moveTo(ptTop.x, ptTop.y);
      graphics.lineTo(ptRight.x, ptRight.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptLeft.x, ptLeft.y);
      graphics.closePath();
      graphics.strokePath();

      // Draw subtle stipple noise points inside the diamond
      graphics.fillStyle(darken(color, 1.2), 0.4);
      graphics.fillRect(TILE_W * 0.3, TILE_H * 0.3, 2, 2);
      graphics.fillRect(TILE_W * 0.6, TILE_H * 0.4, 2, 2);
      graphics.fillRect(TILE_W * 0.45, TILE_H * 0.6, 2, 2);
      graphics.fillRect(TILE_W * 0.7, TILE_H * 0.65, 2, 2);
      graphics.fillRect(TILE_W * 0.2, TILE_H * 0.5, 2, 2);
      
      graphics.fillStyle(darken(color, 0.7), 0.4);
      graphics.fillRect(TILE_W * 0.4, TILE_H * 0.25, 2, 2);
      graphics.fillRect(TILE_W * 0.55, TILE_H * 0.5, 2, 2);
      graphics.fillRect(TILE_W * 0.35, TILE_H * 0.7, 2, 2);
      graphics.fillRect(TILE_W * 0.8, TILE_H * 0.45, 2, 2);
    } else if (type === "concrete") {
      // Concrete slabs: Draw cold grey borders and a micro crack line
      graphics.lineStyle(1, darken(color, 0.7), 0.95);
      graphics.beginPath();
      graphics.moveTo(ptTop.x, ptTop.y);
      graphics.lineTo(ptRight.x, ptRight.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptLeft.x, ptLeft.y);
      graphics.closePath();
      graphics.strokePath();

      // Procedural Concrete crack line
      graphics.lineStyle(1.0, darken(color, 0.55), 0.5);
      graphics.beginPath();
      graphics.moveTo(TILE_W * 0.4, TILE_H * 0.25);
      graphics.lineTo(TILE_W * 0.5, TILE_H * 0.45);
      graphics.lineTo(TILE_W * 0.42, TILE_H * 0.65);
      graphics.strokePath();
    }

    graphics.generateTexture(key, TILE_W, TILE_H);
    graphics.destroy();
  }

  /**
   * Generates highly polished 2.5D retro neon glow block textures
   */
  private generateIsoBlock(
    key: string,
    widthTiles: number,
    depthTiles: number,
    heightPixels: number,
    color: number,
    dir: number = 0
  ): void {
    const graphics = this.make.graphics();
    const TILE_W = 64;
    const TILE_H = 32;

    const wTiles = (dir % 2 === 1) ? depthTiles : widthTiles;
    const dTiles = (dir % 2 === 1) ? widthTiles : depthTiles;

    const shiftX = dTiles * (TILE_W / 2);

    const ptTop = { x: shiftX, y: 0 };
    const ptRight = {
      x: shiftX + wTiles * (TILE_W / 2),
      y: wTiles * (TILE_H / 2)
    };
    const ptBottom = {
      x: shiftX + (wTiles - dTiles) * (TILE_W / 2),
      y: (wTiles + dTiles) * (TILE_H / 2)
    };
    const ptLeft = {
      x: shiftX - dTiles * (TILE_W / 2),
      y: dTiles * (TILE_H / 2)
    };

    const centerX = (ptTop.x + ptBottom.x) / 2;
    const centerY = (ptTop.y + ptBottom.y) / 2;

    const darken = (c: number, f: number) => {
      const r = Math.floor(((c >> 16) & 0xff) * f);
      const g = Math.floor(((c >> 8) & 0xff) * f);
      const b = Math.floor((c & 0xff) * f);
      return (r << 16) | (g << 8) | b;
    };

    const lighten = (c: number, f: number) => {
      const r = Math.min(255, Math.floor(((c >> 16) & 0xff) * f));
      const g = Math.min(255, Math.floor(((c >> 8) & 0xff) * f));
      const b = Math.min(255, Math.floor((c & 0xff) * f));
      return (r << 16) | (g << 8) | b;
    };

    const getNeonGlowColor = (baseColor: number) => {
      const r = (baseColor >> 16) & 0xff;
      const g = (baseColor >> 8) & 0xff;
      const b = baseColor & 0xff;
      const maxVal = Math.max(r, g, b);
      if (maxVal === 0) return 0x00ffff;
      const factor = 255 / maxVal;
      const nr = Math.min(255, Math.floor(r * factor * 1.3));
      const ng = Math.min(255, Math.floor(g * factor * 1.3));
      const nb = Math.min(255, Math.floor(b * factor * 1.3));
      return (nr << 16) | (ng << 8) | nb;
    };

    const neonColor = getNeonGlowColor(color);

    const isFurniture = key.startsWith('furniture');
    const isTrap = key.startsWith('trap');
    const isTurret = key.startsWith('turret');
    const isBarricade = key.startsWith('barricade');
    const isEntity = key.startsWith('entity') || key.startsWith('boss') || key === 'loot_stash';

    // Unit-coordinate projection helper (True Rotations around Z-axis)
    const getPoint = (uOrig: number, vOrig: number) => {
      let u = uOrig;
      let v = vOrig;
      if (dir === 1) {
        u = 1 - vOrig;
        v = uOrig;
      } else if (dir === 2) {
        u = 1 - uOrig;
        v = 1 - vOrig;
      } else if (dir === 3) {
        u = vOrig;
        v = 1 - uOrig;
      }
      return {
        x: ptTop.x + (ptRight.x - ptTop.x) * u + (ptLeft.x - ptTop.x) * v,
        y: ptTop.y + (ptRight.y - ptTop.y) * u + (ptLeft.y - ptTop.y) * v
      };
    };

    // Soft Ambient Occlusion Contact Floor Shadow
    graphics.fillStyle(0x000000, 0.22);
    graphics.beginPath();
    graphics.moveTo(ptTop.x, ptTop.y + heightPixels);
    graphics.lineTo(ptRight.x + 3, ptRight.y + heightPixels + 1.5);
    graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels + 3);
    graphics.lineTo(ptLeft.x - 3, ptLeft.y + heightPixels + 1.5);
    graphics.closePath();
    graphics.fillPath();

    // 3D Volumetric Sub-Block Drawer (Draws elements block-by-block with correct depth and coordinates)
    const drawVolumetricSubBlock = (
      uStart: number,
      vStart: number,
      zStart: number,
      uSize: number,
      vSize: number,
      zSize: number,
      baseColor: number,
      options: {
        wood?: boolean;
        fabric?: boolean;
        neon?: boolean;
        screen?: boolean;
        drawers?: boolean;
        metalGrid?: boolean;
        sandbag?: boolean;
        panel?: boolean;
        alpha?: number;
      } = {}
    ) => {
      const alphaVal = options.alpha !== undefined ? options.alpha : 1;
      const subColorTop = options.screen ? baseColor : lighten(baseColor, 1.05);
      const subColorRight = darken(baseColor, 0.7);
      const subColorLeft = darken(baseColor, 0.55);

      const pt = (u: number, v: number, z: number) => {
        const pTop = getPoint(u, v);
        return {
          x: pTop.x,
          y: pTop.y + (heightPixels - z)
        };
      };

      const zEnd = zStart + zSize;

      const pt0 = pt(uStart, vStart, zEnd);
      const pt1 = pt(uStart + uSize, vStart, zEnd);
      const pt2 = pt(uStart + uSize, vStart + vSize, zEnd);
      const pt3 = pt(uStart, vStart + vSize, zEnd);

      const pt0B = pt(uStart, vStart, zStart);
      const pt1B = pt(uStart + uSize, vStart, zStart);
      const pt2B = pt(uStart + uSize, vStart + vSize, zStart);
      const pt3B = pt(uStart, vStart + vSize, zStart);

      // 1. TOP FACE FILL
      graphics.fillStyle(subColorTop, alphaVal);
      graphics.beginPath();
      graphics.moveTo(pt0.x, pt0.y);
      graphics.lineTo(pt1.x, pt1.y);
      graphics.lineTo(pt2.x, pt2.y);
      graphics.lineTo(pt3.x, pt3.y);
      graphics.closePath();
      graphics.fillPath();

      // Top face wood grains
      if (options.wood) {
        graphics.lineStyle(1.0, darken(baseColor, 0.65), 0.75 * alphaVal);
        for (let f = 0.2; f <= 0.8; f += 0.25) {
          const ws = pt(uStart, vStart + vSize * f, zEnd);
          const we = pt(uStart + uSize, vStart + vSize * f, zEnd);
          graphics.beginPath();
          graphics.moveTo(ws.x, ws.y);
          graphics.lineTo(we.x, we.y);
          graphics.strokePath();
        }
      }

      // Top face neon styling
      if (options.neon) {
        graphics.lineStyle(1.5, neonColor, 0.85 * alphaVal);
        graphics.beginPath();
        graphics.moveTo(pt0.x, pt0.y);
        graphics.lineTo(pt1.x, pt1.y);
        graphics.lineTo(pt2.x, pt2.y);
        graphics.lineTo(pt3.x, pt3.y);
        graphics.closePath();
        graphics.strokePath();
      }

      // Screen styling
      if (options.screen) {
        graphics.fillStyle(color, 0.8 * alphaVal);
        const s0 = pt(uStart + uSize * 0.08, vStart + vSize * 0.08, zEnd);
        const s1 = pt(uStart + uSize * 0.92, vStart + vSize * 0.08, zEnd);
        const s2 = pt(uStart + uSize * 0.92, vStart + vSize * 0.92, zEnd);
        const s3 = pt(uStart + uSize * 0.08, vStart + vSize * 0.92, zEnd);
        graphics.beginPath();
        graphics.moveTo(s0.x, s0.y);
        graphics.lineTo(s1.x, s1.y);
        graphics.lineTo(s2.x, s2.y);
        graphics.lineTo(s3.x, s3.y);
        graphics.closePath();
        graphics.fillPath();

        graphics.lineStyle(0.8, 0xffffff, 0.3 * alphaVal);
        for (let yPos = s0.y + 2; yPos < s3.y - 1; yPos += 2) {
          graphics.beginPath();
          graphics.moveTo(s0.x, yPos);
          graphics.lineTo(s1.x, yPos);
          graphics.strokePath();
        }
      }

      // 2. SIDE WALLS (if height > 0)
      if (zSize > 0) {
        // Right face
        graphics.fillStyle(subColorRight, alphaVal);
        graphics.beginPath();
        graphics.moveTo(pt1.x, pt1.y);
        graphics.lineTo(pt2.x, pt2.y);
        graphics.lineTo(pt2B.x, pt2B.y);
        graphics.lineTo(pt1B.x, pt1B.y);
        graphics.closePath();
        graphics.fillPath();

        // Left face
        graphics.fillStyle(subColorLeft, alphaVal);
        graphics.beginPath();
        graphics.moveTo(pt3.x, pt3.y);
        graphics.lineTo(pt2.x, pt2.y);
        graphics.lineTo(pt2B.x, pt2B.y);
        graphics.lineTo(pt3B.x, pt3B.y);
        graphics.closePath();
        graphics.fillPath();

        if (options.drawers) {
          graphics.lineStyle(1.5, darken(baseColor, 0.45), 1.0 * alphaVal);
          const handleColor = 0xfac20a;
          for (let f = 0.33; f <= 0.67; f += 0.33) {
            const h = zStart + zSize * f;
            const lStart = pt(uStart, vStart + vSize, h);
            const lEnd = pt(uStart + uSize, vStart + vSize, h);
            graphics.beginPath();
            graphics.moveTo(lStart.x, lStart.y);
            graphics.lineTo(lEnd.x, lEnd.y);
            graphics.strokePath();

            graphics.fillStyle(handleColor, alphaVal);
            const midX = (lStart.x + lEnd.x) / 2;
            const midY = (lStart.y + lEnd.y) / 2 - 2;
            graphics.beginPath();
            graphics.arc(midX, midY, 1.5, 0, Math.PI * 2);
            graphics.fillPath();
          }
        }
      }

      // Outlines / beveled seams
      graphics.lineStyle(1.0, darken(baseColor, 0.35), 0.7 * alphaVal);
      graphics.beginPath();
      graphics.moveTo(pt0.x, pt0.y);
      graphics.lineTo(pt1.x, pt1.y);
      graphics.lineTo(pt2.x, pt2.y);
      graphics.lineTo(pt3.x, pt3.y);
      graphics.closePath();
      graphics.strokePath();

      if (zSize > 0) {
        graphics.beginPath();
        graphics.moveTo(pt3.x, pt3.y);
        graphics.lineTo(pt3B.x, pt3B.y);
        graphics.moveTo(pt2.x, pt2.y);
        graphics.lineTo(pt2B.x, pt2B.y);
        graphics.moveTo(pt1.x, pt1.y);
        graphics.lineTo(pt1B.x, pt1B.y);
        graphics.strokePath();

        graphics.beginPath();
        graphics.moveTo(pt3B.x, pt3B.y);
        graphics.lineTo(pt2B.x, pt2B.y);
        graphics.lineTo(pt1B.x, pt1B.y);
        graphics.strokePath();
      }
    };

    let drawnCustomModel = false;

    // A. PREMIUM VOLUMETRIC FURNITURE CUSTOM MODELS
    if (key.startsWith('furniture_bed_twin')) {
      // Wood frame bottom
      drawVolumetricSubBlock(0, 0, 0, 1, 1, 6, 0x3d2b1f, { wood: true });
      // Headboard
      drawVolumetricSubBlock(0, 0, 0, 0.08, 1, 20, 0x271911, { wood: true });
      // Footboard
      drawVolumetricSubBlock(0.92, 0, 0, 0.08, 1, 12, 0x271911, { wood: true });
      // Raised comfortable mattress
      drawVolumetricSubBlock(0.08, 0.04, 6, 0.84, 0.92, 8, 0xe2e8f0);
      // Textured cozy blanket sheet
      drawVolumetricSubBlock(0.35, 0.04, 6.1, 0.57, 0.92, 8.2, 0x0891b2, { fabric: true });
      // Folded sheet top border rim
      drawVolumetricSubBlock(0.31, 0.04, 14.3, 0.04, 0.92, 0.2, 0xffffff);
      // Soft volumetric neon cyber pillow
      drawVolumetricSubBlock(0.12, 0.15, 14, 0.16, 0.7, 3, 0x06b6d4, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_desk_wooden')) {
      // Volumetric leg support pillars
      drawVolumetricSubBlock(0.05, 0.05, 0, 0.08, 0.08, heightPixels - 4, 0x271911);
      drawVolumetricSubBlock(0.05, 0.87, 0, 0.08, 0.08, heightPixels - 4, 0x271911);
      drawVolumetricSubBlock(0.87, 0.05, 0, 0.08, 0.08, heightPixels - 4, 0x271911);
      drawVolumetricSubBlock(0.87, 0.87, 0, 0.08, 0.08, heightPixels - 4, 0x271911);
      // Desktop slab
      drawVolumetricSubBlock(0, 0, heightPixels - 4, 1, 1, 4, 0x5c4033, { wood: true });
      // Side drawer cabinet unit
      drawVolumetricSubBlock(0.6, 0.08, 0, 0.28, 0.84, heightPixels - 4, 0x3d2b1f, { drawers: true });
      
      // Volumetric stand-up terminal monitor
      // base plate
      drawVolumetricSubBlock(0.35, 0.35, heightPixels, 0.12, 0.12, 1, 0x1e293b);
      // support neck
      drawVolumetricSubBlock(0.4, 0.4, heightPixels + 1, 0.04, 0.04, 4, 0x0f172a);
      // terminal screen
      drawVolumetricSubBlock(0.2, 0.38, heightPixels + 5, 0.45, 0.06, 12, 0x0f172a, { screen: true });
      // keyboard console
      drawVolumetricSubBlock(0.3, 0.6, heightPixels, 0.28, 0.16, 1, 0x1e293b, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_chair_office')) {
      // Spokes base
      drawVolumetricSubBlock(0.3, 0.3, 0, 0.4, 0.4, 3, 0x111827);
      // Lift pole
      drawVolumetricSubBlock(0.44, 0.44, 3, 0.12, 0.12, 12, 0xbababa);
      // Seat cushion
      drawVolumetricSubBlock(0.15, 0.15, 15, 0.7, 0.7, 5, 0x374151, { fabric: true });
      // Spine backing bar
      drawVolumetricSubBlock(0.45, 0.05, 15, 0.1, 0.1, 16, 0x1f2937);
      // Backrest
      drawVolumetricSubBlock(0.2, 0.05, 27, 0.6, 0.1, 10, 0x374151, { fabric: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_shelf_metal')) {
      // Vertical framing pillars
      drawVolumetricSubBlock(0.04, 0.04, 0, 0.06, 0.06, heightPixels, 0x4b5563);
      drawVolumetricSubBlock(0.04, 0.9, 0, 0.06, 0.06, heightPixels, 0x4b5563);
      drawVolumetricSubBlock(0.9, 0.04, 0, 0.06, 0.06, heightPixels, 0x4b5563);
      drawVolumetricSubBlock(0.9, 0.9, 0, 0.06, 0.06, heightPixels, 0x4b5563);
      
      const h1 = Math.floor(heightPixels * 0.2);
      const h2 = Math.floor(heightPixels * 0.45);
      const h3 = Math.floor(heightPixels * 0.7);
      const h4 = heightPixels - 2;

      // 4 metal wireframe shelves
      drawVolumetricSubBlock(0.04, 0.04, h1, 0.92, 0.92, 2, 0x1e293b, { metalGrid: true });
      drawVolumetricSubBlock(0.04, 0.04, h2, 0.92, 0.92, 2, 0x1e293b, { metalGrid: true });
      drawVolumetricSubBlock(0.04, 0.04, h3, 0.92, 0.92, 2, 0x1e293b, { metalGrid: true });
      drawVolumetricSubBlock(0.04, 0.04, h4, 0.92, 0.92, 2, 0x1e293b, { metalGrid: true });

      // Loot canisters & boxes scattered on shelf tiers
      drawVolumetricSubBlock(0.2, 0.2, h1 + 2, 0.35, 0.45, 10, 0xb45309, { wood: true });
      drawVolumetricSubBlock(0.4, 0.1, h2 + 2, 0.3, 0.5, 6, 0xef4444);
      drawVolumetricSubBlock(0.15, 0.3, h3 + 2, 0.25, 0.25, 12, 0x06b6d4, { neon: true });
      drawVolumetricSubBlock(0.55, 0.3, h3 + 2, 0.25, 0.25, 12, 0x06b6d4, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_tv_flatscreen')) {
      // Wooden media console table
      drawVolumetricSubBlock(0, 0, 0, 1, 1, 12, 0x1e293b, { wood: true });
      // Inner media compartment bay
      drawVolumetricSubBlock(0.06, 0.06, 1, 0.88, 0.88, 10, 0x0f172a);
      // Media player deck receiver
      drawVolumetricSubBlock(0.25, 0.25, 1.5, 0.3, 0.4, 3, 0x334155, { neon: true });
      // Volumetric monitor stand
      drawVolumetricSubBlock(0.4, 0.4, 12, 0.2, 0.2, 1, 0x111827);
      drawVolumetricSubBlock(0.47, 0.47, 13, 0.06, 0.06, 4, 0x111827);
      // Volumetric flat TV screen
      drawVolumetricSubBlock(0.15, 0.45, 17, 0.7, 0.1, 18, 0x111827, { screen: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_dresser_wooden')) {
      // Wood frame cabinet box
      drawVolumetricSubBlock(0, 0, 0, 1, 1, heightPixels, 0x5c4033, { wood: true });
      // Three modular wood drawer compartments
      const dH = Math.floor((heightPixels - 8) / 3);
      drawVolumetricSubBlock(0.04, 0.04, 2, 0.92, 0.92, dH, 0x8b5a2b, { drawers: true });
      drawVolumetricSubBlock(0.04, 0.04, 4 + dH, 0.92, 0.92, dH, 0x8b5a2b, { drawers: true });
      drawVolumetricSubBlock(0.04, 0.04, 6 + dH * 2, 0.92, 0.92, dH, 0x8b5a2b, { drawers: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_table_folding')) {
      // Four structural steel folding legs
      drawVolumetricSubBlock(0.08, 0.08, 0, 0.05, 0.05, heightPixels - 2, 0x4b5563);
      drawVolumetricSubBlock(0.08, 0.87, 0, 0.05, 0.05, heightPixels - 2, 0x4b5563);
      drawVolumetricSubBlock(0.87, 0.08, 0, 0.05, 0.05, heightPixels - 2, 0x4b5563);
      drawVolumetricSubBlock(0.87, 0.87, 0, 0.05, 0.05, heightPixels - 2, 0x4b5563);
      // Plastic folding tabletop panel
      drawVolumetricSubBlock(0, 0, heightPixels - 2, 1, 1, 2, 0xd2b48c, { wood: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_lamp_floor')) {
      // Heavy carbon base plate
      drawVolumetricSubBlock(0.3, 0.3, 0, 0.4, 0.4, 2, 0x111827);
      // Tall iron riser rod
      drawVolumetricSubBlock(0.46, 0.46, 2, 0.08, 0.08, heightPixels - 12, 0x78716c);
      // Retro glowing lamp shade dome
      drawVolumetricSubBlock(0.25, 0.25, heightPixels - 12, 0.5, 0.5, 12, 0xfac20a, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_plant_potted')) {
      // Terracotta flower pot
      drawVolumetricSubBlock(0.3, 0.3, 0, 0.4, 0.4, 10, 0xb45309);
      // Mud soil inside pot
      drawVolumetricSubBlock(0.33, 0.33, 9, 0.34, 0.34, 1.2, 0x451a03);
      // Plant stem shoot
      drawVolumetricSubBlock(0.46, 0.46, 10, 0.08, 0.08, 12, 0x15803d);
      // Voxel lush plant green layers
      drawVolumetricSubBlock(0.2, 0.2, 16, 0.6, 0.6, 6, 0x166534, { fabric: true });
      drawVolumetricSubBlock(0.25, 0.25, 22, 0.5, 0.5, 5, 0x15803d, { fabric: true });
      drawVolumetricSubBlock(0.35, 0.35, 27, 0.3, 0.3, 4, 0x22c55e, { fabric: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('furniture_custom_poster')) {
      // Outer poster backboard mounting frame
      drawVolumetricSubBlock(0.04, 0.45, 0, 0.92, 0.1, heightPixels, 0x1e293b, { wood: true });
      // Inner artwork print core
      drawVolumetricSubBlock(0.08, 0.47, 2, 0.84, 0.06, heightPixels - 4, 0x0f172a, { screen: true });

      drawnCustomModel = true;
    }

    // B. PREMIUM VOLUMETRIC BARRICADES
    else if (key.startsWith('barricade_bookshelf')) {
      // Flipped wood backing plate
      drawVolumetricSubBlock(0, 0, 0, 1, 1, 4, 0x5c4033, { wood: true });
      // Vertical shelf boards (leaning/lying on ground)
      drawVolumetricSubBlock(0, 0, 4, 0.06, 1, 20, 0x3d2b1f);
      drawVolumetricSubBlock(0.94, 0, 4, 0.06, 1, 20, 0x3d2b1f);
      drawVolumetricSubBlock(0.3, 0, 4, 0.05, 1, 20, 0x3d2b1f);
      drawVolumetricSubBlock(0.63, 0, 4, 0.05, 1, 20, 0x3d2b1f);
      
      // Spilled volumetric multi-colored books inside shelf sections
      drawVolumetricSubBlock(0.1, 0.15, 4, 0.15, 0.7, 14, 0xef4444);
      drawVolumetricSubBlock(0.2, 0.25, 4, 0.08, 0.5, 14, 0x3b82f6);
      drawVolumetricSubBlock(0.42, 0.3, 4, 0.12, 0.5, 12, 0xeab308);
      drawVolumetricSubBlock(0.5, 0.1, 4, 0.1, 0.7, 14, 0x10b981);
      drawVolumetricSubBlock(0.72, 0.2, 4, 0.15, 0.6, 12, 0x8b5cf6);

      drawnCustomModel = true;
    }
    else if (key.startsWith('barricade_flipped_table')) {
      // Tabletop shielding panel (wood)
      drawVolumetricSubBlock(0, 0.42, 0, 1, 0.16, heightPixels, 0xa0522d, { wood: true });
      // Four table legs extending horizontally
      drawVolumetricSubBlock(0.06, 0.08, heightPixels - 6, 0.08, 0.34, 0.08, 0x78350f);
      drawVolumetricSubBlock(0.06, 0.58, heightPixels - 6, 0.08, 0.34, 0.08, 0x78350f);
      drawVolumetricSubBlock(0.86, 0.08, heightPixels - 6, 0.08, 0.34, 0.08, 0x78350f);
      drawVolumetricSubBlock(0.86, 0.58, heightPixels - 6, 0.08, 0.34, 0.08, 0x78350f);

      drawnCustomModel = true;
    }
    else if (key.startsWith('barricade_sandbags')) {
      // Overlapping layered canvas sandbag components
      drawVolumetricSubBlock(0.05, 0.05, 0, 0.42, 0.9, 10, 0xbdc3c7, { fabric: true });
      drawVolumetricSubBlock(0.53, 0.05, 0, 0.42, 0.9, 10, 0xbdc3c7, { fabric: true });
      drawVolumetricSubBlock(0.22, 0.1, 10, 0.56, 0.8, 10, 0x9ca3af, { fabric: true });

      drawnCustomModel = true;
    }

    // C. HIGH-FIDELITY DEFENSIVE TURRETS
    else if (key.startsWith('turret_nailgun')) {
      // Octagonal armored steel base
      drawVolumetricSubBlock(0.12, 0.12, 0, 0.76, 0.76, 16, 0x34495e, { panel: true });
      // Swivel rotor stem riser
      drawVolumetricSubBlock(0.38, 0.38, 16, 0.24, 0.24, 6, 0x1e293b);
      // Automated gun housing block
      drawVolumetricSubBlock(0.2, 0.25, 22, 0.6, 0.6, 12, 0x475569, { neon: true });
      // Dual beveled steel gun barrels projecting forward
      drawVolumetricSubBlock(0.3, 0.05, 25, 0.12, 0.2, 4, 0x111827);
      drawVolumetricSubBlock(0.58, 0.05, 25, 0.12, 0.2, 4, 0x111827);

      drawnCustomModel = true;
    }
    else if (key.startsWith('turret_taser')) {
      // purple armored base
      drawVolumetricSubBlock(0.15, 0.15, 0, 0.7, 0.7, 12, 0x581c87, { panel: true });
      // central riser pole
      drawVolumetricSubBlock(0.35, 0.35, 12, 0.3, 0.3, 10, 0x3b0764);
      // condenser coil sphere
      drawVolumetricSubBlock(0.25, 0.25, 22, 0.5, 0.5, 12, 0x7e22ce, { neon: true });
      // dual brass shock spikes extending out
      drawVolumetricSubBlock(0.32, 0.1, 26, 0.08, 0.15, 4, 0xeab308);
      drawVolumetricSubBlock(0.6, 0.1, 26, 0.08, 0.15, 4, 0xeab308);

      drawnCustomModel = true;
    }
    else if (key.startsWith('turret_tesla')) {
      // Tower levels
      drawVolumetricSubBlock(0.15, 0.15, 0, 0.7, 0.7, 16, 0x1e293b, { panel: true });
      drawVolumetricSubBlock(0.25, 0.25, 16, 0.5, 0.5, 14, 0x475569, { panel: true });
      drawVolumetricSubBlock(0.35, 0.35, 30, 0.3, 0.3, 12, 0x334155);
      // Copper coil rings
      drawVolumetricSubBlock(0.25, 0.25, 42, 0.5, 0.5, 3, 0xb45309, { neon: true });
      drawVolumetricSubBlock(0.3, 0.3, 47, 0.4, 0.4, 3, 0xb45309, { neon: true });
      // Energy core on top
      drawVolumetricSubBlock(0.38, 0.38, 50, 0.24, 0.24, 6, 0xa855f7, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('turret_autocannon') || key.startsWith('turret_autocannon_mk2')) {
      // 2x2 large heavy armored base plates
      drawVolumetricSubBlock(0.1, 0.1, 0, 0.8, 0.8, 20, 0x1e293b, { panel: true });
      // Heavy rotary stem
      drawVolumetricSubBlock(0.3, 0.3, 20, 0.4, 0.4, 8, 0x0f172a);
      // Giant cannon head
      drawVolumetricSubBlock(0.15, 0.2, 28, 0.7, 0.65, 18, 0x334155, { neon: true });
      // Massive dual long barrels extending forward
      drawVolumetricSubBlock(0.26, 0.04, 32, 0.14, 0.2, 5, 0x0f172a);
      drawVolumetricSubBlock(0.6, 0.04, 32, 0.14, 0.2, 5, 0x0f172a);

      drawnCustomModel = true;
    }
    else if (key.startsWith('turret_shotgun')) {
      // Armor base
      drawVolumetricSubBlock(0.12, 0.12, 0, 0.76, 0.76, 14, 0xd35400, { panel: true });
      // neck
      drawVolumetricSubBlock(0.36, 0.36, 14, 0.28, 0.28, 6, 0x1e293b);
      // wide head box
      drawVolumetricSubBlock(0.18, 0.22, 20, 0.64, 0.64, 12, 0x475569, { neon: true });
      // Triple fanned barrels
      drawVolumetricSubBlock(0.22, 0.06, 23, 0.1, 0.2, 3, 0x0f172a);
      drawVolumetricSubBlock(0.45, 0.04, 24, 0.1, 0.2, 3, 0x0f172a);
      drawVolumetricSubBlock(0.68, 0.06, 23, 0.1, 0.2, 3, 0x0f172a);

      drawnCustomModel = true;
    }

    // D. PREMIUM VOLUMETRIC TRAPS
    else if (key.startsWith('trap_pressure_plate')) {
      // Thin metal pad on floor
      drawVolumetricSubBlock(0.08, 0.08, 0, 0.84, 0.84, 1.5, 0xe67e22);
      // Red raised trigger button in center
      drawVolumetricSubBlock(0.35, 0.35, 1.5, 0.3, 0.3, 1.5, 0xef4444, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('trap_spike_strip')) {
      // Carbon baseline bar
      drawVolumetricSubBlock(0.05, 0.2, 0, 0.9, 0.6, 2, 0x4b5563);
      // Rows of sharp volumetric metal spikes sticking out
      for (let u = 0.15; u <= 0.85; u += 0.22) {
        drawVolumetricSubBlock(u, 0.3, 2, 0.06, 0.12, 6, 0x9ca3af);
        drawVolumetricSubBlock(u, 0.58, 2, 0.06, 0.12, 6, 0x9ca3af);
      }

      drawnCustomModel = true;
    }
    else if (key.startsWith('trap_shock_pad')) {
      // Rubber insulated pad
      drawVolumetricSubBlock(0.08, 0.08, 0, 0.84, 0.84, 2, 0x334155);
      // Brass electrical contact rows on top
      drawVolumetricSubBlock(0.18, 0.18, 2, 0.64, 0.12, 0.5, 0xd97706, { neon: true });
      drawVolumetricSubBlock(0.18, 0.44, 2, 0.64, 0.12, 0.5, 0xd97706, { neon: true });
      drawVolumetricSubBlock(0.18, 0.7, 2, 0.64, 0.12, 0.5, 0xd97706, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('trap_glue')) {
      // Slime puddle base diamond
      drawVolumetricSubBlock(0.1, 0.1, 0, 0.8, 0.8, 1, 0xd97706, { alpha: 0.8 });
      // Glowing voxel slime details
      drawVolumetricSubBlock(0.25, 0.25, 1, 0.3, 0.3, 1, 0xfac20a, { neon: true });
      drawVolumetricSubBlock(0.55, 0.45, 1, 0.2, 0.2, 1, 0xfac20a, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('trap_tripwire_alarm')) {
      // Base plate
      drawVolumetricSubBlock(0.08, 0.08, 0, 0.84, 0.84, 1.5, 0x475569);
      // Left side sensor post
      drawVolumetricSubBlock(0.1, 0.42, 1.5, 0.12, 0.16, 10, 0x1e293b);
      // Right side sensor post
      drawVolumetricSubBlock(0.78, 0.42, 1.5, 0.12, 0.16, 10, 0x1e293b);
      // Glowing neon red tripwire laser block bridging them
      drawVolumetricSubBlock(0.22, 0.46, 8, 0.56, 0.08, 1, 0xef4444, { neon: true });

      drawnCustomModel = true;
    }

    // E. ENTITIES / DRONES & CHESTS
    else if (key.startsWith('entity_drone') || key.startsWith('guard_drone')) {
      // Hovering body sphere (suspended at z=12)
      drawVolumetricSubBlock(0.33, 0.33, 12, 0.34, 0.34, 8, 0xeab308, { neon: true });
      // Horizontal rotor arms
      drawVolumetricSubBlock(0.08, 0.08, 15, 0.84, 0.06, 2, 0x475569);
      drawVolumetricSubBlock(0.08, 0.86, 15, 0.84, 0.06, 2, 0x475569);
      // 4 glowing rotor blades discs on corners
      drawVolumetricSubBlock(0.04, 0.04, 17, 0.16, 0.16, 1, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.8, 0.04, 17, 0.16, 0.16, 1, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.04, 0.8, 17, 0.16, 0.16, 1, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.8, 0.8, 17, 0.16, 0.16, 1, 0x06b6d4, { screen: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('loot_stash')) {
      // Armored gold vault chest
      drawVolumetricSubBlock(0.12, 0.12, 0, 0.76, 0.76, 14, 0xd97706, { wood: true });
      // Titanium enforcement grid straps
      drawVolumetricSubBlock(0.12, 0.28, 0.1, 0.76, 0.12, 14.1, 0x475569);
      drawVolumetricSubBlock(0.12, 0.60, 0.1, 0.76, 0.12, 14.1, 0x475569);
      // Cyber display screen center lock
      drawVolumetricSubBlock(0.44, 0.44, 14, 0.12, 0.12, 1.5, 0x06b6d4, { neon: true });

      drawnCustomModel = true;
    }

    // F. DEFAULT FALLBACK BLOCK GENERATION (Standard sleek beveled octagonal prism)
    if (!drawnCustomModel) {
      drawVolumetricSubBlock(0, 0, 0, 1, 1, heightPixels, color, {
        panel: true,
        wood: isFurniture && (key.includes('wooden') || key.includes('wood') || key.includes('dresser')),
        neon: isTrap || isTurret || isEntity,
        screen: key.includes('monitor') || key.includes('panel')
      });
    }

    const totalWidth = (wTiles + dTiles) * (TILE_W / 2);
    const totalHeight = (wTiles + dTiles) * (TILE_H / 2) + heightPixels;

    graphics.generateTexture(key, totalWidth, totalHeight);
    graphics.destroy();
  }
}
