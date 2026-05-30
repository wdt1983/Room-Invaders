-- Migration: 00031_holographic_boss_pedestal.sql
-- Description: Add Holographic Boss Pedestal to master items catalog
-- Phase: 9 (Expansion)

INSERT INTO public.items (type, name, description, tier, cost, stats, footprint, sprite_key, unlock_level)
SELECT 
  'furniture'::text, 
  'Holographic Boss Pedestal'::text, 
  'A sleek metal terminal projecting a rotating, glowing holographic trophy of a defeated boss.'::text, 
  5, 
  '{"scrap": 250, "components": 50}'::jsonb, 
  '{}'::jsonb, 
  '{"w": 1, "h": 1}'::jsonb, 
  'furniture_boss_pedestal'::text, 
  5
WHERE NOT EXISTS (
  SELECT 1 FROM public.items WHERE sprite_key = 'furniture_boss_pedestal'
);
