-- Migration: 00002_rooms.sql
-- Description: Rooms table, RLS policies, auto-create trigger on profile insert, indexes.
-- Phase: 0 (Foundation)

-- 1. Create the rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    room_level INTEGER NOT NULL DEFAULT 1,
    grid_size INTEGER NOT NULL DEFAULT 10,
    layout JSONB NOT NULL DEFAULT '[]',
    cosmetics JSONB NOT NULL DEFAULT '{}',
    entry_points JSONB NOT NULL DEFAULT '[
        {"type":"door","wall":"south","position":5},
        {"type":"window","wall":"east","position":5},
        {"type":"vent","wall":"north","position":5}
    ]',
    defense_rating INTEGER NOT NULL DEFAULT 0,
    times_raided INTEGER NOT NULL DEFAULT 0,
    last_raided_at TIMESTAMPTZ,
    shield_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id)
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Authenticated users can view any room (necessary for scouting/visiting/raiding)
CREATE POLICY "Rooms are viewable by authenticated users."
    ON rooms FOR SELECT USING (auth.role() = 'authenticated');

-- Owners can update their own room
CREATE POLICY "Users can update own room."
    ON rooms FOR UPDATE USING (auth.uid() = owner_id);

-- Owners can insert their own room (though trigger handles initial creation)
CREATE POLICY "Users can insert own room."
    ON rooms FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- 4. Create Trigger Function for Room Auto-Creation
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.rooms (owner_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Bind Trigger to profiles
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_profile();

-- 6. Create Indexes
CREATE INDEX idx_rooms_owner ON rooms(owner_id);
CREATE INDEX idx_rooms_defense_rating ON rooms(defense_rating);
