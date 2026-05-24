-- Migration: 00009_player_items_select_policy.sql
-- Description: Allow authenticated users to select player items (required for raiding and visiting).
-- Phase: 5 (PvP & Social)

CREATE POLICY "Player items are viewable by authenticated users."
    ON public.player_items FOR SELECT
    USING (auth.role() = 'authenticated');
