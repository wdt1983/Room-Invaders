import * as Phaser from 'phaser';
import { DEFAULT_GRID_SIZE } from '@/game/utils/constants';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { GridSystem } from '@/game/systems/GridSystem';
import { FurnitureSprite } from '@/game/objects/FurnitureSprite';
import { EntitySprite } from '@/game/objects/EntitySprite';
import { EventBus } from '@/game/EventBus';
import { entryTileFor } from '@/lib/game/entryPoints';
import {
  useRaidStore,
  type RaidOutcome,
} from '@/lib/store/useRaidStore';
import {
  type NpcRoomFixture,
  type NpcPlacedItem,
  resolveFixture,
  DEFAULT_FIXTURE_ID,
} from '@/game/fixtures/npc-rooms';
import type { EntryPointType, EntryPointWall } from '@/lib/store/useRoomStore';
import { applyDamageToPlaced, DEFAULT_SQUAD_HP } from '@/game/systems/CombatSystem';
import { TrapSystem, type TrapTriggeredPayload } from '@/game/systems/TrapSystem';
import { TurretAI, type TurretFiredPayload } from '@/game/systems/DefenseAI';

const WALL_COLOR = 0x888888;
const WALL_THICKNESS = 6;
const ENTRY_WALL_COLORS: Record<EntryPointType, number> = {
  door: 0xa0522d,
  window: 0x5dade2,
  vent: 0x34495e,
};
const ENTRY_SPRITE_KEYS: Record<EntryPointType, string> = {
  door: 'entry_door',
  window: 'entry_window',
  vent: 'entry_vent',
};

/** Per-turret projectile-line colors. Distinct hues so simultaneous
 *  fires from different turret types read clearly when both lines are
 *  on screen. Falls back to white for unknown sprite keys. */
const TURRET_PROJECTILE_COLORS: Record<string, number> = {
  turret_nailgun: 0xfde047, // amber — matches the nailgun's kinetic feel
  turret_taser:   0x67e8f9, // cyan  — electric / ice read for taser stun
};

/** Barricade HP keyed by sprite_key. Mirrors `items.stats.hp` in
 *  `supabase/seed.sql` for `type = 'barricade'` rows. Same pattern as
 *  TRAP_STATS_BY_SPRITE_KEY / TURRET_STATS_BY_SPRITE_KEY — retires when
 *  DB-hydrated stats flow through the raid target. */
const BARRICADE_HP_BY_SPRITE_KEY: Record<string, number> = {
  barricade_bookshelf: 50,
  barricade_flipped_table: 30,
  barricade_sandbags: 75,
};

/** Squad melee damage per hit against destructible placed items. */
const SQUAD_MELEE_DAMAGE = 10;
/** Milliseconds between melee hits while the squad is adjacent to the
 *  target. 1000ms = 1 hit/second. */
const SQUAD_MELEE_RATE_MS = 1000;

/** Seconds the squad must hold the stash tile to win, per difficulty. */
const STASH_HOLD_SECONDS: Record<string, number> = {
  easy: 3,
  medium: 5,
  hard: 8,
};

/** Tick rate for the stash hold timer. 100ms = 10Hz for smooth progress. */
const STASH_HOLD_TICK_MS = 100;

/**
 * RaidScene — Phase 3 scaffold (tasks 3.0.13 + 3.0.15).
 *
 * Loads an {@link NpcRoomFixture} by id, renders the NPC layout using the
 * same visual vocabulary as {@link RoomScene} (floor diamonds, wall line
 * segments with per-entry tints, entry-point floor markers, furniture
 * sprites z-sorted by gridX+gridY), spawns the player squad unit one tile
 * inside the first entry, and starts a 1Hz countdown tied to
 * {@link useRaidStore.tickTimer}.
 *
 * Termination paths handled HERE:
 *   - `timeRemainingSeconds → 0`        → defeat (timer expiry)
 *   - EventBus `raid-complete` (outcome)→ victory or defeat from an external
 *                                         trigger (stub buttons in RaidHUD for
 *                                         now; later tasks hook combat + loot
 *                                         stash into this event).
 *
 * What's DELIBERATELY NOT HERE (by scope):
 *   - resolve-raid Edge Function round-trip (task 3.0.16) — lives in
 *     {@link RaidResolver}, a React component mounted on the raid route.
 *     RaidScene commits scaffold rewards via `finishRaid`; the resolver
 *     fires the Edge Function and overwrites those fields with server
 *     numbers.
 *   - LootSystem (task 3.0.17) — rewards are a static per-difficulty
 *     table in the Edge Function. Loot tables + RNG land with 3.0.17.
 *
 * CombatSystem (task 3.0.9) is wired: entity-damaged / entity-killed listeners
 * mirror squad HP into useRaidStore, squad-kill auto-finishes the raid as
 * defeat, and defense-destroyed cleans up the sprite + tile.
 *
 * TrapSystem (task 3.0.8) is wired: fixture items of `type === 'trap'` leave
 * their tile `'empty'` so A* routes the squad over them, and the TrapSystem
 * triggers on `'entity-entered-tile'` events. On trigger, this scene handles
 * stun + camera shake + sprite flash + action-log append; the actual damage
 * is applied by TrapSystem via CombatSystem.
 *
 * TurretAI (task 3.0.10) is wired: fixture items of `type === 'turret'` are
 * registered with the AI, which ticks off the scene's `update()` hook.
 * Turrets acquire the squad by Chebyshev range, fire at the stat's `fire_rate`
 * cadence, and deplete `ammo` per shot (out-of-ammo → `'defense-destroyed'`
 * via the existing cleanup path). Taser stun reuses the shared squad-stun
 * helper introduced for TrapSystem. Projectile VFX is a short fading line
 * drawn by this scene in response to the `'turret-fired'` event.
 *
 * Barricade attack (task 3.0.11) is wired: clicking an occupied tile with a
 * destructible sprite (hp !== null) paths the squad adjacent and starts a
 * 1Hz melee attack via `applyDamageToPlaced`. First consumer of the
 * CombatSystem's placed-damage path. Barricades get HP from
 * `BARRICADE_HP_BY_SPRITE_KEY` at fixture placement time. Attack stops on
 * new click, barricade destruction, stun (skips ticks), or raid end.
 *
 * All of those pending systems bolt on top of the termination + combat
 * contracts defined above without touching the scaffold.
 */
