-- Migration: 00023_custom_posters.sql
-- Description: Add custom image columns to player_items, seed Custom Poster item, create posters bucket and configure secure storage policies.
-- Phase: 9 (Post-Launch Backlog)

-- ============================================
-- 1. EXTEND PLAYER_ITEMS SCHEMA
-- ============================================
ALTER TABLE public.player_items 
ADD COLUMN IF NOT EXISTS custom_image_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moderation_status TEXT CHECK (moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS moderation_error TEXT DEFAULT NULL;

-- ============================================
-- 2. SEED CUSTOM POSTER CATALOG ITEM
-- ============================================
INSERT INTO public.items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level)
VALUES (
    'furniture',
    'Custom Poster',
    'Upload a custom image to decorate your wall. Undergoes automated content safety checks.',
    1,
    '{"scrap": 50}',
    '{"is_poster": true}',
    '{"w": 1, "h": 1}',
    'furniture_custom_poster',
    1
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CREATE STORAGE BUCKET & CONFIGURE POLICIES
-- ============================================
-- Create the posters bucket if it doesn't already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('posters', 'posters', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (if not already enabled by Supabase Storage)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid collision during reruns
DROP POLICY IF EXISTS "Allow public read access to posters" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from own folder" ON storage.objects;

-- SELECT: Allow anyone (public and authenticated) to view all posters in the bucket
CREATE POLICY "Allow public read access to posters" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'posters');

-- INSERT: Allow authenticated users to upload only to their own directory
-- (The path must start with the user's UUID: e.g. "auth_uid_string/filename.png")
CREATE POLICY "Allow authenticated uploads to own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'posters' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Allow authenticated users to update items inside their own directory
CREATE POLICY "Allow authenticated updates to own folder" ON storage.objects
FOR UPDATE TO authenticated
USING (
    bucket_id = 'posters' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'posters' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE: Allow authenticated users to delete items inside their own directory
CREATE POLICY "Allow authenticated deletes from own folder" ON storage.objects
FOR DELETE TO authenticated
USING (
    bucket_id = 'posters' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);
