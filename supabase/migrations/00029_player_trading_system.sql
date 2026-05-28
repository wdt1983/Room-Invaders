-- Migration: 00029_player_trading_system.sql
-- Description: Peer-to-peer barter trading system tables, RLS policies, indices, and plpgsql escrow functions.
-- Phase: 9 (Post-Launch Backlog - Milestone 9M)

-- ============================================
-- 1. TRADE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.trade_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'withdrawn', 'declined')) DEFAULT 'pending',
    offer_scrap INTEGER NOT NULL DEFAULT 0 CHECK (offer_scrap >= 0),
    offer_components INTEGER NOT NULL DEFAULT 0 CHECK (offer_components >= 0),
    offer_credits INTEGER NOT NULL DEFAULT 0 CHECK (offer_credits >= 0),
    demand_scrap INTEGER NOT NULL DEFAULT 0 CHECK (demand_scrap >= 0),
    demand_components INTEGER NOT NULL DEFAULT 0 CHECK (demand_components >= 0),
    demand_credits INTEGER NOT NULL DEFAULT 0 CHECK (demand_credits >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.trade_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_offer_id UUID NOT NULL REFERENCES public.trade_offers(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    direction TEXT NOT NULL CHECK (direction IN ('offer', 'demand'))
);

-- ============================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_items ENABLE ROW LEVEL SECURITY;

-- trade_offers Select policy
DROP POLICY IF EXISTS "Users can view own trade offers." ON public.trade_offers;
CREATE POLICY "Users can view own trade offers."
    ON public.trade_offers FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- trade_offers Insert policy
DROP POLICY IF EXISTS "Users can insert own trade offers as sender." ON public.trade_offers;
CREATE POLICY "Users can insert own trade offers as sender."
    ON public.trade_offers FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- trade_offers Update policy
DROP POLICY IF EXISTS "Users can update own trade offers." ON public.trade_offers;
CREATE POLICY "Users can update own trade offers."
    ON public.trade_offers FOR UPDATE
    USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- trade_items Select policy
DROP POLICY IF EXISTS "Users can view own trade items." ON public.trade_items;
CREATE POLICY "Users can view own trade items."
    ON public.trade_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.trade_offers
            WHERE id = trade_items.trade_offer_id
              AND (auth.uid() = sender_id OR auth.uid() = receiver_id)
        )
    );

