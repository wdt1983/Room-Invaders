-- Migration: 00033_fix_battle_pass_reward_item_ids.sql
-- Description: Resolve missing item catalog IDs in seasonal battle pass rewards.

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

    -- Update rewards
    UPDATE public.battle_pass_rewards SET item_id = v_flipped_table_id WHERE season_id = 'season_1' AND tier_number = 1 AND is_premium = TRUE;
    UPDATE public.battle_pass_rewards SET item_id = v_bed_id WHERE season_id = 'season_1' AND tier_number = 3 AND is_premium = FALSE;
    UPDATE public.battle_pass_rewards SET item_id = v_pressure_plate_id WHERE season_id = 'season_1' AND tier_number = 3 AND is_premium = TRUE;
    UPDATE public.battle_pass_rewards SET item_id = v_tripwire_id WHERE season_id = 'season_1' AND tier_number = 5 AND is_premium = FALSE;
    UPDATE public.battle_pass_rewards SET item_id = v_plant_id WHERE season_id = 'season_1' AND tier_number = 5 AND is_premium = TRUE;
    UPDATE public.battle_pass_rewards SET item_id = v_spike_strip_id WHERE season_id = 'season_1' AND tier_number = 7 AND is_premium = FALSE;
    UPDATE public.battle_pass_rewards SET item_id = v_sandbags_id WHERE season_id = 'season_1' AND tier_number = 7 AND is_premium = TRUE;
    UPDATE public.battle_pass_rewards SET item_id = v_taser_id WHERE season_id = 'season_1' AND tier_number = 9 AND is_premium = TRUE;
    UPDATE public.battle_pass_rewards SET item_id = v_autocannon_id WHERE season_id = 'season_1' AND tier_number = 10 AND is_premium = TRUE;
END $$;
