# Room Invaders

An asynchronous isometric strategy base-builder built as a PWA.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Engine**: Phaser 4 (Isometric Grid, Render Engine)
- **Database/Auth**: Supabase (PostgreSQL, RLS, Edge Functions, Auth)
- **State Management**: Zustand
- **Styling/UI**: TailwindCSS 4, shadcn/ui
- **Telemetry**: Sentry

## Local Development Setup

To run Room Invaders locally, follow these steps:

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Environment Configuration
Copy the template `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Update `.env.local` to include your Supabase project URL and anon key.

### 3. Database Initialization
This project relies heavily on Supabase for auth, schema, and trigger automation. 
Apply the migrations and insert the seed data (items catalog) located in the `supabase/` directory:
- Run all SQL files inside `supabase/migrations/` sequentially.
- Execute the `supabase/seed.sql` script into your database.

### 4. Start Development Server
```bash
pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application in the browser.
