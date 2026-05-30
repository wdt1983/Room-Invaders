-- Migration: 00030_custom_poster_hologram_settings.sql
-- Description: Add hologram settings configuration for custom posters to player_items
-- Phase: 9 (Post-Launch Backlog)

-- ============================================
-- 1. ADD HOLOGRAM SETTINGS TO PLAYER_ITEMS
-- ============================================
ALTER TABLE public.player_items 
ADD COLUMN IF NOT EXISTS hologram_settings JSONB DEFAULT '{"color": "#06b6d4", "flicker": 0.15, "scanlines": 0.40, "noise": 0.10}'::jsonb;

-- Create an index on the jsonb column for fast querying if needed
CREATE INDEX IF NOT EXISTS idx_player_items_hologram_settings ON public.player_items USING gin (hologram_settings);
