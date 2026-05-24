-- Migration: 00003_items_inventory.sql
-- Description: Inventories, items catalog, player_items, RLS, auto-create trigger, indexes.
-- Phase: 0 (Foundation)

-- ============================================
-- 1. INVENTORIES
-- ============================================
CREATE TABLE inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scrap INTEGER NOT NULL DEFAULT 200,
    components INTEGER NOT NULL DEFAULT 50,
    credits INTEGER NOT NULL DEFAULT 100,
    contraband INTEGER NOT NULL DEFAULT 0,
    intel INTEGER NOT NULL DEFAULT 10,
    storage_capacity INTEGER NOT NULL DEFAULT 500,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(owner_id)
);

-- ============================================
-- 2. ITEMS (master catalog)
-- ============================================
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN (
        'furniture','trap','turret','barricade','cosmetic','consumable','guard'
    )),
    name TEXT NOT NULL,
    description TEXT,
    tier INTEGER NOT NULL DEFAULT 1,
    cost JSONB NOT NULL DEFAULT '{}',
    stats JSONB NOT NULL DEFAULT '{}',
    footprint JSONB NOT NULL DEFAULT '{"w":1,"h":1}',
    sprite_key TEXT NOT NULL,
    unlock_level INTEGER NOT NULL DEFAULT 1,
    tech_tree_node TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. PLAYER_ITEMS (inventory instances)
-- ============================================
CREATE TABLE player_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    placed_in_room BOOLEAN NOT NULL DEFAULT FALSE,
    grid_position JSONB,  -- {"x":3,"y":5} if placed
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_items ENABLE ROW LEVEL SECURITY;

-- Inventories: Owners only
CREATE POLICY "Users can view own inventory." ON inventories FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can update own inventory." ON inventories FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own inventory." ON inventories FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Items: Public read, no write (system managed)
CREATE POLICY "Items are viewable by everyone." ON items FOR SELECT USING (true);

-- Player Items: Owners only
CREATE POLICY "Users can view own items." ON player_items FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can update own items." ON player_items FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can insert own items." ON player_items FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can delete own items." ON player_items FOR DELETE USING (auth.uid() = owner_id);

-- ============================================
-- 5. AUTO-CREATE INVENTORY TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_profile_inventory()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.inventories (owner_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_inventory
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_profile_inventory();

-- ============================================
-- 6. INDEXES
-- ============================================
CREATE INDEX idx_player_items_owner ON player_items(owner_id);
