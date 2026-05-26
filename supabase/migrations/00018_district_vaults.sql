-- Migration: 00018_district_vaults.sql
-- Description: District vaults and transaction feeds, RLS, and triggers.
-- Phase: 9 (Post-Launch Backlog)

-- 1. Create the district_vaults table
CREATE TABLE public.district_vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE UNIQUE,
    scrap INTEGER NOT NULL DEFAULT 0 CHECK (scrap >= 0),
    components INTEGER NOT NULL DEFAULT 0 CHECK (components >= 0),
    credits INTEGER NOT NULL DEFAULT 0 CHECK (credits >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.district_vaults ENABLE ROW LEVEL SECURITY;

-- Select policy: members of the district can see the vault balance
CREATE POLICY "District members can view vault."
    ON public.district_vaults FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.district_members 
            WHERE district_id = district_vaults.district_id AND profile_id = auth.uid()
        )
    );


-- 2. Create the district_vault_transactions table
CREATE TABLE public.district_vault_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
    resource TEXT NOT NULL CHECK (resource IN ('scrap', 'components', 'credits')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.district_vault_transactions ENABLE ROW LEVEL SECURITY;

-- Select policy: members of the district can view transactions list
CREATE POLICY "District members can view transactions."
    ON public.district_vault_transactions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.district_members 
            WHERE district_id = district_vault_transactions.district_id AND profile_id = auth.uid()
        )
    );

-- Insert policy: members can record their own deposits/withdrawals
CREATE POLICY "District members can insert transactions."
    ON public.district_vault_transactions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.district_members 
            WHERE district_id = district_vault_transactions.district_id AND profile_id = auth.uid()
        ) AND auth.uid() = profile_id
    );


-- 3. Create Trigger Function for Auto-Creating Vaults
CREATE OR REPLACE FUNCTION public.handle_new_district_vault()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.district_vaults (district_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to districts
CREATE OR REPLACE TRIGGER on_district_created
  AFTER INSERT ON public.districts
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_district_vault();


-- 4. Initialize vaults for any pre-existing districts
INSERT INTO public.district_vaults (district_id)
SELECT id FROM public.districts
ON CONFLICT (district_id) DO NOTHING;


-- 5. Create Indexes
CREATE INDEX idx_district_vaults_district ON public.district_vaults(district_id);
CREATE INDEX idx_district_vault_tx_district ON public.district_vault_transactions(district_id);
CREATE INDEX idx_district_vault_tx_profile ON public.district_vault_transactions(profile_id);
CREATE INDEX idx_district_vault_tx_created ON public.district_vault_transactions(created_at DESC);
