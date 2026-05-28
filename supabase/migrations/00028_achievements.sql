-- Migration: 00028_achievements.sql
-- Description: Create achievement_catalog, player_achievements, profiles columns, inventories columns, automatic trigger validations, and backfills.

-- ============================================
-- 1. TABLES CREATION
-- ============================================

-- Achievement Catalog (master catalog)
CREATE TABLE public.achievement_catalog (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    target_metric TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('badge', 'portrait_border', 'room_skin', 'credits')),
    reward_code TEXT NOT NULL,
    reward_amount INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Player Achievements progress tracking
CREATE TABLE public.player_achievements (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES public.achievement_catalog(id) ON DELETE CASCADE,
    progress INTEGER NOT NULL DEFAULT 0,
    is_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    unlocked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- ============================================
-- 2. PROFILE & INVENTORY EXTENSIONS
-- ============================================

-- Add active cosmetic slots to player profiles
ALTER TABLE public.profiles 
ADD COLUMN active_badge TEXT,
ADD COLUMN active_border TEXT,
ADD COLUMN active_room_skin TEXT;

-- Add spent tracking parameters for the double spender achievement in inventories
ALTER TABLE public.inventories
ADD COLUMN last_victory_at TIMESTAMPTZ,
ADD COLUMN last_spend_at TIMESTAMPTZ,
ADD COLUMN spend_count_after_victory INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.achievement_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;

-- Read and write policies
CREATE POLICY "Achievement catalog is viewable by everyone." 
    ON public.achievement_catalog FOR SELECT USING (true);

CREATE POLICY "Users can view own achievements." 
    ON public.player_achievements FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements." 
    ON public.player_achievements FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements." 
    ON public.player_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. INDEXES
-- ============================================

CREATE INDEX idx_player_achievements_user ON public.player_achievements(user_id);
CREATE INDEX idx_player_achievements_unlocked ON public.player_achievements(user_id, is_unlocked);

-- ============================================
-- 5. SEED DATA
-- ============================================

INSERT INTO public.achievement_catalog (id, name, description, target_metric, target_value, reward_type, reward_code) VALUES
('raids_50', 'Veteran Raider', 'Successfully complete 50 raids.', 'successful_raids', 50, 'badge', 'badge_veteran_raider'),
('outposts_5', 'Grid Overlord', 'Your district controls 5 outposts simultaneously on the neighborhood board.', 'outposts_held', 5, 'room_skin', 'neon_glitch'),
('double_spent_scrap', 'Double Spender', 'Spent plundered scrap on two upgrades/purchases within 30 seconds of a successful raid.', 'double_spent_scrap', 1, 'portrait_border', 'neon-green')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 6. TRIGGERS & FUNCTIONS
-- ============================================

-- Trigger: Automatically increment successful raid victories progress
CREATE OR REPLACE FUNCTION public.handle_raid_victory_achievement()
RETURNS trigger AS $$
BEGIN
    IF NEW.outcome = 'victory' THEN
        INSERT INTO public.player_achievements (user_id, achievement_id, progress, is_unlocked, unlocked_at)
        VALUES (
            NEW.player_id, 
            'raids_50', 
            1, 
            FALSE, 
            NULL
        )
        ON CONFLICT (user_id, achievement_id) DO UPDATE
        SET progress = LEAST(50, player_achievements.progress + 1),
            is_unlocked = CASE WHEN player_achievements.progress + 1 >= 50 THEN TRUE ELSE FALSE END,
            unlocked_at = CASE WHEN player_achievements.progress + 1 >= 50 AND NOT player_achievements.is_unlocked THEN NOW() ELSE player_achievements.unlocked_at END,
            updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_raid_recorded_achievement
    AFTER INSERT ON public.raid_history
    FOR EACH ROW EXECUTE PROCEDURE public.handle_raid_victory_achievement();

-- Trigger: Automatically seed achievements for new profiles
CREATE OR REPLACE FUNCTION public.handle_new_profile_achievements()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.player_achievements (user_id, achievement_id, progress, is_unlocked)
    SELECT NEW.id, id, 0, FALSE
    FROM public.achievement_catalog
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_achievements
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_profile_achievements();

-- ============================================
-- 7. HISTORICAL BACKFILL
-- ============================================

-- a) Pre-initialize all existing users with achievement records
INSERT INTO public.player_achievements (user_id, achievement_id, progress, is_unlocked)
SELECT p.id, c.id, 0, FALSE
FROM public.profiles p
CROSS JOIN public.achievement_catalog c
ON CONFLICT (user_id, achievement_id) DO NOTHING;

-- b) Calculate and backfill historical victory progress
DO $$
DECLARE
    v_profile RECORD;
    v_victory_count INTEGER;
BEGIN
    FOR v_profile IN SELECT id FROM public.profiles LOOP
        SELECT COUNT(*) INTO v_victory_count
        FROM public.raid_history
        WHERE player_id = v_profile.id AND outcome = 'victory';

        IF v_victory_count > 0 THEN
            UPDATE public.player_achievements
            SET progress = LEAST(50, v_victory_count),
                is_unlocked = CASE WHEN v_victory_count >= 50 THEN TRUE ELSE FALSE END,
                unlocked_at = CASE WHEN v_victory_count >= 50 THEN NOW() ELSE NULL END,
                updated_at = NOW()
            WHERE user_id = v_profile.id AND achievement_id = 'raids_50';
        END IF;
    END LOOP;
END $$;
