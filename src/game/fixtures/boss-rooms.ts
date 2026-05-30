import type { NpcRoomFixture } from './npc-rooms';

export interface BossPhaseEvent {
  type: 'spawn_minions' | 'area_denial' | 'overcharge_turrets' 
      | 'heal_self' | 'enrage' | 'lockdown';
  params: Record<string, number>;
}

export interface BossPhase {
  hpThreshold: number;           // Phase starts when HP drops below this % (e.g. 0.6 = 60%)
  speedMultiplier: number;       // 1.0 = normal, 1.5 = 50% faster
  damageMultiplier: number;
  attackRateMultiplier: number;  // Lower = faster attacks (e.g. 0.8 = 20% faster fire rate)
  onEnter?: BossPhaseEvent;      // Triggered when phase begins
}

export interface BossAbility {
  id: string;
  cooldownSeconds: number;
  range: number;
  damage?: number;
  stunSeconds?: number;
  description: string;           // For action log
}

export interface BossDefinition {
  entityId: string;              // e.g. 'boss-ironjaw'
  name: string;                  // Display name: "Ironjaw"
  title: string;                 // "The Scrapyard King"
  spriteKey: string;             // BootScene texture key e.g. 'boss_ironjaw'
  hp: number;                    // Total HP
  maxHp: number;
  speed: number;                 // Tiles per second movement (0 for stationary)
  damage: number;                // Melee/ranged damage per hit
  attackRate: number;            // Seconds between attacks
  attackRange: number;           // Attack range
  phases: BossPhase[];           // Phase transitions
  abilities: BossAbility[];      // Special abilities
  spawnTile: { x: number; y: number };
  patrolPath?: { x: number; y: number }[];  // Optional patrol route
}

export interface BossRoomFixture extends NpcRoomFixture {
  boss: BossDefinition;
  act: number;                   // Story act (1, 2, or 3)
  storyQuestId: string;          // Links to quest chain e.g. 'story-02'
  briefing: {                    // Dialog briefings shown in UI
    pre: string;                 // Shown before raid
    victory: string;             // Shown on win
    defeat: string;              // Shown on loss
  };
  cooldownHours: number;         // Boss-specific cooldown (default 24)
  firstClearRewards: {           // Guaranteed on first victory
    uniqueItemSpriteKey?: string;
    scrap: number;
    components: number;
    credits: number;
    contraband: number;
    xp: number;
  };
}

