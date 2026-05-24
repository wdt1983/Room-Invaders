-- Migration: 00004_player_item_rotation.sql
-- Description: Add `rotation` column to player_items so placed furniture /
--              defenses can be oriented in 90° increments. Stored as a
--              discrete 0-3 index (0=0°, 1=90°, 2=180°, 3=270°). Client
--              multiplies by 90 for visual angle and swaps footprint
--              dimensions when rotation is odd (1 or 3).
-- Phase: 1 (Task 1.0.13 — Room editor: rotate item)

ALTER TABLE player_items
  ADD COLUMN rotation INTEGER NOT NULL DEFAULT 0
  CHECK (rotation IN (0, 1, 2, 3));
