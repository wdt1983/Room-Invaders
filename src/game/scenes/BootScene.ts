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
];

const TURRETS: readonly SpriteDescriptor[] = [
  ['turret_nailgun',    1, 1, 40, 0x34495e],
  ['turret_taser',      1, 1, 40, 0x9b59b6],
  ['turret_tesla',      1, 1, 56, 0x9b59b6],
  ['turret_autocannon', 2, 2, 64, 0x2c3e50],
  ['turret_shotgun',    1, 1, 44, 0xd35400],
];

const BARRICADES: readonly SpriteDescriptor[] = [
  ['barricade_bookshelf',     2, 1, 56, 0x5c4033],
  ['barricade_flipped_table', 2, 1, 24, 0xa0522d],
  ['barricade_sandbags',      1, 1, 20, 0xbdc3c7],
];

const ENTITIES: readonly SpriteDescriptor[] = [
  ['entity_drone', 1, 1, 40, 0xf1c40f],
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
  private generateFloorTexture(key: string, color: number, type: "wood" | "carpet" | "tile" | "concrete"): void {
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

    if (type === "tile") {
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
      // Draw smooth, sleek grid subdivisions to look like premium textured surfaces
      graphics.lineStyle(1, darken(color, 0.5), 0.25);
      for (let f = 0.33; f <= 0.67; f += 0.33) {
        // Left-to-right division lines
        graphics.beginPath();
        graphics.moveTo(ptTop.x + (ptLeft.x - ptTop.x) * f, ptTop.y + (ptLeft.y - ptTop.y) * f);
        graphics.lineTo(ptRight.x + (ptBottom.x - ptRight.x) * f, ptRight.y + (ptBottom.y - ptRight.y) * f);
        graphics.strokePath();

        // Right-to-left division lines
        graphics.beginPath();
        graphics.moveTo(ptTop.x + (ptRight.x - ptTop.x) * f, ptTop.y + (ptRight.y - ptTop.y) * f);
        graphics.lineTo(ptLeft.x + (ptBottom.x - ptLeft.x) * f, ptLeft.y + (ptBottom.y - ptLeft.y) * f);
        graphics.strokePath();
      }
    } else if (isTrap) {
      // Traps get diagonal warning lines (hazard strip style!)
      graphics.lineStyle(2, neonColor, 0.4);
      for (let f = 0.2; f <= 0.8; f += 0.2) {
        // Draw diagonal hazard lines crossing from left wall to right wall
        graphics.beginPath();
        graphics.moveTo(ptLeft.x + (ptTop.x - ptLeft.x) * f, ptLeft.y + (ptTop.y - ptLeft.y) * f);
        graphics.lineTo(ptBottom.x + (ptRight.x - ptBottom.x) * f, ptBottom.y + (ptRight.y - ptBottom.y) * f);
        graphics.strokePath();
      }
      
      // Draw central warning plate outline
      graphics.lineStyle(2, neonColor, 0.85);
      graphics.beginPath();
      graphics.moveTo(ptTop.x * 0.7 + ptBottom.x * 0.3, ptTop.y * 0.7 + ptBottom.y * 0.3);
      graphics.lineTo(ptRight.x * 0.7 + ptLeft.x * 0.3, ptRight.y * 0.7 + ptLeft.y * 0.3);
      graphics.lineTo(ptBottom.x * 0.7 + ptTop.x * 0.3, ptBottom.y * 0.7 + ptTop.y * 0.3);
      graphics.lineTo(ptLeft.x * 0.7 + ptRight.x * 0.3, ptLeft.y * 0.7 + ptRight.y * 0.3);
      graphics.closePath();
      graphics.strokePath();
    } else if (isTurret) {
      // Turrets get a high-tech glowing energy core circle in the center!
      graphics.fillStyle(neonColor, 0.9);
      graphics.lineStyle(1.5, 0xffffff, 0.85);
      
      const centerX = (ptTop.x + ptBottom.x) / 2;
      const centerY = (ptTop.y + ptBottom.y) / 2;
      
      graphics.beginPath();
      graphics.arc(centerX, centerY, 6, 0, Math.PI * 2);
      graphics.fillPath();
      graphics.strokePath();
      
      // Draw aiming HUD vectors
      graphics.lineStyle(1, neonColor, 0.5);
      graphics.beginPath();
      graphics.moveTo(centerX - 12, centerY);
      graphics.lineTo(centerX + 12, centerY);
      graphics.moveTo(centerX, centerY - 6);
      graphics.lineTo(centerX, centerY + 6);
      graphics.strokePath();
    } else if (isEntity) {
      // Drone or Stash: Draw beautiful glowing inner cores
      graphics.fillStyle(0xffffff, 0.95);
      graphics.lineStyle(1.5, neonColor, 0.9);
      const centerX = (ptTop.x + ptBottom.x) / 2;
      const centerY = (ptTop.y + ptBottom.y) / 2;
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
        // Draw heavy metallic horizontal slats across barricade sides!
        graphics.lineStyle(2, darken(color, 0.25), 0.7);
        for (let offset = 0.2; offset <= 0.8; offset += 0.2) {
          const hOffset = Math.floor(heightPixels * offset);
          // Right side slat
          graphics.beginPath();
          graphics.moveTo(ptRight.x, ptRight.y + hOffset);
          graphics.lineTo(ptBottom.x, ptBottom.y + hOffset);
          graphics.strokePath();

          // Left side slat
          graphics.beginPath();
          graphics.moveTo(ptLeft.x, ptLeft.y + hOffset);
          graphics.lineTo(ptBottom.x, ptBottom.y + hOffset);
          graphics.strokePath();
        }
      } else if (isTurret) {
        // Turrets get glowing heat-vent vertical lines
        graphics.lineStyle(1.5, neonColor, 0.4);
        for (let f = 0.25; f <= 0.75; f += 0.25) {
          // Right side vent vertical lines
          const rx = ptRight.x + (ptBottom.x - ptRight.x) * f;
          const ry = ptRight.y + (ptBottom.y - ptRight.y) * f;
          graphics.beginPath();
          graphics.moveTo(rx, ry + 4);
          graphics.lineTo(rx, ry + heightPixels - 4);
          graphics.strokePath();

          // Left side vent vertical lines
          const lx = ptLeft.x + (ptBottom.x - ptLeft.x) * f;
          const ly = ptLeft.y + (ptBottom.y - ptLeft.y) * f;
          graphics.beginPath();
          graphics.moveTo(lx, ly + 4);
          graphics.lineTo(lx, ly + heightPixels - 4);
          graphics.strokePath();
        }
      }
    }

    // 5. GLOWING NEON HIGHLIGHT EDGES (AESTHETIC UPGRADE)
    // Draw thick glowing overlay under primary thin outline for double outline neon bloom!
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
