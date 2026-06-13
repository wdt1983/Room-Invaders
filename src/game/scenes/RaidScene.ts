import * as Phaser from 'phaser';
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
  isBossFixture,
  type BossRoomFixture,
} from '@/game/fixtures/npc-rooms';
import type { EntryPointType, EntryPointWall } from '@/lib/store/useRoomStore';
import { applyDamage, applyDamageToPlaced, DEFAULT_SQUAD_HP, heal } from '@/game/systems/CombatSystem';
import { createClient } from '@/lib/supabase/client';
import { TrapSystem, type TrapTriggeredPayload } from '@/game/systems/TrapSystem';
import { TurretAI, type TurretFiredPayload } from '@/game/systems/DefenseAI';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { SoundManager } from '@/game/objects/SoundManager';
import { BossAI } from '@/game/systems/BossAI';
import { BootScene } from './BootScene';

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
// const SQUAD_MELEE_DAMAGE = 10;
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
  private lastCameraScrollX: number = 0;
  private lastCameraScrollY: number = 0;
  private lastCameraZoom: number = 0;

  private fixture!: NpcRoomFixture;
  private floorTiles: Phaser.GameObjects.Image[] = [];
  private furnitureItems: FurnitureSprite[] = [];
  private wallGraphics!: Phaser.GameObjects.Graphics;
  private entryPointSprites: Phaser.GameObjects.Image[] = [];
  private entryPointTiles: Set<string> = new Set();
  private playerEntity!: EntitySprite;
  private squadEntities: EntitySprite[] = [];
  private activeSquadIndex: number = 0;
  private selectionRing!: Phaser.GameObjects.Graphics;
  private pathDebugGraphics!: Phaser.GameObjects.Graphics;
  private trapSystem: TrapSystem | null = null;
  private turretAI: TurretAI | null = null;
  private bossAI: BossAI | null = null;
  private realtimeChannel: any = null;
  private hostileEntities: EntitySprite[] = [];
  private activeCustomPosters: Map<FurnitureSprite, { item: any; texKey: string; imgKey: string }> = new Map();
  public activeBossPedestals: Map<FurnitureSprite, { projection: Phaser.GameObjects.Sprite; settings: any; lastSpinTime: number; dir: number }> = new Map();
  public glitchIntensity: number = 0;
  private lastScanlineUpdateTime: number = 0;
  private guardAiTimer: Phaser.Time.TimerEvent | null = null;
  private simulatedDefenderTimer: Phaser.Time.TimerEvent | null = null;
  private squadCombatTimer: Phaser.Time.TimerEvent | null = null;

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
  private ambientOverlay!: Phaser.GameObjects.Graphics;
  private lightGlowOverlay!: Phaser.GameObjects.Graphics;
  private shadowGraphics!: Phaser.GameObjects.Graphics;

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
  private onChangeActiveUnit: ((index: number) => void) | null = null;
  private onExecuteAbility: ((payload: any) => void) | null = null;
  private onBossPhaseChanged: ((payload: any) => void) | null = null;
  private onBossSpawnMinions: ((payload: any) => void) | null = null;
  private onBossOverchargeTurrets: ((payload: any) => void) | null = null;
  private onBossLockdown: ((payload: any) => void) | null = null;
  private onTurretJammed: ((payload: any) => void) | null = null;

  constructor() {
    super({ key: 'RaidScene' });
    this.gridSystem = new GridSystem();
  }

  create() {
    this.hostileEntities = [];
    SoundManager.getInstance().playMusic('briefing_room');
    // Resolve the fixture from the raid store (SSR-hydrated by
    // RaidInitializer on the /raid/[id] page). Unknown ids fall back to the
    // default fixture so the scene always has something to render.
    const target = useRaidStore.getState().target;
    BootScene.regenerateEnemyTextures(this, target);
    this.gridSize = target?.gridSize ?? 10;
    this.gridSystem = new GridSystem(this.gridSize);

    const isBossTarget = isBossFixture(target?.id ?? '');
    const isStaticNpc = target?.id && (
      target.id === 'tier1-abandoned-apartment' || 
      target.id === 'tier1-storage-unit' || 
      target.id === 'tier1-corner-store'
    );

    if ((target?.isPvP || target?.placedItems) && !isBossTarget && !isStaticNpc) {
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
          type: item.type as any,
          customImageUrl: (item as any).customImageUrl,
          moderationStatus: (item as any).moderationStatus,
          moderationError: (item as any).moderationError,
        }))
      };
    } else {
      this.fixture = resolveFixture(target?.id ?? DEFAULT_FIXTURE_ID);
      console.log("[RaidScene] Initialized fixture:", this.fixture.id, "has boss def:", !!(this.fixture as any).boss, "fixture object:", this.fixture);
    }

    this.offsetX = this.scale.width / 2;
    this.offsetY = this.scale.height / 4;

    this.pathDebugGraphics = this.add.graphics().setDepth(1000);

    // ── Floor ──────────────────────────────────────────────────────────────
    const floorType = target?.cosmetics?.floorType || 'tile';
    const floorKey = `floor_${floorType}`;
    const stEvent = useRaidStore.getState().activeEvent;
    const isBlackout = stEvent?.eventType === 'sector_blackout';
    const blackoutTint = isBlackout ? 0x222233 : 0xffffff;

    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const screenPos = IsometricEngine.worldToScreen(x, y);
        const tile = this.add.image(screenPos.x + this.offsetX, screenPos.y + this.offsetY, floorKey);
        tile.setData('gridX', x);
        tile.setData('gridY', y);
        if (isBlackout) {
          tile.setTint(blackoutTint);
        }
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
      if (isBlackout) {
        sprite.setTint(0x444455);
      }
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
      if (isBlackout) {
        sprite.setTint(0x555566);
      }
      sprite.setInteractive();
      this.furnitureItems.push(sprite);
      
      // Dynamic custom poster rendering checks in PvP Raids / Replays
      this.applyCustomPosterTexture(sprite, item);
      
      // Holographic boss pedestal projection check
      this.applyHologramProjection(sprite, item);

      if (item.type !== 'trap') {
        this.gridSystem.setTileState(item.gridX, item.gridY, 'occupied');
      }
    }

    // ── Squad unit — spawn multiple squad members based on prep selection ──
    const prepMembers = useRaidStore.getState().prepSquadMembers || [];
    const isJointRaid = useRaidStore.getState().isJointRaid;
    const allyBonusHp = useRaidStore.getState().allyBonusHp;
    const allyBonusDamage = useRaidStore.getState().allyBonusDamage;

    const hpBonusPerMember = isJointRaid && prepMembers.length > 0 ? Math.round(allyBonusHp / prepMembers.length) : 0;
    const dmgBonusPerMember = isJointRaid && prepMembers.length > 0 ? Math.round(allyBonusDamage / prepMembers.length) : 0;

    this.squadEntities = [];
    this.activeSquadIndex = 0;

    if (prepMembers && prepMembers.length > 0) {
      // First let's map custom textures or keys. We can use default 'entity_drone' or dynamically resolved textures.
      prepMembers.forEach((member, index) => {
        const spawn = this.resolveSpawnForMember(member);
        const textureKey = this.textures.exists(`entity_drone_slot_${member.slotNumber}`)
          ? `entity_drone_slot_${member.slotNumber}`
          : 'entity_drone';
        const sprite = new EntitySprite(this, spawn.x, spawn.y, textureKey, {
          entityId: `member_${index}`,
          name: member.name,
          maxHp: Math.round(DEFAULT_SQUAD_HP * (usePlayerStore.getState().activeEffects.squadHpMult ?? 1.0)) + hpBonusPerMember,
          speed: 1.0 * (usePlayerStore.getState().activeEffects.squadSpeedMult ?? 1.0),
          activeAbility: member.activeAbility,
          passiveGear: member.passiveGear,
          weapon: member.weapon || null,
          armor: member.armor || null,
        });

        if (isJointRaid) {
          sprite.meleeDamage += dmgBonusPerMember;
          // Apply neon blue glow (tint)
          sprite.setTint(0x33ffff);
        }

        sprite.setInteractive();
        sprite.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
        this.squadEntities.push(sprite);
      });
    } else {
      // Fallback to single player entity
      const spawn = this.resolveSpawn(this.fixture);
      const textureKey = this.textures.exists('entity_drone_slot_1') ? 'entity_drone_slot_1' : 'entity_drone';
      const sprite = new EntitySprite(this, spawn.x, spawn.y, textureKey, {
        entityId: 'player',
        name: 'Vanguard',
        maxHp: DEFAULT_SQUAD_HP,
        speed: 1.0,
      });
      sprite.setInteractive();
      sprite.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
      this.squadEntities.push(sprite);
    }

    // playerEntity represents the active selected squad member
    this.playerEntity = this.squadEntities[this.activeSquadIndex];

    // Initialize selection ring
    this.selectionRing = this.add.graphics().setDepth(1.5);

    // Sync squad members in store with their instantiated HP/maxHp
    const updatedPrepMembers = this.squadEntities.map((s, idx) => {
      const existing = prepMembers[idx] || {};
      return {
        ...existing,
        name: s.name,
        hp: s.hp,
        maxHp: s.maxHp,
        activeAbility: s.activeAbility,
        passiveGear: s.passiveGear,
        weapon: s.weapon || null,
        armor: s.armor || null,
        entityId: s.entityId,
      };
    });
    useRaidStore.getState().setPrepSquadMembers(updatedPrepMembers);

    // Set legacy combined squad HP
    const totalHp = this.squadEntities.reduce((sum, s) => sum + s.hp, 0);
    const totalMaxHp = this.squadEntities.reduce((sum, s) => sum + s.maxHp, 0);
    useRaidStore.getState().setSquadHp(totalHp, totalMaxHp);

    // ── TrapSystem registration (task 3.0.8) ───────────────────────────────
    // Subscribes to `'entity-entered-tile'` events from EntitySprite. Each
    // trap in the fixture is registered with its canonical stats from
    // TRAP_STATS_BY_SPRITE_KEY (mirror of supabase/seed.sql).
    this.trapSystem = new TrapSystem(this.squadEntities);
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
    this.turretAI = new TurretAI(this.squadEntities);
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

    // ── Boss setup (task: Named NPC Raid Bosses) ───────────────────────────
    const isBoss = isBossFixture(this.fixture.id);
    if (isBoss) {
      const bossFixture = this.fixture as BossRoomFixture;
      const bDef = bossFixture.boss;

      // Update useRaidStore with boss details
      useRaidStore.getState().setBossRaidDetails({
        isBoss: true,
        name: bDef.name,
        title: bDef.title,
        hp: bDef.hp,
        maxHp: bDef.maxHp,
        phase: 1,
        totalPhases: bDef.phases.length,
        briefingText: bossFixture.briefing.pre,
      });

      // Spawn boss EntitySprite
      const bossSprite = new EntitySprite(this, bDef.spawnTile.x, bDef.spawnTile.y, bDef.spriteKey, {
        entityId: bDef.entityId,
        name: bDef.name,
        maxHp: bDef.maxHp,
        isBoss: true,
        isHostile: true,
      });
      bossSprite.setInteractive();
      bossSprite.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
      
      this.hostileEntities.push(bossSprite);
      
      // Instantiate BossAI
      this.bossAI = new BossAI(bDef, bossSprite, this.gridSystem);

      // Event listener bindings
      this.onBossPhaseChanged = (payload: { bossId: string; newPhase: number; totalPhases: number; event?: any }) => {
        useRaidStore.getState().setBossPhase(payload.newPhase, payload.totalPhases);
        
        const st = useRaidStore.getState();
        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        st.appendAction({
          t: elapsed,
          type: 'boss_phase_changed',
          data: payload
        });

        this.cameras.main.shake(300, 0.01);
        this.cameras.main.flash(400, 239, 68, 68, false); // red flash
        this.broadcastOperationalEvent(`[${elapsed}s] ⚠️ ALERT: ${bDef.name} entered Phase ${payload.newPhase}/${payload.totalPhases}!`);
      };
      EventBus.on('boss-phase-changed', this.onBossPhaseChanged);

      this.onBossSpawnMinions = (payload: { bossId: string; count: number; spriteKey: string; hp: number; damage: number }) => {
        const st = useRaidStore.getState();
        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        
        for (let i = 0; i < payload.count; i++) {
          const bx = bossSprite.currentGridX;
          const by = bossSprite.currentGridY;
          const offsets = [[0, -1], [0, 1], [-1, 0], [1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
          let spawn = { x: bx + 1, y: by + 1 };
          
          for (const [dx, dy] of offsets) {
            const tx = bx + dx;
            const ty = by + dy;
            if (this.gridSystem.isInBounds(tx, ty) && this.gridSystem.isTileWalkable(tx, ty)) {
              spawn = { x: tx, y: ty };
              break;
            }
          }
          
          const minion = new EntitySprite(this, spawn.x, spawn.y, payload.spriteKey, {
            entityId: `minion_${Date.now()}_${i}`,
            name: 'Guard Drone',
            maxHp: payload.hp,
            speed: 1.2,
            isHostile: true,
          });
          minion.setInteractive();
          minion.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
          minion.setTint(0xff8888);
          this.hostileEntities.push(minion);
          
          st.appendAction({
            t: elapsed,
            type: 'minion_spawned',
            data: { entityId: minion.entityId, gridX: spawn.x, gridY: spawn.y }
          });
        }
        
        this.broadcastOperationalEvent(`[${elapsed}s] ⚠️ ALERT: ${bDef.name} spawned Guard Drones!`);
      };
      EventBus.on('boss-spawn-minions', this.onBossSpawnMinions);

      this.onBossOverchargeTurrets = (_payload: { bossId: string; duration: number }) => {
        if (this.turretAI) {
          const deployedTurrets = (this.turretAI as any).turrets;
          if (deployedTurrets) {
            for (const turret of deployedTurrets.values()) {
              turret.stats.fire_rate = turret.stats.fire_rate * 0.5; // twice as fast
              this.playEmpVfx(turret.gridX, turret.gridY);
            }
          }
        }
        const st = useRaidStore.getState();
        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        this.broadcastOperationalEvent(`[${elapsed}s] ⚡ WARNING: All defensive turrets overcharged!`);
      };
      EventBus.on('boss-overcharge-turrets', this.onBossOverchargeTurrets);

      this.onBossLockdown = (payload: { bossId: string; duration: number }) => {
        this.squadEntities.forEach(s => {
          if (s.hp > 0) {
            this.applyEntityStun(s.entityId, payload.duration);
          }
        });
        const st = useRaidStore.getState();
        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        this.broadcastOperationalEvent(`[${elapsed}s] 🔒 WARNING: The Warden triggered lockdown! Squad is STUNNED!`);
      };
      EventBus.on('boss-lockdown', this.onBossLockdown);
    } else {
      // Clear boss state details
      useRaidStore.getState().setBossRaidDetails({
        isBoss: false,
        name: '',
        title: '',
        hp: 0,
        maxHp: 0,
        phase: 1,
        totalPhases: 1,
        briefingText: null,
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
      const memberIndex = this.squadEntities.findIndex(e => e.entityId === payload.entityId);
      if (memberIndex < 0) return;

      // Action log — record every tile the squad enters.
      const st = useRaidStore.getState();
      if (st.phase === 'active') {
        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        st.appendAction({ t: elapsed, type: 'move', data: { entityId: payload.entityId, gridX: payload.x, gridY: payload.y } });

        const entity = this.squadEntities[memberIndex];
        this.broadcastOperationalEvent(`[${elapsed}s] ${entity.name} advanced to sector tile (${payload.x}, ${payload.y})`);

        // Real-time broadcast to defender
        if (this.realtimeChannel) {
          this.realtimeChannel.send({
            type: 'broadcast',
            event: 'attacker-moved',
            payload: {
              memberIndex,
              x: payload.x,
              y: payload.y,
              hp: entity.hp,
              maxHp: entity.maxHp
            }
          });
        }
      }

      const s = this.fixture.stash;
      const anyOnStash = this.squadEntities.some(e => e.hp > 0 && e.currentGridX === s.x && e.currentGridY === s.y);
      if (anyOnStash) {
        this.startStashHold();
      } else if (this.stashHold) {
        this.cancelStashHold();
      }
    };
    EventBus.on('entity-entered-tile', this.onEntityEnteredTile);

    // change-active-unit listener from React portraits click
    this.onChangeActiveUnit = (index: number) => {
      this.selectSquadMember(index);
    };
    EventBus.on('change-active-unit', this.onChangeActiveUnit);

    // execute-ability listener from React ability triggers
    this.onExecuteAbility = (payload: { ability: string; targetId?: string; x?: number; y?: number }) => {
      this.handleExecuteAbility(payload);
    };
    EventBus.on('execute-ability', this.onExecuteAbility);

    // Centering the Camera & Dynamic Zoom Auto-Scaling (Task 9.0.24)
    const baseZoom = 10 / this.gridSize;
    this.cameras.main.setZoom(baseZoom);
    this.cameras.main.centerOn(this.offsetX, this.offsetY);
    this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);

    // ── Input — view-mode pathfinding identical to RoomScene ───────────────
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('wheel', this.handleWheel, this);

    // ── Replay or Countdown Timer ──
    SoundManager.getInstance().playMusic('combat_tension');
    useRaidStore.getState().beginActivePhase();

    // ── PvP Real-Time Channels & AI Systems ──
    const lobbyId = useRaidStore.getState().jointLobbyId;
    if (!this.isReplayMode) {
      if (lobbyId) {
        try {
          const supabaseClient = createClient();
          const channelName = `joint-raid-live:${lobbyId}`;
          this.realtimeChannel = supabaseClient.channel(channelName, {
            config: {
              broadcast: { self: true }
            }
          });
          this.realtimeChannel.subscribe();
        } catch (err) {
          console.error("[RaidScene] Failed to mount joint raid live channel:", err);
        }
      } else if (target?.isPvP && target?.id) {
        try {
          const supabaseClient = createClient();
          const channelName = `pvp-raid:${target.id}`;
          this.realtimeChannel = supabaseClient.channel(channelName, {
            config: {
              broadcast: { self: false }
            }
          });

          this.realtimeChannel.on('broadcast', { event: 'defender-action' }, (payload: any) => {
            const action = payload.payload;
            if (!action || !action.type) return;
            
            if (action.type === 'overcharge') {
              this.handleOvercharge(action.x, action.y);
            } else if (action.type === 'spawn-drone') {
              this.handleSpawnDrone(action.x, action.y);
            } else if (action.type === 'security-lock') {
              this.handleSecurityLock();
            }
          });

          this.realtimeChannel.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
              const currentMembers = useRaidStore.getState().prepSquadMembers || [];
              this.realtimeChannel.send({
                type: 'broadcast',
                event: 'breach-started',
                payload: {
                  squadMembers: currentMembers.map((m: any, idx: number) => ({
                    entityId: `member_${idx}`,
                    name: m.name,
                    hp: m.hp || DEFAULT_SQUAD_HP,
                    maxHp: m.maxHp || DEFAULT_SQUAD_HP
                  })),
                  targetId: target.id
                }
              });
            }
          });
        } catch (err) {
          console.error("[RaidScene] Failed to mount Supabase Realtime channel:", err);
        }
      } else {
        // Offline / Sandbox Mode: Spin up Simulated Defender AI agent triggering overrides every 15s
        this.simulatedDefenderTimer = this.time.addEvent({
          delay: 15000,
          loop: true,
          callback: () => this.tickSimulatedDefender(),
          callbackScope: this
        });
      }

      // Live Active Guard Patrol AI ticker (1.5 seconds delay)
      this.guardAiTimer = this.time.addEvent({
        delay: 1500,
        loop: true,
        callback: () => this.tickHostileGuardDrones(),
        callbackScope: this
      });

      // Live Squad Combat Ticker (1.0 second delay)
      this.squadCombatTimer = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => this.tickSquadCombat(),
        callbackScope: this
      });
    }

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
    // Mirror squad HP to the store so the HUD stays live.
    this.onEntityDamaged = (payload) => {
      // Check if boss was damaged
      const isBossRaid = isBossFixture(this.fixture.id);
      if (isBossRaid) {
        const bDef = (this.fixture as BossRoomFixture).boss;
        if (payload.entityId === bDef.entityId) {
          const bossSprite = this.hostileEntities.find(e => e.entityId === bDef.entityId);
          if (bossSprite) {
            bossSprite.hp = payload.hp;
            useRaidStore.getState().setBossHp(payload.hp);
            
            const st = useRaidStore.getState();
            const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
            st.appendAction({
              t: elapsed,
              type: 'boss_damaged',
              data: { bossId: payload.entityId, hp: payload.hp, maxHp: payload.maxHp, amount: payload.amount }
            });
            this.broadcastOperationalEvent(`[${elapsed}s] Boss ${bDef.name} took ${payload.amount} damage! (${payload.hp}/${payload.maxHp} HP)`);
          }
          return;
        }
      }

      const memberIndex = this.squadEntities.findIndex(e => e.entityId === payload.entityId);
      if (memberIndex >= 0) {
        const sprite = this.squadEntities[memberIndex];
        sprite.hp = payload.hp;

        // Update in store
        const st = useRaidStore.getState();
        const currentPrepMembers = st.prepSquadMembers ? [...st.prepSquadMembers] : [];
        if (currentPrepMembers[memberIndex]) {
          currentPrepMembers[memberIndex] = {
            ...currentPrepMembers[memberIndex],
            hp: payload.hp,
          };
          st.setPrepSquadMembers(currentPrepMembers);
        }

        // Recalculate combined HP
        const totalHp = this.squadEntities.reduce((sum, s) => sum + s.hp, 0);
        const totalMaxHp = this.squadEntities.reduce((sum, s) => sum + s.maxHp, 0);
        st.setSquadHp(totalHp, totalMaxHp);

        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        st.appendAction({
          t: elapsed,
          type: 'damage',
          data: { entityId: payload.entityId, hp: payload.hp, maxHp: payload.maxHp, amount: payload.amount },
        });

        this.broadcastOperationalEvent(`[${elapsed}s] WARNING: ${sprite.name} took ${payload.amount} damage! (${payload.hp}/${payload.maxHp} HP)`);

        // Real-time broadcast to defender on damage
        if (this.realtimeChannel) {
          this.realtimeChannel.send({
            type: 'broadcast',
            event: 'attacker-moved',
            payload: {
              memberIndex,
              x: sprite.currentGridX,
              y: sprite.currentGridY,
              hp: payload.hp,
              maxHp: payload.maxHp
            }
          });
        }
      }
    };
    this.onEntityKilled = (payload) => {
      // Check if boss was killed
      const isBossRaid = isBossFixture(this.fixture.id);
      if (isBossRaid) {
        const bDef = (this.fixture as BossRoomFixture).boss;
        if (payload.entityId === bDef.entityId) {
          useRaidStore.getState().setBossHp(0);
          
          const st = useRaidStore.getState();
          const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
          st.appendAction({
            t: elapsed,
            type: 'boss_defeated',
            data: { bossId: payload.entityId }
          });
          
          this.broadcastOperationalEvent(`[${elapsed}s] VICTORY: Boss ${bDef.name} was DEFEATED!`);
          
          const bossSprite = this.hostileEntities.find(e => e.entityId === bDef.entityId);
          if (bossSprite) {
            this.playExplosionVfx(bossSprite.currentGridX, bossSprite.currentGridY);
            bossSprite.destroy();
          }
          this.hostileEntities = this.hostileEntities.filter(e => e.entityId !== bDef.entityId);

          this.finishRaid('victory', 'Boss defeated');
          return;
        }
      }

      // Check if hostile drone was killed
      const hostileIndex = this.hostileEntities.findIndex(e => e.entityId === payload.entityId);
      if (hostileIndex >= 0) {
        const sprite = this.hostileEntities[hostileIndex];
        this.playExplosionVfx(sprite.currentGridX, sprite.currentGridY);
        sprite.destroy();
        this.hostileEntities.splice(hostileIndex, 1);
        const st = useRaidStore.getState();
        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        this.broadcastOperationalEvent(`[${elapsed}s] SECURE UPDATE: Hostile drone destroyed!`);
        return;
      }

      const memberIndex = this.squadEntities.findIndex(e => e.entityId === payload.entityId);
      if (memberIndex >= 0) {
        const sprite = this.squadEntities[memberIndex];
        sprite.hp = 0;

        // Update in store
        const st = useRaidStore.getState();
        const currentPrepMembers = st.prepSquadMembers ? [...st.prepSquadMembers] : [];
        if (currentPrepMembers[memberIndex]) {
          currentPrepMembers[memberIndex] = {
            ...currentPrepMembers[memberIndex],
            hp: 0,
          };
          st.setPrepSquadMembers(currentPrepMembers);
        }

        const elapsed = Math.max(0, st.durationSeconds - st.timeRemainingSeconds);
        this.broadcastOperationalEvent(`[${elapsed}s] CRITICAL: ${sprite.name} was ELIMINATED!`);

        // Check if all squad members are eliminated
        const anySquadAlive = this.squadEntities.some(s => s.hp > 0);
        if (!anySquadAlive) {
          st.setSquadHp(0);
          this.finishRaid('defeat', 'Squad eliminated');
        } else {
          // Re-calculate combined HP
          const totalHp = this.squadEntities.reduce((sum, s) => sum + s.hp, 0);
          const totalMaxHp = this.squadEntities.reduce((sum, s) => sum + s.maxHp, 0);
          st.setSquadHp(totalHp, totalMaxHp);

          // If the killed entity was the active one, auto-select another alive member!
          if (this.activeSquadIndex === memberIndex) {
            const nextAliveIndex = this.squadEntities.findIndex(s => s.hp > 0);
            if (nextAliveIndex >= 0) {
              this.selectSquadMember(nextAliveIndex);
            }
          }
        }

        st.appendAction({
          t: elapsed,
          type: 'entity_killed',
          data: { entityId: payload.entityId, maxHp: payload.maxHp },
        });
      }
    };
    // Defense destruction: remove the sprite + clear the tile so the
    // squad can walk through. Future 3.0.11 (barricade attack) drives
    // this via `applyDamageToPlaced` calls from the attacker's update.
    this.onDefenseDestroyed = (payload) => {
      this.triggerGlitchDecal(0.95);
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

      const defenseName = payload.spriteKey.replace('barricade_', '').replace('turret_', '').replace('_', ' ');
      this.broadcastOperationalEvent(`[${elapsed}s] SECURE BREAKTHROUGH: enemy ${defenseName} destroyed at (${payload.gridX}, ${payload.gridY})!`);
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

    // ── Turret jam visual feedback (Task 2) ──────────────────────────────
    this.onTurretJammed = (payload: { gridX: number; gridY: number }) => {
      const isBlackout = useRaidStore.getState().activeEvent?.eventType === 'sector_blackout';
      const screenPos = IsometricEngine.worldToScreen(payload.gridX, payload.gridY, this.currentRotation);
      const sparks = this.add.graphics().setDepth(payload.gridX + payload.gridY + 1.5);
      sparks.lineStyle(2, 0x00ffff, 1);
      for (let i = 0; i < 3; i++) {
        sparks.lineBetween(
          screenPos.x + this.offsetX + Phaser.Math.Between(-12, 12),
          screenPos.y + this.offsetY - 24 + Phaser.Math.Between(-8, 8),
          screenPos.x + this.offsetX + Phaser.Math.Between(-12, 12),
          screenPos.y + this.offsetY - 12 + Phaser.Math.Between(-8, 8)
        );
      }
      const turretSprite = this.furnitureItems.find(f => f.gridX === payload.gridX && f.gridY === payload.gridY);
      if (turretSprite) {
        turretSprite.setTint(0xff3333);
        this.time.delayedCall(120, () => {
          if (turretSprite) turretSprite.setTint(isBlackout ? 0x555566 : 0xffffff);
        });
      }
      this.time.delayedCall(180, () => sparks.destroy());
    };
    EventBus.on('turret-jammed', this.onTurretJammed);

    // Initialize ambient and light glow overlays
    this.shadowGraphics = this.add.graphics().setDepth(0.1);
    this.ambientOverlay = this.add.graphics().setDepth(900);
    this.lightGlowOverlay = this.add.graphics().setDepth(901);
    this.lightGlowOverlay.setBlendMode(Phaser.BlendModes.ADD);

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

  private resolveSpawnForEntryPoint(ep: any): { x: number; y: number } {
    if (!ep) return { x: 1, y: 1 };
    const max = this.gridSize - 1;
    switch (ep.wall) {
      case 'north': return { x: ep.position, y: 1 };
      case 'south': return { x: ep.position, y: max - 1 };
      case 'east':  return { x: max - 1,     y: ep.position };
      case 'west':  return { x: 1,           y: ep.position };
      default: return { x: 1, y: 1 };
    }
  }

  private resolveSpawnForMember(member: any): { x: number; y: number } {
    const ep = member.selectedEntryPoint ?? member.assignedEntryPoint ?? this.fixture?.entryPoints?.[0];
    const baseSpawn = this.resolveSpawnForEntryPoint(ep);
    
    // Find a nearby unoccupied walkable tile to avoid stacked overlaps at start
    const maxDist = 3;
    for (let r = 0; r <= maxDist; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          const tx = baseSpawn.x + dx;
          const ty = baseSpawn.y + dy;
          if (tx >= 1 && tx < this.gridSize - 1 && ty >= 1 && ty < this.gridSize - 1) {
            if (this.gridSystem.isTileWalkable(tx, ty)) {
              const occupied = this.squadEntities.some(e => e.currentGridX === tx && e.currentGridY === ty);
              if (!occupied) {
                return { x: tx, y: ty };
              }
            }
          }
        }
      }
    }
    return baseSpawn;
  }

  private selectSquadMember(index: number): void {
    if (index < 0 || index >= this.squadEntities.length) return;
    if (this.squadEntities[index].hp <= 0) return; // Ignore dead members
    
    this.activeSquadIndex = index;
    this.playerEntity = this.squadEntities[index];
    
    // Update store
    useRaidStore.getState().setActiveSquadIndex(index);
    
    // Update systems
    this.turretAI?.setTargets(this.squadEntities); // Keeps TurretAI synced to all squad members
    
    // Camera start follow
    this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);
    
    // Update debug path or cancel it
    this.pathDebugGraphics.clear();
  }

  private handleExecuteAbility(payload: { ability: string; targetId?: string; x?: number; y?: number }): void {
    const store = useRaidStore.getState();
    const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
    
    if (payload.ability === 'medkit') {
      const targetSprite = this.squadEntities.find(s => s.entityId === payload.targetId);
      if (targetSprite && targetSprite.hp > 0) {
        const prevHp = targetSprite.hp;
        heal(targetSprite, 40, targetSprite.entityId);
        
        // Custom visual effects in Phaser
        this.playHealVfx(targetSprite);
        
        // Update in store
        const memberIndex = this.squadEntities.indexOf(targetSprite);
        const currentPrepMembers = store.prepSquadMembers ? [...store.prepSquadMembers] : [];
        if (currentPrepMembers[memberIndex]) {
          currentPrepMembers[memberIndex] = {
            ...currentPrepMembers[memberIndex],
            hp: targetSprite.hp,
          };
          store.setPrepSquadMembers(currentPrepMembers);
        }
        
        // Recalculate legacy combined HP
        const totalHp = this.squadEntities.reduce((sum, s) => sum + s.hp, 0);
        const totalMaxHp = this.squadEntities.reduce((sum, s) => sum + s.maxHp, 0);
        store.setSquadHp(totalHp, totalMaxHp);
        
        store.appendAction({
          t: elapsed,
          type: 'ability_medkit',
          data: { targetId: payload.targetId, healedAmount: targetSprite.hp - prevHp }
        });
      }
    } else if (payload.ability === 'breaching_charge') {
      const { x, y } = payload;
      if (x !== undefined && y !== undefined) {
        const sprite = this.furnitureItems.find(f => f.gridX === x && f.gridY === y);
        if (sprite && sprite.hp !== null) {
          applyDamageToPlaced(sprite, 9999);
          this.playExplosionVfx(x, y);
          
          store.appendAction({
            t: elapsed,
            type: 'ability_breach',
            data: { gridX: x, gridY: y }
          });
        }
      }
    } else if (payload.ability === 'emp_grenade') {
      const { x, y } = payload;
      if (x !== undefined && y !== undefined) {
        let disabledCount = 0;
        if (this.turretAI) {
          const deployedTurrets = (this.turretAI as any).turrets;
          if (deployedTurrets) {
            for (const turret of deployedTurrets.values()) {
              const dx = Math.abs(turret.gridX - x);
              const dy = Math.abs(turret.gridY - y);
              if (Math.max(dx, dy) <= 1) {
                const currentTimeMs = this.time.now;
                turret.lastFiredAtMs = currentTimeMs + 6000;
                this.playEmpVfx(turret.gridX, turret.gridY);
                disabledCount++;
              }
            }
          }
        }
        
        store.appendAction({
          t: elapsed,
          type: 'ability_emp',
          data: { gridX: x, gridY: y, disabledCount }
        });
      }
    }
  }

  private playHealVfx(sprite: EntitySprite): void {
    SoundManager.getInstance().playSfx('heal');
    const startX = sprite.x;
    const startY = sprite.y - 16;
    
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 10 + Math.random() * 20;
      const targetX = startX + Math.cos(angle) * distance;
      const targetY = startY + Math.sin(angle) * distance - 25;
      
      const particle = this.add.graphics();
      particle.setDepth(sprite.depth + 1);
      particle.fillStyle(0x22c55e, 0.9);
      particle.fillCircle(startX, startY, 3);
      
      this.tweens.add({
        targets: particle,
        x: targetX - startX,
        y: targetY - startY,
        alpha: 0,
        scale: 0.5,
        duration: 800 + Math.random() * 400,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
  }

  private playExplosionVfx(gridX: number, gridY: number): void {
    SoundManager.getInstance().playSfx('breach');
    const screenPos = IsometricEngine.worldToScreen(gridX, gridY, this.currentRotation);
    const cx = screenPos.x + this.offsetX;
    const cy = screenPos.y + this.offsetY;
    
    const blast = this.add.graphics();
    blast.setDepth(100);
    blast.fillStyle(0xef4444, 0.8);
    blast.fillCircle(cx, cy, 5);
    
    this.tweens.add({
      targets: blast,
      scaleX: 8,
      scaleY: 8,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => blast.destroy()
    });
    
    this.cameras.main.shake(250, 0.015);
  }

  private playEmpVfx(gridX: number, gridY: number): void {
    SoundManager.getInstance().playSfx('stun');
    const screenPos = IsometricEngine.worldToScreen(gridX, gridY, this.currentRotation);
    const cx = screenPos.x + this.offsetX;
    const cy = screenPos.y + this.offsetY - 20;
    
    for (let i = 0; i < 6; i++) {
      const spark = this.add.graphics();
      spark.setDepth(100);
      spark.lineStyle(2, 0x06b6d4, 1.0);
      
      const angle = Math.random() * Math.PI * 2;
      const length = 15 + Math.random() * 15;
      
      spark.beginPath();
      spark.moveTo(cx, cy);
      spark.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
      spark.strokePath();
      
      this.tweens.add({
        targets: spark,
        alpha: 0,
        duration: 300 + Math.random() * 200,
        ease: 'Linear',
        onComplete: () => spark.destroy()
      });
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

    this.broadcastOperationalEvent(`[System] Operation finished: ${outcome.toUpperCase()} - ${reason}`);

    if (this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'raid-completed',
        payload: { outcome, reason }
      });

      if (store.isJointRaid) {
        this.realtimeChannel.send({
          type: 'broadcast',
          event: 'raid_completed',
          payload: { outcome, reason }
        });
      }
    }

    SoundManager.getInstance().stopMusic();
    SoundManager.getInstance().playSfx(outcome === 'victory' ? 'victory' : 'defeat');

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
    SoundManager.getInstance().stopMusic();
    this.stopTimer();

    if (this.guardAiTimer) {
      this.guardAiTimer.remove(false);
      this.guardAiTimer = null;
    }
    if (this.squadCombatTimer) {
      this.squadCombatTimer.remove(false);
      this.squadCombatTimer = null;
    }
    if (this.simulatedDefenderTimer) {
      this.simulatedDefenderTimer.remove(false);
      this.simulatedDefenderTimer = null;
    }
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
    this.hostileEntities.forEach(drone => {
      if (drone && drone.active) drone.destroy();
    });
    this.hostileEntities = [];

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
    if (this.bossAI) {
      this.bossAI.destroy();
      this.bossAI = null;
    }
    if (this.onBossPhaseChanged) {
      EventBus.off('boss-phase-changed', this.onBossPhaseChanged);
      this.onBossPhaseChanged = null;
    }
    if (this.onBossSpawnMinions) {
      EventBus.off('boss-spawn-minions', this.onBossSpawnMinions);
      this.onBossSpawnMinions = null;
    }
    if (this.onBossOverchargeTurrets) {
      EventBus.off('boss-overcharge-turrets', this.onBossOverchargeTurrets);
      this.onBossOverchargeTurrets = null;
    }
    if (this.onBossLockdown) {
      EventBus.off('boss-lockdown', this.onBossLockdown);
      this.onBossLockdown = null;
    }
    this.stopBarricadeAttack();
    this.clearStashHold();
    if (this.onEntityEnteredTile) {
      EventBus.off('entity-entered-tile', this.onEntityEnteredTile);
      this.onEntityEnteredTile = null;
    }
    if (this.onChangeActiveUnit) {
      EventBus.off('change-active-unit', this.onChangeActiveUnit);
      this.onChangeActiveUnit = null;
    }
    if (this.onExecuteAbility) {
      EventBus.off('execute-ability', this.onExecuteAbility);
      this.onExecuteAbility = null;
    }

    this.activeBossPedestals.forEach(info => {
      info.projection.destroy();
      this.stopHologramFlicker(info.projection);
    });
    this.activeBossPedestals.clear();

    if (this.onTurretJammed) {
      EventBus.off('turret-jammed', this.onTurretJammed);
      this.onTurretJammed = null;
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
    this.cullTiles();

    // Glitch intensity decay (approx 300ms fully back to 0)
    if (this.glitchIntensity > 0) {
      const deltaFactor = this.sys.game.loop.delta / 16.66;
      this.glitchIntensity -= 0.05 * deltaFactor;
      if (this.glitchIntensity < 0) this.glitchIntensity = 0;
    }

    // Throttled scanline scroll crawler (Updates at ~20 FPS/every 50ms)
    const currentTime = time || Date.now();
    if (this.activeCustomPosters.size > 0 && currentTime - this.lastScanlineUpdateTime > 50) {
      this.lastScanlineUpdateTime = currentTime;
      const scanlineOffset = currentTime / 100;
      
      this.activeCustomPosters.forEach((data, sprite) => {
        if (sprite.active && sprite.visible) {
          const settings = data.item.hologramSettings || data.item.hologram_settings;
          this.projectPosterImage(data.texKey, data.imgKey, settings, scanlineOffset);
        }
      });
    }

    // 3. Spinning boss projections
    if (this.activeBossPedestals.size > 0) {
      this.activeBossPedestals.forEach((info, pedestal) => {
        if (!pedestal.active) {
          info.projection.destroy();
          this.activeBossPedestals.delete(pedestal);
          return;
        }

        // Spin projection: cycle texture every 500ms
        const now = time || Date.now();
        if (now - info.lastSpinTime > 500) {
          info.dir = (info.dir + 1) % 4;
          const boss = info.settings.boss || 'boss-ironjaw';
          const bossKey = `hologram_${boss}`;
          const tex = `${bossKey}_dir_${info.dir}`;
          if (this.textures.exists(tex)) {
            info.projection.setTexture(tex);
          }
          info.lastSpinTime = now;
        }

        // Sync coordinate position and depth layer above pedestal
        const isBlackout = useRaidStore.getState().activeEvent?.eventType === 'sector_blackout';
        const activeGlitch = Math.max(this.glitchIntensity, isBlackout ? 0.25 : 0);

        const shiftX = activeGlitch > 0 ? (Math.random() - 0.5) * 8 * activeGlitch : 0;
        const scaleX = activeGlitch > 0 ? 1.0 + (Math.random() - 0.5) * 0.4 * activeGlitch : 1.0;
        const alphaDrop = activeGlitch > 0 && Math.random() < 0.1 * activeGlitch ? 0.35 : 1.0;

        info.projection.x = pedestal.x + shiftX;
        info.projection.scaleX = scaleX;
        info.projection.setAlpha(Math.max(0.1, 0.6 * (1.0 - activeGlitch * 0.5) * alphaDrop));

        info.projection.y = pedestal.y - 18;
        info.projection.setDepth(pedestal.depth + 1);

        // Viewport Culling check
        if (pedestal.visible !== info.projection.visible) {
          info.projection.setVisible(pedestal.visible);
        }
      });
    }

    this.updateLighting(time);
    this.updateShadows(time);

    if (useRaidStore.getState().phase !== 'active') return;
    this.turretAI?.tick(time);
    this.bossAI?.tick(time, this.squadEntities);

    // Draw pulsating selection ring under the active squad member
    if (this.playerEntity && this.playerEntity.active && this.playerEntity.hp > 0) {
      this.selectionRing.clear();
      
      const pulse = 1.0 + 0.15 * Math.sin(time / 150);
      const screenPos = IsometricEngine.worldToScreen(
        this.playerEntity.currentGridX,
        this.playerEntity.currentGridY,
        this.currentRotation,
        this.gridSize
      );
      
      this.selectionRing.lineStyle(2, 0x00ff00, 0.8);
      this.selectionRing.beginPath();
      
      const rx = 32 * pulse;
      const ry = 16 * pulse;
      const cx = screenPos.x + this.offsetX;
      const cy = screenPos.y + this.offsetY - 5;
      
      this.selectionRing.moveTo(cx, cy - ry);
      this.selectionRing.lineTo(cx + rx, cy);
      this.selectionRing.lineTo(cx, cy + ry);
      this.selectionRing.lineTo(cx - rx, cy);
      this.selectionRing.closePath();
      this.selectionRing.strokePath();
    } else {
      this.selectionRing.clear();
    }
  }

  /**
   * Apply a stun / immobilize to a specific squad member. Shared between
   * {@link handleTrapTriggered} and {@link handleTurretFired}: kill the
   * current tween chain so movement stops, push `stunnedUntilMs`
   * forward if it's the currently active squad member, and alpha-pulse the sprite.
   */
  private applyEntityStun(entityId: string, seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const sprite = this.squadEntities.find(s => s.entityId === entityId);
    if (!sprite) return;

    this.tweens.killTweensOf(sprite);
    
    const freezeUntil = Date.now() + seconds * 1000;
    (sprite as any).stunnedUntilMs = freezeUntil;
    
    if (sprite === this.playerEntity) {
      this.stunnedUntilMs = Math.max(this.stunnedUntilMs, freezeUntil);
    }

    this.tweens.add({
      targets: sprite,
      alpha: { from: 0.4, to: 1.0 },
      duration: 330,
      yoyo: true,
      repeat: Math.max(1, Math.ceil(seconds * 1.5)),
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (sprite && sprite.active) {
          sprite.setAlpha(1);
        }
      },
    });
  }

  /**
   * Handle a `'trap-triggered'` event emitted by {@link TrapSystem}.
   */
  private handleTrapTriggered(payload: TrapTriggeredPayload): void {
    const isSquadMember = this.squadEntities.some(s => s.entityId === payload.entityId);
    this.triggerGlitchDecal(0.85);

    if (payload.stunSeconds > 0 || payload.immobilizeSeconds > 0) {
      SoundManager.getInstance().playSfx('stun');
    } else {
      SoundManager.getInstance().playSfx('alarm');
    }

    // 1) Stun / immobilize — cancel the rest of the path + lock input.
    if (isSquadMember) {
      this.applyEntityStun(payload.entityId, payload.stunSeconds + payload.immobilizeSeconds);
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

    // 3) Camera shake
    this.cameras.main.shake(180, 0.005);

    // 4) Action log
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

    const trapName = payload.spriteKey.replace('trap_', '').replace('_', ' ');
    const memberName = this.squadEntities.find(s => s.entityId === payload.entityId)?.name || 'Squad member';
    this.broadcastOperationalEvent(`[${secondsElapsed}s] DANGER: ${memberName} triggered ${trapName} trap at (${payload.gridX}, ${payload.gridY})!`);
  }

  /**
   * Handle a `'turret-fired'` event emitted by {@link TurretAI}.
   */
  private handleTurretFired(payload: TurretFiredPayload): void {
    this.triggerGlitchDecal(0.40);
    const isSquadMember = this.squadEntities.some(s => s.entityId === payload.targetEntityId);

    SoundManager.getInstance().playSfx('laser');

    // 1) Projectile line VFX.
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
      turretScreen.y + this.offsetY - 20,
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
    if (isSquadMember && payload.stunSeconds > 0) {
      this.applyEntityStun(payload.targetEntityId, payload.stunSeconds);
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

    const turretName = payload.spriteKey.replace('turret_', '').replace('_', ' ');
    const targetName = this.squadEntities.find(s => s.entityId === payload.targetEntityId)?.name || 'Squad member';
    this.broadcastOperationalEvent(`[${secondsElapsed}s] WARNING: ${turretName} turret fired at ${targetName}!`);
  }

  private handleWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const currentZoom = this.cameras.main.zoom;
    const zoomFactor = deltaY > 0 ? 0.9 : 1.1;
    const baseZoom = 10 / this.gridSize;
    const minZoom = 0.5 * baseZoom;
    const maxZoom = 2.0;
    const newZoom = Phaser.Math.Clamp(currentZoom * zoomFactor, minZoom, maxZoom);
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

  private handlePointerDown(pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[] = []): void {
    if (this.isReplayMode) return;
    // Pathfinding is only meaningful while the raid is actively running —
    // prep and results phases are read-only.
    if (useRaidStore.getState().phase !== 'active') return;
    // Stun / immobilize from a trap freezes the squad until the
    // `stunnedUntilMs` deadline elapses. Ignore pointer clicks while
    // frozen so the player can't path out early.
    if (Date.now() < this.stunnedUntilMs) return;

    SoundManager.getInstance().playSfx('click');

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

    // 1) Click to select another squad member via gameObjects click detection first!
    if (gameObjects && gameObjects.length > 0) {
      const clickedMember = gameObjects.find(go => go instanceof EntitySprite && this.squadEntities.includes(go) && go.hp > 0) as EntitySprite | undefined;
      if (clickedMember) {
        const clickedMemberIndex = this.squadEntities.indexOf(clickedMember);
        if (clickedMemberIndex >= 0) {
          this.selectSquadMember(clickedMemberIndex);
          return;
        }
      }
    }

    // Check if in ability target selection mode
    const store = useRaidStore.getState();
    const abilityMode = store.activeAbilityMode;
    if (abilityMode) {
      if (abilityMode === 'breaching_charge') {
        const tileState = this.gridSystem.getTileState(worldCoords.x, worldCoords.y);
        if (tileState === 'occupied') {
          const sprite = this.furnitureItems.find(f => f.gridX === worldCoords.x && f.gridY === worldCoords.y);
          if (sprite && sprite.hp !== null) {
            this.handleExecuteAbility({ ability: 'breaching_charge', x: worldCoords.x, y: worldCoords.y });
            store.setActiveAbilityMode(null);
            return;
          }
        }
      } else if (abilityMode === 'emp_grenade') {
        this.handleExecuteAbility({ ability: 'emp_grenade', x: worldCoords.x, y: worldCoords.y });
        store.setActiveAbilityMode(null);
        return;
      }
      
      // Any click cancels ability selection
      store.setActiveAbilityMode(null);
      return;
    }

    // 2) Click to select another squad member via coordinates check if exact
    const clickedMemberIndex = this.squadEntities.findIndex(
      (s) => s.hp > 0 && s.currentGridX === worldCoords.x && s.currentGridY === worldCoords.y
    );
    if (clickedMemberIndex >= 0) {
      this.selectSquadMember(clickedMemberIndex);
      return;
    }

    let targetX = worldCoords.x;
    let targetY = worldCoords.y;

    let hostileAtTile = this.hostileEntities.find(h => h.hp > 0 && h.currentGridX === targetX && h.currentGridY === targetY);
    let furnitureAtTile = this.furnitureItems.find(f => f.occupies(targetX, targetY));

    if (gameObjects && gameObjects.length > 0) {
      // Prioritize clicking hostile EntitySprites (bosses, drones)
      const clickedHostile = gameObjects.find(go => go instanceof EntitySprite && this.hostileEntities.includes(go) && go.hp > 0) as EntitySprite | undefined;
      if (clickedHostile) {
        targetX = clickedHostile.currentGridX;
        targetY = clickedHostile.currentGridY;
        hostileAtTile = clickedHostile;
        furnitureAtTile = undefined;
      } else {
        // Next, check if they clicked on a FurnitureSprite
        const clickedFurniture = gameObjects.find(go => go instanceof FurnitureSprite) as FurnitureSprite | undefined;
        if (clickedFurniture) {
          targetX = clickedFurniture.gridX;
          targetY = clickedFurniture.gridY;
          furnitureAtTile = clickedFurniture;
          hostileAtTile = undefined;
        }
      }
    }

    const tileState = this.gridSystem.getTileState(targetX, targetY);
    if (!tileState) return;

    const isTrap = furnitureAtTile && furnitureAtTile.texture.key.startsWith('trap');
    const isTargetOccupied = tileState === 'occupied' || hostileAtTile !== undefined || (furnitureAtTile !== undefined && !isTrap);

    if (isTargetOccupied) {
      const path = this.gridSystem.findPathToAdjacent(
        this.playerEntity.currentGridX,
        this.playerEntity.currentGridY,
        targetX,
        targetY,
      );
      if (path) {
        this.drawDebugPath(path);
        
        // Start barricade/turret attack only if it is a destructible furniture item (hp !== null) and NOT a hostile entity
        const onComplete = hostileAtTile 
          ? undefined 
          : () => this.startBarricadeAttack(targetX, targetY);

        this.playerEntity.walkPath(
          path,
          this.offsetX,
          this.offsetY,
          this.currentRotation,
          onComplete,
        );
        this.cameras.main.startFollow(this.playerEntity, true, 0.05, 0.05);
      }
    } else {
      const path = this.gridSystem.findPath(
        this.playerEntity.currentGridX,
        this.playerEntity.currentGridY,
        targetX,
        targetY,
      );
      if (path && path.length > 0) {
        this.drawDebugPath(path);
        this.playerEntity.walkPath(path, this.offsetX, this.offsetY, this.currentRotation);
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

    const meleeDamage = this.playerEntity.meleeDamage;
    const result = applyDamageToPlaced(sprite, meleeDamage);
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
        damage: meleeDamage,
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

    // In a boss raid, we can't secure the stash while the boss is still alive!
    const isBossRaid = isBossFixture(this.fixture.id);
    const bossAlive = isBossRaid && this.hostileEntities.some(e => e.entityId === (this.fixture as BossRoomFixture).boss.entityId);
    if (bossAlive) return;

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
    const target = useRaidStore.getState().target;
    const wallColor = target?.cosmetics?.wallColor ?? WALL_COLOR;
    const wallHeight = 32;

    const colorFor = (wall: EntryPointWall, position: number): number => {
      const ep = this.fixture.entryPoints.find((e) => e.wall === wall && e.position === position);
      return ep ? ENTRY_WALL_COLORS[ep.type] : wallColor;
    };

    const segment = (
      wall: EntryPointWall,
      position: number,
      start: { x: number; y: number },
      end: { x: number; y: number },
    ): void => {
      const s = IsometricEngine.worldToScreen(start.x, start.y, this.currentRotation);
      const e = IsometricEngine.worldToScreen(end.x, end.y, this.currentRotation);
      
      const neonColor = colorFor(wall, position);
      const bx = this.offsetX;
      const by = this.offsetY;

      // 1. Draw volumetric semi-transparent holographic barrier panels
      this.wallGraphics.fillStyle(neonColor, 0.12);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + bx, s.y + by);
      this.wallGraphics.lineTo(e.x + bx, e.y + by);
      this.wallGraphics.lineTo(e.x + bx, e.y + by - wallHeight);
      this.wallGraphics.lineTo(s.x + bx, s.y + by - wallHeight);
      this.wallGraphics.closePath();
      this.wallGraphics.fillPath();

      // 2. Draw subtle horizontal scanlines inside the holographic panel
      this.wallGraphics.lineStyle(1.5, neonColor, 0.25);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + bx, s.y + by - wallHeight * 0.4);
      this.wallGraphics.lineTo(e.x + bx, e.y + by - wallHeight * 0.4);
      this.wallGraphics.moveTo(s.x + bx, s.y + by - wallHeight * 0.7);
      this.wallGraphics.lineTo(e.x + bx, e.y + by - wallHeight * 0.7);
      this.wallGraphics.strokePath();

      // 3. Draw vertical boundary support pillars
      this.wallGraphics.lineStyle(1.5, neonColor, 0.4);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + bx, s.y + by);
      this.wallGraphics.lineTo(s.x + bx, s.y + by - wallHeight);
      this.wallGraphics.strokePath();

      // 4. Draw high-opacity neon top-capping edge with glowing effect
      // Primary solid cap
      this.wallGraphics.lineStyle(2.5, neonColor, 0.85);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + bx, s.y + by - wallHeight);
      this.wallGraphics.lineTo(e.x + bx, e.y + by - wallHeight);
      this.wallGraphics.strokePath();

      // Secondary soft glow capping line
      this.wallGraphics.lineStyle(5.5, neonColor, 0.2);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + bx, s.y + by - wallHeight);
      this.wallGraphics.lineTo(e.x + bx, e.y + by - wallHeight);
      this.wallGraphics.strokePath();

      // 5. Draw a small glowing base trim line
      this.wallGraphics.lineStyle(1.5, neonColor, 0.4);
      this.wallGraphics.beginPath();
      this.wallGraphics.moveTo(s.x + bx, s.y + by);
      this.wallGraphics.lineTo(e.x + bx, e.y + by);
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

  private handleOvercharge(x: number, y: number): void {
    if (!this.turretAI) return;
    const turret = this.turretAI.getTurret(x, y);
    if (!turret) return;

    const store = useRaidStore.getState();
    const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
    store.appendAction({
      t: elapsed,
      type: 'defender_overcharge',
      data: { gridX: x, gridY: y }
    });

    const originalFireRate = turret.stats.fire_rate;
    const originalRange = turret.stats.range;

    turret.stats.fire_rate = originalFireRate / 2; // double speed!
    turret.stats.range = originalRange + 2;

    const sprite = turret.sprite;
    if (sprite && sprite.active) {
      sprite.setTint(0xff3333);
      this.tweens.add({
        targets: sprite,
        scaleX: { from: 1.0, to: 1.25 },
        scaleY: { from: 1.0, to: 1.25 },
        yoyo: true,
        repeat: 3,
        duration: 300,
        ease: 'Quad.easeInOut'
      });

      this.time.delayedCall(5000, () => {
        if (turret && turret.stats) {
          turret.stats.fire_rate = originalFireRate;
          turret.stats.range = originalRange;
        }
        if (sprite && sprite.active) {
          sprite.clearTint();
        }
      });
    }
  }

  private handleSpawnDrone(x: number, y: number): void {
    const store = useRaidStore.getState();
    const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
    store.appendAction({
      t: elapsed,
      type: 'defender_spawn_drone',
      data: { gridX: x, gridY: y }
    });

    const drone = new EntitySprite(this, x, y, 'entity_drone', {
      entityId: `hostile_drone_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: 'Sentinel Drone',
      maxHp: 50,
      speed: 0.8,
    });

    drone.setTint(0xff5555);
    drone.setInteractive();
    drone.updateIsometricPosition(this.currentRotation, this.offsetX, this.offsetY);
    
    drone.setScale(0);
    this.tweens.add({
      targets: drone,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    this.hostileEntities.push(drone);
    this.playEmpVfx(x, y);
  }

  private handleSecurityLock(): void {
    const store = useRaidStore.getState();
    const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
    store.appendAction({
      t: elapsed,
      type: 'defender_security_lock',
      data: {}
    });

    this.squadEntities.forEach(member => {
      if (member.hp > 0) {
        this.applyEntityStun(member.entityId, 3.0);
        this.playEmpVfx(member.currentGridX, member.currentGridY);
      }
    });

    this.cameras.main.shake(200, 0.01);
  }

  private tickHostileGuardDrones(): void {
    if (useRaidStore.getState().phase !== 'active') return;

    this.hostileEntities = this.hostileEntities.filter(drone => drone.active && drone.hp > 0);
    const aliveSquad = this.squadEntities.filter(s => s.active && s.hp > 0);
    if (aliveSquad.length === 0 || this.hostileEntities.length === 0) return;

    for (const drone of this.hostileEntities) {
      if (Date.now() < (drone as any).stunnedUntilMs) continue;

      let closestMember: EntitySprite | null = null;
      let minDistance = Infinity;

      for (const member of aliveSquad) {
        const dx = Math.abs(member.currentGridX - drone.currentGridX);
        const dy = Math.abs(member.currentGridY - drone.currentGridY);
        const dist = Math.max(dx, dy);
        if (dist < minDistance) {
          minDistance = dist;
          closestMember = member;
        }
      }

      if (!closestMember) continue;

      if (minDistance <= 1) {
        SoundManager.getInstance().playSfx('laser');
        applyDamage(closestMember, 15, closestMember.entityId);
        this.playEmpVfx(closestMember.currentGridX, closestMember.currentGridY);
        this.cameras.main.shake(100, 0.003);
      } else {
        const path = this.gridSystem.findPath(
          drone.currentGridX,
          drone.currentGridY,
          closestMember.currentGridX,
          closestMember.currentGridY
        );
        if (path && path.length > 1) {
          const step = path[1];
          drone.walkPath([step], this.offsetX, this.offsetY, this.currentRotation);
        } else {
          const adjPath = this.gridSystem.findPathToAdjacent(
            drone.currentGridX,
            drone.currentGridY,
            closestMember.currentGridX,
            closestMember.currentGridY
          );
          if (adjPath && adjPath.length > 1) {
            const step = adjPath[1];
            drone.walkPath([step], this.offsetX, this.offsetY, this.currentRotation);
          }
        }
      }
    }
  }

  private tickSquadCombat(): void {
    if (useRaidStore.getState().phase !== 'active') return;

    const aliveSquad = this.squadEntities.filter(s => s.active && s.hp > 0);
    if (aliveSquad.length === 0 || this.hostileEntities.length === 0) return;

    const isBossRaid = isBossFixture(this.fixture.id);
    const bDef = isBossRaid ? (this.fixture as BossRoomFixture).boss : null;

    for (const member of aliveSquad) {
      if (Date.now() < (member as any).stunnedUntilMs) continue;

      // 1. Prioritize attacking the boss if adjacent
      if (isBossRaid && bDef) {
        const bossSprite = this.hostileEntities.find(e => e.entityId === bDef.entityId && e.hp > 0);
        if (bossSprite) {
          const dx = Math.abs(member.currentGridX - bossSprite.currentGridX);
          const dy = Math.abs(member.currentGridY - bossSprite.currentGridY);
          const dist = Math.max(dx, dy); // Chebyshev distance

          if (dist <= 1) {
            // Melee attack the boss!
            const meleeDamage = member.meleeDamage;
            SoundManager.getInstance().playSfx('laser');
            
            const store = useRaidStore.getState();
            const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
            store.appendAction({
              t: elapsed,
              type: 'boss_attacked',
              data: { bossId: bossSprite.entityId, entityId: member.entityId }
            });

            applyDamage(bossSprite, meleeDamage, bossSprite.entityId);

            // Flashing animation for the boss
            this.tweens.add({
              targets: bossSprite,
              alpha: { from: 1.0, to: 0.5 },
              duration: 100,
              yoyo: true
            });

            this.broadcastOperationalEvent(`[${elapsed}s] Attack: Squad member ${member.name} dealt ${meleeDamage} damage to Boss!`);
            continue;
          }
        }
      }

      // 2. Otherwise attack adjacent drones
      const adjacentDrones = this.hostileEntities.filter(e => {
        if (e.hp <= 0 || e.entityId === bDef?.entityId) return false;
        const dx = Math.abs(member.currentGridX - e.currentGridX);
        const dy = Math.abs(member.currentGridY - e.currentGridY);
        return Math.max(dx, dy) <= 1;
      });

      if (adjacentDrones.length > 0) {
        // Attack the first adjacent drone
        const targetDrone = adjacentDrones[0];
        const meleeDamage = member.meleeDamage;
        SoundManager.getInstance().playSfx('laser');
        
        applyDamage(targetDrone, meleeDamage, targetDrone.entityId);

        this.tweens.add({
          targets: targetDrone,
          alpha: { from: 1.0, to: 0.5 },
          duration: 100,
          yoyo: true
        });

        const store = useRaidStore.getState();
        const elapsed = Math.max(0, store.durationSeconds - store.timeRemainingSeconds);
        this.broadcastOperationalEvent(`[${elapsed}s] Attack: Squad member ${member.name} dealt ${meleeDamage} damage to drone!`);
      }
    }
  }

  private tickSimulatedDefender(): void {
    if (useRaidStore.getState().phase !== 'active') return;

    const aliveSquad = this.squadEntities.filter(s => s.active && s.hp > 0);
    if (aliveSquad.length === 0) return;

    const randomMember = aliveSquad[Math.floor(Math.random() * aliveSquad.length)];
    const targetX = randomMember.currentGridX;
    const targetY = randomMember.currentGridY;

    const actionType = Math.floor(Math.random() * 3);

    if (actionType === 0 && this.turretAI && this.turretAI.registeredCount() > 0) {
      const turrets = Array.from((this.turretAI as any).turrets.values()) as any[];
      if (turrets.length > 0) {
        const randomTurret = turrets[Math.floor(Math.random() * turrets.length)];
        this.handleOvercharge(randomTurret.gridX, randomTurret.gridY);
      } else {
        this.handleSecurityLock();
      }
    } else if (actionType === 1) {
      let spawnTile = { x: targetX, y: targetY };
      let found = false;

      for (let r = 1; r <= 2; r++) {
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            const tx = targetX + dx;
            const ty = targetY + dy;
            if (tx >= 0 && tx < this.gridSize && ty >= 0 && ty < this.gridSize) {
              if (this.gridSystem.isTileWalkable(tx, ty)) {
                const occupied = this.squadEntities.some(e => e.currentGridX === tx && e.currentGridY === ty);
                if (!occupied) {
                  spawnTile = { x: tx, y: ty };
                  found = true;
                  break;
                }
              }
            }
          }
          if (found) break;
        }
        if (found) break;
      }

      this.handleSpawnDrone(spawnTile.x, spawnTile.y);
    } else {
      this.handleSecurityLock();
    }
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
          this.stopHologramFlicker(this.furnitureItems[idx]);
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

  private broadcastOperationalEvent(logText: string): void {
    const st = useRaidStore.getState();
    if (st.isJointRaid && this.realtimeChannel) {
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'raid_action_log',
        payload: { text: logText }
      });

      // Recalculate combined HP
      const totalHp = this.squadEntities.reduce((sum, s) => sum + s.hp, 0);
      const totalMaxHp = this.squadEntities.reduce((sum, s) => sum + s.maxHp, 0);
      
      this.realtimeChannel.send({
        type: 'broadcast',
        event: 'raid_stats_update',
        payload: { hp: totalHp, maxHp: totalMaxHp }
      });
    }
  }

  public applyCustomPosterTexture(sprite: FurnitureSprite, item: any, flickerDelay = 0) {
    if (!item || item.spriteKey !== 'furniture_custom_poster') return;

    const settings = item.hologramSettings || item.hologram_settings;

    if (item.moderationStatus === 'approved' && item.customImageUrl) {
      const texKey = `custom_poster_tex_${item.id}`;
      const imgKey = `custom_poster_img_${item.id}`;

      // Start/update the dynamic alpha flicker loop
      this.applyHologramFlicker(sprite, settings, flickerDelay);

      // Register for dynamic scrolling scanlines animation
      this.activeCustomPosters.set(sprite, { item, texKey, imgKey });

      // Fast-path: if source image is already loaded, redraw and refresh immediately
      if (this.textures.exists(imgKey)) {
        this.projectPosterImage(texKey, imgKey, settings);
        sprite.setTexture(texKey);
        return;
      }

      this.load.image(imgKey, item.customImageUrl);
      this.load.once(`filecomplete-image-${imgKey}`, () => {
        this.projectPosterImage(texKey, imgKey, settings);
        if (sprite.active) {
          sprite.setTexture(texKey);
        }
      });
      this.load.start();
    } else {
      this.activeCustomPosters.delete(sprite);
      this.stopHologramFlicker(sprite);
      if (item.moderationStatus === 'pending') {
        sprite.setTexture('furniture_custom_poster_pending');
      } else if (item.moderationStatus === 'rejected') {
        sprite.setTexture('furniture_custom_poster_rejected');
      } else {
        sprite.setTexture('furniture_custom_poster');
      }
    }
  }

  public applyHologramProjection(sprite: FurnitureSprite, item: any, flickerDelay = 0) {
    if (!item || item.spriteKey !== 'furniture_boss_pedestal') return;

    const settings = item.hologramSettings || item.hologram_settings || {
      color: '#06b6d4',
      flicker: 0.15,
      scanlines: 0.40,
      noise: 0.10,
      boss: 'boss-ironjaw'
    };

    const boss = settings.boss || 'boss-ironjaw';
    const color = settings.color || '#06b6d4';

    const existing = this.activeBossPedestals.get(sprite);
    if (existing) {
      existing.projection.destroy();
      this.stopHologramFlicker(existing.projection);
    }

    const bossKey = `hologram_${boss}`;
    const initialTexture = this.textures.exists(`${bossKey}_dir_0`) ? `${bossKey}_dir_0` : 'boss_ironjaw_dir_0';

    const projection = this.add.sprite(sprite.x, sprite.y - 18, initialTexture);
    projection.setOrigin(0.5, 1);
    projection.setAlpha(0.6);
    projection.setDepth(sprite.depth + 1);

    const tintColor = Phaser.Display.Color.HexStringToColor(color).color;
    projection.setTint(tintColor);

    this.applyHologramFlicker(projection, settings, flickerDelay);

    this.activeBossPedestals.set(sprite, {
      projection,
      settings,
      lastSpinTime: this.time ? this.time.now : Date.now(),
      dir: 0
    });
  }

  public triggerGlitchDecal(intensity: number) {
    this.glitchIntensity = Math.max(this.glitchIntensity, intensity);
  }

  private applyHologramFlicker(sprite: any, settings: any, flickerDelay = 0) {
    this.stopHologramFlicker(sprite);

    const hologram = settings || {
      color: '#06b6d4',
      flicker: 0.15,
      scanlines: 0.40,
      noise: 0.10
    };

    if (!hologram.flicker || hologram.flicker <= 0) {
      return;
    }

    const startTween = () => {
      if (!sprite.active) return;

      const duration = Math.max(50, 100 / hologram.flicker);
      const minAlpha = Math.max(0.6, 1.0 - hologram.flicker * 0.35);

      sprite.hologramFlickerTween = this.tweens.add({
        targets: sprite,
        alpha: minAlpha,
        duration: duration,
        yoyo: true,
        repeat: -1,
        ease: 'Power1',
        onUpdate: () => {
          // Micro-flickers for hardware instability aesthetics
          if (Math.random() < 0.02 * hologram.flicker) {
            sprite.alpha = minAlpha * 0.7;
          }
        }
      });
    };

    if (flickerDelay > 0) {
      sprite.hologramFlickerTimer = this.time.delayedCall(flickerDelay, startTween);
    } else {
      startTween();
    }
  }

  private stopHologramFlicker(sprite: any) {
    if (this.activeCustomPosters) {
      this.activeCustomPosters.delete(sprite);
    }
    if (sprite.hologramFlickerTween) {
      sprite.hologramFlickerTween.stop();
      sprite.hologramFlickerTween = null;
    }
    if (sprite.hologramFlickerTimer) {
      sprite.hologramFlickerTimer.remove();
      sprite.hologramFlickerTimer = null;
    }
    sprite.setAlpha(1);
  }

  private projectPosterImage(texKey: string, imgKey: string, settings: any, scanlineOffset = 0) {
    let canvasTexture: Phaser.Textures.CanvasTexture | null = null;
    if (this.textures.exists(texKey)) {
      canvasTexture = this.textures.get(texKey) as Phaser.Textures.CanvasTexture;
      if (canvasTexture && canvasTexture.context) {
        canvasTexture.context.clearRect(0, 0, 64, 64);
      }
    } else {
      canvasTexture = this.textures.createCanvas(texKey, 64, 64);
    }
    if (!canvasTexture) return;
    const ctx = canvasTexture.context;
    
    // Copy the base custom poster pre-rendered block onto our CanvasTexture
    const baseTexture = this.textures.get('furniture_custom_poster').getSourceImage() as HTMLCanvasElement;
    if (baseTexture) {
      ctx.drawImage(baseTexture, 0, 0);
    }

    const loadedImg = this.textures.get(imgKey).getSourceImage() as HTMLImageElement;
    if (!loadedImg) return;

    const hologram = settings || {
      color: '#06b6d4',
      flicker: 0.15,
      scanlines: 0.40,
      noise: 0.10
    };

    // Tiny offscreen processing canvas for dynamic color tints, scanlines, and noise grain
    const width = loadedImg.width || 32;
    const height = loadedImg.height || 32;
    
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const oCtx = offscreen.getContext('2d');
    
    if (oCtx) {
      // 1. Base image
      oCtx.drawImage(loadedImg, 0, 0, width, height);

      // 2. Color tint overlay (source-atop preserves transparent details)
      if (hologram.color) {
        oCtx.save();
        oCtx.globalCompositeOperation = 'source-atop';
        oCtx.fillStyle = hologram.color;
        oCtx.fillRect(0, 0, width, height);
        oCtx.restore();
      }

      // 3. Scanline pattern overlay with scrolling offset
      if (hologram.scanlines > 0) {
        oCtx.save();
        oCtx.globalCompositeOperation = 'source-atop';
        oCtx.strokeStyle = `rgba(0, 0, 0, ${hologram.scanlines})`;
        oCtx.lineWidth = 1;
        
        const offset = Math.floor(scanlineOffset) % 4;
        for (let y = -4 + offset; y < height; y += 2) {
          if (y >= 0) {
            oCtx.beginPath();
            oCtx.moveTo(0, y);
            oCtx.lineTo(width, y);
            oCtx.stroke();
          }
        }
        oCtx.restore();
      }

      // 4. Digital static grain overlay
      if (hologram.noise > 0) {
        oCtx.save();
        oCtx.globalCompositeOperation = 'source-atop';
        const imgData = oCtx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const noiseAmount = hologram.noise * 255;
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() < hologram.noise) {
            const randNoise = (Math.random() - 0.5) * noiseAmount;
            data[i] = Math.min(255, Math.max(0, data[i] + randNoise));
            data[i+1] = Math.min(255, Math.max(0, data[i+1] + randNoise));
            data[i+2] = Math.min(255, Math.max(0, data[i+2] + randNoise));
          }
        }
        oCtx.putImageData(imgData, 0, 0);
        oCtx.restore();
      }

      // 5. Dynamic horizontal pixel screen tearing / glitch decals
      const isBlackout = useRaidStore.getState().activeEvent?.eventType === 'sector_blackout';
      const activeGlitch = Math.max(this.glitchIntensity, isBlackout ? 0.25 : 0);
      if (activeGlitch > 0) {
        const numSlices = 5;
        const sliceHeight = height / numSlices;
        oCtx.save();
        const temp = document.createElement('canvas');
        temp.width = width;
        temp.height = height;
        const tCtx = temp.getContext('2d');
        if (tCtx) {
          tCtx.drawImage(offscreen, 0, 0);
          oCtx.clearRect(0, 0, width, height);
          for (let i = 0; i < numSlices; i++) {
            const sliceY = i * sliceHeight;
            const shift = (Math.random() - 0.5) * width * 0.3 * activeGlitch;
            oCtx.drawImage(temp, 0, sliceY, width, sliceHeight, shift, sliceY, width, sliceHeight);
          }
        }
        oCtx.restore();
      }
    }

    const sourceCanvas = oCtx ? offscreen : loadedImg;

    // Skew and project onto Left face (facing South-East, parallel NW wall)
    ctx.save();
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.drawImage(sourceCanvas, 7, 2, 18, 18);
    ctx.restore();

    // Skew and project onto Right face (facing South-West, parallel NE wall)
    ctx.save();
    ctx.transform(1, -0.5, 0, 1, 0, 0);
    ctx.drawImage(sourceCanvas, 39, 34, 18, 18);
    ctx.restore();

    canvasTexture.refresh();
  }

  private cullTiles(): void {
    const cam = this.cameras.main;
    if (
      cam.scrollX === this.lastCameraScrollX &&
      cam.scrollY === this.lastCameraScrollY &&
      cam.zoom === this.lastCameraZoom
    ) {
      return;
    }

    this.lastCameraScrollX = cam.scrollX;
    this.lastCameraScrollY = cam.scrollY;
    this.lastCameraZoom = cam.zoom;

    const bounds = cam.worldView;
    const padding = 128; // Padding prevents visual pop-in near borders

    for (const tile of this.floorTiles) {
      if (tile) {
        const visible = (
          tile.x >= bounds.x - padding &&
          tile.x <= bounds.x + bounds.width + padding &&
          tile.y >= bounds.y - padding &&
          tile.y <= bounds.y + bounds.height + padding
        );
        tile.setVisible(visible);
      }
    }

    for (const item of this.furnitureItems) {
      if (item) {
        const visible = (
          item.x >= bounds.x - padding &&
          item.x <= bounds.x + bounds.width + padding &&
          item.y >= bounds.y - padding &&
          item.y <= bounds.y + bounds.height + padding
        );
        item.setVisible(visible);
      }
    }
  }

  private updateLighting(time: number): void {
    if (!this.ambientOverlay || !this.lightGlowOverlay) return;

    this.ambientOverlay.clear();
    this.lightGlowOverlay.clear();

    const isBlackout = useRaidStore.getState().activeEvent?.eventType === 'sector_blackout';
    const activeGlitch = Math.max(this.glitchIntensity, isBlackout ? 0.25 : 0);

    const cam = this.cameras.main;
    const view = cam.worldView;

    // Draw the ambient darkness rectangle covering the current camera view
    const ambientAlpha = isBlackout ? 0.78 : 0.42;
    this.ambientOverlay.fillStyle(0x060913, ambientAlpha);
    this.ambientOverlay.fillRect(view.x - 200, view.y - 200, view.width + 400, view.height + 400);

    // List of active light sources to draw cutouts
    const lightSources: Array<{
      cx: number;
      cy: number;
      radius: number;
      angle: number;
      spread: number;
      color: number;
      alpha: number;
      type: 'flashlight' | 'searchlight' | 'pulsate';
    }> = [];

    // 1. Player squad flashlights
    this.squadEntities.forEach((entity) => {
      if (!entity.active || entity.hp <= 0) return;

      const cx = entity.x;
      const cy = entity.y - 28;

      let dir = 0;
      if (entity.texture && entity.texture.key) {
        const match = entity.texture.key.match(/_dir_(\d)/);
        if (match) {
          dir = parseInt(match[1]);
        }
      }

      const angle = dir * 0.5 * Math.PI + 0.25 * Math.PI;

      lightSources.push({
        cx,
        cy,
        radius: 110,
        angle,
        spread: 0.45,
        color: 0xe0f7fa,
        alpha: 0.12,
        type: 'flashlight',
      });
    });

    // 2. Hostile entities (drones and bosses)
    this.hostileEntities.forEach((entity) => {
      if (!entity.active || (entity as any).hp <= 0) return;

      const isBoss = entity.isBoss;
      const key = entity.texture.key;

      const cx = entity.x;
      const cy = isBoss ? entity.y - 35 : (key.includes('drone') ? entity.y - 16 : entity.y - 24);

      let dir = 0;
      const match = key.match(/_dir_(\d)/);
      if (match) {
        dir = parseInt(match[1]);
      }
      const baseAngle = dir * 0.5 * Math.PI + 0.25 * Math.PI;

      if (isBoss) {
        const bossId = entity.entityId;

        if (bossId === 'boss-ironjaw') {
          const sweep = Math.sin(time / 1000) * 0.4;
          lightSources.push({
            cx,
            cy,
            radius: 160,
            angle: baseAngle + sweep,
            spread: 0.60,
            color: 0xef4444,
            alpha: 0.15,
            type: 'searchlight',
          });
        } else if (bossId === 'boss-whisper') {
          lightSources.push({
            cx,
            cy,
            radius: 35 + 5 * Math.sin(time / 200),
            angle: 0,
            spread: Math.PI * 2,
            color: 0x22c55e,
            alpha: 0.10,
            type: 'pulsate',
          });
        } else if (bossId === 'boss-volkov') {
          const sweep = Math.sin(time / 1200) * 0.5;
          lightSources.push({
            cx,
            cy,
            radius: 200,
            angle: baseAngle + sweep,
            spread: 0.70,
            color: 0xf97316,
            alpha: 0.16,
            type: 'searchlight',
          });
        } else if (bossId === 'boss-circuit') {
          for (let i = 0; i < 4; i++) {
            const rotAngle = baseAngle + i * 0.5 * Math.PI + Math.sin(time / 600) * 0.2;
            lightSources.push({
              cx,
              cy,
              radius: 140,
              angle: rotAngle,
              spread: 0.18,
              color: 0x06b6d4,
              alpha: 0.14,
              type: 'searchlight',
            });
          }
        } else if (bossId === 'boss-warden') {
          const rotAngle = (time / 1500) * Math.PI * 2;
          lightSources.push({
            cx,
            cy,
            radius: 220,
            angle: rotAngle,
            spread: 0.50,
            color: 0xec4899,
            alpha: 0.18,
            type: 'searchlight',
          });
        }
      } else if (key.includes('drone') || entity.name?.toLowerCase().includes('drone')) {
        const cosmetics = (window as any).activeEnemyCosmetics?.guard_drone;
        const color = cosmetics?.searchlightColor || 0xef4444;
        const sweep = Math.sin(time / 800) * 0.5;

        lightSources.push({
          cx,
          cy,
          radius: 140,
          angle: baseAngle + sweep,
          spread: 0.80,
          color,
          alpha: 0.15,
          type: 'searchlight',
        });
      }
    });

    // A. CUT OUT LIGHT CHANNELS
    this.ambientOverlay.setBlendMode(Phaser.BlendModes.ERASE);

    lightSources.forEach((light) => {
      this.ambientOverlay.fillStyle(0xffffff, 1.0);
      if (light.spread >= Math.PI * 2) {
        this.ambientOverlay.fillCircle(light.cx, light.cy, light.radius);
      } else {
        this.ambientOverlay.beginPath();
        this.ambientOverlay.moveTo(light.cx, light.cy);
        this.ambientOverlay.slice(
          light.cx,
          light.cy,
          light.radius,
          light.angle - light.spread / 2,
          light.angle + light.spread / 2,
          false
        );
        this.ambientOverlay.closePath();
        this.ambientOverlay.fillPath();
      }

      this.ambientOverlay.fillCircle(light.cx, light.cy, 35);
    });

    this.ambientOverlay.setBlendMode(Phaser.BlendModes.NORMAL);

    // B. DRAW GLOWING VOLUMETRIC LIGHT CONES
    lightSources.forEach((light) => {
      const flickerFactor = activeGlitch > 0 && Math.random() < 0.15 * activeGlitch ? 0.4 : 1.0;
      const alpha = light.alpha * flickerFactor;

      this.lightGlowOverlay.fillStyle(light.color, alpha);
      if (light.spread >= Math.PI * 2) {
        this.lightGlowOverlay.fillCircle(light.cx, light.cy, light.radius);
      } else {
        this.lightGlowOverlay.beginPath();
        this.lightGlowOverlay.moveTo(light.cx, light.cy);
        this.lightGlowOverlay.slice(
          light.cx,
          light.cy,
          light.radius,
          light.angle - light.spread / 2,
          light.angle + light.spread / 2,
          false
        );
        this.lightGlowOverlay.closePath();
        this.lightGlowOverlay.fillPath();
      }

      if (light.spread < Math.PI * 2) {
        this.lightGlowOverlay.lineStyle(1.0, light.color, alpha * 2.2);
        this.lightGlowOverlay.beginPath();
        this.lightGlowOverlay.slice(
          light.cx,
          light.cy,
          light.radius,
          light.angle - light.spread / 2,
          light.angle + light.spread / 2,
          false
        );
        this.lightGlowOverlay.strokePath();
      }
    });
  }

  private updateShadows(time: number): void {
    if (!this.shadowGraphics) return;
    this.shadowGraphics.clear();

    const lights: Array<{ cx: number; cy: number; radius: number; Lz: number }> = [];

    // Player squad flashlights
    this.squadEntities.forEach((entity) => {
      if (!entity.active || entity.hp <= 0) return;
      lights.push({
        cx: entity.x,
        cy: entity.y - 28,
        radius: 110,
        Lz: 100
      });
    });

    // Hostile entities (drones and bosses)
    this.hostileEntities.forEach((entity) => {
      if (!entity.active || (entity as any).hp <= 0) return;
      const isBoss = entity.isBoss;
      const key = entity.texture.key;
      const cy = isBoss ? entity.y - 35 : (key.includes('drone') ? entity.y - 16 : entity.y - 24);
      lights.push({
        cx: entity.x,
        cy: cy,
        radius: 140,
        Lz: 80
      });
    });

    if (lights.length === 0) return;

    const HEIGHT_MAP: Record<string, number> = {
      'furniture_bed_twin': 16,
      'furniture_desk_wooden': 32,
      'furniture_chair_office': 32,
      'furniture_shelf_metal': 64,
      'furniture_dresser_wooden': 40,
      'furniture_tv_flatscreen': 24,
      'furniture_rug_area': 0,
      'furniture_lamp_floor': 48,
      'furniture_plant_potted': 32,
      'furniture_table_folding': 20,
      'furniture_custom_poster': 40,
      'furniture_custom_poster_pending': 40,
      'furniture_custom_poster_rejected': 40,
      'furniture_boss_pedestal': 32,
      'barricade_bookshelf': 56,
      'barricade_flipped_table': 24,
      'barricade_sandbags': 20,
      'turret_nailgun': 40,
      'turret_taser': 40,
      'turret_tesla': 56,
      'turret_autocannon': 64,
      'turret_shotgun': 44,
      'turret_autocannon_mk2': 64,
      'turret_power_node': 40,
      'entity_drone': 40,
      'guard_drone': 40,
      'guard_dog': 30,
      'guard_decoy': 32,
      'boss_ironjaw': 56,
      'boss_whisper': 48,
      'boss_volkov': 52,
      'boss_circuit': 48,
      'boss_warden': 60,
      'loot_stash': 14
    };

    const getObjectHeight = (textureKey: string): number => {
      let base = textureKey.replace(/_slot_\d/g, '');
      base = base.replace(/_dir_\d/g, '');
      return HEIGHT_MAP[base] ?? 0;
    };

    lights.forEach((light) => {
      this.furnitureItems.forEach((sprite) => {
        if (!sprite.active || !sprite.visible) return;
        const H = getObjectHeight(sprite.texture.key);
        if (H <= 0) return;

        if (sprite.texture.key.startsWith('trap_')) return;

        const corners = this.getFurnitureScreenCorners(sprite);
        this.drawShadowVolume(light, corners, H);
      });

      this.squadEntities.forEach((entity) => {
        if (!entity.active || !entity.visible || entity.hp <= 0) return;
        const H = getObjectHeight(entity.texture.key) || 40;
        const corners = this.getEntityScreenCorners(entity);
        this.drawShadowVolume(light, corners, H);
      });

      this.hostileEntities.forEach((entity) => {
        if (!entity.active || !entity.visible || (entity as any).hp <= 0) return;
        const H = getObjectHeight(entity.texture.key) || 40;
        const corners = this.getEntityScreenCorners(entity);
        this.drawShadowVolume(light, corners, H);
      });
    });
  }

  private getFurnitureScreenCorners(sprite: any): { x: number; y: number }[] {
    const rotation = this.currentRotation;
    const gridSize = this.gridSize || 10;
    const corners = [
      { gx: sprite.gridX, gy: sprite.gridY },
      { gx: sprite.gridX + sprite.footprintW, gy: sprite.gridY },
      { gx: sprite.gridX + sprite.footprintW, gy: sprite.gridY + sprite.footprintH },
      { gx: sprite.gridX, gy: sprite.gridY + sprite.footprintH }
    ];

    let shiftX = 0;
    let shiftY = 0;
    let rotX = sprite.gridX;
    let rotY = sprite.gridY;
    const MAX = gridSize - 1;

    switch (rotation % 4) {
      case 1:
        rotX = MAX - sprite.gridY;
        rotY = sprite.gridX;
        break;
      case 2:
        rotX = MAX - sprite.gridX;
        rotY = MAX - sprite.gridY;
        break;
      case 3:
        rotX = sprite.gridY;
        rotY = MAX - sprite.gridX;
        break;
      default:
        break;
    }

    if (rotY === 0) {
      shiftX += 2;
      shiftY += 4;
    }
    if (rotX === 0) {
      shiftX -= 2;
      shiftY += 4;
    }

    return corners.map(c => {
      const pos = IsometricEngine.worldToScreen(c.gx, c.gy, rotation, gridSize);
      return {
        x: pos.x + this.offsetX + shiftX,
        y: pos.y + this.offsetY + shiftY
      };
    });
  }

  private getEntityScreenCorners(entity: any): { x: number; y: number }[] {
    return [
      { x: entity.x, y: entity.y - 32 },
      { x: entity.x + 32, y: entity.y - 16 },
      { x: entity.x, y: entity.y },
      { x: entity.x - 32, y: entity.y - 16 }
    ];
  }

  private drawShadowVolume(
    light: { cx: number; cy: number; radius: number; Lz: number },
    corners: { x: number; y: number }[],
    H: number
  ): void {
    const SL_x = light.cx;
    const SL_y = light.cy;
    const Lz = light.Lz;

    const projectedCorners: { x: number; y: number }[] = [];

    for (let i = 0; i < 4; i++) {
      const Bi = corners[i];
      const dx = Bi.x - SL_x;
      const dy = Bi.y - SL_y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 5) return;

      if (dist > light.radius * 1.5) return;

      const clampLz = Math.max(Lz, H + 20);
      const scale = clampLz / (clampLz - H);
      projectedCorners.push({
        x: SL_x + dx * scale,
        y: SL_y + dy * scale
      });
    }

    this.shadowGraphics.fillStyle(0x000000, 0.18);
    
    // Draw top face shadow
    this.shadowGraphics.beginPath();
    this.shadowGraphics.moveTo(projectedCorners[0].x, projectedCorners[0].y);
    for (let i = 1; i < projectedCorners.length; i++) {
      this.shadowGraphics.lineTo(projectedCorners[i].x, projectedCorners[i].y);
    }
    this.shadowGraphics.closePath();
    this.shadowGraphics.fillPath();

    // Draw side wall shadows
    for (let i = 0; i < 4; i++) {
      const nextIdx = (i + 1) % 4;
      const Bi = corners[i];
      const Bnext = corners[nextIdx];
      const Si = projectedCorners[i];
      const Snext = projectedCorners[nextIdx];

      this.shadowGraphics.beginPath();
      this.shadowGraphics.moveTo(Bi.x, Bi.y);
      this.shadowGraphics.lineTo(Bnext.x, Bnext.y);
      this.shadowGraphics.lineTo(Snext.x, Snext.y);
      this.shadowGraphics.lineTo(Si.x, Si.y);
      this.shadowGraphics.closePath();
      this.shadowGraphics.fillPath();
    }
  }
}
