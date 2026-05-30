-- Seed: seed.sql
-- Description: Populate the items catalog with starter furniture, traps,
--              turrets, and barricades for the MVP.
-- Phase: 0 (Foundation)
--
-- Item type reference (from 00003_items_inventory.sql CHECK):
--   furniture | trap | turret | barricade | cosmetic | consumable | guard
--
-- GDD references:
--   Section 5.1 — Furniture categories (Sleep, Work, Storage, Entertainment, Comfort, Decor)
--   Section 5.2 — Defense categories (Floor Traps, Wall Traps, Turrets, Barricades)
--   Section 12  — MVP scope: 30 furniture minimum target, 5 trap types, 2 barricade types
--   Task 1.0.6  — Placeholder sprite set: bed, desk, chair, shelf, table, lamp, TV, rug, plant, dresser

-- ============================================
-- FURNITURE (10 starter items)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
-- Sleep
('furniture', 'Twin Bed', 'A simple twin bed. Every survivor needs sleep.', 1,
  '{"scrap": 30}', '{}', '{"w": 2, "h": 1}', 'furniture_bed_twin', 1),

-- Work
('furniture', 'Wooden Desk', 'A sturdy desk. Good for planning your next move.', 1,
  '{"scrap": 25}', '{}', '{"w": 2, "h": 1}', 'furniture_desk_wooden', 1),

('furniture', 'Office Chair', 'A swivel chair. Spins help you think.', 1,
  '{"scrap": 15}', '{}', '{"w": 1, "h": 1}', 'furniture_chair_office', 1),

-- Storage
('furniture', 'Metal Shelf', 'Open shelving unit. Stores your scavenged goods.', 1,
  '{"scrap": 20}', '{}', '{"w": 1, "h": 2}', 'furniture_shelf_metal', 1),

('furniture', 'Wooden Dresser', 'A heavy dresser. Doubles as a barricade in a pinch.', 1,
  '{"scrap": 25}', '{}', '{"w": 2, "h": 1}', 'furniture_dresser_wooden', 1),

-- Entertainment
('furniture', 'Flatscreen TV', 'A salvaged TV. Still gets static on channel 3.', 1,
  '{"scrap": 20, "components": 5}', '{}', '{"w": 2, "h": 1}', 'furniture_tv_flatscreen', 1),

-- Comfort
('furniture', 'Area Rug', 'A threadbare rug. It ties the room together.', 1,
  '{"scrap": 10}', '{}', '{"w": 2, "h": 2}', 'furniture_rug_area', 1),

('furniture', 'Floor Lamp', 'A standing lamp. Light keeps the dark at bay.', 1,
  '{"scrap": 10, "components": 3}', '{}', '{"w": 1, "h": 1}', 'furniture_lamp_floor', 1),

-- Decor
('furniture', 'Potted Plant', 'A resilient succulent. Life finds a way.', 1,
  '{"scrap": 5}', '{}', '{"w": 1, "h": 1}', 'furniture_plant_potted', 1),

('furniture', 'Folding Table', 'A basic folding table. Functional, not pretty.', 1,
  '{"scrap": 15}', '{}', '{"w": 2, "h": 1}', 'furniture_table_folding', 1),

-- Progression Trophy
('furniture', 'Holographic Boss Pedestal', 'A sleek metal terminal projecting a rotating, glowing holographic trophy of a defeated boss.', 5,
  '{"scrap": 250, "components": 50}', '{}', '{"w": 1, "h": 1}', 'furniture_boss_pedestal', 5);


-- ============================================
-- TRAPS (5 starter types)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
('trap', 'Pressure Plate', 'A concealed plate that triggers when stepped on. Deals moderate damage.', 1,
  '{"scrap": 15, "components": 2}',
  '{"damage": 15, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_pressure_plate', 1),

('trap', 'Spike Strip', 'Jagged metal spikes hidden under debris. Slows and damages.', 1,
  '{"scrap": 20, "components": 3}',
  '{"damage": 10, "slow": 0.5, "trigger": "step", "uses": 2}',
  '{"w": 1, "h": 1}', 'trap_spike_strip', 1),

('trap', 'Shock Pad', 'An electrified floor pad. Stuns the target briefly.', 2,
  '{"scrap": 25, "components": 6}',
  '{"damage": 12, "stun_duration": 1.8, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_shock_pad', 3),

