-- Migration: 00014_defense_repair_system.sql
-- Description: Add is_damaged column to player_items and enable repair system resource sinks.
-- Phase: 4 (Task 4.0.3 — Repair System)

ALTER TABLE public.player_items
  ADD COLUMN is_damaged BOOLEAN NOT NULL DEFAULT FALSE;

-- Create an index to quickly filter out/find damaged items
CREATE INDEX idx_player_items_is_damaged ON public.player_items(owner_id, is_damaged) WHERE is_damaged = TRUE;
