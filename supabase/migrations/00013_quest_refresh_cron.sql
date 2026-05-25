-- 00013_quest_refresh_cron.sql
-- PL/pgSQL stored functions and pg_cron triggers to execute daily and weekly quest resets.

-- 1. Stored Function for Daily Quest Refresh
CREATE OR REPLACE FUNCTION public.refresh_daily_quests()
RETURNS void AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Delete daily quests with status 'claimed' or 'active' (uncompleted) for all users.
    -- Completed but unclaimed ('completed') dailies are kept so users can claim their reward.
    DELETE FROM public.player_quests 
    WHERE quest_id LIKE 'daily-%' 
      AND status IN ('active', 'claimed');

    -- Loop through all registered users in profiles
    FOR user_record IN 
        SELECT id, player_level 
        FROM public.profiles
    LOOP
        -- Select 3 random daily quests matching user level.
        -- Pool defined inline matching game/fixtures/quests.json
        WITH eligible_dailies AS (
            SELECT * FROM (
                VALUES 
                    ('daily-01', 2, 1), -- Scavenger's Duty
                    ('daily-02', 2, 1), -- Fortification Check
                    ('daily-03', 2, 1), -- Interior Designer
                    ('daily-04', 2, 1), -- Data Collector
                    ('daily-05', 3, 2)  -- Veteran Raider
            ) AS q(id, target_val, min_level)
            WHERE user_record.player_level >= q.min_level
        ),
        selected_dailies AS (
            SELECT id, target_val 
            FROM eligible_dailies
            ORDER BY random()
            LIMIT 3
        )
        -- Insert the selected dailies for this user.
        -- ON CONFLICT DO NOTHING preserves any completed but unclaimed daily quests from yesterday.
        INSERT INTO public.player_quests (player_id, quest_id, status, progress, target_value)
        SELECT user_record.id, id, 'active', 0, target_val
        FROM selected_dailies
        ON CONFLICT (player_id, quest_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Stored Function for Weekly Quest Refresh
CREATE OR REPLACE FUNCTION public.refresh_weekly_quests()
RETURNS void AS $$
DECLARE
    user_record RECORD;
BEGIN
    -- Delete weekly quests with status 'claimed' or 'active' (uncompleted) for all users.
    DELETE FROM public.player_quests 
    WHERE quest_id LIKE 'weekly-%' 
      AND status IN ('active', 'claimed');

    -- Loop through all registered users
    FOR user_record IN 
        SELECT id, player_level 
        FROM public.profiles
    LOOP
        -- Pool of weekly quests defined inline matching game/fixtures/quests.json
        WITH eligible_weeklies AS (
            SELECT * FROM (
                VALUES 
                    ('weekly-01', 8, 1),  -- Architect of Anarchy
                    ('weekly-02', 10, 1), -- Dominion over the Blocks
                    ('weekly-03', 15, 1)  -- Elite Engineer
            ) AS q(id, target_val, min_level)
            WHERE user_record.player_level >= q.min_level
        )
        -- Insert eligible weeklies (up to 3).
        INSERT INTO public.player_quests (player_id, quest_id, status, progress, target_value)
        SELECT user_record.id, id, 'active', 0, target_val
        FROM eligible_weeklies
        ON CONFLICT (player_id, quest_id) DO NOTHING;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enable pg_cron and Schedule Schedulers
-- Enable extension inside pg_catalog schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Unschedule existing cron jobs safely if they exist to prevent duplicates
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('daily-quest-refresh', 'weekly-quest-refresh');

-- Schedule Daily Quest Refresh at 00:00 UTC every day
SELECT cron.schedule(
  'daily-quest-refresh',
  '0 0 * * *',
  'SELECT public.refresh_daily_quests()'
);

-- Schedule Weekly Quest Refresh at 00:00 UTC every Monday
SELECT cron.schedule(
  'weekly-quest-refresh',
  '0 0 * * 1',
  'SELECT public.refresh_weekly_quests()'
);
