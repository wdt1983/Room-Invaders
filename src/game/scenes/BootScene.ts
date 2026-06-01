import * as Phaser from "phaser";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useSquadStore } from "@/lib/store/useSquadStore";

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
  ['furniture_boss_pedestal', 1, 1, 32, 0x475569],
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

    // Pre-generate slot-specific raider textures
    for (let slot = 1; slot <= 4; slot++) {
      const slotKey = `entity_drone_slot_${slot}`;
      this.generateIsoBlock(slotKey, 1, 1, 40, 0xf1c40f, 0);
      for (let dir = 0; dir < 4; dir++) {
        this.generateIsoBlock(`${slotKey}_dir_${dir}`, 1, 1, 40, 0xf1c40f, dir);
      }
    }

    // 3. Pre-generate boss holographic projections (cyan wireframe blueprints)
    for (const bossKey of ['boss_ironjaw', 'boss_whisper', 'boss_volkov', 'boss_circuit', 'boss_warden']) {
      const holoKey = `hologram_${bossKey}`;
      const color = 0x06b6d4; // Cyan is default hologram color
      const entry = ENTITIES.find(e => e[0] === bossKey);
      const w = entry ? entry[1] : 1;
      const h = entry ? entry[2] : 1;
      const heightPx = entry ? entry[3] : 48;
      
      this.generateIsoBlock(holoKey, w, h, heightPx, color, 0);
      for (let dir = 0; dir < 4; dir++) {
        this.generateIsoBlock(`${holoKey}_dir_${dir}`, w, h, heightPx, color, dir);
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
    const isHologram = key.startsWith('hologram_');

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
    graphics.fillStyle(isHologram ? neonColor : 0x000000, isHologram ? 0.25 : 0.22);
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
      const alphaVal = options.alpha !== undefined ? options.alpha : (isHologram ? 0.15 : 1);
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
      if (isHologram) {
        graphics.lineStyle(1.5, neonColor, 0.9);
      } else {
        graphics.lineStyle(1.0, darken(baseColor, 0.35), 0.7 * alphaVal);
      }
      graphics.beginPath();
      graphics.moveTo(pt0.x, pt0.y);
      graphics.lineTo(pt1.x, pt1.y);
      graphics.lineTo(pt2.x, pt2.y);
      graphics.lineTo(pt3.x, pt3.y);
      graphics.closePath();
      graphics.strokePath();

      if (zSize > 0) {
        if (isHologram) {
          graphics.lineStyle(1.5, neonColor, 0.9);
        } else {
          graphics.lineStyle(1.0, darken(baseColor, 0.35), 0.7 * alphaVal);
        }
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
    else if (key.startsWith('furniture_boss_pedestal')) {
      // 1. Sleek metallic base terminal (volumetric block)
      drawVolumetricSubBlock(0.15, 0.15, 0, 0.7, 0.7, 24, 0x1e293b, { panel: true });
      // 2. High-tech keyboard/console interface panel on top
      drawVolumetricSubBlock(0.2, 0.2, 24, 0.6, 0.6, 4, 0x0f172a, { neon: true });
      // 3. Status indicator lights or glowing core on the front
      drawVolumetricSubBlock(0.35, 0.12, 10, 0.3, 0.04, 6, 0x06b6d4, { neon: true });

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
    else if (key.startsWith('entity_drone')) {
      // 0. Parse slot number if this is a slot-specific key, default to slot 1 for general key
      let slotNumber = 1;
      if (key.includes('slot_2')) slotNumber = 2;
      else if (key.includes('slot_3')) slotNumber = 3;
      else if (key.includes('slot_4')) slotNumber = 4;

      // 1. Fetch cosmetics customizer settings
      let preset = "tactical";
      let gender = "male";
      let helmetColor = 0x1e293b;
      let visorColor = 0x06b6d4;
      let vestColor = color; // defaults to the squad color preset or customized color
      let pantsColor = 0x1e3a8a;
      let bootsColor = 0x0f172a;
      let hairColor = 0xd97706;

      try {
        if (typeof window !== "undefined") {
          // Allow dynamic injection from global window for direct previews, or fallback to Zustand store
          const activeCosmetics = (window as any).activeRaiderCosmetics || usePlayerStore.getState().raiderCosmetics;
          if (activeCosmetics) {
            preset = activeCosmetics.preset ?? preset;
            gender = activeCosmetics.gender ?? gender;
            helmetColor = typeof activeCosmetics.helmetColor === 'number' ? activeCosmetics.helmetColor : helmetColor;
            visorColor = typeof activeCosmetics.visorColor === 'number' ? activeCosmetics.visorColor : visorColor;
            vestColor = typeof activeCosmetics.vestColor === 'number' ? activeCosmetics.vestColor : vestColor;
            pantsColor = typeof activeCosmetics.pantsColor === 'number' ? activeCosmetics.pantsColor : pantsColor;
            bootsColor = typeof activeCosmetics.bootsColor === 'number' ? activeCosmetics.bootsColor : bootsColor;
            hairColor = typeof activeCosmetics.hairColor === 'number' ? activeCosmetics.hairColor : hairColor;
          }
        }
      } catch (e) {
        console.warn("Failed to read store cosmetics inside Phaser generator", e);
      }

      // 2. Fetch slot-specific loadout weapons and armor
      let weapon: string | null = null;
      let armor: string | null = null;

      try {
        if (typeof window !== "undefined") {
          const members = (window as any).useSquadStore?.getState().members || [];
          const member = members.find((m: any) => m.slotNumber === slotNumber);
          if (member) {
            weapon = member.weapon || null;
            armor = member.armor || null;
          }
        }
      } catch (e) {
        console.warn("Failed to read squad loadout inside Phaser generator", e);
      }

      const isFemale = gender === "female";
      const isRustic = preset === "rustic";

      // 1. FEET & TACTICAL BOOTS (z = 0 to 4)
      const finalBootsColor = isRustic ? 0x451a03 : bootsColor; // Dark brown leather boots for rustic, else bootsColor
      drawVolumetricSubBlock(0.32, 0.38, 0, 0.14, 0.16, 4, finalBootsColor, { panel: true });
      drawVolumetricSubBlock(0.54, 0.38, 0, 0.14, 0.16, 4, finalBootsColor, { panel: true });
      
      // 2. LEGS & TACTICAL CARGO PANTS (z = 4 to 16)
      // Left leg
      drawVolumetricSubBlock(0.32, 0.34, 4, 0.14, 0.18, 12, pantsColor);
      // Right leg
      drawVolumetricSubBlock(0.54, 0.34, 4, 0.14, 0.18, 12, pantsColor);
      
      // 3. UTILITY BELT & HIP POUCHES (z = 16 to 18)
      drawVolumetricSubBlock(0.28, 0.30, 16, 0.44, 0.22, 2, 0x0f172a, { panel: true }); // Belt
      drawVolumetricSubBlock(0.24, 0.34, 12, 0.06, 0.12, 4, 0xd97706); // Holstered utility pouch left
      drawVolumetricSubBlock(0.70, 0.34, 12, 0.06, 0.12, 4, 0xd97706); // Holstered utility pouch right
      
      // 4. TORSO & ARMORED VEST (z = 18 to 32)
      if (isRustic) {
        // Replaces armor plates with a long desert-tan coat (z = 8 to 32)
        drawVolumetricSubBlock(0.24, 0.28, 8, 0.52, 0.24, 24, vestColor, { panel: true });
      } else {
        // Heavy tactical jacket torso
        // Streamline torso frame for female
        const torsoW = isFemale ? 0.40 : 0.48;
        const torsoD = isFemale ? 0.20 : 0.24;
        const torsoU = (1.0 - torsoW) / 2;
        const torsoV = 0.28;
        drawVolumetricSubBlock(torsoU, torsoV, 18, torsoW, torsoD, 14, 0x334155);

        // Armored front breastplate vest overlay (textured with custom color tint!)
        const vestW = isFemale ? 0.36 : 0.44;
        const vestU = (1.0 - vestW) / 2;
        drawVolumetricSubBlock(vestU, 0.26, 20, vestW, 0.04, 10, vestColor, { panel: true });

        // Glowing chest-mounted telemetry core badge
        drawVolumetricSubBlock(0.44, 0.24, 23, 0.12, 0.02, 4, 0x06b6d4, { neon: true });
        
        // --- Armor Loadout Additions ---
        if (armor === 'reinforced_vest') {
          // Reinforced Vest: draw extra black plate reinforcement block on chest
          drawVolumetricSubBlock(0.38, 0.24, 21, 0.24, 0.04, 8, 0x1e293b, { panel: true });
        } else if (armor === 'tactical_armor') {
          // Tactical Armor (Exo-Clad): draw extra heavy chest ridges and active power coils
          drawVolumetricSubBlock(0.34, 0.24, 20, 0.32, 0.04, 12, 0x0f172a, { panel: true });
          drawVolumetricSubBlock(0.38, 0.22, 24, 0.24, 0.04, 4, 0x06b6d4, { neon: true });
        }
      }
      
      // 5. BACKPACK (z = 18 to 30)
      // Heavy-duty composite explorer pack
      drawVolumetricSubBlock(0.30, 0.52, 18, 0.40, 0.16, 12, 0x1e293b, { panel: true });
      
      // 6. TACTICAL SHOULDER PADS & ARMS (z = 18 to 28)
      // Left arm sleeve
      const armW = isFemale ? 0.06 : 0.08;
      const leftArmU = isFemale ? 0.20 : 0.18;
      drawVolumetricSubBlock(leftArmU, 0.32, 18, armW, 0.16, 10, 0x334155);
      
      // Right arm sleeve
      const rightArmU = isFemale ? 0.74 : 0.74;
      drawVolumetricSubBlock(rightArmU, 0.32, 18, armW, 0.16, 10, 0x334155);

      if (!isRustic && armor === 'tactical_armor') {
        // Massive heavy pauldrons and glowing power coils for Exo-Clad tactical armor
        drawVolumetricSubBlock(leftArmU - 0.04, 0.28, 25, armW + 0.04, 0.22, 5, 0x0f172a, { panel: true });
        drawVolumetricSubBlock(rightArmU, 0.28, 25, armW + 0.04, 0.22, 5, 0x0f172a, { panel: true });
        drawVolumetricSubBlock(leftArmU - 0.02, 0.30, 30, armW, 0.18, 1, 0x06b6d4, { neon: true });
        drawVolumetricSubBlock(rightArmU + 0.02, 0.30, 30, armW, 0.18, 1, 0x06b6d4, { neon: true });
      } else {
        // Standard shoulder plates
        drawVolumetricSubBlock(leftArmU - 0.02, 0.30, 26, armW + 0.02, 0.18, 3, vestColor, { panel: true }); // Left shoulder plate
        drawVolumetricSubBlock(rightArmU, 0.30, 26, armW + 0.02, 0.18, 3, vestColor, { panel: true }); // Right shoulder plate
      }
      
      // 7. GLOVED HANDS & HELD WEAPON (z = 16 to 22)
      // Gloved hands holding rifle
      drawVolumetricSubBlock(0.22, 0.28, 15, 0.08, 0.12, 3, 0x1f2937); // Left hand
      drawVolumetricSubBlock(0.70, 0.28, 15, 0.08, 0.12, 3, 0x1f2937); // Right hand

      if (weapon === 'heavy_machete') {
        // Cybernetic Laser Machete: Renders in right hand
        drawVolumetricSubBlock(0.68, 0.04, 17, 0.08, 0.26, 3, 0xe2e8f0, { panel: true }); // silver blade
        drawVolumetricSubBlock(0.66, 0.02, 17, 0.12, 0.02, 3, 0xf59e0b, { neon: true });  // glowing amber laser edge
        drawVolumetricSubBlock(0.68, 0.26, 15, 0.08, 0.08, 6, 0x111827);                // dark hilt
      } else if (weapon === 'demo_hammer') {
        // Vibro-Shock Demolition Hammer: Renders held diagonally
        drawVolumetricSubBlock(0.26, 0.16, 17, 0.48, 0.06, 2, 0x374151);                // long hammer shaft
        drawVolumetricSubBlock(0.68, 0.04, 13, 0.18, 0.16, 9, 0x1f2937, { panel: true }); // massive steel head casing
        drawVolumetricSubBlock(0.70, 0.02, 14, 0.14, 0.02, 7, 0xf97316, { neon: true });  // orange active shock pad
        drawVolumetricSubBlock(0.66, 0.10, 16, 0.02, 0.06, 3, 0xeab308, { neon: true });  // yellow hazard details
      } else {
        // Default Tactical Assault Rifle
        drawVolumetricSubBlock(0.30, 0.20, 18, 0.44, 0.08, 4, 0x0f172a, { panel: true }); // Rifle barrel
        drawVolumetricSubBlock(0.74, 0.18, 19, 0.03, 0.03, 2, 0x22c55e, { neon: true });  // Green laser sight tip
      }
      
      // 8. HEAD, NECK & TACTICAL BEVELED HELMET (z = 32 to 42)
      // Neck joint
      drawVolumetricSubBlock(0.42, 0.34, 30, 0.16, 0.12, 3, 0xfdba74); // Skin tone neck
      // Armored high-tech helmet
      drawVolumetricSubBlock(0.30, 0.28, 33, 0.40, 0.24, 9, helmetColor, { panel: true });
      
      // Visor
      const finalVisorColor = isRustic ? 0xf59e0b : visorColor; // Orange/amber goggles for rustic, else visorColor
      // Sweeping neon cybernetic visor on the face plate
      drawVolumetricSubBlock(0.36, 0.26, 36, 0.28, 0.02, 3, finalVisorColor, { screen: true }); // Glowing visor

      // 9. FEMALE GENDER ACCESSORY: Custom glowing ponytail projecting behind the helmet (z = 26 to 38)
      if (isFemale) {
        // Ponytail block projecting behind the helmet:
        // Positioned at: uStart = 0.46, vStart = 0.52, zStart = 26, uSize = 0.08, vSize = 0.08, zSize = 12
        // We draw it using hairColor
        drawVolumetricSubBlock(0.46, 0.52, 26, 0.08, 0.08, 12, hairColor, { neon: true });
        // Draw hair band
        drawVolumetricSubBlock(0.44, 0.50, 36, 0.12, 0.04, 2, 0x0f172a);
      }
      
      drawnCustomModel = true;
    }
    else if (key.startsWith('guard_drone')) {
      // 1. Layered armored body plates (suspended at z=12)
      // Bottom slate-gray chassis plate
      drawVolumetricSubBlock(0.33, 0.33, 10, 0.34, 0.34, 4, 0x1e293b, { panel: true });
      // Hovering gold power core sphere
      drawVolumetricSubBlock(0.33, 0.33, 14, 0.34, 0.34, 6, 0xeab308, { neon: true });
      
      // 2. Front-mounted Sensor Gimbal & Twin Cyan Lenses
      // Gimbal ball
      drawVolumetricSubBlock(0.42, 0.26, 8, 0.16, 0.08, 4, 0x0f172a);
      // Twin glowing optics visors
      drawVolumetricSubBlock(0.44, 0.24, 9, 0.12, 0.02, 2, neonColor, { screen: true });
      
      // 3. Side-Mounted Weapon Rails Flanking bottom wings
      // Left laser rails
      drawVolumetricSubBlock(0.22, 0.44, 6, 0.06, 0.2, 3, 0x334155);
      drawVolumetricSubBlock(0.22, 0.40, 6.5, 0.06, 0.04, 1.5, 0x06b6d4, { screen: true }); // Laser tip
      // Right laser rails
      drawVolumetricSubBlock(0.72, 0.44, 6, 0.06, 0.2, 3, 0x334155);
      drawVolumetricSubBlock(0.72, 0.40, 6.5, 0.06, 0.04, 1.5, 0x06b6d4, { screen: true }); // Laser tip

      // 4. Under-Chassis Thruster Nozzle & Flame Flare
      drawVolumetricSubBlock(0.42, 0.42, 6, 0.16, 0.16, 4, 0x475569);
      // Glowing thruster plume vector block
      drawVolumetricSubBlock(0.45, 0.45, 1, 0.10, 0.10, 5, 0xf97316, { neon: true });

      // 5. Horizontal rotor arms
      drawVolumetricSubBlock(0.08, 0.08, 16, 0.84, 0.06, 2, 0x475569);
      drawVolumetricSubBlock(0.08, 0.86, 16, 0.84, 0.06, 2, 0x475569);
      
      // 6. 4 glowing rotor blades discs on corners
      drawVolumetricSubBlock(0.04, 0.04, 18, 0.16, 0.16, 1, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.8, 0.04, 18, 0.16, 0.16, 1, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.04, 0.8, 18, 0.16, 0.16, 1, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.8, 0.8, 18, 0.16, 0.16, 1, 0x06b6d4, { screen: true });

      // 7. Side stabilizer wings
      drawVolumetricSubBlock(0.28, 0.4, 10, 0.05, 0.2, 12, 0x475569);
      drawVolumetricSubBlock(0.67, 0.4, 10, 0.05, 0.2, 12, 0x475569);

      drawnCustomModel = true;
    }
    else if (key.startsWith('guard_dog')) {
      // 1. Mechanical lower chassis base
      drawVolumetricSubBlock(0.28, 0.15, 0, 0.44, 0.7, 10, 0x78350f, { wood: true });
      
      // 2. Beveled armored spine plating
      drawVolumetricSubBlock(0.30, 0.25, 9, 0.40, 0.5, 3, 0x475569, { panel: true });
      // Flashing back energy power cell
      drawVolumetricSubBlock(0.44, 0.40, 12, 0.12, 0.2, 2, 0xeab308, { neon: true });
      
      // 3. Glowing shoulder heat vents
      drawVolumetricSubBlock(0.22, 0.3, 8, 0.06, 0.08, 2, 0xef4444, { neon: true });
      drawVolumetricSubBlock(0.72, 0.3, 8, 0.06, 0.08, 2, 0xef4444, { neon: true });

      // 4. Cybernetic armored neck collar
      drawVolumetricSubBlock(0.3, 0.2, 10, 0.4, 0.4, 4, 0xf97316, { neon: true });
      
      // 5. Cyber dog head with glowing neon visor
      drawVolumetricSubBlock(0.33, 0.1, 14, 0.34, 0.34, 8, 0x9a3412);
      drawVolumetricSubBlock(0.37, 0.08, 17, 0.26, 0.04, 3, 0xef4444, { screen: true });
      
      // 6. Front and rear steel limbs with pivot joint caps
      drawVolumetricSubBlock(0.24, 0.2, 0, 0.08, 0.12, 10, 0x475569);
      drawVolumetricSubBlock(0.24, 0.2, 6, 0.10, 0.14, 2, 0x9ca3af, { panel: true }); // Left Front Joint
      
      drawVolumetricSubBlock(0.68, 0.2, 0, 0.08, 0.12, 10, 0x475569);
      drawVolumetricSubBlock(0.68, 0.2, 6, 0.10, 0.14, 2, 0x9ca3af, { panel: true }); // Right Front Joint
      
      drawVolumetricSubBlock(0.24, 0.68, 0, 0.08, 0.12, 10, 0x475569);
      drawVolumetricSubBlock(0.24, 0.68, 6, 0.10, 0.14, 2, 0x9ca3af, { panel: true }); // Left Rear Joint
      
      drawVolumetricSubBlock(0.68, 0.68, 0, 0.08, 0.12, 10, 0x475569);
      drawVolumetricSubBlock(0.68, 0.68, 6, 0.10, 0.14, 2, 0x9ca3af, { panel: true }); // Right Rear Joint

      drawnCustomModel = true;
    }
    else if (key.startsWith('guard_decoy')) {
      // Translucent glassmorphic supporting frame base
      drawVolumetricSubBlock(0.2, 0.2, 0, 0.6, 0.6, 24, 0x7e22ce, { alpha: 0.5 });
      // High-power emitter node on top
      drawVolumetricSubBlock(0.3, 0.3, 24, 0.4, 0.4, 4, 0xa855f7, { neon: true });
      // Glowing purple decoy power capacitor core
      drawVolumetricSubBlock(0.35, 0.35, 6, 0.3, 0.3, 12, 0xd946ef, { screen: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('boss_ironjaw')) {
      // Heavy armored scavenger chassis base
      drawVolumetricSubBlock(0.1, 0.1, 0, 0.8, 0.8, 20, 0xef4444, { panel: true });
      
      // 2. Heavy slate-gray ground stabilizer hydraulic cylinders (back)
      drawVolumetricSubBlock(0.18, 0.70, 0, 0.12, 0.12, 22, 0x475569);
      drawVolumetricSubBlock(0.70, 0.70, 0, 0.12, 0.12, 22, 0x475569);
      
      // 3. Massive protruding gray iron jaw plate
      drawVolumetricSubBlock(0.15, 0.05, 4, 0.7, 0.15, 12, 0x64748b);
      
      // 4. Spiked shoulder pads with yellow-black hazard trims
      drawVolumetricSubBlock(0.04, 0.3, 16, 0.1, 0.4, 28, 0x334155);
      drawVolumetricSubBlock(0.04, 0.3, 44, 0.1, 0.4, 2, 0xeab308); // Yellow hazard strip
      
      drawVolumetricSubBlock(0.86, 0.3, 16, 0.1, 0.4, 28, 0x334155);
      drawVolumetricSubBlock(0.86, 0.3, 44, 0.1, 0.4, 2, 0xeab308); // Yellow hazard strip
      
      // 5. Glowing warning core on top
      drawVolumetricSubBlock(0.35, 0.35, 20, 0.3, 0.3, 14, 0xeab308, { neon: true });
      
      // 6. Crimson glowing visual optics band (eye visor)
      drawVolumetricSubBlock(0.3, 0.08, 24, 0.4, 0.04, 4, 0xef4444, { screen: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('boss_whisper')) {
      // Midnight-black carbon composite core
      drawVolumetricSubBlock(0.2, 0.2, 0, 0.6, 0.6, 24, 0x0f172a, { panel: true });
      
      // 2. Active dense fiber-optic glowing circuitry channels
      drawVolumetricSubBlock(0.38, 0.22, 4, 0.04, 0.02, 16, 0x22c55e, { neon: true });
      drawVolumetricSubBlock(0.58, 0.22, 4, 0.04, 0.02, 16, 0x22c55e, { neon: true });
      
      // 3. Flanking neon-green active-camo panels
      drawVolumetricSubBlock(0.12, 0.25, 4, 0.08, 0.5, 18, 0x22c55e, { neon: true });
      drawVolumetricSubBlock(0.8, 0.25, 4, 0.08, 0.5, 18, 0x22c55e, { neon: true });
      
      // 4. Twin high-frequency sensor scanner antennas
      drawVolumetricSubBlock(0.48, 0.48, 24, 0.04, 0.04, 20, 0x22c55e);
      
      // 5. Flashing passive sensor pod grids on the back
      drawVolumetricSubBlock(0.35, 0.74, 8, 0.08, 0.04, 8, 0x15803d, { neon: true });
      drawVolumetricSubBlock(0.57, 0.74, 8, 0.08, 0.04, 8, 0x15803d, { neon: true });
      
      // 6. Glowing green data visor screen
      drawVolumetricSubBlock(0.25, 0.18, 16, 0.5, 0.04, 5, 0x22c55e, { screen: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('boss_volkov')) {
      // Armored navy blue tread base casing
      drawVolumetricSubBlock(0.08, 0.08, 0, 0.84, 0.84, 16, 0x1e3a8a, { panel: true });
      
      // 2. Heavy steel tread track links
      drawVolumetricSubBlock(0.05, 0.12, 4, 0.03, 0.76, 2, 0x0f172a);
      drawVolumetricSubBlock(0.05, 0.12, 10, 0.03, 0.76, 2, 0x0f172a);
      drawVolumetricSubBlock(0.92, 0.12, 4, 0.03, 0.76, 2, 0x0f172a);
      drawVolumetricSubBlock(0.92, 0.12, 10, 0.03, 0.76, 2, 0x0f172a);
      
      // 3. Heavy mechanical steel torso
      drawVolumetricSubBlock(0.2, 0.2, 16, 0.6, 0.6, 22, 0x3b82f6);
      
      // 4. Dual shoulder-mounted heavy railgun barrels
      drawVolumetricSubBlock(0.08, 0.06, 28, 0.16, 0.5, 8, 0x1e293b);
      drawVolumetricSubBlock(0.76, 0.06, 28, 0.16, 0.5, 8, 0x1e293b);
      
      // 5. High-density ammunition feed belts running into railguns
      drawVolumetricSubBlock(0.18, 0.50, 18, 0.08, 0.2, 10, 0x475569);
      drawVolumetricSubBlock(0.74, 0.50, 18, 0.08, 0.2, 10, 0x475569);
      
      // 6. Glowing orange command visor
      drawVolumetricSubBlock(0.35, 0.18, 24, 0.3, 0.04, 4, 0xf97316, { screen: true });
      
      // 7. Golden central insignia crest on chest
      drawVolumetricSubBlock(0.4, 0.19, 18, 0.2, 0.02, 6, 0xeab308, { neon: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('boss_circuit')) {
      // 1. Sleek metallic safety mounting base plate with yellow hazard corners
      drawVolumetricSubBlock(0.08, 0.08, 0, 0.84, 0.84, 3, 0x334155, { panel: true });
      drawVolumetricSubBlock(0.08, 0.08, 3, 0.14, 0.14, 1, 0xeab308); // Hazard corner NW
      drawVolumetricSubBlock(0.78, 0.08, 3, 0.14, 0.14, 1, 0xeab308); // Hazard corner NE
      drawVolumetricSubBlock(0.08, 0.78, 3, 0.14, 0.14, 1, 0xeab308); // Hazard corner SW
      drawVolumetricSubBlock(0.78, 0.78, 3, 0.14, 0.14, 1, 0xeab308); // Hazard corner SE

      // 2. Multi-tiered detailed modular server cabinet racks
      drawVolumetricSubBlock(0.15, 0.15, 3, 0.7, 0.7, 9, 0xca8a04, { panel: true });
      drawVolumetricSubBlock(0.25, 0.25, 12, 0.5, 0.5, 16, 0xeab308, { panel: true });
      drawVolumetricSubBlock(0.35, 0.35, 28, 0.3, 0.3, 14, 0xfef08a);
      
      // 3. Horizontal server drawer divisions (black seams)
      drawVolumetricSubBlock(0.24, 0.24, 8, 0.52, 0.52, 1, 0x1e293b);
      drawVolumetricSubBlock(0.24, 0.24, 14, 0.52, 0.52, 1, 0x1e293b);
      drawVolumetricSubBlock(0.24, 0.24, 20, 0.52, 0.52, 1, 0x1e293b);
      drawVolumetricSubBlock(0.24, 0.24, 26, 0.52, 0.52, 1, 0x1e293b);

      // 4. Exposed glowing copper power busbars
      drawVolumetricSubBlock(0.21, 0.25, 3, 0.04, 0.5, 25, 0xb45309, { neon: true });
      drawVolumetricSubBlock(0.75, 0.25, 3, 0.04, 0.5, 25, 0xb45309, { neon: true });
      
      // 5. Active blinking green and cyan LED computational clusters
      drawVolumetricSubBlock(0.32, 0.24, 6, 0.08, 0.01, 2, 0x22c55e, { screen: true });
      drawVolumetricSubBlock(0.44, 0.24, 6, 0.08, 0.01, 2, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.56, 0.24, 6, 0.08, 0.01, 2, 0x22c55e, { screen: true });
      
      drawVolumetricSubBlock(0.32, 0.24, 16, 0.08, 0.01, 2, 0x06b6d4, { screen: true });
      drawVolumetricSubBlock(0.44, 0.24, 16, 0.08, 0.01, 2, 0x22c55e, { screen: true });
      drawVolumetricSubBlock(0.56, 0.24, 16, 0.08, 0.01, 2, 0x06b6d4, { screen: true });
      
      // 6. Side ventilation grates
      drawVolumetricSubBlock(0.24, 0.35, 6, 0.01, 0.3, 6, 0x0f172a);
      drawVolumetricSubBlock(0.24, 0.35, 18, 0.01, 0.3, 6, 0x0f172a);

      // 7. Glowing copper condenser rings on top
      drawVolumetricSubBlock(0.28, 0.28, 42, 0.44, 0.44, 3, 0xca8a04, { neon: true });
      
      // 8. Matrix-grid data visor screen
      drawVolumetricSubBlock(0.3, 0.32, 20, 0.4, 0.04, 6, 0xeab308, { screen: true });

      drawnCustomModel = true;
    }
    else if (key.startsWith('boss_warden')) {
      // 1. Heavy purple armored containment treads base
      drawVolumetricSubBlock(0.06, 0.06, 0, 0.88, 0.88, 18, 0x3b0764, { panel: true });
      
      // 2. Heavy-duty composite mechanical torso
      drawVolumetricSubBlock(0.18, 0.18, 18, 0.64, 0.64, 24, 0x581c87);
      
      // 3. Vault containment cage vertical steel bars
      drawVolumetricSubBlock(0.24, 0.17, 20, 0.04, 0.02, 20, 0x1e293b);
      drawVolumetricSubBlock(0.38, 0.17, 20, 0.04, 0.02, 20, 0x1e293b);
      drawVolumetricSubBlock(0.58, 0.17, 20, 0.04, 0.02, 20, 0x1e293b);
      drawVolumetricSubBlock(0.72, 0.17, 20, 0.04, 0.02, 20, 0x1e293b);
      
      // 4. Heavy hydraulic torso stabilizer cylinders
      drawVolumetricSubBlock(0.12, 0.45, 4, 0.06, 0.10, 18, 0x475569);
      drawVolumetricSubBlock(0.82, 0.45, 4, 0.06, 0.10, 18, 0x475569);
      
      // 5. Dual flanking vertical heavy shield plates
      drawVolumetricSubBlock(0.04, 0.2, 22, 0.12, 0.6, 18, 0x7e22ce);
      drawVolumetricSubBlock(0.84, 0.2, 22, 0.12, 0.6, 18, 0x7e22ce);
      
      // 6. Red searchlight beacon dome on top
      drawVolumetricSubBlock(0.35, 0.35, 42, 0.3, 0.3, 10, 0xef4444, { neon: true });
      
      // 7. Monolithic horizontal visor slot
      drawVolumetricSubBlock(0.3, 0.16, 30, 0.4, 0.04, 4, 0xef4444, { screen: true });

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

  /**
   * Public static helper that dynamically regenerates the human raider voxel textures
   * at runtime, allowing immediate visual updates without resetting scenes.
   */
  public static regenerateRaiderTextures(scene: Phaser.Scene, cosmetics: any): void {
    const bootScene = scene.scene.get("BootScene") as BootScene;
    if (!bootScene) return;

    // Update active raider cosmetics on window so the generator picks it up
    if (typeof window !== "undefined") {
      (window as any).activeRaiderCosmetics = cosmetics;
    }

    const keys = ["entity_drone"];
    for (let dir = 0; dir < 4; dir++) {
      keys.push(`entity_drone_dir_${dir}`);
    }
    for (let slot = 1; slot <= 4; slot++) {
      const slotKey = `entity_drone_slot_${slot}`;
      keys.push(slotKey);
      for (let dir = 0; dir < 4; dir++) {
        keys.push(`${slotKey}_dir_${dir}`);
      }
    }

    for (const key of keys) {
      if (scene.textures.exists(key)) {
        scene.textures.remove(key);
      }
    }

    const entry = ENTITIES.find(e => e[0] === 'entity_drone');
    const w = entry ? entry[1] : 1;
    const h = entry ? entry[2] : 1;
    const heightPx = entry ? entry[3] : 40;
    const baseColor = entry ? entry[4] : 0xf1c40f;

    bootScene.generateIsoBlock("entity_drone", w, h, heightPx, baseColor, 0);
    for (let dir = 0; dir < 4; dir++) {
      bootScene.generateIsoBlock(`entity_drone_dir_${dir}`, w, h, heightPx, baseColor, dir);
    }
    for (let slot = 1; slot <= 4; slot++) {
      const slotKey = `entity_drone_slot_${slot}`;
      bootScene.generateIsoBlock(slotKey, w, h, heightPx, baseColor, 0);
      for (let dir = 0; dir < 4; dir++) {
        bootScene.generateIsoBlock(`${slotKey}_dir_${dir}`, w, h, heightPx, baseColor, dir);
      }
    }

    scene.events.emit("raider-textures-regenerated");
  }
}
