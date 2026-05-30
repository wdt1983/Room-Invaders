-- Migration: 00032_index_optimizations_and_perf.sql
-- Description: Add index optimizations for spatial grid coordinates, bidirectional social connections, and high-frequency trade/achievement reads to maximize database efficiency.
-- Phase: Post-Launch Scalability & Optimization

-- 1. Optimize Spatial Room Placements
-- Phaser scenes (`RoomScene.ts` and `RaidScene.ts`) query placed furniture and defensive items by owner and coordinate bounds.
-- This composite index makes spatial collision checks and room load state hydrations extremely fast.
CREATE INDEX IF NOT EXISTS idx_player_items_coords 
ON public.player_items(owner_id, grid_x, grid_y) 
WHERE placed_in_room = true;

-- 2. Optimize Bidirectional Friend Connections
-- Bidirectional friendship checks query `WHERE (sender_id = X AND receiver_id = Y) OR (sender_id = Y AND receiver_id = X)`.
-- While `UNIQUE(sender_id, receiver_id)` automatically indexes sender-to-receiver lookups, this index covers the reverse receiver-to-sender path.
CREATE INDEX IF NOT EXISTS idx_friendships_reverse 
ON public.friendships(receiver_id, sender_id);

-- 3. Optimize Achievement Completion Hydration
-- Checking completed or equipped player achievements queries `WHERE user_id = X AND is_unlocked = true`.
-- This partial index keeps active trophy calculations lightweight.
CREATE INDEX IF NOT EXISTS idx_player_achievements_completed_user 
ON public.player_achievements(user_id) 
WHERE is_unlocked = true;

-- 4. Optimize Active Cooldowns & Action Analytics
-- Cooldown scans search `raid_history` by player and fixture within timeframes.
-- This composite index covers `completed_at` descending, allowing instant paging.
CREATE INDEX IF NOT EXISTS idx_raid_history_cooldown_completed 
ON public.raid_history(player_id, target_id, created_at DESC);
