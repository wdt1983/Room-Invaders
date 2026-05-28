-- ============================================================
-- Migration: 00026_community_events.sql
-- Description: Establishes global scheduled events and contribution trackers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.community_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN ('sector_blackout', 'turret_malfunction', 'double_scrap', 'scrap_frenzy')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    rewards JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_time_range CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.player_event_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    progress JSONB NOT NULL DEFAULT '{"raids_completed": 0, "contribution": 0}'::jsonb,
    reward_claimed BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_event_profile UNIQUE (event_id, profile_id)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_community_events_status_time ON public.community_events (status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_player_event_contribs_profile ON public.player_event_contributions (profile_id);

-- Enable RLS
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_event_contributions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: community_events
CREATE POLICY "Allow public select of community events"
ON public.community_events
FOR SELECT
TO authenticated
USING (true);

-- RLS Policies: player_event_contributions
CREATE POLICY "Allow members select own contributions"
ON public.player_event_contributions
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Allow members insert own contributions"
ON public.player_event_contributions
FOR INSERT
TO authenticated
WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Allow members update own contributions"
ON public.player_event_contributions
FOR UPDATE
TO authenticated
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Seed a default scheduled event (Sector Blackout active now for 12 hours)
INSERT INTO public.community_events (event_type, title, description, starts_at, ends_at, status, parameters, rewards)
VALUES (
    'sector_blackout',
    'Sector Blackout: Dark Grid Breach',
    'A massive solar flare or EMP grid sweep has knocked out standard illumination across the district! Raid stashes give double scrap and reputation, but visual ranges are reduced and turrets are highly unstable.',
    now() - interval '1 hour',
    now() + interval '11 hours',
    'active',
    '{"fog_of_war": true, "turret_jam_chance": 0.15, "ambient_tint": "0x111b21", "light_radius": 96}'::jsonb,
    '{"scrap_multiplier": 2.0, "rep_bonus": 15}'::jsonb
) ON CONFLICT DO NOTHING;
