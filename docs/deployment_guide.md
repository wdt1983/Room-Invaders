# Staging & Production Deployment Guide

This document provides the step-by-step technical instructions for deploying the **Room Invaders** schema migrations, Deno Edge Functions, and Next.js front-end assets to live Supabase staging and production cloud environments.

---

## 1. Database Schema Migrations

Supabase db migrations are managed locally in the `supabase/migrations/` directory. They must be pushed in chronological order using the Supabase CLI.

### 1.1 Local Dry Run & Verification
Prior to cloud pushes, always reset and verify the local container database to ensure zero migration conflicts or foreign key inconsistencies:
```bash
# Reset local DB containers and run seeds
supabase db reset
```

### 1.2 Remote Cloud Deploy (Staging / Production)
To link your local environment and push migrations to the cloud:

1. **Log in to the Supabase CLI**:
   ```bash
   supabase login
   ```
2. **Link your project**:
   Use your Supabase project ref code (found in the cloud dashboard settings or in `supabase/config.toml`):
   ```bash
   supabase link --project-ref tqvsympapbmpbwkydumc
   ```
3. **Push Migrations**:
   Compare the cloud schema against local migrations and apply any new files (`00001` through `00032`):
   ```bash
   supabase db push
   ```

---

## 2. Deno Edge Functions

Room Invaders utilizes server-authoritative Deno Edge Functions (e.g., `resolve-raid`, `process-quest`, `matchmaking`, `validate-defense`) for secure calculations, anti-doubling seed derivation, and chronological replay validation.

### 2.1 Environmental Secret Keys
Ensure that staging/production environments have their Supabase Service Role and environment keys declared on the dashboard:
* `SUPABASE_URL` (Auto-injected in edge functions)
* `SUPABASE_SERVICE_ROLE_KEY` (Auto-injected, bypasses RLS for authoritative validation write commits)

### 2.2 Edge Function Deployments
Deploy Deno pure functions to your active linked project:

```bash
# Deploy all functions simultaneously
supabase functions deploy

# Or deploy specific functions individually
supabase functions deploy resolve-raid
supabase functions deploy process-quest
supabase functions deploy matchmaking
supabase functions deploy validate-defense
```

*Note: The platform JWT verifiers are disabled inside `supabase/config.toml` to allow functions to execute custom request-scoped `supabase.auth.getUser()` calls cleanly under the ES256 default verifiers.*

---

## 3. High-Traffic Index Optimizations

Migration `00032_index_optimizations_and_perf.sql` establishes premium composite indexes targeting high-traffic indices:

1. **`idx_player_items_coords`**:
   * **Target**: `public.player_items(owner_id, grid_x, grid_y) WHERE placed_in_room = true`
   * **Rationale**: Speeds up Phaser Room and Raid spatial layout loads and editor placement colliders.
2. **`idx_friendships_reverse`**:
   * **Target**: `public.friendships(receiver_id, sender_id)`
   * **Rationale**: Covers the reverse path for bidirectional sender/receiver social checks.
3. **`idx_player_achievements_completed_user`**:
   * **Target**: `public.player_achievements(user_id) WHERE is_unlocked = true`
   * **Rationale**: Optimizes quick lookups of unlocked profile cosmetics and milestones.
4. **`idx_raid_history_cooldown_completed`**:
   * **Target**: `public.raid_history(player_id, target_id, created_at DESC)`
   * **Rationale**: Instantly calculates the 4-hour room raiding cooldown limit.

---

## 4. Next.js & Turbopack Frontend Deployment

The front-end Web application uses Next.js 16 and is fully optimized for Vercel or cloud VPS platforms.

### 4.1 Production Build Check
Before deploying, execute the local production bundler to verify TypeScript types, page generation paths, and static routes compile flawlessly:
```bash
pnpm run build
```

### 4.2 Environmental Configurations
Declare the following environment keys inside your Vercel or cloud deployment settings:
```ini
NEXT_PUBLIC_SUPABASE_URL=https://tqvsympapbmpbwkydumc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

### 4.3 Staging URL Hydration
Verify that client-side Zustand store endpoints (`useRoomStore.ts`, `usePlayerStore.ts`) and custom action modules in `src/app/actions/` target the resolved HTTPS gateway of your staging environment for zero CORS blocks.