export class RaidScene extends Phaser.Scene {
  public gridSystem: GridSystem;
  public currentRotation: number = 0;
  public gridSize: number = 10;
  public offsetX: number = 0;
  public offsetY: number = 0;

  private fixture!: NpcRoomFixture;
  private floorTiles: Phaser.GameObjects.Image[] = [];
  private furnitureItems: FurnitureSprite[] = [];
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private entryPointSprites: Phaser.GameObjects.Image[] = [];
  private entryPointTiles: Set<string> = new Set();
  private playerEntity!: EntitySprite;
  private pathDebugGraphics!: Phaser.GameObjects.Graphics;
  private trapSystem: TrapSystem | null = null;
  private turretAI: TurretAI | null = null;

  /** Active barricade-attack state. `null` when the squad is not
   *  attacking. Set by {@link startBarricadeAttack}; cleared by
   *  {@link stopBarricadeAttack}, `'defense-destroyed'`, or teardown. */
  private barricadeAttack: {
    targetGridX: number;
    targetGridY: number;
    timer: Phaser.Time.TimerEvent;
  } | null = null;

  /** Stash hold state. `null` when not holding. */
  private stashHold: {
    timer: Phaser.Time.TimerEvent;
    startTimeMs: number;
    durationMs: number;
  } | null = null;
  private stashSprite: Phaser.GameObjects.Image | null = null;

  private onEntityEnteredTile: ((payload: { entityId: string; x: number; y: number }) => void) | null = null;

  /**
   * `Date.now()` timestamp until which pointer clicks are ignored. Set
   * by the trap-trigger handler when a stun / immobilize effect fires;
   * {@link handlePointerDown} early-returns while we're past `0` and
   * before this value. Stun effect = no new pathfinding + no input
   * response. Once elapsed, clicks work again without any explicit
   * "stun ended" event — we just check the timestamp on every click.
   */
  private stunnedUntilMs: number = 0;

  /** 1Hz Phaser TimerEvent that drives the countdown. Stored so the scene
   *  can destroy it on shutdown / completion — leaving it running would
   *  keep decrementing `useRaidStore` after the raid ended. */
  private timerEvent: Phaser.Time.TimerEvent | null = null;

  private isReplayMode: boolean = false;
  private replayElapsedSeconds: number = 0;
  private replayActionLog: any[] = [];

  /** Bound EventBus listeners — kept as fields so we can detach them in
   *  `shutdown()`. Detaching by reference prevents stale closures from
   *  firing against a destroyed scene if the user navigates mid-raid. */
  private onRaidComplete: ((payload: { outcome: RaidOutcome; reason?: string }) => void) | null = null;
  private onEntityDamaged: ((payload: { entityId: string; hp: number; maxHp: number; amount: number }) => void) | null = null;
  private onEntityKilled: ((payload: { entityId: string; maxHp: number }) => void) | null = null;
  private onDefenseDestroyed: ((payload: { gridX: number; gridY: number; spriteKey: string; maxHp: number }) => void) | null = null;
  private onTrapTriggered: ((payload: TrapTriggeredPayload) => void) | null = null;
  private onTurretFired: ((payload: TurretFiredPayload) => void) | null = null;

  constructor() {
    super({ key: 'RaidScene' });
    this.gridSystem = new GridSystem();
  }

