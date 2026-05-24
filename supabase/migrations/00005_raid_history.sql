-- 00005_raid_history.sql

CREATE TABLE public.raid_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient cooldown checks
CREATE INDEX idx_raid_history_player_target ON public.raid_history(player_id, target_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.raid_history ENABLE ROW LEVEL SECURITY;

-- Players can view their own raid history
CREATE POLICY "Players can view their own raid history"
    ON public.raid_history FOR SELECT
    USING (auth.uid() = player_id);

-- Only service role can insert/update/delete (via resolve-raid Edge Function)
-- No policies needed for service role as it bypasses RLS
