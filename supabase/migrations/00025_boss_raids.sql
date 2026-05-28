-- Migration: 00025_boss_raids.sql
-- Description: Named NPC Raid Bosses database tables, columns, and policies.
-- Phase: 9 (Expansion)

-- 1. Add boss-specific columns to items table
ALTER TABLE public.items ADD COLUMN item_source TEXT;
ALTER TABLE public.items ADD COLUMN required_boss_clear TEXT;

-- 2. Boss clear history table
CREATE TABLE public.boss_clears (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  boss_id text NOT NULL,           -- fixture ID e.g. 'boss-ironjaw'
  cleared_at timestamptz NOT NULL DEFAULT now(),
  is_first_clear boolean NOT NULL DEFAULT false,
  phase_reached int NOT NULL DEFAULT 1,
  seconds_elapsed int NOT NULL DEFAULT 0,
  squad_hp_remaining int NOT NULL DEFAULT 0
);

CREATE INDEX idx_boss_clears_player ON public.boss_clears(player_id);
CREATE INDEX idx_boss_clears_boss ON public.boss_clears(player_id, boss_id);

-- RLS: players see only their own clears
ALTER TABLE public.boss_clears ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view own boss clears"
  ON public.boss_clears FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Server inserts boss clears"
  ON public.boss_clears FOR INSERT WITH CHECK (auth.uid() = player_id);
