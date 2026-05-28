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
];

const TURRETS: readonly SpriteDescriptor[] = [
  ['turret_nailgun',    1, 1, 40, 0x34495e],
  ['turret_taser',      1, 1, 40, 0x9b59b6],
  ['turret_tesla',      1, 1, 56, 0x9b59b6],
  ['turret_autocannon', 2, 2, 64, 0x2c3e50],
  ['turret_shotgun',    1, 1, 44, 0xd35400],
  ['turret_autocannon_mk2', 2, 2, 64, 0x3b82f6],
];

const BARRICADES: readonly SpriteDescriptor[] = [
  ['barricade_bookshelf',     2, 1, 56, 0x5c4033],
  ['barricade_flipped_table', 2, 1, 24, 0xa0522d],
  ['barricade_sandbags',      1, 1, 20, 0xbdc3c7],
];

const ENTITIES: readonly SpriteDescriptor[] = [
  ['entity_drone', 1, 1, 40, 0xf1c40f],
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
        this.generateIsoBlock(key, w, h, heightPx, color);
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
    color: number
  ): void {
    const graphics = this.make.graphics();
    const TILE_W = 64;
    const TILE_H = 32;

    const shiftX = depthTiles * (TILE_W / 2);

    const ptTop = { x: shiftX, y: 0 };
    const ptRight = {
      x: shiftX + widthTiles * (TILE_W / 2),
      y: widthTiles * (TILE_H / 2)
    };
    const ptBottom = {
      x: shiftX + (widthTiles - depthTiles) * (TILE_W / 2),
      y: (widthTiles + depthTiles) * (TILE_H / 2)
    };
    const ptLeft = {
      x: shiftX - depthTiles * (TILE_W / 2),
      y: depthTiles * (TILE_H / 2)
    };

    const centerX = (ptTop.x + ptBottom.x) / 2;
    const centerY = (ptTop.y + ptBottom.y) / 2;

    const darken = (c: number, f: number) => {
      const r = Math.floor(((c >> 16) & 0xff) * f);
      const g = Math.floor(((c >> 8) & 0xff) * f);
      const b = Math.floor((c & 0xff) * f);
      return (r << 16) | (g << 8) | b;
    };

    // Calculate vibrant neon glow color
    const getNeonGlowColor = (baseColor: number) => {
      const r = (baseColor >> 16) & 0xff;
      const g = (baseColor >> 8) & 0xff;
      const b = baseColor & 0xff;
      const maxVal = Math.max(r, g, b);
      if (maxVal === 0) return 0x00ffff; // default cyan
      const factor = 255 / maxVal;
      // Boost brightness to make it stand out as a neon glow source
      const nr = Math.min(255, Math.floor(r * factor * 1.3));
      const ng = Math.min(255, Math.floor(g * factor * 1.3));
      const nb = Math.min(255, Math.floor(b * factor * 1.3));
      return (nr << 16) | (ng << 8) | nb;
    };

    const neonColor = getNeonGlowColor(color);
    
    // Core Cyberpunk styling based on block type key prefix
    const isFurniture = key.startsWith('furniture');
    const isTrap = key.startsWith('trap');
    const isTurret = key.startsWith('turret');
    const isBarricade = key.startsWith('barricade');
    const isEntity = key.startsWith('entity') || key === 'loot_stash';

    // Base colors
    const colorTop = color;
    const colorRight = darken(color, 0.8);
    const colorLeft = darken(color, 0.6);

    // 1. TOP FACE FILL
    graphics.fillStyle(colorTop, 1);
    graphics.beginPath();
    graphics.moveTo(ptTop.x, ptTop.y);
    graphics.lineTo(ptRight.x, ptRight.y);
    graphics.lineTo(ptBottom.x, ptBottom.y);
    graphics.lineTo(ptLeft.x, ptLeft.y);
    graphics.closePath();
    graphics.fillPath();

    // Draw dark structural outlines for the face
    graphics.lineStyle(1.5, darken(color, 0.35), 0.7);
    graphics.strokePath();

    // 2. TECH GRAPHICS / DETAILED TEXTURES ON TOP FACE
    if (isFurniture) {
      if (key === 'furniture_bed_twin') {
        // Draw wood frame border
        graphics.lineStyle(2, 0x3d2b1f, 1);
        graphics.beginPath();
        graphics.moveTo(ptTop.x, ptTop.y);
        graphics.lineTo(ptRight.x, ptRight.y);
        graphics.lineTo(ptBottom.x, ptBottom.y);
        graphics.lineTo(ptLeft.x, ptLeft.y);
        graphics.closePath();
        graphics.strokePath();

        // Draw mattress (inset off-white polygon)
        graphics.fillStyle(0xdddddd, 1);
        graphics.beginPath();
        graphics.moveTo(ptTop.x * 0.9 + ptBottom.x * 0.1, ptTop.y * 0.9 + ptBottom.y * 0.1);
        graphics.lineTo(ptRight.x * 0.9 + ptLeft.x * 0.1, ptRight.y * 0.9 + ptLeft.y * 0.1);
        graphics.lineTo(ptBottom.x * 0.95 + ptTop.x * 0.05, ptBottom.y * 0.95 + ptTop.y * 0.05);
        graphics.lineTo(ptLeft.x * 0.9 + ptRight.x * 0.1, ptLeft.y * 0.9 + ptRight.y * 0.1);
        graphics.closePath();
        graphics.fillPath();

        // Draw pillow
        graphics.fillStyle(0x06b6d4, 1);
        graphics.beginPath();
        graphics.moveTo(ptTop.x * 0.75 + ptBottom.x * 0.25, ptTop.y * 0.75 + ptBottom.y * 0.25);
        graphics.lineTo(ptRight.x * 0.75 + ptLeft.x * 0.25, ptRight.y * 0.75 + ptLeft.y * 0.25);
        graphics.lineTo(ptRight.x * 0.5 + ptLeft.x * 0.5, ptRight.y * 0.5 + ptLeft.y * 0.5);
        graphics.lineTo(ptTop.x * 0.5 + ptBottom.x * 0.5, ptTop.y * 0.5 + ptBottom.y * 0.5);
        graphics.closePath();
        graphics.fillPath();

        // Draw blanket cover (cyan)
        graphics.fillStyle(0x0891b2, 0.85);
        graphics.beginPath();
        graphics.moveTo(ptTop.x * 0.4 + ptBottom.x * 0.6, ptTop.y * 0.4 + ptBottom.y * 0.6);
        graphics.lineTo(ptRight.x * 0.4 + ptLeft.x * 0.6, ptRight.y * 0.4 + ptLeft.y * 0.6);
        graphics.lineTo(ptBottom.x * 0.95, ptBottom.y * 0.95);
        graphics.lineTo(ptLeft.x * 0.9 + ptRight.x * 0.1, ptLeft.y * 0.9 + ptRight.y * 0.1);
        graphics.closePath();
        graphics.fillPath();
      } 
      else if (key === 'furniture_desk_wooden' || key === 'furniture_table_folding') {
        // Draw wood planks
        graphics.lineStyle(1, 0x4a3b32, 0.8);
        for (let f = 0.25; f <= 0.75; f += 0.25) {
          graphics.beginPath();
          graphics.moveTo(ptTop.x + (ptLeft.x - ptTop.x) * f, ptTop.y + (ptLeft.y - ptTop.y) * f);
          graphics.lineTo(ptRight.x + (ptBottom.x - ptRight.x) * f, ptRight.y + (ptBottom.y - ptRight.y) * f);
          graphics.strokePath();
        }
        
        if (key === 'furniture_desk_wooden') {
          // Draw a glowing keyboard/laptop in the center
          graphics.fillStyle(0x00ffff, 0.9);
          graphics.fillRect(centerX - 8, centerY - 4, 16, 8);
          graphics.lineStyle(1.5, 0xffffff, 0.9);
          graphics.strokeRect(centerX - 8, centerY - 4, 16, 8);
        }
      }
      else if (key === 'furniture_chair_office') {
        // Draw steel pole and star base
        graphics.lineStyle(2, 0xbababa, 1);
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.lineTo(centerX, centerY + 12);
        graphics.strokePath();

        // Draw star spokes
        graphics.lineStyle(1.5, 0x333333, 1);
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5;
          graphics.beginPath();
          graphics.moveTo(centerX, centerY + 12);
          graphics.lineTo(centerX + Math.cos(angle) * 8, centerY + 12 + Math.sin(angle) * 4);
          graphics.strokePath();
        }

        // Draw seat back cushion
        graphics.fillStyle(0x374151, 1);
        graphics.beginPath();
        graphics.arc(centerX, centerY - 6, 8, 0, Math.PI * 2);
        graphics.fillPath();

        // Draw backrest
        graphics.fillStyle(0x1f2937, 1);
        graphics.fillRect(centerX - 4, centerY - 18, 8, 12);
      }
      else if (key === 'furniture_dresser_wooden') {
        // Dresser dividers and details
        graphics.lineStyle(2, 0x3d2b1f, 1);
        graphics.beginPath();
        graphics.moveTo(ptTop.x, ptTop.y);
        graphics.lineTo(ptRight.x, ptRight.y);
        graphics.lineTo(ptBottom.x, ptBottom.y);
        graphics.lineTo(ptLeft.x, ptLeft.y);
        graphics.closePath();
        graphics.strokePath();
      }
      else if (key === 'furniture_tv_flatscreen') {
        // Draw flat TV display bezel
        graphics.fillStyle(0x111827, 1);
        graphics.fillRect(centerX - 24, centerY - 16, 48, 24);
        
        // Glowing screen showing static matrix lines
        graphics.fillStyle(0x8b5cf6, 0.8);
        graphics.fillRect(centerX - 22, centerY - 14, 44, 20);
        graphics.lineStyle(1.5, 0xa78bfa, 0.95);
        graphics.strokeRect(centerX - 22, centerY - 14, 44, 20);

        graphics.lineStyle(1, 0xd8b4fe, 0.4);
        graphics.beginPath();
        graphics.moveTo(centerX - 22, centerY - 4);
        graphics.lineTo(centerX + 22, centerY - 4);
        graphics.moveTo(centerX - 10, centerY - 14);
        graphics.lineTo(centerX - 10, centerY + 6);
        graphics.strokePath();
      }
      else if (key === 'furniture_rug_area') {
        // Glowing neon concentric rug outline diamonds
        for (let i = 0.2; i <= 0.8; i += 0.2) {
          graphics.lineStyle(1.5, neonColor, 0.8 - i * 0.5);
          graphics.beginPath();
          graphics.moveTo(ptTop.x * (1-i) + ptBottom.x * i, ptTop.y * (1-i) + ptBottom.y * i);
          graphics.lineTo(ptRight.x * (1-i) + ptLeft.x * i, ptRight.y * (1-i) + ptLeft.y * i);
          graphics.lineTo(ptBottom.x * (1-i) + ptTop.x * i, ptBottom.y * (1-i) + ptTop.y * i);
          graphics.lineTo(ptLeft.x * (1-i) + ptRight.x * i, ptLeft.y * (1-i) + ptRight.y * i);
          graphics.closePath();
          graphics.strokePath();
        }
      }
      else if (key === 'furniture_lamp_floor') {
        // Draw soft lighting circle
        graphics.fillStyle(0xfef08a, 0.35);
        graphics.beginPath();
        graphics.arc(centerX, centerY, 24, 0, Math.PI * 2);
        graphics.fillPath();

        // Draw central stand and glowing base
        graphics.fillStyle(0xfac20a, 0.9);
        graphics.beginPath();
        graphics.arc(centerX, centerY, 5, 0, Math.PI * 2);
        graphics.fillPath();
      }
      else if (key === 'furniture_plant_potted') {
        // Draw terra-cotta pot
        graphics.fillStyle(0xb45309, 1);
        graphics.beginPath();
        graphics.arc(centerX, centerY, 6, 0, Math.PI * 2);
        graphics.fillPath();

        // Overlapping rich green leaves
        graphics.fillStyle(0x15803d, 0.9);
        graphics.beginPath();
        graphics.arc(centerX - 4, centerY - 2, 5, 0, Math.PI * 2);
        graphics.arc(centerX + 4, centerY - 3, 4, 0, Math.PI * 2);
        graphics.arc(centerX, centerY - 6, 6, 0, Math.PI * 2);
        graphics.fillPath();

        graphics.fillStyle(0x22c55e, 1);
        graphics.beginPath();
        graphics.arc(centerX - 1, centerY - 3, 3, 0, Math.PI * 2);
        graphics.fillPath();
      }
      else {
        // Draw standard sleek grid divisions for base furniture
        graphics.lineStyle(1, darken(color, 0.5), 0.25);
        for (let f = 0.33; f <= 0.67; f += 0.33) {
          graphics.beginPath();
          graphics.moveTo(ptTop.x + (ptLeft.x - ptTop.x) * f, ptTop.y + (ptLeft.y - ptTop.y) * f);
          graphics.lineTo(ptRight.x + (ptBottom.x - ptRight.x) * f, ptRight.y + (ptBottom.y - ptRight.y) * f);
          graphics.strokePath();

          graphics.beginPath();
          graphics.moveTo(ptTop.x + (ptRight.x - ptTop.x) * f, ptTop.y + (ptRight.y - ptTop.y) * f);
          graphics.lineTo(ptLeft.x + (ptBottom.x - ptLeft.x) * f, ptLeft.y + (ptBottom.y - ptLeft.y) * f);
          graphics.strokePath();
        }
      }
    } else if (isTrap) {
      if (key === 'trap_pressure_plate') {
        // concentric orange circles
        graphics.lineStyle(2, 0xf97316, 0.95);
        graphics.beginPath();
        graphics.arc(centerX, centerY, 8, 0, Math.PI * 2);
        graphics.strokePath();
        graphics.fillStyle(0xf97316, 0.5);
        graphics.beginPath();
        graphics.arc(centerX, centerY, 4, 0, Math.PI * 2);
        graphics.fillPath();
      } 
      else if (key === 'trap_spike_strip') {
        // sharp steel spikes
        graphics.fillStyle(0x9ca3af, 1);
        graphics.lineStyle(1, 0x4b5563, 1);
        for (let sx = -16; sx <= 16; sx += 8) {
          for (let sy = -8; sy <= 8; sy += 4) {
            graphics.beginPath();
            graphics.moveTo(centerX + sx, centerY + sy);
            graphics.lineTo(centerX + sx + 4, centerY + sy - 10);
            graphics.lineTo(centerX + sx + 8, centerY + sy);
            graphics.closePath();
            graphics.fillPath();
            graphics.strokePath();
          }
        }
      }
      else if (key === 'trap_shock_pad') {
        // electrical shock wire spirals
        graphics.lineStyle(1.5, 0x06b6d4, 1);
        graphics.beginPath();
        graphics.arc(centerX, centerY, 12, 0, Math.PI * 2);
        graphics.strokePath();

        graphics.lineStyle(1, 0xffffff, 0.9);
        graphics.beginPath();
        graphics.moveTo(centerX - 8, centerY - 8);
        graphics.lineTo(centerX + 8, centerY + 8);
        graphics.moveTo(centerX + 8, centerY - 8);
        graphics.lineTo(centerX - 8, centerY + 8);
        graphics.strokePath();
      }
      else if (key === 'trap_glue') {
        // yellow gooey sludge puddle
        graphics.fillStyle(0xf59e0b, 0.7);
        graphics.fillEllipse(centerX, centerY, 36, 18);

        // draw bubble circles inside
        graphics.fillStyle(0xfef08a, 0.9);
        graphics.beginPath();
        graphics.arc(centerX - 4, centerY - 2, 2, 0, Math.PI * 2);
        graphics.arc(centerX + 6, centerY + 2, 3, 0, Math.PI * 2);
        graphics.fillPath();
      }
      else if (key === 'trap_tripwire_alarm') {
        // draw small posts on side edges
        graphics.fillStyle(0x374151, 1);
        graphics.fillRect(ptLeft.x + 2, ptLeft.y - 12, 4, 12);
        graphics.fillRect(ptRight.x - 6, ptRight.y - 12, 4, 12);

        // red glowing tripwire laser
        graphics.lineStyle(2.0, 0xef4444, 0.95);
        graphics.beginPath();
        graphics.moveTo(ptLeft.x + 4, ptLeft.y - 8);
        graphics.lineTo(ptRight.x - 4, ptRight.y - 8);
        graphics.strokePath();
      }
      else {
        // Traps get diagonal warning lines (hazard strip style!)
        graphics.lineStyle(2, neonColor, 0.4);
        for (let f = 0.2; f <= 0.8; f += 0.2) {
          graphics.beginPath();
          graphics.moveTo(ptLeft.x + (ptTop.x - ptLeft.x) * f, ptLeft.y + (ptTop.y - ptLeft.y) * f);
          graphics.lineTo(ptBottom.x + (ptRight.x - ptBottom.x) * f, ptBottom.y + (ptRight.y - ptBottom.y) * f);
          graphics.strokePath();
        }
        
        graphics.lineStyle(2, neonColor, 0.85);
        graphics.beginPath();
        graphics.moveTo(ptTop.x * 0.7 + ptBottom.x * 0.3, ptTop.y * 0.7 + ptBottom.y * 0.3);
        graphics.lineTo(ptRight.x * 0.7 + ptLeft.x * 0.3, ptRight.y * 0.7 + ptLeft.y * 0.3);
        graphics.lineTo(ptBottom.x * 0.7 + ptTop.x * 0.3, ptBottom.y * 0.7 + ptTop.y * 0.3);
        graphics.lineTo(ptLeft.x * 0.7 + ptRight.x * 0.3, ptLeft.y * 0.7 + ptRight.y * 0.3);
        graphics.closePath();
        graphics.strokePath();
      }
    } else if (isTurret) {
      // Swivel turret base
      graphics.fillStyle(0x374151, 1);
      graphics.fillEllipse(centerX, centerY, 24, 12);

      if (key === 'turret_nailgun') {
        // Draw dual barrels pointing forward
        graphics.lineStyle(3, 0x4b5563, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 3, centerY);
        graphics.lineTo(centerX - 3, centerY - 18);
        graphics.moveTo(centerX + 3, centerY);
        graphics.lineTo(centerX + 3, centerY - 18);
        graphics.strokePath();
      }
      else if (key === 'turret_taser') {
        // Taser spikes emitting blue arcs
        graphics.lineStyle(2, 0x06b6d4, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 4, centerY);
        graphics.lineTo(centerX - 6, centerY - 14);
        graphics.moveTo(centerX + 4, centerY);
        graphics.lineTo(centerX + 6, centerY - 14);
        graphics.strokePath();

        // blue arcs
        graphics.lineStyle(1.5, 0xffffff, 0.9);
        graphics.beginPath();
        graphics.moveTo(centerX - 6, centerY - 14);
        graphics.lineTo(centerX, centerY - 20);
        graphics.lineTo(centerX + 6, centerY - 14);
        graphics.strokePath();
      }
      else if (key === 'turret_tesla') {
        // tesla coil tower layers
        graphics.fillStyle(0x4b5563, 1);
        graphics.fillRect(centerX - 4, centerY - 20, 8, 20);

        graphics.fillStyle(0x9ca3af, 1);
        graphics.fillEllipse(centerX, centerY - 8, 20, 10);
        graphics.fillEllipse(centerX, centerY - 16, 16, 8);

        // Giant purple/pink sphere on top
        graphics.fillStyle(0xa855f7, 0.95);
        graphics.beginPath();
        graphics.arc(centerX, centerY - 24, 7, 0, Math.PI * 2);
        graphics.fillPath();
        graphics.lineStyle(1.5, 0xffffff, 0.9);
        graphics.strokePath();
      }
      else if (key === 'turret_autocannon') {
        // Massive double long barrels pointing out
        graphics.lineStyle(4, 0x1f2937, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 4, centerY);
        graphics.lineTo(centerX - 6, centerY - 26);
        graphics.moveTo(centerX + 4, centerY);
        graphics.lineTo(centerX + 6, centerY - 26);
        graphics.strokePath();
        
        // thick armor drum box
        graphics.fillStyle(0x111827, 1);
        graphics.fillRect(centerX - 8, centerY - 2, 16, 10);
      }
      else if (key === 'turret_shotgun') {
        // Squat wide box with 3 small shotgun barrels spreading in a fan
        graphics.lineStyle(2.5, 0x1f2937, 1);
        graphics.beginPath();
        graphics.moveTo(centerX, centerY);
        graphics.lineTo(centerX, centerY - 16);
        graphics.moveTo(centerX, centerY);
        graphics.lineTo(centerX - 8, centerY - 14);
        graphics.moveTo(centerX, centerY);
        graphics.lineTo(centerX + 8, centerY - 14);
        graphics.strokePath();
      }
      else {
        // standard glowing energy core
        graphics.fillStyle(neonColor, 0.9);
        graphics.lineStyle(1.5, 0xffffff, 0.85);
        graphics.beginPath();
        graphics.arc(centerX, centerY, 6, 0, Math.PI * 2);
        graphics.fillPath();
        graphics.strokePath();
      }
    } else if (isEntity) {
      if (key === 'entity_drone') {
        // Quadcopter drone rotors
        graphics.lineStyle(2, 0x9ca3af, 1);
        graphics.beginPath();
        graphics.moveTo(centerX - 10, centerY - 10);
        graphics.lineTo(centerX + 10, centerY + 10);
        graphics.moveTo(centerX + 10, centerY - 10);
        graphics.lineTo(centerX - 10, centerY + 10);
        graphics.strokePath();

        // 4 small rotor circles
        graphics.fillStyle(0x06b6d4, 0.8);
        graphics.beginPath();
        graphics.arc(centerX - 10, centerY - 10, 3, 0, Math.PI * 2);
        graphics.arc(centerX + 10, centerY - 10, 3, 0, Math.PI * 2);
        graphics.arc(centerX - 10, centerY + 10, 3, 0, Math.PI * 2);
        graphics.arc(centerX + 10, centerY + 10, 3, 0, Math.PI * 2);
        graphics.fillPath();
      }
      
      // Drone or Stash: Draw beautiful glowing inner cores
      graphics.fillStyle(0xffffff, 0.95);
      graphics.lineStyle(1.5, neonColor, 0.9);
      graphics.beginPath();
      graphics.arc(centerX, centerY, 5, 0, Math.PI * 2);
      graphics.fillPath();
      graphics.strokePath();
    }

    if (heightPixels > 0) {
      // 3. RIGHT FACE FILL & TECH BANDS
      graphics.fillStyle(colorRight, 1);
      graphics.beginPath();
      graphics.moveTo(ptRight.x, ptRight.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.lineTo(ptRight.x, ptRight.y + heightPixels);
      graphics.closePath();
      graphics.fillPath();

      graphics.lineStyle(1.5, darken(color, 0.45), 0.7);
      graphics.strokePath();

      // 4. LEFT FACE FILL & TECH BANDS
      graphics.fillStyle(colorLeft, 1);
      graphics.beginPath();
      graphics.moveTo(ptLeft.x, ptLeft.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.lineTo(ptLeft.x, ptLeft.y + heightPixels);
      graphics.closePath();
      graphics.fillPath();

      graphics.lineStyle(1.5, darken(color, 0.35), 0.7);
      graphics.strokePath();

      // Draw specialized side panel textures
      if (isBarricade) {
        if (key === 'barricade_bookshelf') {
          // Draw fallen bookshelf with vertical partitions
          graphics.lineStyle(2, 0x4a3b32, 1);
          graphics.beginPath();
          graphics.moveTo(ptLeft.x, ptLeft.y);
          graphics.lineTo(ptRight.x, ptRight.y);
          graphics.strokePath();

          // draw book colors inside right face
          graphics.fillStyle(0xef4444, 0.95); // red book
          graphics.fillRect(centerX - 12, centerY + 2, 4, 10);
          graphics.fillStyle(0x3b82f6, 0.95); // blue book
          graphics.fillRect(centerX - 6, centerY + 2, 4, 10);
          graphics.fillStyle(0x10b981, 0.95); // green book
          graphics.fillRect(centerX, centerY + 2, 4, 10);
        }
        else if (key === 'barricade_flipped_table') {
          // Draw table face standing vertically, legs sticking out
          graphics.lineStyle(3, 0x78350f, 1);
          graphics.beginPath();
          graphics.moveTo(centerX, centerY);
          graphics.lineTo(centerX - 10, centerY - 14);
          graphics.moveTo(centerX, centerY);
          graphics.lineTo(centerX + 10, centerY - 14);
          graphics.strokePath();
        }
        else if (key === 'barricade_sandbags') {
          // overlapping rounded sandbags
          graphics.fillStyle(0xd1d5db, 1);
          graphics.lineStyle(1.5, 0x6b7280, 1);
          
          // Row 1 sandbags (bottom)
          graphics.fillEllipse(centerX - 10, centerY + heightPixels - 6, 24, 12);
          graphics.strokeEllipse(centerX - 10, centerY + heightPixels - 6, 24, 12);
          graphics.fillEllipse(centerX + 10, centerY + heightPixels - 6, 24, 12);
          graphics.strokeEllipse(centerX + 10, centerY + heightPixels - 6, 24, 12);

          // Row 2 sandbags (top)
          graphics.fillStyle(0x9ca3af, 1);
          graphics.fillEllipse(centerX, centerY + 6, 28, 14);
          graphics.strokeEllipse(centerX, centerY + 6, 28, 14);
        }
        else {
          // Heavy horizontal slats
          graphics.lineStyle(2, darken(color, 0.25), 0.7);
          for (let offset = 0.2; offset <= 0.8; offset += 0.2) {
            const hOffset = Math.floor(heightPixels * offset);
            graphics.beginPath();
            graphics.moveTo(ptRight.x, ptRight.y + hOffset);
            graphics.lineTo(ptBottom.x, ptBottom.y + hOffset);
            graphics.strokePath();

            graphics.beginPath();
            graphics.moveTo(ptLeft.x, ptLeft.y + hOffset);
            graphics.lineTo(ptBottom.x, ptBottom.y + hOffset);
            graphics.strokePath();
          }
        }
      } else if (isTurret) {
        // Turrets get glowing heat-vent vertical lines
        graphics.lineStyle(1.5, neonColor, 0.4);
        for (let f = 0.25; f <= 0.75; f += 0.25) {
          const rx = ptRight.x + (ptBottom.x - ptRight.x) * f;
          const ry = ptRight.y + (ptBottom.y - ptRight.y) * f;
          graphics.beginPath();
          graphics.moveTo(rx, ry + 4);
          graphics.lineTo(rx, ry + heightPixels - 4);
          graphics.strokePath();

          const lx = ptLeft.x + (ptBottom.x - ptLeft.x) * f;
          const ly = ptLeft.y + (ptBottom.y - ptLeft.y) * f;
          graphics.beginPath();
          graphics.moveTo(lx, ly + 4);
          graphics.lineTo(lx, ly + heightPixels - 4);
          graphics.strokePath();
        }
      } else if (isFurniture) {
        if (key === 'furniture_dresser_wooden') {
          // Drawer horizontal panel lines on dresser sides
          graphics.lineStyle(2.0, 0x3d2b1f, 1);
          for (let offset = 0.33; offset <= 0.67; offset += 0.33) {
            const hOffset = Math.floor(heightPixels * offset);
            graphics.beginPath();
            graphics.moveTo(ptLeft.x, ptLeft.y + hOffset);
            graphics.lineTo(ptBottom.x, ptBottom.y + hOffset);
            graphics.strokePath();

            // draw tiny handle dots (gold/cyan)
            graphics.fillStyle(0xfac20a, 1);
            const midX = (ptLeft.x + ptBottom.x) / 2;
            const midY = (ptLeft.y + ptBottom.y) / 2 + hOffset - 4;
            graphics.beginPath();
            graphics.arc(midX, midY, 1.5, 0, Math.PI * 2);
            graphics.fillPath();
          }
        }
        else if (key === 'furniture_shelf_metal') {
          // Open steel grid framing lines
          graphics.lineStyle(1.5, 0x4b5563, 0.85);
          for (let offset = 0.25; offset <= 0.75; offset += 0.25) {
            const hOffset = Math.floor(heightPixels * offset);
            graphics.beginPath();
            graphics.moveTo(ptLeft.x, ptLeft.y + hOffset);
            graphics.lineTo(ptBottom.x, ptBottom.y + hOffset);
            graphics.lineTo(ptRight.x, ptRight.y + hOffset);
            graphics.strokePath();
          }
        }
        else if (key.startsWith('furniture_custom_poster')) {
          // Draw a carbon border frame around the vertical Left face
          graphics.lineStyle(2.5, 0x1e293b, 1.0);
          graphics.beginPath();
          graphics.moveTo(ptLeft.x + 3, ptLeft.y + 2);
          graphics.lineTo(ptBottom.x - 3, ptBottom.y + 2);
          graphics.lineTo(ptBottom.x - 3, ptBottom.y + heightPixels - 2);
          graphics.lineTo(ptLeft.x + 3, ptLeft.y + heightPixels - 2);
          graphics.closePath();
          graphics.strokePath();

          // Draw a slightly smaller inner frame on Left face
          graphics.fillStyle(0x0f172a, 0.9);
          graphics.beginPath();
          graphics.moveTo(ptLeft.x + 5, ptLeft.y + 3);
          graphics.lineTo(ptBottom.x - 5, ptBottom.y + 3);
          graphics.lineTo(ptBottom.x - 5, ptBottom.y + heightPixels - 3);
          graphics.lineTo(ptLeft.x + 5, ptLeft.y + heightPixels - 3);
          graphics.closePath();
          graphics.fillPath();

          // Draw the exact same borders on the Right face
          graphics.lineStyle(2.5, darken(0x1e293b, 0.8), 1.0);
          graphics.beginPath();
          graphics.moveTo(ptRight.x - 3, ptRight.y + 2);
          graphics.lineTo(ptBottom.x + 3, ptBottom.y + 2);
          graphics.lineTo(ptBottom.x + 3, ptBottom.y + heightPixels - 2);
          graphics.lineTo(ptRight.x - 3, ptRight.y + heightPixels - 2);
          graphics.closePath();
          graphics.strokePath();

          graphics.fillStyle(darken(0x0f172a, 0.8), 0.9);
          graphics.beginPath();
          graphics.moveTo(ptRight.x - 5, ptRight.y + 3);
          graphics.lineTo(ptBottom.x + 5, ptBottom.y + 3);
          graphics.lineTo(ptBottom.x + 5, ptBottom.y + heightPixels - 3);
          graphics.lineTo(ptRight.x - 5, ptRight.y + heightPixels - 3);
          graphics.closePath();
          graphics.fillPath();

          // Render indicators inside both faces based on the moderation state
          if (key === 'furniture_custom_poster') {
            // Blueprint schematics (neon cyan grid or diamond)
            graphics.lineStyle(1.0, 0x06b6d4, 0.7);
            graphics.beginPath();
            graphics.moveTo((ptLeft.x + ptBottom.x) / 2, (ptLeft.y + ptBottom.y) / 2 + 6);
            graphics.lineTo(ptBottom.x - 10, (ptLeft.y + ptBottom.y) / 2 + heightPixels / 2);
            graphics.lineTo((ptLeft.x + ptBottom.x) / 2, (ptLeft.y + ptBottom.y) / 2 + heightPixels - 6);
            graphics.lineTo(ptLeft.x + 10, (ptLeft.y + ptBottom.y) / 2 + heightPixels / 2);
            graphics.closePath();
            graphics.strokePath();

            graphics.lineStyle(1.0, darken(0x06b6d4, 0.8), 0.7);
            graphics.beginPath();
            graphics.moveTo((ptRight.x + ptBottom.x) / 2, (ptRight.y + ptBottom.y) / 2 + 6);
            graphics.lineTo(ptBottom.x + 10, (ptRight.y + ptBottom.y) / 2 + heightPixels / 2);
            graphics.lineTo((ptRight.x + ptBottom.x) / 2, (ptRight.y + ptBottom.y) / 2 + heightPixels - 6);
            graphics.lineTo(ptRight.x - 10, (ptRight.y + ptBottom.y) / 2 + heightPixels / 2);
            graphics.closePath();
            graphics.strokePath();
          } else if (key === 'furniture_custom_poster_pending') {
            // Amber glowing warning/caution stripes
            graphics.lineStyle(1.5, 0xf59e0b, 0.75);
            for (let d = 8; d <= 24; d += 8) {
              graphics.beginPath();
              graphics.moveTo(ptLeft.x + d, ptLeft.y + 6);
              graphics.lineTo(ptLeft.x + d + 3, ptLeft.y + heightPixels - 6);
              graphics.strokePath();
            }

            graphics.lineStyle(1.5, darken(0xf59e0b, 0.8), 0.75);
            for (let d = 8; d <= 24; d += 8) {
              graphics.beginPath();
              graphics.moveTo(ptRight.x - d, ptRight.y + 6);
              graphics.lineTo(ptRight.x - d - 3, ptRight.y + heightPixels - 6);
              graphics.strokePath();
            }
          } else if (key === 'furniture_custom_poster_rejected') {
            // Red warning X symbol
            graphics.lineStyle(2.0, 0xef4444, 0.9);
            graphics.beginPath();
            graphics.moveTo(ptLeft.x + 8, ptLeft.y + 6);
            graphics.lineTo(ptBottom.x - 8, ptBottom.y + heightPixels - 6);
            graphics.moveTo(ptBottom.x - 8, ptBottom.y + 6);
            graphics.lineTo(ptLeft.x + 8, ptLeft.y + heightPixels - 6);
            graphics.strokePath();

            graphics.lineStyle(2.0, darken(0xef4444, 0.8), 0.9);
            graphics.beginPath();
            graphics.moveTo(ptRight.x - 8, ptRight.y + 6);
            graphics.lineTo(ptBottom.x + 8, ptBottom.y + heightPixels - 6);
            graphics.moveTo(ptBottom.x + 8, ptBottom.y + 6);
            graphics.lineTo(ptRight.x - 8, ptRight.y + heightPixels - 6);
            graphics.strokePath();
          }
        }
      }
    }

    // 5. GLOWING NEON HIGHLIGHT EDGES (AESTHETIC UPGRADE)
    graphics.lineStyle(4, neonColor, 0.35); // outer thick glow
    graphics.beginPath();
    graphics.moveTo(ptTop.x, ptTop.y);
    graphics.lineTo(ptRight.x, ptRight.y);
    graphics.lineTo(ptBottom.x, ptBottom.y);
    graphics.lineTo(ptLeft.x, ptLeft.y);
    graphics.closePath();
    graphics.strokePath();

    if (heightPixels > 0) {
      graphics.beginPath();
      graphics.moveTo(ptLeft.x, ptLeft.y + heightPixels);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.lineTo(ptRight.x, ptRight.y + heightPixels);
      graphics.strokePath();
      
      graphics.beginPath();
      graphics.moveTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.strokePath();
    }

    // Draw primary thin high-vibrancy glowing outline
    graphics.lineStyle(1.5, neonColor, 1.0); // inner neon beam
    graphics.beginPath();
    graphics.moveTo(ptTop.x, ptTop.y);
    graphics.lineTo(ptRight.x, ptRight.y);
    graphics.lineTo(ptBottom.x, ptBottom.y);
    graphics.lineTo(ptLeft.x, ptLeft.y);
    graphics.closePath();
    graphics.strokePath();

    if (heightPixels > 0) {
      graphics.beginPath();
      graphics.moveTo(ptLeft.x, ptLeft.y + heightPixels);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.lineTo(ptRight.x, ptRight.y + heightPixels);
      graphics.strokePath();
      
      graphics.beginPath();
      graphics.moveTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.strokePath();
    }

    const totalWidth = (widthTiles + depthTiles) * (TILE_W / 2);
    const totalHeight = (widthTiles + depthTiles) * (TILE_H / 2) + heightPixels;

    graphics.generateTexture(key, totalWidth, totalHeight);
    graphics.destroy();
  }
}
