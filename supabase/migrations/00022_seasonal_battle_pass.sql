-- Migration: 00022_seasonal_battle_pass.sql
-- Description: Create battle_pass_tiers, player_battle_pass_progress, and battle_pass_rewards tables.
--              Implement RLS policies, atomic functions for progression/claiming, triggers, and seed season_1.
-- Phase: 9 (Post-Launch Backlog)

-- ============================================
-- 1. TABLES CREATION
-- ============================================

-- Tiers table
CREATE TABLE public.battle_pass_tiers (
    season_id TEXT NOT NULL,
    tier_number INTEGER NOT NULL CHECK (tier_number >= 1),
    required_xp INTEGER NOT NULL CHECK (required_xp >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (season_id, tier_number)
);

-- Progress table
CREATE TABLE public.player_battle_pass_progress (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    season_id TEXT NOT NULL,
    current_tier INTEGER NOT NULL DEFAULT 1 CHECK (current_tier >= 1),
    current_xp INTEGER NOT NULL DEFAULT 0 CHECK (current_xp >= 0),
    is_premium_unlocked BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_free_rewards INTEGER[] NOT NULL DEFAULT '{}',
    claimed_premium_rewards INTEGER[] NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, season_id),
    FOREIGN KEY (season_id, current_tier) REFERENCES public.battle_pass_tiers(season_id, tier_number)
);

-- Rewards table
CREATE TABLE public.battle_pass_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id TEXT NOT NULL,
    tier_number INTEGER NOT NULL,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    reward_type TEXT NOT NULL CHECK (reward_type IN ('scrap', 'components', 'credits', 'contraband', 'intel', 'item', 'xp')),
    reward_amount INTEGER NOT NULL DEFAULT 1 CHECK (reward_amount >= 1),
    item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    FOREIGN KEY (season_id, tier_number) REFERENCES public.battle_pass_tiers(season_id, tier_number) ON DELETE CASCADE
);

-- ============================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.battle_pass_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_battle_pass_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_pass_rewards ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "Tiers are viewable by everyone." ON public.battle_pass_tiers FOR SELECT USING (true);
CREATE POLICY "Rewards are viewable by everyone." ON public.battle_pass_rewards FOR SELECT USING (true);
CREATE POLICY "Users can view own bp progress." ON public.player_battle_pass_progress FOR SELECT USING (auth.uid() = user_id);

-- Write policies
CREATE POLICY "Users can update own bp progress." ON public.player_battle_pass_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bp progress." ON public.player_battle_pass_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX idx_bp_progress_user ON public.player_battle_pass_progress(user_id);
CREATE INDEX idx_bp_rewards_tier ON public.battle_pass_rewards(season_id, tier_number);

-- ============================================
-- 4. ATOMIC DATABASE PROCEDURES
-- ============================================

-- Function: Add Battle Pass XP (with automatic tier-ups and overflow rollover)
CREATE OR REPLACE FUNCTION public.add_battle_pass_xp(p_user_id UUID, p_xp_amount INTEGER)
RETURNS VOID AS $$
DECLARE
    v_current_xp INTEGER;
    v_current_tier INTEGER;
    v_next_tier_xp INTEGER;
    v_season_id TEXT := 'season_1';
BEGIN
    -- Ensure player progress row exists
    INSERT INTO public.player_battle_pass_progress (user_id, season_id, current_tier, current_xp)
    VALUES (p_user_id, v_season_id, 1, 0)
    ON CONFLICT (user_id, season_id) DO NOTHING;

    -- Update BP XP
    UPDATE public.player_battle_pass_progress
    SET current_xp = current_xp + p_xp_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id AND season_id = v_season_id
    RETURNING current_xp, current_tier INTO v_current_xp, v_current_tier;

    -- Loop to handle tier ups
    LOOP
        -- Find the XP required for the NEXT tier
        SELECT required_xp INTO v_next_tier_xp
        FROM public.battle_pass_tiers
        WHERE season_id = v_season_id AND tier_number = v_current_tier + 1;

        -- Exit loop if at max tier or not enough XP
        IF v_next_tier_xp IS NULL OR v_current_xp < v_next_tier_xp THEN
            EXIT;
        END IF;

        -- Consume XP and advance tier
        v_current_xp := v_current_xp - v_next_tier_xp;
        v_current_tier := v_current_tier + 1;

        UPDATE public.player_battle_pass_progress
        SET current_xp = v_current_xp,
            current_tier = v_current_tier
        WHERE user_id = p_user_id AND season_id = v_season_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function: Unlock Premium Battle Pass for 500 Credits
