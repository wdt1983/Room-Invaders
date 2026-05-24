-- 00006_quests.sql
-- Create the player_quests table to track progress on tutorial, daily, and weekly quests.

CREATE TABLE public.player_quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quest_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'claimed')),
    progress INTEGER NOT NULL DEFAULT 0,
    target_value INTEGER NOT NULL,
    unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to prevent duplicate quests for same player
CREATE UNIQUE INDEX idx_player_quests_player_quest ON public.player_quests(player_id, quest_id);

-- Index for querying active quests rapidly
CREATE INDEX idx_player_quests_player_status ON public.player_quests(player_id, status);

-- Enable RLS
ALTER TABLE public.player_quests ENABLE ROW LEVEL SECURITY;

-- Players can view their own quest progress
CREATE POLICY "Players can view their own quest progress"
    ON public.player_quests FOR SELECT
    USING (auth.uid() = player_id);

-- Only service role can mutate quests (via Edge Functions & Server Actions)
-- No write policies needed for service role as it bypasses RLS
