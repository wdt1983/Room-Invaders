-- Migration: 00015_beta_feedback.sql
-- Description: Create beta feedback tracking database schema to collect tester reports and ratings.
-- Phase: 8 (Task 8.0.15 — Beta test)

CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  rating_gameplay INT CHECK (rating_gameplay >= 1 AND rating_gameplay <= 5),
  rating_visuals INT CHECK (rating_visuals >= 1 AND rating_visuals <= 5),
  rating_performance INT CHECK (rating_performance >= 1 AND rating_performance <= 5),
  comments TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to INSERT reports with their own UID
CREATE POLICY insert_authenticated_feedback ON public.beta_feedback
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Restrict SELECT to users for their own entries
CREATE POLICY select_own_feedback ON public.beta_feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
