-- Migration: 00019_notifications_rls.sql
-- Description: Add INSERT policy for notifications table to support server-action and social alerts.
-- Phase: 9 (Post-Launch Backlog)

CREATE POLICY "Authenticated users can insert notifications."
    ON public.notifications FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