CREATE OR REPLACE FUNCTION public.unlock_premium_battle_pass(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_season_id TEXT := 'season_1';
    v_credits INTEGER;
    v_progress RECORD;
BEGIN
    -- Fetch player credits
    SELECT credits INTO v_credits
    FROM public.inventories
    WHERE owner_id = p_user_id;

    IF v_credits IS NULL OR v_credits < 500 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits. Premium Pass costs 500 Credits.');
    END IF;

    -- Deduct Credits
    UPDATE public.inventories
    SET credits = credits - 500,
        updated_at = NOW()
    WHERE owner_id = p_user_id;

    -- Ensure player progress row exists
    INSERT INTO public.player_battle_pass_progress (user_id, season_id, current_tier, current_xp)
    VALUES (p_user_id, v_season_id, 1, 0)
    ON CONFLICT (user_id, season_id) DO NOTHING;

    -- Set Premium Unlocked
    UPDATE public.player_battle_pass_progress
    SET is_premium_unlocked = TRUE,
        updated_at = NOW()
    WHERE user_id = p_user_id AND season_id = v_season_id
    RETURNING * INTO v_progress;

    RETURN jsonb_build_object(
        'success', true, 
        'is_premium_unlocked', v_progress.is_premium_unlocked, 
        'new_credits', v_credits - 500
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function: Buy Battle Pass Tier for 100 Credits (Skip Tier)
CREATE OR REPLACE FUNCTION public.buy_battle_pass_tier(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_season_id TEXT := 'season_1';
    v_credits INTEGER;
    v_current_tier INTEGER;
    v_max_tier INTEGER;
    v_progress RECORD;
BEGIN
    -- Fetch player credits
    SELECT credits INTO v_credits
    FROM public.inventories
    WHERE owner_id = p_user_id;

    IF v_credits IS NULL OR v_credits < 100 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits. Skipping a tier costs 100 Credits.');
    END IF;

    -- Get player's current tier
    SELECT current_tier INTO v_current_tier
    FROM public.player_battle_pass_progress
    WHERE user_id = p_user_id AND season_id = v_season_id;

    -- Default if row doesn't exist
    IF v_current_tier IS NULL THEN
        v_current_tier := 1;
    END IF;

    -- Find maximum tier
    SELECT MAX(tier_number) INTO v_max_tier
    FROM public.battle_pass_tiers
    WHERE season_id = v_season_id;

    IF v_current_tier >= v_max_tier THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already at maximum Battle Pass Tier.');
    END IF;

    -- Deduct Credits
    UPDATE public.inventories
    SET credits = credits - 100,
        updated_at = NOW()
    WHERE owner_id = p_user_id;

    -- Upsert/Advance Tier
    INSERT INTO public.player_battle_pass_progress (user_id, season_id, current_tier, current_xp)
    VALUES (p_user_id, v_season_id, v_current_tier + 1, 0)
    ON CONFLICT (user_id, season_id) DO UPDATE
    SET current_tier = v_current_tier + 1,
        current_xp = 0,
        updated_at = NOW()
    RETURNING * INTO v_progress;

    RETURN jsonb_build_object(
        'success', true, 
        'new_tier', v_progress.current_tier,
        'new_credits', v_credits - 100
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function: Claim Battle Pass Reward transactionally
CREATE OR REPLACE FUNCTION public.claim_battle_pass_reward(
    p_user_id UUID,
    p_tier_number INTEGER,
    p_is_premium BOOLEAN
)
RETURNS JSONB AS $$
DECLARE
    v_season_id TEXT := 'season_1';
    v_progress RECORD;
    v_reward RECORD;
    v_inventory RECORD;
    v_item_count INTEGER;
BEGIN
    -- Fetch player progress
    SELECT * INTO v_progress
    FROM public.player_battle_pass_progress
    WHERE user_id = p_user_id AND season_id = v_season_id;

    IF v_progress IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No battle pass progress found.');
    END IF;

    -- Validate player has unlocked the tier
    IF v_progress.current_tier < p_tier_number THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tier is locked.');
    END IF;

    -- Validate premium authorization if claiming a premium reward
    IF p_is_premium AND NOT v_progress.is_premium_unlocked THEN
        RETURN jsonb_build_object('success', false, 'error', 'Premium Pass is required.');
    END IF;

    -- Validate not already claimed
    IF p_is_premium THEN
        IF p_tier_number = ANY(v_progress.claimed_premium_rewards) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Premium reward already claimed.');
        END IF;
    ELSE
        IF p_tier_number = ANY(v_progress.claimed_free_rewards) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Free reward already claimed.');
        END IF;
    END IF;

    -- Fetch the reward definition
    SELECT * INTO v_reward
    FROM public.battle_pass_rewards
    WHERE season_id = v_season_id AND tier_number = p_tier_number AND is_premium = p_is_premium;

    IF v_reward IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward definition not found.');
    END IF;

    -- Distribute reward
    CASE v_reward.reward_type
        WHEN 'scrap' THEN
            UPDATE public.inventories SET scrap = scrap + v_reward.reward_amount, updated_at = NOW() WHERE owner_id = p_user_id;
        WHEN 'components' THEN
            UPDATE public.inventories SET components = components + v_reward.reward_amount, updated_at = NOW() WHERE owner_id = p_user_id;
        WHEN 'credits' THEN
            UPDATE public.inventories SET credits = credits + v_reward.reward_amount, updated_at = NOW() WHERE owner_id = p_user_id;
        WHEN 'contraband' THEN
            UPDATE public.inventories SET contraband = contraband + v_reward.reward_amount, updated_at = NOW() WHERE owner_id = p_user_id;
        WHEN 'intel' THEN
            UPDATE public.inventories SET intel = intel + v_reward.reward_amount, updated_at = NOW() WHERE owner_id = p_user_id;
        WHEN 'xp' THEN
            UPDATE public.profiles SET xp = xp + v_reward.reward_amount, updated_at = NOW() WHERE id = p_user_id;
        WHEN 'item' THEN
            IF v_reward.item_id IS NULL THEN
                RETURN jsonb_build_object('success', false, 'error', 'Item reward missing catalog item ID.');
            END IF;
            -- Check if player already owns this item
            SELECT COUNT(*) INTO v_item_count FROM public.player_items WHERE owner_id = p_user_id AND item_id = v_reward.item_id AND placed_in_room = FALSE;
            IF v_item_count > 0 THEN
                UPDATE public.player_items SET quantity = quantity + v_reward.reward_amount WHERE owner_id = p_user_id AND item_id = v_reward.item_id AND placed_in_room = FALSE;
            ELSE
                INSERT INTO public.player_items (owner_id, item_id, quantity, placed_in_room)
                VALUES (p_user_id, v_reward.item_id, v_reward.reward_amount, FALSE);
            END IF;
    END CASE;

    -- Update claimed array
    IF p_is_premium THEN
        UPDATE public.player_battle_pass_progress
        SET claimed_premium_rewards = array_append(claimed_premium_rewards, p_tier_number),
            updated_at = NOW()
        WHERE user_id = p_user_id AND season_id = v_season_id
        RETURNING * INTO v_progress;
    ELSE
        UPDATE public.player_battle_pass_progress
        SET claimed_free_rewards = array_append(claimed_free_rewards, p_tier_number),
            updated_at = NOW()
        WHERE user_id = p_user_id AND season_id = v_season_id
        RETURNING * INTO v_progress;
    END IF;

    -- Fetch updated inventory
    SELECT * INTO v_inventory FROM public.inventories WHERE owner_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'claimed_free_rewards', v_progress.claimed_free_rewards,
        'claimed_premium_rewards', v_progress.claimed_premium_rewards,
        'new_inventory', jsonb_build_object(
            'scrap', v_inventory.scrap,
            'components', v_inventory.components,
            'credits', v_inventory.credits,
            'intel', v_inventory.intel,
            'contraband', v_inventory.contraband
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGER ON PROFILE CREATED
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_profile_battle_pass()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.player_battle_pass_progress (user_id, season_id, current_tier, current_xp)
  VALUES (new.id, 'season_1', 1, 0)
  ON CONFLICT (user_id, season_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_battle_pass ON public.profiles;

CREATE TRIGGER on_profile_created_battle_pass
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_profile_battle_pass();

-- ============================================
-- 6. SEED DATA (SEASON 1)
-- ============================================

-- Seed 10 Tiers
INSERT INTO public.battle_pass_tiers (season_id, tier_number, required_xp) VALUES
('season_1', 1, 0),     -- Starting level (Free claim instantly)
('season_1', 2, 100),
('season_1', 3, 200),
('season_1', 4, 300),
('season_1', 5, 450),
('season_1', 6, 600),
('season_1', 7, 800),
('season_1', 8, 1000),
('season_1', 9, 1300),
('season_1', 10, 1600);

-- Backfill active users
INSERT INTO public.player_battle_pass_progress (user_id, season_id, current_tier, current_xp)
SELECT id, 'season_1', 1, 0
FROM public.profiles
ON CONFLICT (user_id, season_id) DO NOTHING;


-- Seed Free & Premium Rewards
-- Dynamic resolution of item catalog IDs
DO $$
DECLARE
    v_bed_id UUID;
    v_flipped_table_id UUID;
    v_pressure_plate_id UUID;
    v_plant_id UUID;
    v_tripwire_id UUID;
    v_spike_strip_id UUID;
    v_sandbags_id UUID;
    v_taser_id UUID;
    v_autocannon_id UUID;
BEGIN
    -- Look up item catalog IDs
    SELECT id INTO v_bed_id FROM public.items WHERE sprite_key = 'furniture_bed_twin' LIMIT 1;
    SELECT id INTO v_flipped_table_id FROM public.items WHERE sprite_key = 'barricade_flipped_table' LIMIT 1;
    SELECT id INTO v_pressure_plate_id FROM public.items WHERE sprite_key = 'trap_pressure_plate' LIMIT 1;
    SELECT id INTO v_plant_id FROM public.items WHERE sprite_key = 'furniture_plant_potted' LIMIT 1;
    SELECT id INTO v_tripwire_id FROM public.items WHERE sprite_key = 'trap_tripwire_alarm' LIMIT 1;
    SELECT id INTO v_spike_strip_id FROM public.items WHERE sprite_key = 'trap_spike_strip' LIMIT 1;
    SELECT id INTO v_sandbags_id FROM public.items WHERE sprite_key = 'barricade_sandbags' LIMIT 1;
    SELECT id INTO v_taser_id FROM public.items WHERE sprite_key = 'turret_taser' LIMIT 1;
    SELECT id INTO v_autocannon_id FROM public.items WHERE sprite_key = 'turret_autocannon' LIMIT 1;

    -- Tier 1
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 1, FALSE, 'scrap', 100, NULL),
    ('season_1', 1, TRUE, 'item', 1, v_flipped_table_id);

    -- Tier 2
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 2, FALSE, 'components', 10, NULL),
    ('season_1', 2, TRUE, 'credits', 50, NULL);

    -- Tier 3
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 3, FALSE, 'item', 1, v_bed_id),
    ('season_1', 3, TRUE, 'item', 1, v_pressure_plate_id);

    -- Tier 4
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 4, FALSE, 'scrap', 150, NULL),
    ('season_1', 4, TRUE, 'contraband', 10, NULL);

    -- Tier 5
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 5, FALSE, 'item', 1, v_tripwire_id),
    ('season_1', 5, TRUE, 'item', 1, v_plant_id);

    -- Tier 6
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 6, FALSE, 'components', 25, NULL),
    ('season_1', 6, TRUE, 'credits', 100, NULL);

    -- Tier 7
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 7, FALSE, 'item', 1, v_spike_strip_id),
    ('season_1', 7, TRUE, 'item', 1, v_sandbags_id);

    -- Tier 8
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 8, FALSE, 'scrap', 200, NULL),
    ('season_1', 8, TRUE, 'contraband', 20, NULL);

    -- Tier 9
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 9, FALSE, 'intel', 15, NULL),
    ('season_1', 9, TRUE, 'item', 1, v_taser_id);

    -- Tier 10
    INSERT INTO public.battle_pass_rewards (season_id, tier_number, is_premium, reward_type, reward_amount, item_id) VALUES
    ('season_1', 10, FALSE, 'credits', 300, NULL),
    ('season_1', 10, TRUE, 'item', 1, v_autocannon_id);
END $$;
