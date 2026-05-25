-- Migration: 00012_player_items_rls_hardening.sql
-- Description: Harden player_items SELECT policy to restrict non-owners from seeing traps and turrets, preserving strategic fog-of-war.
-- Phase: 8 (Polish & MVP Launch Prep)

-- Drop the old wide-open SELECT policy
DROP POLICY IF EXISTS "Player items are viewable by authenticated users." ON public.player_items;

-- Re-create SELECT policy that enforces trap and turret obfuscation for non-owners
CREATE POLICY "Player items are viewable by authenticated users if not traps or turrets."
    ON public.player_items FOR SELECT
    USING (
        auth.uid() = owner_id 
        OR (
            auth.role() = 'authenticated' 
            AND EXISTS (
                SELECT 1 FROM public.items i
                WHERE i.id = item_id
                AND i.type NOT IN ('trap', 'turret')
            )
        )
    );
