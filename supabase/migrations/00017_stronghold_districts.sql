-- Migration: 00017_stronghold_districts.sql
-- Description: Districts and district_members tables, RLS policies, indexes.
-- Phase: 9 (Post-Launch Backlog)

-- 1. Create the districts table
CREATE TABLE public.districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

-- Select policy: viewable by authenticated users
CREATE POLICY "Districts are viewable by authenticated users."
    ON public.districts FOR SELECT
    USING (auth.role() = 'authenticated');

-- Insert policy: any authenticated user can create a district
CREATE POLICY "Authenticated users can create districts."
    ON public.districts FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Delete policy: any member of the district can delete it if it is empty (or we can cascade delete)
CREATE POLICY "Authenticated users can delete districts."
    ON public.districts FOR DELETE
    USING (auth.role() = 'authenticated');


-- 2. Create the district_members table
CREATE TABLE public.district_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    grid_x INTEGER NOT NULL CHECK (grid_x BETWEEN 0 AND 2),
    grid_y INTEGER NOT NULL CHECK (grid_y BETWEEN 0 AND 2),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(district_id, grid_x, grid_y),
    UNIQUE(profile_id) -- A player can belong to only one district at a time
);

-- Enable RLS
ALTER TABLE public.district_members ENABLE ROW LEVEL SECURITY;

-- Select policy: viewable by authenticated users
CREATE POLICY "District members are viewable by authenticated users."
    ON public.district_members FOR SELECT
    USING (auth.role() = 'authenticated');

-- Insert policy: players can join a district grid slot themselves
CREATE POLICY "Users can join districts."
    ON public.district_members FOR INSERT
    WITH CHECK (auth.uid() = profile_id);

-- Delete policy: players can leave a district
CREATE POLICY "Users can leave districts."
    ON public.district_members FOR DELETE
    USING (auth.uid() = profile_id);


-- 3. Create Indexes
CREATE INDEX idx_district_members_district ON public.district_members(district_id);
CREATE INDEX idx_district_members_profile ON public.district_members(profile_id);
CREATE INDEX idx_district_members_coords ON public.district_members(district_id, grid_x, grid_y);
