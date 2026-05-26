-- Migration: 00016_rls_profiles_and_raid_history_fk.sql
-- Description: Allow users to insert their own profile under RLS, and fix raid_history foreign key join on profiles.

-- 1. Add INSERT policy on profiles table for authenticated users inserting their own profile
CREATE POLICY "Users can insert own profile." 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- 2. Refactor raid_history(player_id) foreign key to reference profiles(id) directly.
-- This lets PostgREST (Supabase REST API) resolve the join between raid_history and profiles.
ALTER TABLE public.raid_history 
    DROP CONSTRAINT IF EXISTS raid_history_player_id_fkey;

ALTER TABLE public.raid_history
    ADD CONSTRAINT raid_history_player_id_fkey 
    FOREIGN KEY (player_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
