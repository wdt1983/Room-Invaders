-- Migration: 00010_tech_tree_and_loadouts.sql
-- Description: Tech Tree progress, player squad loadouts, tech points trigger.
-- Phase: 7 (Tech Tree & Loadouts)

-- 1. Extend public.profiles with available tech points
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tech_points INTEGER NOT NULL DEFAULT 1;

-- 2. Create the tech tree progress table
CREATE TABLE IF NOT EXISTS public.player_tech (
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, node_id)
);

-- Enable RLS
ALTER TABLE public.player_tech ENABLE ROW LEVEL SECURITY;

-- Recreate policies safely (in case of migrations run multiple times)
DROP POLICY IF EXISTS "Users can view own tech progress." ON public.player_tech;
CREATE POLICY "Users can view own tech progress."
    ON public.player_tech FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can unlock tech nodes." ON public.player_tech;
CREATE POLICY "Users can unlock tech nodes."
    ON public.player_tech FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- 3. Create the player squad members & loadout table
CREATE TABLE IF NOT EXISTS public.player_squad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 4),
    name TEXT NOT NULL DEFAULT 'Squad Member',
    active_ability TEXT,   -- 'medkit', 'breaching_charge', 'emp_grenade', etc.
    passive_gear TEXT,     -- 'protective_shield', 'reinforced_boots', etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id, slot_number)
);

-- Enable RLS
ALTER TABLE public.player_squad ENABLE ROW LEVEL SECURITY;

-- Recreate policies safely
DROP POLICY IF EXISTS "Users can view own squad." ON public.player_squad;
CREATE POLICY "Users can view own squad."
    ON public.player_squad FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can manage own squad." ON public.player_squad;
CREATE POLICY "Users can manage own squad."
    ON public.player_squad FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- 4. Create automatic tech points level-up trigger
CREATE OR REPLACE FUNCTION public.handle_player_level_up_tech()
RETURNS trigger AS $$
BEGIN
  IF new.player_level > old.player_level THEN
    new.tech_points := new.tech_points + (new.player_level - old.player_level);
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_player_level_upgrade_tech ON public.profiles;
CREATE TRIGGER on_player_level_upgrade_tech
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (new.player_level > old.player_level)
  EXECUTE FUNCTION public.handle_player_level_up_tech();

-- Backfill existing profiles so they have tech points equal to their level
UPDATE public.profiles
SET tech_points = COALESCE(player_level, 1)
WHERE tech_points IS NULL OR tech_points = 0;