('trap', 'Glue Trap', 'Industrial adhesive spread. Immobilizes for a short duration.', 1,
  '{"scrap": 15, "components": 4}',
  '{"damage": 0, "immobilize_duration": 4.0, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_glue', 1),

('trap', 'Tripwire Alarm', 'A thin wire connected to an alarm. Alerts nearby defenses.', 1,
  '{"scrap": 10, "components": 2}',
  '{"damage": 0, "alert_radius": 4, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_tripwire_alarm', 1);

-- ============================================
-- TURRETS (2 starter types)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
('turret', 'Nail Gun Turret', 'A repurposed nail gun mounted on a swivel. Fires at the nearest intruder.', 2,
  '{"scrap": 60, "components": 15}',
  '{"damage": 8, "range": 3, "fire_rate": 1.0, "ammo": 15}',
  '{"w": 1, "h": 1}', 'turret_nailgun', 5),

('turret', 'Taser Turret', 'A jury-rigged taser with auto-targeting. Short range, high stun.', 2,
  '{"scrap": 55, "components": 18}',
  '{"damage": 6, "range": 2, "fire_rate": 0.8, "ammo": 12, "stun_duration": 1.2}',
  '{"w": 1, "h": 1}', 'turret_taser', 5);

-- ============================================
-- BARRICADES (3 starter types)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
('barricade', 'Bookshelf Barricade', 'A toppled bookshelf blocking the path. Sturdy but destructible.', 1,
  '{"scrap": 20}',
  '{"hp": 50, "blocks_movement": true}',
  '{"w": 2, "h": 1}', 'barricade_bookshelf', 1),

('barricade', 'Flipped Table', 'A table on its side. Provides partial cover. Light but quick to deploy.', 1,
  '{"scrap": 10}',
  '{"hp": 30, "blocks_movement": true}',
  '{"w": 2, "h": 1}', 'barricade_flipped_table', 1),

('barricade', 'Sandbags', 'Stacked sandbags. Heavy, reliable, boring. Gets the job done.', 1,
  '{"scrap": 35}',
  '{"hp": 75, "blocks_movement": true}',
  '{"w": 1, "h": 1}', 'barricade_sandbags', 2);

-- ============================================
-- ADVANCED GATED DEFENSES (Phase 7 Tech Tree & Loadouts)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level, tech_tree_node) VALUES
-- Traps
('trap', 'Flame Vent', 'Wall-mounted nozzle firing flame streams. Deals fire damage to 3 linear tiles.', 3,
  '{"scrap": 50, "components": 15}', '{"damage": 30, "aoe_line": 3, "uses": 3}', '{"w": 1, "h": 1}', 'trap_flame_vent', 8, 'def_unlock_flame_vent'),

('trap', 'Laser Alarm Grid', 'Trips an alarm if crossed, alerting sentries across the entire grid size.', 2,
  '{"scrap": 40, "components": 10}', '{"alert_radius": 15, "uses": 99}', '{"w": 1, "h": 1}', 'trap_laser_grid', 8, 'def_unlock_laser_grid'),

('trap', 'Shock Wire', 'Electrified metal wire that stuns and damages multiple units crossing adjacent tiles.', 3,
  '{"scrap": 55, "components": 12}', '{"damage": 15, "stun_duration": 2.5, "uses": 2}', '{"w": 2, "h": 1}', 'trap_shock_wire', 10, 'def_unlock_tesla'),

('trap', 'EMP Mine', 'Deactivates electronic squad loadouts and delays abilities by 10s when detonated.', 3,
  '{"scrap": 60, "components": 18}', '{"damage": 0, "emp_duration": 12.0, "uses": 1}', '{"w": 1, "h": 1}', 'trap_emp_mine', 10, 'def_unlock_guard_drone'),

-- Turrets
('turret', 'Tesla Coil', 'High-frequency electric tower firing chain lightning. Deals moderate damage in radius 2 Chebyshev disks.', 3,
  '{"scrap": 100, "components": 35}', '{"damage": 18, "range": 3, "fire_rate": 1.1, "ammo": 20, "chain_targets": 3}', '{"w": 1, "h": 1}', 'turret_tesla', 8, 'def_unlock_tesla'),

