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
  '{"scrap": 15}', '{}', '{"w": 2, "h": 1}', 'furniture_table_folding', 1);

-- ============================================
-- TRAPS (5 starter types)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
('trap', 'Pressure Plate', 'A concealed plate that triggers when stepped on. Deals moderate damage.', 1,
  '{"scrap": 20, "components": 10}',
  '{"damage": 15, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_pressure_plate', 1),

('trap', 'Spike Strip', 'Jagged metal spikes hidden under debris. Slows and damages.', 1,
  '{"scrap": 25, "components": 8}',
  '{"damage": 10, "slow": 0.5, "trigger": "step", "uses": 2}',
  '{"w": 1, "h": 1}', 'trap_spike_strip', 1),

('trap', 'Shock Pad', 'An electrified floor pad. Stuns the target briefly.', 2,
  '{"scrap": 15, "components": 20}',
  '{"damage": 8, "stun_duration": 1.5, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_shock_pad', 3),

('trap', 'Glue Trap', 'Industrial adhesive spread. Immobilizes for a short duration.', 1,
  '{"scrap": 10, "components": 12}',
  '{"damage": 0, "immobilize_duration": 3, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_glue', 1),

('trap', 'Tripwire Alarm', 'A thin wire connected to an alarm. Alerts nearby defenses.', 1,
  '{"scrap": 10, "components": 5}',
  '{"damage": 0, "alert_radius": 3, "trigger": "step", "uses": 1}',
  '{"w": 1, "h": 1}', 'trap_tripwire_alarm', 1);

-- ============================================
-- TURRETS (2 starter types)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
('turret', 'Nail Gun Turret', 'A repurposed nail gun mounted on a swivel. Fires at the nearest intruder.', 2,
  '{"scrap": 40, "components": 25}',
  '{"damage": 8, "range": 3, "fire_rate": 1.0, "ammo": 15}',
  '{"w": 1, "h": 1}', 'turret_nailgun', 5),

('turret', 'Taser Turret', 'A jury-rigged taser with auto-targeting. Short range, high stun.', 2,
  '{"scrap": 35, "components": 30}',
  '{"damage": 5, "range": 2, "fire_rate": 0.8, "ammo": 10, "stun_duration": 1.0}',
  '{"w": 1, "h": 1}', 'turret_taser', 5);

-- ============================================
-- BARRICADES (3 starter types)
-- ============================================

INSERT INTO items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level) VALUES
('barricade', 'Bookshelf Barricade', 'A toppled bookshelf blocking the path. Sturdy but destructible.', 1,
  '{"scrap": 15}',
  '{"hp": 50, "blocks_movement": true}',
  '{"w": 2, "h": 1}', 'barricade_bookshelf', 1),

('barricade', 'Flipped Table', 'A table on its side. Provides partial cover. Light but quick to deploy.', 1,
  '{"scrap": 10}',
  '{"hp": 30, "blocks_movement": true}',
  '{"w": 2, "h": 1}', 'barricade_flipped_table', 1),

('barricade', 'Sandbags', 'Stacked sandbags. Heavy, reliable, boring. Gets the job done.', 1,
  '{"scrap": 20}',
  '{"hp": 75, "blocks_movement": true}',
  '{"w": 1, "h": 1}', 'barricade_sandbags', 2);
