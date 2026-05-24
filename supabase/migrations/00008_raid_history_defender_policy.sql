-- Migration: 00008_raid_history_defender_policy.sql
-- Description: Allow defenders to view their own defense logs in raid_history.
-- Phase: 5 (PvP & Social)

CREATE POLICY "Defenders can view their own defense logs"
    ON public.raid_history FOR SELECT
    USING (auth.uid() = defender_id);
