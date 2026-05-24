-- Migration: 00001_profiles.sql
-- Description: Profiles table, RLS policies, and auth signup trigger.
-- Phase: 0 (Foundation)

-- 1. Create the profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    player_level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    reputation INTEGER NOT NULL DEFAULT 0,
    safe_mode_until TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    tutorial_step INTEGER NOT NULL DEFAULT 0,
    tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
-- Profiles are public to view (needed for matchmaking/visiting)
CREATE POLICY "Public profiles are viewable by everyone."
    ON profiles FOR SELECT USING (true);

-- Users can update their own profiles
CREATE POLICY "Users can update own profile."
    ON profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Create Trigger Function for Auth Signups
-- Pulls the username from the raw_user_meta_data we passed during the signup action
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    COALESCE(new.raw_user_meta_data->>'username', 'Survivor')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Bind Trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
