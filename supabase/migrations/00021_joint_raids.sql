-- Migration: 00021_joint_raids.sql
-- Description: Create joint_raid_lobbies and joint_raid_participants tables with RLS policies and indexes.
-- Phase: 9 (Post-Launch Backlog)

-- 1. Create the joint_raid_lobbies table
CREATE TABLE public.joint_raid_lobbies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL,           -- defender UUID (PvP) or fixture ID (NPC)
    target_name TEXT NOT NULL,
    target_difficulty TEXT NOT NULL CHECK (target_difficulty IN ('easy', 'medium', 'hard')),
    status TEXT NOT NULL DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'active', 'completed', 'cancelled')),
    max_participants INTEGER NOT NULL DEFAULT 4 CHECK (max_participants BETWEEN 2 AND 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Enable RLS for joint_raid_lobbies
ALTER TABLE public.joint_raid_lobbies ENABLE ROW LEVEL SECURITY;

-- Select policy: district members can view lobbies in their district
CREATE POLICY "District members can view lobbies in their district"
    ON public.joint_raid_lobbies FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.district_members dm
            WHERE dm.district_id = joint_raid_lobbies.district_id
            AND dm.profile_id = auth.uid()
        )
    );

-- Insert policy: district members can host a lobby in their district
CREATE POLICY "District members can create lobbies in their district"
    ON public.joint_raid_lobbies FOR INSERT
    WITH CHECK (
        auth.uid() = host_id
        AND EXISTS (
            SELECT 1 FROM public.district_members dm
            WHERE dm.district_id = joint_raid_lobbies.district_id
            AND dm.profile_id = auth.uid()
        )
    );

-- Update policy: hosts can update their own lobbies
CREATE POLICY "Hosts can update their own lobbies"
    ON public.joint_raid_lobbies FOR UPDATE
    USING (auth.uid() = host_id)
    WITH CHECK (auth.uid() = host_id);


-- 2. Create the joint_raid_participants table
CREATE TABLE public.joint_raid_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lobby_id UUID NOT NULL REFERENCES public.joint_raid_lobbies(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    squad_hp_contribution INTEGER NOT NULL DEFAULT 0,
    squad_damage_bonus INTEGER NOT NULL DEFAULT 0,
    is_ready BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(lobby_id, profile_id)
);

-- Enable RLS for joint_raid_participants
ALTER TABLE public.joint_raid_participants ENABLE ROW LEVEL SECURITY;

-- Select policy: district members can view participants in their district lobbies
CREATE POLICY "District members can view lobby participants"
    ON public.joint_raid_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.joint_raid_lobbies l
            JOIN public.district_members dm ON l.district_id = dm.district_id
            WHERE l.id = joint_raid_participants.lobby_id
            AND dm.profile_id = auth.uid()
        )
    );

-- Insert policy: players can join a lobby if they are in the same district and join as themselves
CREATE POLICY "Players can join lobbies"
    ON public.joint_raid_participants FOR INSERT
    WITH CHECK (
        auth.uid() = profile_id
        AND EXISTS (
            SELECT 1 FROM public.joint_raid_lobbies l
            JOIN public.district_members dm ON l.district_id = dm.district_id
            WHERE l.id = lobby_id
            AND dm.profile_id = auth.uid()
        )
    );

-- Update policy: players can update their own ready state/contributions
CREATE POLICY "Players can update their own participant state"
    ON public.joint_raid_participants FOR UPDATE
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Delete policy: players can leave, or hosts can kick players
CREATE POLICY "Players can leave or hosts can kick players"
    ON public.joint_raid_participants FOR DELETE
    USING (
        auth.uid() = profile_id
        OR EXISTS (
            SELECT 1 FROM public.joint_raid_lobbies l
            WHERE l.id = lobby_id
            AND l.host_id = auth.uid()
        )
    );


-- 3. Indexes
CREATE INDEX idx_joint_raid_lobbies_district ON public.joint_raid_lobbies(district_id);
CREATE INDEX idx_joint_raid_lobbies_host ON public.joint_raid_lobbies(host_id);
CREATE INDEX idx_joint_raid_participants_lobby ON public.joint_raid_participants(lobby_id);
CREATE INDEX idx_joint_raid_participants_profile ON public.joint_raid_participants(profile_id);