  create() {
    // Resolve the fixture from the raid store (SSR-hydrated by
    // RaidInitializer on the /raid/[id] page). Unknown ids fall back to the
    // default fixture so the scene always has something to render.
    const target = useRaidStore.getState().target;
    this.gridSize = target?.gridSize ?? 10;
    this.gridSystem = new GridSystem(this.gridSize);

    if (target?.isPvP || target?.placedItems) {
      // Resolve dynamic spawn point adjacent to first entry point
      const entryPoints = target.entryPoints ?? [];
      const firstEp = entryPoints[0];
      let spawn = { x: 1, y: 1 };
      if (firstEp) {
        const max = this.gridSize - 1;
        switch (firstEp.wall) {
          case 'north': spawn = { x: firstEp.position, y: 1 }; break;
          case 'south': spawn = { x: firstEp.position, y: max - 1 }; break;
          case 'east':  spawn = { x: max - 1,     y: firstEp.position }; break;
          case 'west':  spawn = { x: 1,           y: firstEp.position }; break;
        }
      }

      // Project stash tile in the far corner opposite to the spawn point, or use custom stash
      const stash = (target as any).stash ?? {
        x: spawn.x < this.gridSize / 2 ? this.gridSize - 3 : 2,
        y: spawn.y < this.gridSize / 2 ? this.gridSize - 3 : 2
      };

      this.fixture = {
        id: target.id,
        name: target.name,
        description: target.isPvP ? "Custom player stronghold layout." : "Procedural survivor layout.",
        difficulty: target.difficulty,
        requiredLevel: 1,
        gridSize: this.gridSize,
        spawn,
        stash,
        entryPoints,
        items: (target.placedItems ?? []).map(item => ({
          spriteKey: item.spriteKey,
          gridX: item.gridX,
          gridY: item.gridY,
          footprintW: item.footprintW,
          footprintH: item.footprintH,
          rotation: item.rotation,
          type: item.type as any
        }))
      };
    } else {
      this.fixture = resolveFixture(target?.id ?? DEFAULT_FIXTURE_ID);
    }

    this.offsetX = this.scale.width / 2;
    this.offsetY = this.scale.height / 4;

    this.pathDebugGraphics = this.add.graphics().setDepth(1000);

    // ── Floor ──────────────────────────────────────────────────────────────
    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const screenPos = IsometricEngine.worldToScreen(x, y);
        const tile = this.add.image(screenPos.x + this.offsetX, screenPos.y + this.offsetY, 'iso-tile');
        tile.setData('gridX', x);
        tile.setData('gridY', y);
        this.floorTiles.push(tile);
      }
    }

    // ── Entry points: hydrate grid + draw markers ──────────────────────────
    for (const ep of this.fixture.entryPoints) {
      const tile = entryTileFor(ep, this.gridSize);
      if (tile) {
        this.gridSystem.setTileState(tile.x, tile.y, 'entry_point');
        this.entryPointTiles.add(`${tile.x},${tile.y}`);
      }
    }

    this.wallGraphics = this.add.graphics();
    this.wallGraphics.setDepth(0.5);
    this.drawWalls();

    for (const ep of this.fixture.entryPoints) {
      const tile = entryTileFor(ep, this.gridSize);
      if (!tile) continue;
      const screenPos = IsometricEngine.worldToScreen(tile.x, tile.y, this.currentRotation);
      const sprite = this.add.image(
        screenPos.x + this.offsetX,
        screenPos.y + this.offsetY,
        ENTRY_SPRITE_KEYS[ep.type],
      );
      sprite.setData('gridX', tile.x);
      sprite.setData('gridY', tile.y);
      sprite.setDepth(tile.x + tile.y + 0.5);
      this.tweens.add({
        targets: sprite,
        alpha: { from: 0.6, to: 1.0 },
        yoyo: true,
        repeat: -1,
        duration: 1200,
        ease: 'Sine.easeInOut',
      });
      this.entryPointSprites.push(sprite);
    }

    // ── NPC furniture / defenses ───────────────────────────────────────────
    // Trap tiles stay `'empty'` so A* routes the squad right over them —
    // that's the trigger. Every other defense type blocks movement.
    // Barricades get HP from BARRICADE_HP_BY_SPRITE_KEY so they're
    // destructible via applyDamageToPlaced (task 3.0.11).
    for (const item of this.fixture.items) {
      if (!this.gridSystem.isTileWalkable(item.gridX, item.gridY)) continue;
      const barricadeHp = item.type === 'barricade'
        ? (BARRICADE_HP_BY_SPRITE_KEY[item.spriteKey] ?? null)
        : null;
      const sprite = new FurnitureSprite(
        this,
        item.gridX,
        item.gridY,
        item.spriteKey,
        item.footprintW,
        item.footprintH,
        barricadeHp != null ? { hp: barricadeHp } : {},
      );
      sprite.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
      sprite.setFurnitureRotation(item.rotation ?? 0);
      this.furnitureItems.push(sprite);
      if (item.type !== 'trap') {
        this.gridSystem.setTileState(item.gridX, item.gridY, 'occupied');
      }
    }

    // ── Squad unit — spawn one tile inside the first entry ─────────────────
    const spawn = this.resolveSpawn(this.fixture);
    this.playerEntity = new EntitySprite(this, spawn.x, spawn.y, 'entity_drone', {
      entityId: 'player',
      maxHp: DEFAULT_SQUAD_HP,
    });
    this.playerEntity.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);

    // Mirror initial squad HP into the store so the HUD shows full bar on
    // raid start before any damage has been dealt.
    useRaidStore.getState().setSquadHp(this.playerEntity.hp, this.playerEntity.maxHp);

    // ── TrapSystem registration (task 3.0.8) ───────────────────────────────
    // Subscribes to `'entity-entered-tile'` events from EntitySprite. Each
    // trap in the fixture is registered with its canonical stats from
    // TRAP_STATS_BY_SPRITE_KEY (mirror of supabase/seed.sql).
    this.trapSystem = new TrapSystem(this.playerEntity);
    for (const item of this.fixture.items) {
      if (item.type !== 'trap') continue;
      const sprite = this.furnitureItems.find(
        (f) => f.gridX === item.gridX && f.gridY === item.gridY,
      );
      if (!sprite) continue;
      this.trapSystem.registerTrap({
        gridX: item.gridX,
        gridY: item.gridY,
        spriteKey: item.spriteKey,
        sprite,
      });
    }

    // ── TurretAI registration (task 3.0.10) ────────────────────────────────
    // Ticks off the scene's `update()` hook. Each turret acquires the squad
    // by Chebyshev range, fires on its `fire_rate` cadence, and emits
    // `'turret-fired'` — handled by `handleTurretFired` below for VFX +
    // stun + action log.
    this.turretAI = new TurretAI(this.playerEntity);
    for (const item of this.fixture.items) {
      if (item.type !== 'turret') continue;
      const sprite = this.furnitureItems.find(
        (f) => f.gridX === item.gridX && f.gridY === item.gridY,
      );
      if (!sprite) continue;
      this.turretAI.registerTurret({
        gridX: item.gridX,
        gridY: item.gridY,
        spriteKey: item.spriteKey,
        sprite,
      });
    }

    // ── Loot stash marker (task 3.0.12) ──────────────────────────────────
    // Pulsing gold sprite on the stash tile so the player knows where to
    // go. The tile stays 'empty' (walkable) — the squad walks onto it to
    // start the capture hold.
    {
      const s = this.fixture.stash;
      const stashScreen = IsometricEngine.worldToScreen(s.x, s.y, this.currentRotation);
      this.stashSprite = this.add.image(
        stashScreen.x + this.offsetX,
        stashScreen.y + this.offsetY,
        'loot_stash',
      );
      this.stashSprite.setDepth(s.x + s.y + 0.5);
      this.tweens.add({
        targets: this.stashSprite,
        alpha: { from: 0.5, to: 1.0 },
        yoyo: true,
        repeat: -1,
        duration: 800,
        ease: 'Sine.easeInOut',
      });
    }

    // ── Stash-hold detection via entity-entered-tile ───────────────────────
    // When the squad enters the stash tile, start a hold timer. When the
    // squad moves to any other tile, cancel the hold. The hold completes
    // after STASH_HOLD_SECONDS[difficulty] → victory.
    this.onEntityEnteredTile = (payload) => {
      if (payload.entityId !== 'player') return;

      // Action log — record every tile the squad enters.
      const st = useRaidStore.getState();
      if (st.phase === 'active') {
        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        st.appendAction({ t: elapsed, type: 'move', data: { gridX: payload.x, gridY: payload.y } });
      }

      const s = this.fixture.stash;
      if (payload.x === s.x && payload.y === s.y) {
        this.startStashHold();
      } else if (this.stashHold) {
        this.cancelStashHold();
      }
    };
    EventBus.on('entity-entered-tile', this.onEntityEnteredTile);

    this.cameras.main.centerOn(this.offsetX, this.offsetY);
    this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);

    // ── Input — view-mode pathfinding identical to RoomScene ───────────────
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('wheel', this.handleWheel, this);

    // ── Replay or Countdown Timer ──
    useRaidStore.getState().beginActivePhase();
    if (this.isReplayMode) {
      this.replayElapsedSeconds = 0;
      this.timerEvent = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: this.tickReplayPlayback,
        callbackScope: this
      });
    } else {
      this.timerEvent = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: this.onTimerTick,
        callbackScope: this,
      });
    }

    // ── External termination hook ──────────────────────────────────────────
    this.onRaidComplete = (payload) => {
      this.finishRaid(payload.outcome, payload.reason ?? 'Raid complete');
    };
    EventBus.on('raid-complete', this.onRaidComplete);

    // ── CombatSystem wiring (task 3.0.9) ───────────────────────────────────
    // Mirror squad HP to the store so the HUD stays live. We gate on
    // `entityId === 'player'` to ignore damage events from future NPC
    // guards / additional squad members — the HUD only shows squad HP.
    this.onEntityDamaged = (payload) => {
      if (payload.entityId !== 'player') return;
      const st = useRaidStore.getState();
      st.setSquadHp(payload.hp, payload.maxHp);
      const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
      st.appendAction({
        t: elapsed,
        type: 'damage',
        data: { hp: payload.hp, maxHp: payload.maxHp, amount: payload.amount },
      });
    };
    this.onEntityKilled = (payload) => {
      if (payload.entityId !== 'player') return;
      const st = useRaidStore.getState();
      st.setSquadHp(0);
      const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
      st.appendAction({
        t: elapsed,
        type: 'entity_killed',
        data: { entityId: payload.entityId, maxHp: payload.maxHp },
      });
      this.finishRaid('defeat', 'Squad eliminated');
    };
    // Defense destruction: remove the sprite + clear the tile so the
    // squad can walk through. Future 3.0.11 (barricade attack) drives
    // this via `applyDamageToPlaced` calls from the attacker's update.
    this.onDefenseDestroyed = (payload) => {
      const idx = this.furnitureItems.findIndex(
        (f) => f.gridX === payload.gridX && f.gridY === payload.gridY,
      );
      if (idx >= 0) {
        this.furnitureItems[idx].destroy();
        this.furnitureItems.splice(idx, 1);
      }
      this.gridSystem.setTileState(payload.gridX, payload.gridY, 'empty');

      const st = useRaidStore.getState();
      const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
      st.appendAction({
        t: elapsed,
        type: 'defense_destroyed',
        data: { gridX: payload.gridX, gridY: payload.gridY, spriteKey: payload.spriteKey, maxHp: payload.maxHp },
      });
    };
    EventBus.on('entity-damaged', this.onEntityDamaged);
    EventBus.on('entity-killed', this.onEntityKilled);
    EventBus.on('defense-destroyed', this.onDefenseDestroyed);

    // ── Trap trigger VFX + stun + action log (task 3.0.8) ──────────────────
    // TrapSystem owns damage + uses bookkeeping; this listener owns the
    // scene-specific consequences: interrupt movement on stun/immobilize,
    // pulse the trap sprite + camera shake, append to the raid action log.
    this.onTrapTriggered = (payload) => this.handleTrapTriggered(payload);
    EventBus.on('trap-triggered', this.onTrapTriggered);

    // ── Turret fire VFX + stun + action log (task 3.0.10) ──────────────────
    // TurretAI owns acquisition + fire-rate + ammo; this listener owns
    // projectile line VFX, taser stun propagation, and the action-log
    // emitter. Shares the squad-stun helper with handleTrapTriggered.
    this.onTurretFired = (payload) => this.handleTurretFired(payload);
    EventBus.on('turret-fired', this.onTurretFired);

    // ── Cleanup on scene shutdown ──────────────────────────────────────────
    // Belt-and-suspenders: navigating away from /raid destroys the Phaser
    // game (GameCanvas unmount), but if Phaser's internal scene manager ever
    // shuts a scene down without full destroy we still want the timer +
    // listener gone so the next raid starts clean.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
  }

  /** Spawn tile = one step inside the first entry point. See handoff
   *  2026-04-14 (task 3.0.13) for rationale — entry tiles aren't walkable
   *  per the existing GridSystem.isTileWalkable contract, so we anchor the
   *  squad unit inside the room rather than on the wall. */
  private resolveSpawn(fixture: NpcRoomFixture): { x: number; y: number } {
    if (fixture.spawn) return fixture.spawn;
    const ep = fixture.entryPoints[0];
    if (!ep) return { x: 0, y: 0 };
    const max = this.gridSize - 1;
    switch (ep.wall) {
      case 'north': return { x: ep.position, y: 1 };
      case 'south': return { x: ep.position, y: max - 1 };
      case 'east':  return { x: max - 1,     y: ep.position };
      case 'west':  return { x: 1,           y: ep.position };
    }
  }

  /** 1Hz timer callback. Drives the Zustand tick + checks for timer expiry.
   *  `tickTimer` itself already guards on `phase === 'active'` so this is
   *  safe even if the raid has already terminated by another route. */
  private onTimerTick = (): void => {
    const state = useRaidStore.getState();
    if (state.phase !== 'active') return;
    state.tickTimer();
    const remaining = useRaidStore.getState().timeRemainingSeconds;
    if (remaining <= 0) {
      this.finishRaid('defeat', 'Time ran out');
    }
  };

  /** Terminate the raid: commit the {@link RaidResults} to the store and
   *  stop the countdown. Idempotent — the store also no-ops once
   *  `phase === 'results'`.
   *
   *  The rewards written here are a scaffold — the canonical numbers
   *  come from the `resolve-raid` Edge Function (task 3.0.16), fired
   *  by {@link RaidResolver} once the store transitions to
   *  `'results'`. The scaffold makes the results screen render
   *  instantly; the resolver overwrites the reward fields on server
   *  response. Keep the scaffold math roughly in line with the server
   *  rewards so the short "validating..." window doesn't flash wildly
   *  different numbers. */
  private finishRaid(outcome: RaidOutcome, reason: string): void {
    const store = useRaidStore.getState();
    if (store.phase === 'results') return;
    const secondsElapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
    // Scaffold math — mirrors the easy-difficulty rewards in
    // `supabase/functions/resolve-raid/fixtures.ts`. Hard/medium get
    // corrected when the server response lands via RaidResolver.
    const baseXp = outcome === 'victory' ? 50 : 10;
    const xpGained = baseXp + (store.target?.difficulty === 'hard' ? 30 : store.target?.difficulty === 'medium' ? 15 : 0);
    // Damage taken — derived from the squad's authoritative HP on the
    // sprite. Falls back to the store value if the sprite was destroyed
    // before finishRaid was called.
    const squadMaxHp = this.playerEntity?.maxHp ?? store.squadMaxHp;
    const squadHp = this.playerEntity?.hp ?? store.squadHp;
    const damageTaken = Math.max(0, squadMaxHp - squadHp);
    store.completeRaid({
      outcome,
      secondsElapsed,
      xpGained,
      damageTaken,
      // Scaffold approximates easy-difficulty victory. The server's
      // lootSystem (task 3.0.17) fills in the full currency spread
      // (credits / intel / contraband) via RaidResolver.
      lootScrap: outcome === 'victory' ? 25 : 0,
      lootComponents: outcome === 'victory' ? 5 : 0,
      lootCredits: 0,
      lootIntel: 0,
      lootContraband: 0,
      reason,
    });
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timerEvent) {
      this.timerEvent.remove(false);
      this.timerEvent = null;
    }
  }

  private teardown(): void {
    this.stopTimer();
    if (this.onRaidComplete) {
      EventBus.off('raid-complete', this.onRaidComplete);
      this.onRaidComplete = null;
    }
    if (this.onEntityDamaged) {
      EventBus.off('entity-damaged', this.onEntityDamaged);
      this.onEntityDamaged = null;
    }
    if (this.onEntityKilled) {
      EventBus.off('entity-killed', this.onEntityKilled);
      this.onEntityKilled = null;
    }
    if (this.onDefenseDestroyed) {
      EventBus.off('defense-destroyed', this.onDefenseDestroyed);
      this.onDefenseDestroyed = null;
    }
    if (this.onTrapTriggered) {
      EventBus.off('trap-triggered', this.onTrapTriggered);
      this.onTrapTriggered = null;
    }
    if (this.onTurretFired) {
      EventBus.off('turret-fired', this.onTurretFired);
      this.onTurretFired = null;
    }
    if (this.trapSystem) {
      this.trapSystem.destroy();
      this.trapSystem = null;
    }
    if (this.turretAI) {
      this.turretAI.destroy();
      this.turretAI = null;
    }
    this.stopBarricadeAttack();
    this.clearStashHold();
    if (this.onEntityEnteredTile) {
      EventBus.off('entity-entered-tile', this.onEntityEnteredTile);
      this.onEntityEnteredTile = null;
    }
    this.stunnedUntilMs = 0;
  }

  /**
   * Phaser scene update — runs every frame. Delegates to TurretAI's tick
   * so turrets can acquire the squad and fire on their own cadence
   * without needing a per-turret Phaser TimerEvent. Gated on
   * `phase === 'active'` so turrets don't fire during prep or after
   * results.
   *
   * @param time    Milliseconds since game start. Used as the turret
   *                AI's time basis — matches `performance.now()` origin,
   *                so alert-mode timestamps set from the `'trap-triggered'`
   *                handler line up with the tick's time basis.
   */
  public update(time: number): void {
    if (useRaidStore.getState().phase !== 'active') return;
    this.turretAI?.tick(time);
  }

  /**
   * Apply a stun / immobilize to the squad. Shared between
   * {@link handleTrapTriggered} and {@link handleTurretFired}: kill the
   * current tween chain so movement stops, push `stunnedUntilMs`
   * forward, and alpha-pulse the squad sprite for the freeze duration.
   *
   * Overlapping freezes extend cleanly — `Math.max` prevents a shorter
   * stun from shortening a longer one that's already running.
   */
  private applySquadStun(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    if (!this.playerEntity) return;
    this.tweens.killTweensOf(this.playerEntity);
    const freezeUntil = Date.now() + seconds * 1000;
    this.stunnedUntilMs = Math.max(this.stunnedUntilMs, freezeUntil);
    this.tweens.add({
      targets: this.playerEntity,
      alpha: { from: 0.4, to: 1.0 },
      duration: 330,
      yoyo: true,
      repeat: Math.max(1, Math.ceil(seconds * 1.5)),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.playerEntity && this.playerEntity.active) {
          this.playerEntity.setAlpha(1);
        }
      },
    });
  }

  /**
   * Handle a `'trap-triggered'` event emitted by {@link TrapSystem}.
   *
   * Responsibilities split from TrapSystem (which only did damage +
   * bookkeeping):
   *   1. **Stun / immobilize** via {@link applySquadStun}.
   *   2. **Trap sprite flash**: a brief alpha dip on the trap that
   *      triggered, so a pressure plate / tripwire that deals no damage
   *      still gives visible feedback. Fires for every trigger,
   *      regardless of damage.
   *   3. **Camera shake**: a short subtle shake on every trigger.
   *   4. **Action log**: append a `trap_triggered` entry. Partial
   *      3.0.14 landing.
   */
  private handleTrapTriggered(payload: TrapTriggeredPayload): void {
    const isPlayer = payload.entityId === 'player';

    // 1) Stun / immobilize — cancel the rest of the path + lock input.
    if (isPlayer) {
      this.applySquadStun(payload.stunSeconds + payload.immobilizeSeconds);
    }

    // 2) Trap sprite flash.
    const trapSprite = this.furnitureItems.find(
      (f) => f.gridX === payload.gridX && f.gridY === payload.gridY,
    );
    if (trapSprite) {
      this.tweens.add({
        targets: trapSprite,
        alpha: { from: 1.0, to: 0.25 },
        duration: 120,
        yoyo: true,
        repeat: 1,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (trapSprite.active) trapSprite.setAlpha(1);
        },
      });
    }

    // 3) Camera shake — short, subtle; the HP bar + sprite flash carry
    //    most of the feedback weight.
    this.cameras.main.shake(180, 0.005);

    // 4) Action log — partial 3.0.14 landing.
    const store = useRaidStore.getState();
    const secondsElapsed = Math.max(
      0,
      store.durationSeconds - store.timeRemainingSeconds,
    );
    store.appendAction({
      t: secondsElapsed,
      type: 'trap_triggered',
      data: {
        gridX: payload.gridX,
        gridY: payload.gridY,
        spriteKey: payload.spriteKey,
        entityId: payload.entityId,
        damage: payload.damageDealt,
        stun: payload.stunSeconds,
        immobilize: payload.immobilizeSeconds,
        alertRadius: payload.alertRadius,
        slow: payload.slow,
        usesRemaining: payload.usesRemaining,
        exhausted: payload.exhausted,
      },
    });
  }

  /**
   * Handle a `'turret-fired'` event emitted by {@link TurretAI}.
   *
   *   1. **Projectile line VFX** — short fading line from the turret's
   *      iso-screen position to the target's. Color-coded per turret
   *      type (nailgun = yellow, taser = cyan) so multiple turrets
   *      firing simultaneously read clearly.
   *   2. **Taser stun** — if the shot carried a non-zero `stunSeconds`
   *      and landed on the squad, apply via the shared stun helper.
   *   3. **Action log** — append a `turret_fired` entry.
   *
   * No camera shake on turret fire — turrets can fire every 0.8–1.0s
   * and constant shake would be disorienting. The HP bar + projectile
   * line carry the feedback weight; shake stays trap-exclusive.
   */
  private handleTurretFired(payload: TurretFiredPayload): void {
    const isPlayer = payload.targetEntityId === 'player';

    // 1) Projectile line VFX. Graphics object drawn fresh per shot,
    //    faded via alpha tween, destroyed on completion. Simpler than
    //    the `Line` GameObject for a short throw-away effect.
    const turretScreen = IsometricEngine.worldToScreen(
      payload.gridX,
      payload.gridY,
      this.currentRotation,
    );
    const targetScreen = IsometricEngine.worldToScreen(
      payload.targetGridX,
      payload.targetGridY,
      this.currentRotation,
    );
    const color = TURRET_PROJECTILE_COLORS[payload.spriteKey] ?? 0xffffff;
    const projectile = this.add.graphics();
    projectile.setDepth(5);
    projectile.lineStyle(2, color, 1.0);
    projectile.lineBetween(
      turretScreen.x + this.offsetX,
      turretScreen.y + this.offsetY - 20, // Raise origin so the line comes from the turret's barrel, not the base
      targetScreen.x + this.offsetX,
      targetScreen.y + this.offsetY - 20,
    );
    this.tweens.add({
      targets: projectile,
      alpha: { from: 1.0, to: 0.0 },
      duration: 150,
      ease: 'Quad.easeOut',
      onComplete: () => {
        projectile.destroy();
      },
    });

    // 2) Taser stun propagation.
    if (isPlayer && payload.stunSeconds > 0) {
      this.applySquadStun(payload.stunSeconds);
    }

    // 3) Action log — partial 3.0.14 landing (second emitter).
    const store = useRaidStore.getState();
    const secondsElapsed = Math.max(
      0,
      store.durationSeconds - store.timeRemainingSeconds,
    );
    store.appendAction({
      t: secondsElapsed,
      type: 'turret_fired',
      data: {
        gridX: payload.gridX,
        gridY: payload.gridY,
        spriteKey: payload.spriteKey,
        targetEntityId: payload.targetEntityId,
        targetGridX: payload.targetGridX,
        targetGridY: payload.targetGridY,
        damage: payload.damageDealt,
        stun: payload.stunSeconds,
        ammoRemaining: payload.ammoRemaining,
        exhausted: payload.exhausted,
        alerted: payload.alerted,
      },
    });
  }

  private handleWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const currentZoom = this.cameras.main.zoom;
    const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Phaser.Math.Clamp(currentZoom * zoomFactor, 0.5, 2.0);
    this.cameras.main.zoom = newZoom;
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!pointer.isDown) return;
    this.cameras.main.stopFollow();
    this.cameras.main.scrollX -=
      (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
    this.cameras.main.scrollY -=
      (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.isReplayMode) return;
    // Pathfinding is only meaningful while the raid is actively running —
    // prep and results phases are read-only.
    if (useRaidStore.getState().phase !== 'active') return;
    // Stun / immobilize from a trap freezes the squad until the
    // `stunnedUntilMs` deadline elapses. Ignore pointer clicks while
    // frozen so the player can't path out early.
    if (Date.now() < this.stunnedUntilMs) return;

    // Any new click cancels in-progress actions — the player's intent
    // changed.
    this.stopBarricadeAttack();
    this.cancelStashHold();

    const worldCoords = IsometricEngine.screenToWorld(
      pointer.worldX,
      pointer.worldY,
      this.offsetX,
      this.offsetY,
      this.currentRotation,
    );
    const tileState = this.gridSystem.getTileState(worldCoords.x, worldCoords.y);
    if (!tileState) return;

    if (tileState === 'empty') {
      const path = this.gridSystem.findPath(
        this.playerEntity.currentGridX,
        this.playerEntity.currentGridY,
        worldCoords.x,
        worldCoords.y,
      );
      if (path && path.length > 0) {
        this.drawDebugPath(path);
        this.playerEntity.walkPath(path, this.offsetX, this.offsetY, this.currentRotation);
        this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);
      }
    } else if (tileState === 'occupied') {
      const path = this.gridSystem.findPathToAdjacent(
        this.playerEntity.currentGridX,
        this.playerEntity.currentGridY,
        worldCoords.x,
        worldCoords.y,
      );
      if (path) {
        this.drawDebugPath(path);
        // Capture the clicked tile so the onComplete callback can start
        // a barricade attack if the target is destructible (hp !== null).
        const targetX = worldCoords.x;
        const targetY = worldCoords.y;
        this.playerEntity.walkPath(
          path,
          this.offsetX,
          this.offsetY,
          this.currentRotation,
          () => this.startBarricadeAttack(targetX, targetY),
        );
        this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);
      }
    }
  }

  /**
   * Begin melee-attacking a destructible placed item at `(gridX, gridY)`.
   * Called from the `walkPath` onComplete when the squad arrives adjacent
   * to an occupied tile the player clicked.
   *
   * Only starts if the sprite at that tile has non-null `hp` (i.e., is a
   * barricade with HP). Furniture, turrets, and traps are indestructible
   * in MVP and silently ignored.
   *
   * The attack runs on a Phaser TimerEvent at {@link SQUAD_MELEE_RATE_MS}
   * cadence. Each tick:
   *   1. Checks the squad is still adjacent (Chebyshev distance 1).
   *   2. Checks the squad is not stunned.
   *   3. Calls {@link applyDamageToPlaced} → CombatSystem emits
   *      `'defense-damaged'` / `'defense-destroyed'`.
   *   4. Flashes the barricade sprite + appends an action-log entry.
   *
   * Stopped by {@link stopBarricadeAttack} (any new click, raid end,
   * stun doesn't stop — just skips ticks, or `'defense-destroyed'`
   * listener clearing the target).
   */
  private startBarricadeAttack(gridX: number, gridY: number): void {
    const sprite = this.furnitureItems.find(
      (f) => f.gridX === gridX && f.gridY === gridY,
    );
    if (!sprite || sprite.hp === null) return;

    this.barricadeAttack = {
      targetGridX: gridX,
      targetGridY: gridY,
      timer: this.time.addEvent({
        delay: SQUAD_MELEE_RATE_MS,
        loop: true,
        callback: () => this.tickBarricadeAttack(),
      }),
    };
  }

  private tickBarricadeAttack(): void {
    if (!this.barricadeAttack) return;
    if (useRaidStore.getState().phase !== 'active') {
      this.stopBarricadeAttack();
      return;
    }
    // Skip this tick if stunned — attack resumes next tick after stun.
    if (Date.now() < this.stunnedUntilMs) return;

    const { targetGridX, targetGridY } = this.barricadeAttack;
    const sprite = this.furnitureItems.find(
      (f) => f.gridX === targetGridX && f.gridY === targetGridY,
    );
    if (!sprite || sprite.hp === null || sprite.hp <= 0) {
      this.stopBarricadeAttack();
      return;
    }
    // Adjacency check (Chebyshev distance 1).
    const dx = Math.abs(this.playerEntity.currentGridX - targetGridX);
    const dy = Math.abs(this.playerEntity.currentGridY - targetGridY);
    if (Math.max(dx, dy) !== 1) {
      this.stopBarricadeAttack();
      return;
    }

    const result = applyDamageToPlaced(sprite, SQUAD_MELEE_DAMAGE);
    if (result.ignored) return;

    // VFX — brief alpha dip on the barricade. No camera shake (1Hz is
    // too frequent; shake stays trap-exclusive).
    if (sprite.active) {
      this.tweens.add({
        targets: sprite,
        alpha: { from: 1.0, to: 0.5 },
        duration: 100,
        yoyo: true,
        repeat: 0,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (sprite.active) sprite.setAlpha(1);
        },
      });
    }

    // Action log.
    const store = useRaidStore.getState();
    const secondsElapsed = Math.max(
      0,
      store.durationSeconds - store.timeRemainingSeconds,
    );
    store.appendAction({
      t: secondsElapsed,
      type: 'barricade_attacked',
      data: {
        gridX: targetGridX,
        gridY: targetGridY,
        spriteKey: sprite.texture.key,
        damage: SQUAD_MELEE_DAMAGE,
        hpRemaining: sprite.hp,
        destroyed: result.destroyed,
      },
    });

    if (result.destroyed) {
      this.stopBarricadeAttack();
    }
  }

  private stopBarricadeAttack(): void {
    if (!this.barricadeAttack) return;
    this.barricadeAttack.timer.remove(false);
    this.barricadeAttack = null;
  }

  /**
   * Start a stash-capture hold. Called when the squad enters the stash
   * tile. A 10Hz timer ticks the progress into the store; when it reaches
   * 1.0 the raid completes as victory.
   */
  private startStashHold(): void {
    if (this.stashHold) return;
    if (useRaidStore.getState().phase !== 'active') return;
    const difficulty = this.fixture.difficulty;
    const holdSeconds = STASH_HOLD_SECONDS[difficulty] ?? STASH_HOLD_SECONDS['easy']!;
    const durationMs = holdSeconds * 1000;
    const startTimeMs = this.time.now;

    // Action log entry.
    const store = useRaidStore.getState();
    const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
    store.appendAction({ t: elapsed, type: 'stash_entered', data: { holdSeconds } });
    store.setStashHoldProgress(0);

    this.stashHold = {
      startTimeMs,
      durationMs,
      timer: this.time.addEvent({
        delay: STASH_HOLD_TICK_MS,
        loop: true,
        callback: () => this.tickStashHold(),
      }),
    };
  }

  private tickStashHold(): void {
    if (!this.stashHold) return;
    if (useRaidStore.getState().phase !== 'active') {
      this.cancelStashHold();
      return;
    }
    const elapsed = this.time.now - this.stashHold.startTimeMs;
    const progress = Math.min(1, elapsed / this.stashHold.durationMs);
    useRaidStore.getState().setStashHoldProgress(progress);

    if (progress >= 1) {
      const store = useRaidStore.getState();
      const raidElapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
      store.appendAction({ t: raidElapsed, type: 'stash_secured' });
      this.clearStashHold();
      this.finishRaid('victory', 'Loot stash secured');
    }
  }

  private cancelStashHold(): void {
    if (!this.stashHold) return;
    const store = useRaidStore.getState();
    const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
    store.appendAction({ t: elapsed, type: 'stash_cancelled' });
    this.clearStashHold();
  }

  private clearStashHold(): void {
    if (!this.stashHold) return;
    this.stashHold.timer.remove(false);
    this.stashHold = null;
    useRaidStore.getState().setStashHoldProgress(0);
  }

  /** Mirror of {@link RoomScene.drawWalls} — four wall edges as
   *  tile-length segments with per-entry tinting. */
  private drawWalls(): void {
    this.wallGraphics.clear();
    const size = this.gridSize;

    const colorFor = (wall: EntryPointWall, position: number): number => {
      const ep = this.fixture.entryPoints.find((e) => e.wall === wall && e.position === position);
      return ep ? ENTRY_WALL_COLORS[ep.type] : WALL_COLOR;
    };

    const segment = (
      wall: EntryPointWall,
      position: number,
      start: { x: number; y: number },
      end: { x: number; y: number },
    ): void => {
      const s = IsometricEngine.worldToScreen(start.x, start.y, this.currentRotation);
      const e = IsometricEngine.worldToScreen(end.x, end.y, this.currentRotation);
      this.wallGraphics.lineStyle(WALL_THICKNESS, colorFor(wall, position), 1.0);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + this.offsetX, s.y + this.offsetY);
      this.wallGraphics.lineTo(e.x + this.offsetX, e.y + this.offsetY);
      this.wallGraphics.strokePath();
    };

    for (let p = 0; p < size; p++) {
      segment('north', p, { x: p,    y: 0 },    { x: p + 1,    y: 0 });
      segment('south', p, { x: p,    y: size }, { x: p + 1,    y: size });
      segment('east',  p, { x: size, y: p },    { x: size,     y: p + 1 });
      segment('west',  p, { x: 0,    y: p },    { x: 0,        y: p + 1 });
    }
  }

  private drawDebugPath(path: { x: number; y: number }[] | null): void {
    this.pathDebugGraphics.clear();
    if (!path || path.length === 0) return;

    this.pathDebugGraphics.lineStyle(4, 0x00ff00, 0.8);
    this.pathDebugGraphics.beginPath();
    path.forEach((node, index) => {
      const screenPos = IsometricEngine.worldToScreen(node.x, node.y, this.currentRotation);
      const targetX = screenPos.x + this.offsetX;
      const targetY = screenPos.y + this.offsetY;
      if (index === 0) {
        this.pathDebugGraphics.moveTo(targetX, targetY);
      } else {
        this.pathDebugGraphics.lineTo(targetX, targetY);
      }
    });
    this.pathDebugGraphics.strokePath();
  }

  /** Accessor retained for parity with RoomScene — nothing consumes it yet
   *  but later defense-range overlays (3.0.10 turret vision cones) will
   *  want typed access to the NPC item list. */
  public getFixtureItems(): ReadonlyArray<NpcPlacedItem> {
    return this.fixture.items;
  }

  /**
   * Run the chronological replay ticker at 1Hz playback speed.
   */
  private tickReplayPlayback(): void {
    if (!this.isReplayMode) return;

    // Filter events in the historical log that occurred in the current second tick
    const events = this.replayActionLog.filter(
      (e) => e && Math.floor(e.t) === this.replayElapsedSeconds
    );

    for (const event of events) {
      this.executeReplayEvent(event);
    }

    this.replayElapsedSeconds++;

    // Check if we have surpassed the duration of the logged session
    const maxDuration = this.replayActionLog.reduce((max, e) => Math.max(max, e?.t ?? 0), 0);
    if (this.replayElapsedSeconds > maxDuration + 1) {
      this.stopTimer();

      // Complete the replay scene gracefully
      this.time.delayedCall(2000, () => {
        const lastEvent = this.replayActionLog[this.replayActionLog.length - 1];
        const isVictory = lastEvent?.type === 'stash_secured';
        
        this.finishRaid(
          isVictory ? 'victory' : 'defeat',
          isVictory 
            ? "Replay playback complete: Stronghold breached!" 
            : "Replay playback complete: Defended successfully."
        );
      });
    }
  }

  /**
   * Translates chronological database log events to visible Phaser visual effects.
   */
  private executeReplayEvent(event: any): void {
    if (!event) return;

    switch (event.type) {
      case "move": {
        const targetX = event.data?.gridX;
        const targetY = event.data?.gridY;
        if (targetX !== undefined && targetY !== undefined) {
          const path = [{ x: targetX, y: targetY }];
          this.playerEntity.walkPath(path, this.offsetX, this.offsetY, this.currentRotation);
          this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);
        }
        break;
      }
      case "trap_triggered": {
        this.handleTrapTriggered({
          gridX: event.data?.gridX,
          gridY: event.data?.gridY,
          spriteKey: event.data?.spriteKey,
          entityId: event.data?.entityId,
          damageDealt: event.data?.damage ?? 0,
          stunSeconds: event.data?.stun ?? 0,
          immobilizeSeconds: event.data?.immobilize ?? 0,
          alertRadius: event.data?.alertRadius ?? 0,
          slow: event.data?.slow ?? 0,
          usesRemaining: event.data?.usesRemaining ?? 0,
          exhausted: event.data?.exhausted ?? false,
        });
        break;
      }
      case "turret_fired": {
        this.handleTurretFired({
          gridX: event.data?.gridX,
          gridY: event.data?.gridY,
          spriteKey: event.data?.spriteKey,
          targetEntityId: event.data?.targetEntityId,
          targetGridX: event.data?.targetGridX,
          targetGridY: event.data?.targetGridY,
          damageDealt: event.data?.damage ?? 0,
          stunSeconds: event.data?.stun ?? 0,
          ammoRemaining: event.data?.ammoRemaining ?? 0,
          exhausted: event.data?.exhausted ?? false,
          alerted: event.data?.alerted ?? false,
        });
        break;
      }
      case "barricade_attacked": {
        const sprite = this.furnitureItems.find(
          (f) => f.gridX === event.data?.gridX && f.gridY === event.data?.gridY
        );
        if (sprite && sprite.active) {
          this.tweens.add({
            targets: sprite,
            alpha: { from: 1.0, to: 0.5 },
            duration: 100,
            yoyo: true,
            repeat: 0,
            ease: "Sine.easeInOut",
            onComplete: () => {
              if (sprite.active) sprite.setAlpha(1);
            },
          });
        }
        break;
      }
      case "defense_destroyed": {
        const idx = this.furnitureItems.findIndex(
          (f) => f.gridX === event.data?.gridX && f.gridY === event.data?.gridY
        );
        if (idx >= 0) {
          this.furnitureItems[idx].destroy();
          this.furnitureItems.splice(idx, 1);
        }
        this.gridSystem.setTileState(event.data?.gridX, event.data?.gridY, "empty");
        break;
      }
      case "damage": {
        // Render HP reduction visual in the HUD
        useRaidStore.getState().setSquadHp(event.data?.hp ?? 0, event.data?.maxHp);
        break;
      }
      case "stash_entered": {
        useRaidStore.getState().setStashHoldProgress(0.1);
        break;
      }
      case "stash_secured": {
        useRaidStore.getState().setStashHoldProgress(1.0);
        break;
      }
      case "stash_cancelled": {
        useRaidStore.getState().setStashHoldProgress(0);
        break;
      }
      case "entity_killed": {
        useRaidStore.getState().setSquadHp(0);
        break;
      }
    }
  }
}
