
-- 1. Safely remap placed player items to the primary (kept) item records
WITH kept_items AS (
  SELECT DISTINCT ON (sprite_key) id, sprite_key
  FROM public.items
  ORDER BY sprite_key, id
)
UPDATE public.player_items pi
SET item_id = k.id
FROM kept_items k
JOIN public.items i ON i.sprite_key = k.sprite_key
WHERE pi.item_id = i.id AND pi.item_id <> k.id;

-- 2. Delete all duplicate item records, keeping only the primary record
DELETE FROM public.items a
USING public.items b
WHERE a.id > b.id
  AND a.sprite_key = b.sprite_key;
