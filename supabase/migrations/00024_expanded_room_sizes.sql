-- Migration: 00024_expanded_room_sizes.sql
-- Description: Add room_size_tier column to rooms table and initialize it based on existing grid_size values.
-- Phase: 9 (Expansion)

-- 1. Add the room_size_tier column with default 1
ALTER TABLE rooms ADD COLUMN room_size_tier INTEGER NOT NULL DEFAULT 1;

-- 2. Backfill room_size_tier based on existing grid_size values
UPDATE rooms SET room_size_tier = 1 WHERE grid_size <= 10;
UPDATE rooms SET room_size_tier = 2 WHERE grid_size = 12;
UPDATE rooms SET room_size_tier = 3 WHERE grid_size = 14;
UPDATE rooms SET room_size_tier = 4 WHERE grid_size = 16;
UPDATE rooms SET room_size_tier = 5 WHERE grid_size >= 18;
