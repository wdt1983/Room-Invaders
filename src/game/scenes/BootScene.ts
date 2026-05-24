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
];

const TURRETS: readonly SpriteDescriptor[] = [
  ['turret_nailgun', 1, 1, 40, 0x34495e],
  ['turret_taser',   1, 1, 40, 0x9b59b6],
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
    // Floor tile — flat isometric diamond.
    this.generateIsoBlock("iso-tile", 1, 1, 0, 0x4ade80);

    // Catalog sprites — keys must match supabase/seed.sql::items.sprite_key.
    // Entry-point textures are room-structure markers (not catalog items).
    for (const group of [FURNITURE, TRAPS, TURRETS, BARRICADES, ENTITIES, ENTRY_POINTS, STASH]) {
      for (const [key, w, h, heightPx, color] of group) {
        this.generateIsoBlock(key, w, h, heightPx, color);
      }
    }
  }

  create() {
    // Route by URL path so /raid/* pages boot straight into the raid scene.
    // Minor Next-coupling here is deliberate — the alternative is threading
    // a config flag through `initGame → GameCanvas → page.tsx`, which is
    // more plumbing than the scaffold warrants. Switch to scene.start data
    // if the coupling becomes annoying.
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
    if (pathname.startsWith('/raid/')) {
      this.scene.start('RaidScene');
    } else {
      this.scene.start('RoomScene');
    }
  }

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

    const colorTop = color;
    const colorRight = darken(color, 0.8);
    const colorLeft = darken(color, 0.6);

    // Top Face
    graphics.fillStyle(colorTop, 1);
    graphics.lineStyle(1, darken(color, 0.9), 1);
    graphics.beginPath();
    graphics.moveTo(ptTop.x, ptTop.y);
    graphics.lineTo(ptRight.x, ptRight.y);
    graphics.lineTo(ptBottom.x, ptBottom.y);
    graphics.lineTo(ptLeft.x, ptLeft.y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    if (heightPixels > 0) {
      // Right Face
      graphics.fillStyle(colorRight, 1);
      graphics.lineStyle(1, darken(color, 0.7), 1);
      graphics.beginPath();
      graphics.moveTo(ptRight.x, ptRight.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.lineTo(ptRight.x, ptRight.y + heightPixels);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();

      // Left Face
      graphics.fillStyle(colorLeft, 1);
      graphics.lineStyle(1, darken(color, 0.5), 1);
      graphics.beginPath();
      graphics.moveTo(ptLeft.x, ptLeft.y);
      graphics.lineTo(ptBottom.x, ptBottom.y);
      graphics.lineTo(ptBottom.x, ptBottom.y + heightPixels);
      graphics.lineTo(ptLeft.x, ptLeft.y + heightPixels);
      graphics.closePath();
      graphics.fillPath();
      graphics.strokePath();
    }

    const totalWidth = (widthTiles + depthTiles) * (TILE_W / 2);
    const totalHeight = (widthTiles + depthTiles) * (TILE_H / 2) + heightPixels;

    graphics.generateTexture(key, totalWidth, totalHeight);
    graphics.destroy();
  }
}