// ----------------------------------------------------
// 1. BOSS 1: IRONJAW (The Scrapyard King)
// Act I, Level 3, 10x10 grid, 1 Phase, Stationary
// ----------------------------------------------------
const BOSS_IRONJAW: BossRoomFixture = {
  id: 'boss-ironjaw',
  name: 'Ironjaw',
  description: 'Act I Boss: A brutal scrapyard lord guarded by heavy barricades and a maze of traps.',
  difficulty: 'easy',
  requiredLevel: 3,
  gridSize: 10,
  stash: { x: 8, y: 8 },
  entryPoints: [{ wall: 'north', type: 'door', position: 5 }],
  cooldownHours: 24,
  act: 1,
  storyQuestId: 'story-02',
  briefing: {
    pre: '“Think you can just waltz into my scrapyard and plunder my treasures? I built this throne from the bones of trespassers. Come and try, rat!”',
    victory: '“You... you broke my scrap palace... and crushed my jaw... Arggh...”',
    defeat: '“Ha! Another heap of junk for my collection. Throw them in the crusher!”'
  },
  firstClearRewards: {
    uniqueItemSpriteKey: 'trap_bear_trap',
    scrap: 500,
    components: 30,
    credits: 100,
    contraband: 0,
    xp: 250
  },
  boss: {
    entityId: 'boss-ironjaw',
    name: 'Ironjaw',
    title: 'The Scrapyard King',
    spriteKey: 'boss_ironjaw',
    hp: 400,
    maxHp: 400,
    speed: 0, // Stationary boss
    damage: 18,
    attackRate: 1.5,
    attackRange: 3,
    phases: [
      { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 }
    ],
    abilities: [
      { id: 'scrap-toss', cooldownSeconds: 8, range: 4, damage: 10, stunSeconds: 1.5, description: 'Ironjaw throws heavy scrap debris at the squad!' }
    ],
    spawnTile: { x: 8, y: 7 }
  },
  items: [
    // Heavy barricades forming a funnel
    { spriteKey: 'barricade_sandbags',      gridX: 4, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_sandbags',      gridX: 6, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_bookshelf',     gridX: 2, gridY: 4, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_bookshelf',     gridX: 6, gridY: 4, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' },
    // Traps scattered in the choke points
    { spriteKey: 'trap_spike_strip',        gridX: 5, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_pressure_plate',     gridX: 5, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_glue',               gridX: 4, gridY: 6, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_glue',               gridX: 6, gridY: 6, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    // A single supporting turret
    { spriteKey: 'turret_nailgun',          gridX: 9, gridY: 9, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' }
  ]
};

// ----------------------------------------------------
// 2. BOSS 2: WHISPER (The Wire Ghost)
// Act I, Level 5, 10x10 grid, 1 Phase, Stationary
// ----------------------------------------------------
const BOSS_WHISPER: BossRoomFixture = {
  id: 'boss-whisper',
  name: 'Whisper',
  description: 'Act I Boss: A spectral wire-hacker surrounded by alarm systems and shocking tripwires.',
  difficulty: 'easy',
  requiredLevel: 5,
  gridSize: 10,
  stash: { x: 1, y: 1 },
  entryPoints: [{ wall: 'south', type: 'door', position: 5 }],
  cooldownHours: 24,
  act: 1,
  storyQuestId: 'story-04',
  briefing: {
    pre: '“Shh... can you hear it? The silent hum of the network. You are just noise in my perfect frequency. I will erase you from the grid.”',
    victory: '“Signal... lost... Connection... terminated...”',
    defeat: '“Flatlined. The grid absorbs another digital ghost.”'
  },
  firstClearRewards: {
    uniqueItemSpriteKey: 'trap_ghost_wire',
    scrap: 600,
    components: 45,
    credits: 150,
    contraband: 0,
    xp: 350
  },
  boss: {
    entityId: 'boss-whisper',
    name: 'Whisper',
    title: 'The Wire Ghost',
    spriteKey: 'boss_whisper',
    hp: 450,
    maxHp: 450,
    speed: 0,
    damage: 15,
    attackRate: 1.0,
    attackRange: 5, // Ranged hacking attack
    phases: [
      { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 }
    ],
    abilities: [
      { id: 'system-shock', cooldownSeconds: 6, range: 6, damage: 12, stunSeconds: 2.0, description: 'Whisper hacks squad loadouts, releasing a high voltage system shock!' }
    ],
    spawnTile: { x: 1, y: 2 }
  },
  items: [
    // Invisible tripwires and alarm systems
    { spriteKey: 'trap_tripwire_alarm',     gridX: 5, gridY: 8, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_tripwire_alarm',     gridX: 4, gridY: 6, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_tripwire_alarm',     gridX: 6, gridY: 6, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_shock_pad',          gridX: 5, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_shock_pad',          gridX: 3, gridY: 4, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_shock_pad',          gridX: 7, gridY: 4, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    // Taser turrets flanking
    { spriteKey: 'turret_taser',            gridX: 0, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_taser',            gridX: 9, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    // Decor shelves acting as cover
    { spriteKey: 'furniture_shelf_metal',   gridX: 2, gridY: 2, footprintW: 1, footprintH: 2, rotation: 0, type: 'furniture' },
    { spriteKey: 'furniture_shelf_metal',   gridX: 7, gridY: 2, footprintW: 1, footprintH: 2, rotation: 0, type: 'furniture' }
  ]
};

// ----------------------------------------------------
// 3. BOSS 3: VOLKOV (The Iron Colonel)
// Act II, Level 7, 12x12 grid, 2 Phases, Mobile
// ----------------------------------------------------
const BOSS_VOLKOV: BossRoomFixture = {
  id: 'boss-volkov',
  name: 'Volkov',
  description: 'Act II Boss: A battle-hardened military remnant colonel. Spawns attack drones in Phase 2.',
  difficulty: 'medium',
  requiredLevel: 7,
  gridSize: 12,
  stash: { x: 10, y: 10 },
  entryPoints: [
    { wall: 'north', type: 'door', position: 6 },
    { wall: 'west', type: 'window', position: 8 }
  ],
  cooldownHours: 24,
  act: 2,
  storyQuestId: 'story-05',
  briefing: {
    pre: '“You think your ragtag cell has what it takes to disrupt my supply lines? This is a professional army. You are outclassed, outgunned, and standing on my firing range.”',
    victory: '“A tactical defeat... falls back... Retreat to position Bravo...”',
    defeat: '“Operational objective secured. Threat neutralized with zero military casualties.”'
  },
  firstClearRewards: {
    uniqueItemSpriteKey: 'turret_autocannon_mk2',
    scrap: 800,
    components: 60,
    credits: 200,
    contraband: 5,
    xp: 500
  },
  boss: {
    entityId: 'boss-volkov',
    name: 'Volkov',
    title: 'The Iron Colonel',
    spriteKey: 'boss_volkov',
    hp: 700,
    maxHp: 700,
    speed: 0.8, // Mobile boss!
    damage: 22,
    attackRate: 1.2,
    attackRange: 4, // Ranged assault rifle
    phases: [
      { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 },
      // Phase 2 triggers at 50% HP: spawns minion drones, gains attack rate boost
      { 
        hpThreshold: 0.5, 
        speedMultiplier: 1.2, 
        damageMultiplier: 1.1, 
        attackRateMultiplier: 0.8,
        onEnter: {
          type: 'spawn_minions',
          params: { count: 2 } // Spawns 2 drones
        }
      }
    ],
    abilities: [
      { id: 'frag-grenade', cooldownSeconds: 10, range: 5, damage: 25, description: 'Volkov launches a tactical frag grenade!' }
    ],
    spawnTile: { x: 10, y: 8 },
    patrolPath: [
      { x: 10, y: 8 },
      { x: 8, y: 10 },
      { x: 6, y: 8 },
      { x: 8, y: 6 }
    ]
  },
  items: [
    // Military sandbags barricading the stash
    { spriteKey: 'barricade_sandbags',      gridX: 9, gridY: 10, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_sandbags',      gridX: 10, gridY: 9, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_sandbags',      gridX: 8, gridY: 8, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    // Spike strips and alarms
    { spriteKey: 'trap_spike_strip',        gridX: 6, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_spike_strip',        gridX: 2, gridY: 7, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_tripwire_alarm',     gridX: 6, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    // Gated defenses
    { spriteKey: 'turret_nailgun',          gridX: 11, gridY: 11, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_taser',            gridX: 11, gridY: 0, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_taser',            gridX: 0, gridY: 11, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' }
  ]
};

// ----------------------------------------------------
// 4. BOSS 4: CIRCUIT (The Machine Mind)
// Act II, Level 10, 12x12 grid, 2 Phases, Mobile
// ----------------------------------------------------
const BOSS_CIRCUIT: BossRoomFixture = {
  id: 'boss-circuit',
  name: 'Circuit',
  description: 'Act II Boss: A self-sustaining defense AI that controls eastern power. Overcharges turrets in Phase 2.',
  difficulty: 'medium',
  requiredLevel: 10,
  gridSize: 12,
  stash: { x: 6, y: 6 },
  entryPoints: [
    { wall: 'south', type: 'door', position: 6 },
    { wall: 'east', type: 'vent', position: 5 }
  ],
  cooldownHours: 24,
  act: 2,
  storyQuestId: 'story-06',
  briefing: {
    pre: '“Biological life detected. Intruders are classified as system bugs. Commencing cleanup protocols. Resistance is highly inefficient.”',
    victory: '“Critical system error... Core temperature critical... Initiating safety dump... Ejecting...”',
    defeat: '“Bugs successfully quarantined and incinerated. System operating at 100% capacity.”'
  },
  firstClearRewards: {
    uniqueItemSpriteKey: 'trap_circuit_emp_mine',
    scrap: 1000,
    components: 80,
    credits: 300,
    contraband: 8,
    xp: 700
  },
  boss: {
    entityId: 'boss-circuit',
    name: 'Circuit',
    title: 'The Machine Mind',
    spriteKey: 'boss_circuit',
    hp: 850,
    maxHp: 850,
    speed: 0.9,
    damage: 20,
    attackRate: 0.8,
    attackRange: 6, // Electrical ranged attacks
    phases: [
      { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 },
      // Phase 2 triggers at 40% HP: overcharges all turrets (+30% fire rate)
      { 
        hpThreshold: 0.4, 
        speedMultiplier: 1.3, 
        damageMultiplier: 1.2, 
        attackRateMultiplier: 0.75,
        onEnter: {
          type: 'overcharge_turrets',
          params: { duration: 15 } // Boosts turrets
        }
      }
    ],
    abilities: [
      { id: 'emp-pulse', cooldownSeconds: 12, range: 4, damage: 5, stunSeconds: 3.0, description: 'Circuit discharges an EMP shockwave, disabling squad members!' }
    ],
    spawnTile: { x: 6, y: 3 },
    patrolPath: [
      { x: 6, y: 3 },
      { x: 3, y: 6 },
      { x: 6, y: 9 },
      { x: 9, y: 6 }
    ]
  },
  items: [
    // Double taser setup and trap coils guarding the central stash
    { spriteKey: 'turret_taser',            gridX: 5, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_taser',            gridX: 7, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_nailgun',          gridX: 5, gridY: 7, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_nailgun',          gridX: 7, gridY: 7, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    // Electrified shock pads
    { spriteKey: 'trap_shock_pad',          gridX: 6, gridY: 1, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_shock_pad',          gridX: 1, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_shock_pad',          gridX: 10, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    // Barricades surrounding
    { spriteKey: 'barricade_flipped_table', gridX: 3, gridY: 3, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_flipped_table', gridX: 7, gridY: 3, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_bookshelf',     gridX: 3, gridY: 8, footprintW: 2, footprintH: 1, rotation: 0, type: 'barricade' }
  ]
};

// ----------------------------------------------------
// 5. BOSS 5: THE WARDEN (Voice of The Fracture)
// Act III, Level 15, 14x14 grid, 3 Phases, Mobile
// ----------------------------------------------------
const BOSS_WARDEN: BossRoomFixture = {
  id: 'boss-warden',
  name: 'The Warden',
  description: 'Capstone Story Boss: The ultimate architect of The Fracture. Multi-phase nightmare encounter.',
  difficulty: 'hard',
  requiredLevel: 15,
  gridSize: 14,
  stash: { x: 7, y: 7 },
  entryPoints: [
    { wall: 'north', type: 'door', position: 7 },
    { wall: 'south', type: 'door', position: 7 },
    { wall: 'east', type: 'window', position: 7 },
    { wall: 'west', type: 'vent', position: 7 }
  ],
  cooldownHours: 24,
  act: 3,
  storyQuestId: 'story-07',
  briefing: {
    pre: '“I have watched you crawl from the dust, little raider. I created this Fracture to filter the weak from the strong. Let us see if you are a true survivor, or just another glitch to be deleted.”',
    victory: '“Unbelievable... The Fracture... collapses... But you... will burn with it... It is... done...”',
    defeat: '“Another failed experiment. Recalibrating the Fracture coefficients. Reset the chamber.”'
  },
  firstClearRewards: {
    uniqueItemSpriteKey: 'cosmetic_warden_key',
    scrap: 2000,
    components: 150,
    credits: 500,
    contraband: 15,
    xp: 1500
  },
  boss: {
    entityId: 'boss-warden',
    name: 'The Warden',
    title: 'Voice of The Fracture',
    spriteKey: 'boss_warden',
    hp: 1500,
    maxHp: 1500,
    speed: 1.0,
    damage: 30,
    attackRate: 0.9,
    attackRange: 5,
    phases: [
      // Phase 1 (100% - 70%): Normal state
      { hpThreshold: 1.0, speedMultiplier: 1.0, damageMultiplier: 1.0, attackRateMultiplier: 1.0 },
      // Phase 2 (70% - 30%): Lockdown stun + spawns minion guards
      { 
        hpThreshold: 0.7, 
        speedMultiplier: 1.2, 
        damageMultiplier: 1.2, 
        attackRateMultiplier: 0.8,
        onEnter: {
          type: 'lockdown',
          params: { duration: 3 } // 3 seconds squad stun + spawns minions
        }
      },
      // Phase 3 (30% - 0%): Enrages permanent speed and damage multipliers
      {
        hpThreshold: 0.3,
        speedMultiplier: 1.5,
        damageMultiplier: 1.4,
        attackRateMultiplier: 0.6,
        onEnter: {
          type: 'enrage',
          params: { amount: 1 }
        }
      }
    ],
    abilities: [
      { id: 'fracture-blast', cooldownSeconds: 8, range: 5, damage: 20, description: 'The Warden emits a reality-fracturing blast!' },
      { id: 'drain-life', cooldownSeconds: 15, range: 4, damage: 15, description: 'The Warden drains life force to heal themselves!' }
    ],
    spawnTile: { x: 7, y: 6 },
    patrolPath: [
      { x: 7, y: 4 },
      { x: 10, y: 7 },
      { x: 7, y: 10 },
      { x: 4, y: 7 }
    ]
  },
  items: [
    // Intricate defense fortress surrounding central stash
    { spriteKey: 'turret_taser',            gridX: 6, gridY: 6, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_taser',            gridX: 8, gridY: 6, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_nailgun',          gridX: 6, gridY: 8, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_nailgun',          gridX: 8, gridY: 8, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    // Outer defense perimeter turrets
    { spriteKey: 'turret_nailgun',          gridX: 0, gridY: 0, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_nailgun',          gridX: 13, gridY: 0, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_nailgun',          gridX: 0, gridY: 13, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    { spriteKey: 'turret_nailgun',          gridX: 13, gridY: 13, footprintW: 1, footprintH: 1, rotation: 0, type: 'turret' },
    // High-value traps
    { spriteKey: 'trap_shock_pad',          gridX: 7, gridY: 3, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_shock_pad',          gridX: 7, gridY: 11, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_tripwire_alarm',     gridX: 3, gridY: 7, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    { spriteKey: 'trap_tripwire_alarm',     gridX: 11, gridY: 7, footprintW: 1, footprintH: 1, rotation: 0, type: 'trap' },
    // Dense barricades
    { spriteKey: 'barricade_sandbags',      gridX: 5, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_sandbags',      gridX: 9, gridY: 5, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_sandbags',      gridX: 5, gridY: 9, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' },
    { spriteKey: 'barricade_sandbags',      gridX: 9, gridY: 9, footprintW: 1, footprintH: 1, rotation: 0, type: 'barricade' }
  ]
};

export const BOSS_ROOM_FIXTURES: Record<string, BossRoomFixture> = {
  [BOSS_IRONJAW.id]: BOSS_IRONJAW,
  [BOSS_WHISPER.id]: BOSS_WHISPER,
  [BOSS_VOLKOV.id]: BOSS_VOLKOV,
  [BOSS_CIRCUIT.id]: BOSS_CIRCUIT,
  [BOSS_WARDEN.id]: BOSS_WARDEN
};

export const BOSS_ROOM_LIST: BossRoomFixture[] = [
  BOSS_IRONJAW,
  BOSS_WHISPER,
  BOSS_VOLKOV,
  BOSS_CIRCUIT,
  BOSS_WARDEN
];

export function isBossFixture(id: string): boolean {
  return id.startsWith('boss-') && id in BOSS_ROOM_FIXTURES;
}