('turret', 'Heavy Autocannon', 'Massive armor-piercing turret. Long range, slower fire rate, destructive shell blast.', 4,
  '{"scrap": 140, "components": 50}', '{"damage": 45, "range": 5, "fire_rate": 1.8, "ammo": 12}', '{"w": 2, "h": 2}', 'turret_autocannon', 12, 'def_turret_ammo_1'),

('turret', 'Shotgun Sentry', 'Fires spread sweeps covering Chebyshev cone ranges. High knockback.', 3,
  '{"scrap": 90, "components": 30}', '{"damage": 25, "range": 2, "fire_rate": 1.4, "ammo": 10, "spread_cone": true}', '{"w": 1, "h": 1}', 'turret_shotgun', 10, 'def_turret_range_1'),

-- Guards
('guard', 'Sentry Patrol Drone', 'Hover drone with built-in nailguns patrolling designated tiles.', 3,
  '{"scrap": 80, "components": 25}', '{"hp": 60, "damage": 6, "range": 3, "fire_rate": 1.0, "patrol": true}', '{"w": 1, "h": 1}', 'guard_drone', 8, 'def_unlock_guard_drone'),

('guard', 'Attack Guard Dog', 'Fierce dog that runs down and bites targets, causing continuous bleed damage.', 3,
  '{"scrap": 70, "components": 15}', '{"hp": 80, "damage": 12, "speed": 1.5, "melee": true}', '{"w": 1, "h": 1}', 'guard_dog', 8, 'def_unlock_guard_drone'),

('guard', 'Decoy Dummy Sentry', 'Holographic projector attracting squad movement paths by simulating stashes.', 2,
  '{"scrap": 50, "components": 10}', '{"hp": 120, "decoy_radius": 3}', '{"w": 1, "h": 1}', 'guard_decoy', 6, 'def_unlock_laser_grid');

-- ============================================
-- COOPERATIVE DISTRICT ITEMS
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
('turret', 'Defense Power Node', 'District power generator that projects +15% Rate of Fire and +1 range grid boosts across shared room boundaries.', 3,
  '{"scrap": 120, "components": 40}',
  '{"energy_boost": 15, "range": 2}',
  '{"w": 1, "h": 1}', 'turret_power_node', 8);

-- ============================================
-- BOSS REWARDS (5 unique items)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level, item_source, required_boss_clear) VALUES
('trap', 'Ironjaw''s Bear Trap', 'A heavy iron trap designed to clamp shut. High damage and stuns targets.', 3,
  '{"scrap": 90, "components": 25}', '{"damage": 30, "stun_duration": 2.0, "uses": 2}', '{"w": 1, "h": 1}', 'trap_bear_trap', 3, 'boss', 'boss-ironjaw'),

('trap', 'Whisper''s Ghost Wire', 'An invisible tripwire linked directly to the security network. Stays hidden and alerts all nearby defenses.', 3,
  '{"scrap": 110, "components": 30}', '{"damage": 0, "alert_radius": 8, "uses": 3}', '{"w": 1, "h": 1}', 'trap_ghost_wire', 5, 'boss', 'boss-whisper'),

('turret', 'Volkov''s Autocannon Mk2', 'An upgraded, custom autocannon configured by Colonel Volkov. Extremely long range and heavy punch.', 4,
  '{"scrap": 180, "components": 60}', '{"damage": 25, "range": 6, "fire_rate": 1.5, "ammo": 10}', '{"w": 2, "h": 2}', 'turret_autocannon_mk2', 7, 'boss', 'boss-volkov'),

('trap', 'Circuit''s EMP Mine', 'An advanced electromagnetic pulse mine. Heavy disruption, long stun.', 4,
  '{"scrap": 150, "components": 40}', '{"damage": 5, "stun_duration": 4.0, "uses": 1}', '{"w": 1, "h": 1}', 'trap_circuit_emp_mine', 10, 'boss', 'boss-circuit'),

('cosmetic', 'The Warden''s Key', 'A strange glowing cryptographic key recovered from the Heart of the Fracture. A legendary trophy.', 5,
  '{"scrap": 500}', '{}', '{"w": 1, "h": 1}', 'cosmetic_warden_key', 15, 'boss', 'boss-warden');