-- trade_items Insert policy
DROP POLICY IF EXISTS "Users can insert trade items." ON public.trade_items;
CREATE POLICY "Users can insert trade items."
    ON public.trade_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.trade_offers
            WHERE id = trade_items.trade_offer_id
              AND auth.uid() = sender_id
        )
    );

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_trade_offers_sender ON public.trade_offers(sender_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_receiver ON public.trade_offers(receiver_id);
CREATE INDEX IF NOT EXISTS idx_trade_offers_status ON public.trade_offers(status);
CREATE INDEX IF NOT EXISTS idx_trade_items_offer ON public.trade_items(trade_offer_id);

-- ============================================
-- 4. ESCROW PROCEDURES (plpgsql)
-- ============================================

-- 1. Propose Trade
CREATE OR REPLACE FUNCTION public.propose_trade(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_offer_scrap INTEGER,
    p_offer_components INTEGER,
    p_offer_credits INTEGER,
    p_demand_scrap INTEGER,
    p_demand_components INTEGER,
    p_demand_credits INTEGER,
    p_items JSONB -- Array of {"item_id": "...", "quantity": N, "direction": "offer"|"demand"}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_friend BOOLEAN;
    v_is_district_mate BOOLEAN;
    v_inventory_id UUID;
    v_sender_scrap INTEGER;
    v_sender_components INTEGER;
    v_sender_credits INTEGER;
    v_trade_id UUID;
    v_item RECORD;
    v_player_item_id UUID;
    v_available_qty INTEGER;
    v_sender_username TEXT;
BEGIN
    -- Check relation constraints: must be friends or district mates
    SELECT EXISTS (
        SELECT 1 FROM public.friendships
        WHERE ((sender_id = p_sender_id AND receiver_id = p_receiver_id)
           OR (sender_id = p_receiver_id AND receiver_id = p_sender_id))
          AND status = 'accepted'
    ) INTO v_is_friend;

    SELECT EXISTS (
        SELECT 1 FROM public.district_members m1
        JOIN public.district_members m2 ON m1.district_id = m2.district_id
        WHERE m1.profile_id = p_sender_id AND m2.profile_id = p_receiver_id
    ) INTO v_is_district_mate;

    IF NOT (v_is_friend OR v_is_district_mate) THEN
        RETURN jsonb_build_object('success', false, 'error', 'You can only trade with friends or district mates.');
    END IF;

    -- Lock sender inventory
    SELECT id, scrap, components, credits INTO v_inventory_id, v_sender_scrap, v_sender_components, v_sender_credits
    FROM public.inventories
    WHERE owner_id = p_sender_id
    FOR UPDATE;

    IF v_inventory_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inventory record not found.');
    END IF;

    -- Validate offered resources
    IF v_sender_scrap < p_offer_scrap OR v_sender_components < p_offer_components OR v_sender_credits < p_offer_credits THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient materials for offer.');
    END IF;

    -- Insert trade offer
    INSERT INTO public.trade_offers (
        sender_id, receiver_id, status, 
        offer_scrap, offer_components, offer_credits, 
        demand_scrap, demand_components, demand_credits
    )
    VALUES (
        p_sender_id, p_receiver_id, 'pending', 
        p_offer_scrap, p_offer_components, p_offer_credits, 
        p_demand_scrap, p_demand_components, p_demand_credits
    )
    RETURNING id INTO v_trade_id;

    -- Deduct offered materials
    UPDATE public.inventories
    SET scrap = scrap - p_offer_scrap,
        components = components - p_offer_components,
        credits = credits - p_offer_credits,
        updated_at = NOW()
    WHERE id = v_inventory_id;

    -- Process offered & demanded items
    IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
        FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(item_id UUID, quantity INTEGER, direction TEXT)
        LOOP
            IF v_item.direction = 'offer' THEN
                -- Lock unplaced player_items row for sender
                SELECT id, quantity INTO v_player_item_id, v_available_qty
                FROM public.player_items
                WHERE owner_id = p_sender_id AND item_id = v_item.item_id AND placed_in_room = false
                FOR UPDATE;

                IF v_player_item_id IS NULL OR v_available_qty < v_item.quantity THEN
                    RAISE EXCEPTION 'Insufficient item quantity in inventory for item %', v_item.item_id;
                END IF;

                -- Deduct item from inventory (Delete if 0)
                IF v_available_qty = v_item.quantity THEN
                    DELETE FROM public.player_items WHERE id = v_player_item_id;
                ELSE
                    UPDATE public.player_items SET quantity = quantity - v_item.quantity WHERE id = v_player_item_id;
                END IF;
            END IF;

            -- Insert into trade_items
            INSERT INTO public.trade_items (trade_offer_id, item_id, quantity, direction)
            VALUES (v_trade_id, v_item.item_id, v_item.quantity, v_item.direction);
        END LOOP;
    END IF;

    -- Send notification
    SELECT username INTO v_sender_username FROM public.profiles WHERE id = p_sender_id;
    INSERT INTO public.notifications (user_id, type, title, content, metadata)
    VALUES (
        p_receiver_id,
        'trade_proposed',
        'Trade Proposal Proposed',
        COALESCE(v_sender_username, 'A survivor') || ' proposed a barter trade offer to you.',
        jsonb_build_object('trade_id', v_trade_id)
    );

    RETURN jsonb_build_object('success', true, 'trade_id', v_trade_id);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 2. Accept Trade
CREATE OR REPLACE FUNCTION public.accept_trade(
    p_trade_id UUID,
    p_receiver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_target_receiver_id UUID;
    v_status TEXT;
    v_offer_scrap INTEGER;
    v_offer_components INTEGER;
    v_offer_credits INTEGER;
    v_demand_scrap INTEGER;
    v_demand_components INTEGER;
    v_demand_credits INTEGER;
    
    v_rec_inventory_id UUID;
    v_rec_scrap INTEGER;
    v_rec_components INTEGER;
    v_rec_credits INTEGER;
    
    v_item RECORD;
    v_player_item_id UUID;
    v_available_qty INTEGER;
    v_existing_id UUID;
    v_receiver_username TEXT;
BEGIN
    -- Lock and retrieve trade offer
    SELECT sender_id, receiver_id, status, offer_scrap, offer_components, offer_credits, demand_scrap, demand_components, demand_credits
    INTO v_sender_id, v_target_receiver_id, v_status, v_offer_scrap, v_offer_components, v_offer_credits, v_demand_scrap, v_demand_components, v_demand_credits
    FROM public.trade_offers
    WHERE id = p_trade_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade offer not found.');
    END IF;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade is no longer pending.');
    END IF;

    IF v_target_receiver_id != p_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to accept this trade.');
    END IF;

    -- Lock receiver inventory
    SELECT id, scrap, components, credits INTO v_rec_inventory_id, v_rec_scrap, v_rec_components, v_rec_credits
    FROM public.inventories
    WHERE owner_id = p_receiver_id
    FOR UPDATE;

    -- Validate demanded materials from receiver
    IF v_rec_scrap < v_demand_scrap OR v_rec_components < v_demand_components OR v_rec_credits < v_demand_credits THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient resources to fulfill counter-demand.');
    END IF;

    -- Lock and validate demanded items from receiver
    FOR v_item IN SELECT item_id, quantity FROM public.trade_items WHERE trade_offer_id = p_trade_id AND direction = 'demand'
    LOOP
        SELECT id, quantity INTO v_player_item_id, v_available_qty
        FROM public.player_items
        WHERE owner_id = p_receiver_id AND item_id = v_item.item_id AND placed_in_room = false
        FOR UPDATE;

        IF v_player_item_id IS NULL OR v_available_qty < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient items in inventory to fulfill demand.';
        END IF;
    END LOOP;

    -- Deduct demanded materials from receiver
    UPDATE public.inventories
    SET scrap = scrap - v_demand_scrap,
        components = components - v_demand_components,
        credits = credits - v_demand_credits,
        updated_at = NOW()
    WHERE owner_id = p_receiver_id;

    -- Credit demanded materials to sender
    UPDATE public.inventories
    SET scrap = scrap + v_demand_scrap,
        components = components + v_demand_components,
        credits = credits + v_demand_credits,
        updated_at = NOW()
    WHERE owner_id = v_sender_id;

    -- Credit offered materials (escrowed) to receiver
    UPDATE public.inventories
    SET scrap = scrap + v_offer_scrap,
        components = components + v_offer_components,
        credits = credits + v_offer_credits,
        updated_at = NOW()
    WHERE owner_id = p_receiver_id;

    -- Transfer items transactionally
    FOR v_item IN SELECT item_id, quantity, direction FROM public.trade_items WHERE trade_offer_id = p_trade_id
    LOOP
        IF v_item.direction = 'demand' THEN
            -- Deduct from receiver player_items
            SELECT id, quantity INTO v_player_item_id, v_available_qty
            FROM public.player_items
            WHERE owner_id = p_receiver_id AND item_id = v_item.item_id AND placed_in_room = false
            FOR UPDATE;

            IF v_available_qty = v_item.quantity THEN
                DELETE FROM public.player_items WHERE id = v_player_item_id;
            ELSE
                UPDATE public.player_items SET quantity = quantity - v_item.quantity WHERE id = v_player_item_id;
            END IF;

            -- Add to sender player_items (Upsert)
            SELECT id INTO v_existing_id FROM public.player_items
            WHERE owner_id = v_sender_id AND item_id = v_item.item_id AND placed_in_room = false
            FOR UPDATE;

            IF v_existing_id IS NOT NULL THEN
                UPDATE public.player_items SET quantity = quantity + v_item.quantity WHERE id = v_existing_id;
            ELSE
                INSERT INTO public.player_items (owner_id, item_id, quantity, placed_in_room)
                VALUES (v_sender_id, v_item.item_id, v_item.quantity, false);
            END IF;

        ELSIF v_item.direction = 'offer' THEN
            -- Offered items are already deducted from sender during propose. Add to receiver (Upsert)
            SELECT id INTO v_existing_id FROM public.player_items
            WHERE owner_id = p_receiver_id AND item_id = v_item.item_id AND placed_in_room = false
            FOR UPDATE;

            IF v_existing_id IS NOT NULL THEN
                UPDATE public.player_items SET quantity = quantity + v_item.quantity WHERE id = v_existing_id;
            ELSE
                INSERT INTO public.player_items (owner_id, item_id, quantity, placed_in_room)
                VALUES (p_receiver_id, v_item.item_id, v_item.quantity, false);
            END IF;
        END IF;
    END LOOP;

    -- Update trade status to accepted
    UPDATE public.trade_offers
    SET status = 'accepted',
        updated_at = NOW()
    WHERE id = p_trade_id;

    -- Send notification
    SELECT username INTO v_receiver_username FROM public.profiles WHERE id = p_receiver_id;
    INSERT INTO public.notifications (user_id, type, title, content, metadata)
    VALUES (
        v_sender_id,
        'trade_accepted',
        'Trade Proposal Accepted',
        COALESCE(v_receiver_username, 'A survivor') || ' accepted your trade barter offer!',
        jsonb_build_object('trade_id', p_trade_id)
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 3. Withdraw Trade
CREATE OR REPLACE FUNCTION public.withdraw_trade(
    p_trade_id UUID,
    p_sender_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_status TEXT;
    v_offer_scrap INTEGER;
    v_offer_components INTEGER;
    v_offer_credits INTEGER;
    
    v_item RECORD;
    v_existing_id UUID;
BEGIN
    -- Lock and retrieve trade
    SELECT sender_id, status, offer_scrap, offer_components, offer_credits
    INTO v_sender_id, v_status, v_offer_scrap, v_offer_components, v_offer_credits
    FROM public.trade_offers
    WHERE id = p_trade_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade offer not found.');
    END IF;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade is no longer pending.');
    END IF;

    IF v_sender_id != p_sender_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to withdraw this trade.');
    END IF;

    -- Refund offered materials to sender
    UPDATE public.inventories
    SET scrap = scrap + v_offer_scrap,
        components = components + v_offer_components,
        credits = credits + v_offer_credits,
        updated_at = NOW()
    WHERE owner_id = p_sender_id;

    -- Refund offered items to sender
    FOR v_item IN SELECT item_id, quantity FROM public.trade_items WHERE trade_offer_id = p_trade_id AND direction = 'offer'
    LOOP
        SELECT id INTO v_existing_id FROM public.player_items
        WHERE owner_id = p_sender_id AND item_id = v_item.item_id AND placed_in_room = false
        FOR UPDATE;

        IF v_existing_id IS NOT NULL THEN
            UPDATE public.player_items SET quantity = quantity + v_item.quantity WHERE id = v_existing_id;
        ELSE
            INSERT INTO public.player_items (owner_id, item_id, quantity, placed_in_room)
            VALUES (p_sender_id, v_item.item_id, v_item.quantity, false);
        END IF;
    END LOOP;

    -- Update status
    UPDATE public.trade_offers
    SET status = 'withdrawn',
        updated_at = NOW()
    WHERE id = p_trade_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 4. Decline Trade
CREATE OR REPLACE FUNCTION public.decline_trade(
    p_trade_id UUID,
    p_receiver_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_receiver_id UUID;
    v_status TEXT;
    v_offer_scrap INTEGER;
    v_offer_components INTEGER;
    v_offer_credits INTEGER;
    
    v_item RECORD;
    v_existing_id UUID;
    v_receiver_username TEXT;
BEGIN
    -- Lock and retrieve trade
    SELECT sender_id, receiver_id, status, offer_scrap, offer_components, offer_credits
    INTO v_sender_id, v_receiver_id, v_status, v_offer_scrap, v_offer_components, v_offer_credits
    FROM public.trade_offers
    WHERE id = p_trade_id
    FOR UPDATE;

    IF v_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade offer not found.');
    END IF;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Trade is no longer pending.');
    END IF;

    IF v_receiver_id != p_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized to decline this trade.');
    END IF;

    -- Refund offered materials back to sender
    UPDATE public.inventories
    SET scrap = scrap + v_offer_scrap,
        components = components + v_offer_components,
        credits = credits + v_offer_credits,
        updated_at = NOW()
    WHERE owner_id = v_sender_id;

    -- Refund offered items back to sender
    FOR v_item IN SELECT item_id, quantity FROM public.trade_items WHERE trade_offer_id = p_trade_id AND direction = 'offer'
    LOOP
        SELECT id INTO v_existing_id FROM public.player_items
        WHERE owner_id = v_sender_id AND item_id = v_item.item_id AND placed_in_room = false
        FOR UPDATE;

        IF v_existing_id IS NOT NULL THEN
            UPDATE public.player_items SET quantity = quantity + v_item.quantity WHERE id = v_existing_id;
        ELSE
            INSERT INTO public.player_items (owner_id, item_id, quantity, placed_in_room)
            VALUES (v_sender_id, v_item.item_id, v_item.quantity, false);
        END IF;
    END LOOP;

    -- Update status
    UPDATE public.trade_offers
    SET status = 'declined',
        updated_at = NOW()
    WHERE id = p_trade_id;

    -- Send notification
    SELECT username INTO v_receiver_username FROM public.profiles WHERE id = p_receiver_id;
    INSERT INTO public.notifications (user_id, type, title, content, metadata)
    VALUES (
        v_sender_id,
        'trade_declined',
        'Trade Proposal Declined',
        COALESCE(v_receiver_username, 'A survivor') || ' declined your trade barter offer.',
        jsonb_build_object('trade_id', p_trade_id)
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
