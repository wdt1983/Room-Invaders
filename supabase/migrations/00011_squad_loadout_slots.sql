-- Migration: 00011_squad_loadout_slots.sql
-- Description: Add Weapon and Armor slots to the player squad members table.
-- Phase: 7 (Tech Tree & Loadouts)

-- 1. Add weapon and armor columns to public.player_squad
ALTER TABLE public.player_squad
ADD COLUMN IF NOT EXISTS weapon TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS armor TEXT DEFAULT NULL;

-- 2. Force updated_at updates when record is modified (sanity check, column already exists)
-- This ensures client-side cache busting works effectively.
