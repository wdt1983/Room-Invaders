-- Migration: 00034_raider_customization.sql
-- Description: Add raider customization configuration JSONB to profiles
-- Phase: 9 (Post-Launch Backlog)

-- ============================================
-- 1. ADD RAIDER COSMETICS TO PROFILES
-- ============================================
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS raider_cosmetics JSONB DEFAULT '{"preset":"tactical","gender":"male","helmetColor":1976635,"visorColor":439508,"vestColor":3359061,"pantsColor":1981066,"bootsColor":988970,"hairColor":14242612}'::jsonb NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_raider_cosmetics ON public.profiles USING gin (raider_cosmetics);
