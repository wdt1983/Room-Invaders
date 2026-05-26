-- Migration: 00020_vault_procedures.sql
-- Description: Transactional database procedures for vault deposits and withdrawals with double-spend locks and cap enforcement.
-- Phase: 9 (Post-Launch Backlog)

-- 1. Deposit Procedure
CREATE OR REPLACE FUNCTION public.deposit_to_vault(
    p_profile_id UUID,
    p_resource TEXT,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_district_id UUID;
    v_inventory_id UUID;
    v_current_balance INTEGER;
BEGIN
    -- 1. Check if profile belongs to a district
    SELECT district_id INTO v_district_id
    FROM public.district_members
    WHERE profile_id = p_profile_id;

    IF v_district_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not belong to any district.');
    END IF;

    -- 2. Validate parameters
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Deposit amount must be positive.');
    END IF;

    IF p_resource NOT IN ('scrap', 'components', 'credits') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid resource type.');
    END IF;

    -- 3. Get player inventory balance and lock the row to prevent race conditions
    SELECT id, 
           CASE 
               WHEN p_resource = 'scrap' THEN scrap
               WHEN p_resource = 'components' THEN components
               WHEN p_resource = 'credits' THEN credits
           END INTO v_inventory_id, v_current_balance
    FROM public.inventories
    WHERE owner_id = p_profile_id
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inventory record not found.');
    END IF;

    IF v_current_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient inventory resources.');
    END IF;

    -- 4. Deduct resource from player inventory
    IF p_resource = 'scrap' THEN
        UPDATE public.inventories SET scrap = scrap - p_amount, updated_at = NOW() WHERE id = v_inventory_id;
    ELSIF p_resource = 'components' THEN
        UPDATE public.inventories SET components = components - p_amount, updated_at = NOW() WHERE id = v_inventory_id;
    ELSIF p_resource = 'credits' THEN
        UPDATE public.inventories SET credits = credits - p_amount, updated_at = NOW() WHERE id = v_inventory_id;
    END IF;

    -- 5. Add resource to district vault
    IF p_resource = 'scrap' THEN
        UPDATE public.district_vaults SET scrap = scrap + p_amount, updated_at = NOW() WHERE district_id = v_district_id;
    ELSIF p_resource = 'components' THEN
        UPDATE public.district_vaults SET components = components + p_amount, updated_at = NOW() WHERE district_id = v_district_id;
    ELSIF p_resource = 'credits' THEN
        UPDATE public.district_vaults SET credits = credits + p_amount, updated_at = NOW() WHERE district_id = v_district_id;
    END IF;

    -- 6. Log transaction
    INSERT INTO public.district_vault_transactions (district_id, profile_id, type, resource, amount)
    VALUES (v_district_id, p_profile_id, 'deposit', p_resource, p_amount);

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Deposited ' || p_amount || ' ' || p_resource || ' successfully.',
        'district_id', v_district_id
    );
END;
$$;


-- 2. Withdrawal Procedure
CREATE OR REPLACE FUNCTION public.withdraw_from_vault(
    p_profile_id UUID,
    p_resource TEXT,
    p_amount INTEGER,
    p_daily_cap INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_district_id UUID;
    v_grid_x INTEGER;
    v_grid_y INTEGER;
    v_vault_balance INTEGER;
    v_withdrawn_24h INTEGER;
BEGIN
    -- 1. Check if profile belongs to a district
    SELECT district_id, grid_x, grid_y INTO v_district_id, v_grid_x, v_grid_y
    FROM public.district_members
    WHERE profile_id = p_profile_id;

    IF v_district_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You do not belong to any district.');
    END IF;

    -- 2. Validate parameters
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal amount must be positive.');
    END IF;

    IF p_resource NOT IN ('scrap', 'components', 'credits') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid resource type.');
    END IF;

    -- 3. Check daily limits for non-leaders (central slot (1, 1) is the leader)
    IF NOT (v_grid_x = 1 AND v_grid_y = 1) THEN
        -- Calculate amount withdrawn in the last 24 hours
        SELECT COALESCE(SUM(amount), 0) INTO v_withdrawn_24h
        FROM public.district_vault_transactions
        WHERE district_id = v_district_id
          AND profile_id = p_profile_id
          AND type = 'withdrawal'
          AND resource = p_resource
          AND created_at >= NOW() - INTERVAL '24 hours';

        IF (v_withdrawn_24h + p_amount) > p_daily_cap THEN
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Exceeds daily withdrawal cap. Remaining quota: ' || (p_daily_cap - v_withdrawn_24h) || ' ' || p_resource
            );
        END IF;
    END IF;

    -- 4. Get vault balance and lock the row to prevent race conditions
    SELECT 
        CASE 
            WHEN p_resource = 'scrap' THEN scrap
            WHEN p_resource = 'components' THEN components
            WHEN p_resource = 'credits' THEN credits
        END INTO v_vault_balance
    FROM public.district_vaults
    WHERE district_id = v_district_id
    FOR UPDATE;

    IF v_vault_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'District vault not found.');
    END IF;

    IF v_vault_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient vault resources.');
    END IF;

    -- 5. Deduct resource from vault
    IF p_resource = 'scrap' THEN
        UPDATE public.district_vaults SET scrap = scrap - p_amount, updated_at = NOW() WHERE district_id = v_district_id;
    ELSIF p_resource = 'components' THEN
        UPDATE public.district_vaults SET components = components - p_amount, updated_at = NOW() WHERE district_id = v_district_id;
    ELSIF p_resource = 'credits' THEN
        UPDATE public.district_vaults SET credits = credits - p_amount, updated_at = NOW() WHERE district_id = v_district_id;
    END IF;

    -- 6. Add resource to player's inventory
    IF p_resource = 'scrap' THEN
        UPDATE public.inventories SET scrap = scrap + p_amount, updated_at = NOW() WHERE owner_id = p_profile_id;
    ELSIF p_resource = 'components' THEN
        UPDATE public.inventories SET components = components + p_amount, updated_at = NOW() WHERE owner_id = p_profile_id;
    ELSIF p_resource = 'credits' THEN
        UPDATE public.inventories SET credits = credits + p_amount, updated_at = NOW() WHERE owner_id = p_profile_id;
    END IF;

    -- 7. Log transaction
    INSERT INTO public.district_vault_transactions (district_id, profile_id, type, resource, amount)
    VALUES (v_district_id, p_profile_id, 'withdrawal', p_resource, p_amount);

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Withdrew ' || p_amount || ' ' || p_resource || ' successfully.',
        'district_id', v_district_id
    );
END;
$$;
