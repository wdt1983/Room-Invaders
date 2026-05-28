-- Migration: 00027_district_territory.sql
-- Description: Hex-based territory control schema, skirmish tracking, tug-of-war update function, and daily dividends.

-- 1. Create the district_territories table
CREATE TABLE public.district_territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    q INTEGER NOT NULL,
    r INTEGER NOT NULL,
    name TEXT NOT NULL UNIQUE,
    resource_type TEXT NOT NULL CHECK (resource_type IN ('refinery', 'vault', 'intel_dish', 'power_station')),
    controlling_district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
    influence_points INTEGER NOT NULL DEFAULT 0 CHECK (influence_points >= 0 AND influence_points <= 100),
    is_locked BOOLEAN NOT NULL DEFAULT FALSE,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(q, r)
);

-- Enable RLS
ALTER TABLE public.district_territories ENABLE ROW LEVEL SECURITY;

-- Select policy: viewable by authenticated users
CREATE POLICY "District territories are viewable by authenticated users."
    ON public.district_territories FOR SELECT
    USING (auth.role() = 'authenticated');

-- Update policy: system or authed users (via functions) can update
CREATE POLICY "District territories can be updated by authenticated users."
    ON public.district_territories FOR UPDATE
    USING (auth.role() = 'authenticated');


