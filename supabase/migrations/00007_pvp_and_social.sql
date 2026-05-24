-- Migration: 00007_pvp_and_social.sql
-- Description: Extend raid_history, create friendships and notifications tables with RLS and indexes.
-- Phase: 5 (PvP & Social)

-- 1. Extend public.raid_history with pvp, loot, and action log tracking
ALTER TABLE public.raid_history 
ADD COLUMN IF NOT EXISTS action_log JSONB NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS squad_hp INTEGER,
ADD COLUMN IF NOT EXISTS seconds_elapsed INTEGER,
ADD COLUMN IF NOT EXISTS scrap_looted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS components_looted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credits_looted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS defender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for matchmaking/social raid history checks
CREATE INDEX IF NOT EXISTS idx_raid_history_defender ON public.raid_history(defender_id);

-- 2. Create the friendships table
CREATE TABLE public.friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(sender_id, receiver_id)
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Friendship policies
CREATE POLICY "Users can select friendships they are part of."
    ON public.friendships FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can initiate friend requests."
    ON public.friendships FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can accept friend requests received."
    ON public.friendships FOR UPDATE
    USING (auth.uid() = receiver_id);

CREATE POLICY "Users can break friendships or cancel requests."
    ON public.friendships FOR DELETE
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Indexes for friendships
CREATE INDEX idx_friendships_sender ON public.friendships(sender_id);
CREATE INDEX idx_friendships_receiver ON public.friendships(receiver_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

-- 3. Create the notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Users can view their own notifications."
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications."
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- Index for notifications
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;