-- 2. Create the territory_skirmishes table
CREATE TABLE public.territory_skirmishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_id UUID NOT NULL REFERENCES public.district_territories(id) ON DELETE CASCADE,
    district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    influence_contributed INTEGER NOT NULL CHECK (influence_contributed <> 0),
    raid_outcome TEXT NOT NULL CHECK (raid_outcome IN ('victory', 'defeat')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.territory_skirmishes ENABLE ROW LEVEL SECURITY;

-- Select policy: viewable by authenticated users
CREATE POLICY "Territory skirmishes are viewable by authenticated users."
    ON public.territory_skirmishes FOR SELECT
    USING (auth.role() = 'authenticated');

-- Insert policy: authenticated users can insert their own skirmishes
CREATE POLICY "Users can record territory skirmishes."
    ON public.territory_skirmishes FOR INSERT
    WITH CHECK (auth.uid() = profile_id);


-- 3. Seed the 19-Hex Board (Radius 2)
INSERT INTO public.district_territories (q, r, name, resource_type) VALUES
  (0, 0, 'Core Processor Vault', 'vault'),
  (1, 0, 'Sector A Refinery', 'refinery'),
  (0, 1, 'Sector B Grid', 'power_station'),
  (-1, 1, 'Sector C Array', 'intel_dish'),
  (-1, 0, 'Sector D Depot', 'vault'),
  (0, -1, 'Sector E Station', 'power_station'),
  (1, -1, 'Sector F Uplink', 'intel_dish'),
  (2, 0, 'Border Node Delta', 'refinery'),
  (1, 1, 'Border Node Gamma', 'power_station'),
  (0, 2, 'Border Node Beta', 'vault'),
  (-1, 2, 'Border Node Alpha', 'intel_dish'),
  (-2, 2, 'Wasteland Core', 'refinery'),
  (-2, 1, 'Wasteland Hub', 'power_station'),
  (-2, 0, 'Wasteland Array', 'intel_dish'),
  (-1, -1, 'Outer Grid Echo', 'vault'),
  (0, -2, 'Outer Grid Foxtrot', 'refinery'),
  (1, -2, 'Outer Grid Golf', 'power_station'),
  (2, -2, 'Outer Grid Hotel', 'intel_dish'),
  (2, -1, 'Outer Grid India', 'vault')
ON CONFLICT (q, r) DO NOTHING;


-- 4. Tug-of-War Transactional PG Function
CREATE OR REPLACE FUNCTION public.record_skirmish_and_update_influence(
    p_profile_id UUID,
    p_territory_id UUID,
    p_district_id UUID,
    p_outcome TEXT,
    p_influence_change INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_current_district UUID;
    v_current_influence INTEGER;
    v_new_district UUID;
    v_new_influence INTEGER;
    v_is_locked BOOLEAN;
    v_locked_until TIMESTAMPTZ;
    v_member_exists BOOLEAN;
    v_result JSONB;
BEGIN
    -- Verify the player actually belongs to this district
    SELECT EXISTS (
        SELECT 1 FROM public.district_members
        WHERE profile_id = p_profile_id AND district_id = p_district_id
    ) INTO v_member_exists;

    IF NOT v_member_exists THEN
        RAISE EXCEPTION 'Player does not belong to the specified district.';
    END IF;

    -- Fetch current territory state
    SELECT controlling_district_id, influence_points, is_locked, locked_until
    INTO v_current_district, v_current_influence, v_is_locked, v_locked_until
    FROM public.district_territories
    WHERE id = p_territory_id;

    -- Handle lock status
    IF v_is_locked AND v_locked_until > NOW() THEN
        RAISE EXCEPTION 'Territory is locked down after a recent capture and cannot be attacked.';
    ELSIF v_is_locked THEN
        -- Lock expired, clear it
        UPDATE public.district_territories
        SET is_locked = FALSE, locked_until = NULL
        WHERE id = p_territory_id;
        v_is_locked := FALSE;
    END IF;

    -- Calculate Tug of War Influence adjustments
    IF p_outcome = 'victory' THEN
        IF v_current_district IS NULL THEN
            -- Neutral territory is captured immediately
            v_new_district := p_district_id;
            v_new_influence := p_influence_change;
            
            -- Lock for 1 hour after fresh capture to avoid instant flip
            UPDATE public.district_territories
            SET controlling_district_id = v_new_district,
                influence_points = v_new_influence,
                is_locked = TRUE,
                locked_until = NOW() + INTERVAL '1 hour'
            WHERE id = p_territory_id;
            
        ELSIF v_current_district = p_district_id THEN
            -- Fortify own territory
            v_new_district := p_district_id;
            v_new_influence := LEAST(100, v_current_influence + p_influence_change);
            
            UPDATE public.district_territories
            SET influence_points = v_new_influence
            WHERE id = p_territory_id;
            
        ELSE
            -- Attack rival territory (tug of war)
            IF v_current_influence > p_influence_change THEN
                -- Reduce rival influence
                v_new_district := v_current_district;
                v_new_influence := v_current_influence - p_influence_change;
                
                UPDATE public.district_territories
                SET influence_points = v_new_influence
                WHERE id = p_territory_id;
            ELSE
                -- Rival loses control, attacker gains it
                v_new_district := p_district_id;
                v_new_influence := p_influence_change - v_current_influence;
                IF v_new_influence = 0 THEN
                    v_new_influence := 5; -- Base minimum starting hold
                END IF;
                
                UPDATE public.district_territories
                SET controlling_district_id = v_new_district,
                    influence_points = v_new_influence,
                    is_locked = TRUE,
                    locked_until = NOW() + INTERVAL '1 hour'
                WHERE id = p_territory_id;
            END IF;
        END IF;

        -- Record skincare contribution
        INSERT INTO public.territory_skirmishes (territory_id, district_id, profile_id, influence_contributed, raid_outcome)
        VALUES (p_territory_id, p_district_id, p_profile_id, p_influence_change, 'victory');

    ELSE
        -- Defeat contributes 0 influence, but records the attempt
        v_new_district := v_current_district;
        v_new_influence := v_current_influence;

        INSERT INTO public.territory_skirmishes (territory_id, district_id, profile_id, influence_contributed, raid_outcome)
        VALUES (p_territory_id, p_district_id, p_profile_id, 0, 'defeat');
    END IF;

    SELECT jsonb_build_object(
        'success', TRUE,
        'controlling_district_id', v_new_district,
        'influence_points', v_new_influence,
        'is_locked', (v_new_district <> COALESCE(v_current_district, '00000000-0000-0000-0000-000000000000'::UUID))
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Daily Reset / Dividends Distribution Function
CREATE OR REPLACE FUNCTION public.distribute_territory_dividends()
RETURNS INTEGER AS $$
DECLARE
    v_row RECORD;
    v_scrap_gained INTEGER;
    v_comp_gained INTEGER;
    v_cred_gained INTEGER;
    v_count INTEGER := 0;
BEGIN
    FOR v_row IN 
        SELECT controlling_district_id, resource_type, COUNT(*) as nodes_count
        FROM public.district_territories
        WHERE controlling_district_id IS NOT NULL
        GROUP BY controlling_district_id, resource_type
    LOOP
        v_scrap_gained := 0;
        v_comp_gained := 0;
        v_cred_gained := 0;

        IF v_row.resource_type = 'refinery' THEN
            v_comp_gained := 50 * v_row.nodes_count;
        ELSIF v_row.resource_type = 'vault' THEN
            v_scrap_gained := 100 * v_row.nodes_count;
        ELSIF v_row.resource_type = 'power_station' THEN
            v_cred_gained := 150 * v_row.nodes_count;
        ELSIF v_row.resource_type = 'intel_dish' THEN
            v_scrap_gained := 50 * v_row.nodes_count;
            v_comp_gained := 50 * v_row.nodes_count;
        END IF;

        -- Update the district vaults directly
        UPDATE public.district_vaults
        SET scrap = scrap + v_scrap_gained,
            components = components + v_comp_gained,
            credits = credits + v_cred_gained,
            updated_at = NOW()
        WHERE district_id = v_row.controlling_district_id;

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Indexes
CREATE INDEX idx_district_territories_control ON public.district_territories(controlling_district_id);
CREATE INDEX idx_territory_skirmishes_territory ON public.territory_skirmishes(territory_id);
CREATE INDEX idx_territory_skirmishes_district ON public.territory_skirmishes(district_id);
CREATE INDEX idx_territory_skirmishes_profile ON public.territory_skirmishes(profile_id);
CREATE INDEX idx_territory_skirmishes_created ON public.territory_skirmishes(created_at DESC);
