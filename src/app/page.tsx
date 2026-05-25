import { Outfit } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { PwaInstallCTA } from "@/components/layout/PwaInstallCTA";

export const dynamic = "force-dynamic";
import { 
  Shield, 
  Swords, 
  Target, 
  Cpu, 
  Lock, 
  User, 
  LogIn, 
  Grid3X3, 
  Users, 
  ChevronRight,
  Sparkles,
  Terminal,
  Activity
} from "lucide-react";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export default async function Home() {
  let isAuthenticated = false;
  let username = "";

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    isAuthenticated = !!user;
    
    if (user) {
      // Query player profile for username display
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single() as any;
      username = profile?.username || "Survivor";
    }
  } catch (error) {
    console.error("Failed to fetch session in landing page:", error);
  }

  return (
    <div className={`${outfit.variable} min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-cyan-500 selection:text-black`}>
      {/* Dynamic Cyber Grid Backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0c0c_1px,transparent_1px),linear-gradient(to_bottom,#0c0c0c_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Ambient Pulsing Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-orange-500/5 blur-[150px] pointer-events-none" />

      {/* High-Tech Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-black/40 border-b border-white/5 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 p-[1px] shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <div className="w-full h-full bg-black rounded-[11px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <span className="font-outfit text-xl font-extrabold tracking-widest bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              ROOM INVADERS
            </span>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 text-xs font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  {username}
                </span>
                <Link
                  href="/room"
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-sm font-bold font-outfit uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:-translate-y-0.5"
                >
                  Return to Base
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white text-sm font-medium transition-all duration-300"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </Link>
                <Link
                  href="/register"
                  className="hidden sm:flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold font-outfit text-sm uppercase tracking-wider transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                >
                  Join Stronghold
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-16 px-4 sm:px-8 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full backdrop-blur-xl bg-zinc-900/60 border border-white/10 mb-8 animate-fade-in">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-zinc-300 font-mono tracking-wider uppercase">
            System Online // PWA Version 0.4.8 Ready
          </span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping ml-1" />
        </div>

        <h1 className="font-outfit text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight leading-[1.05] uppercase bg-gradient-to-b from-white via-zinc-200 to-zinc-600 bg-clip-text text-transparent mb-6 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          YOUR BEDROOM.<br />
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(6,182,212,0.35)] font-black">
            YOUR STRONGHOLD.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-zinc-400 text-base sm:text-lg md:text-xl font-normal leading-relaxed mb-12 font-sans px-4">
          Build a digital replica of your personal space in a post-collapse grid world. Fortify it with taser turrets, alarm triggers, and heavy barricades, then gather your squad to breach your rivals' chambers.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4">
          {isAuthenticated ? (
            <Link
              href="/room"
              className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-cyan-400 to-teal-400 hover:from-cyan-300 hover:to-teal-300 text-black font-black font-outfit text-lg uppercase tracking-widest transition-all duration-300 shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] hover:-translate-y-0.5"
            >
              <Swords className="w-5 h-5 animate-pulse" />
              Enter War Room
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black font-outfit text-lg uppercase tracking-widest transition-all duration-300 shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] hover:-translate-y-0.5"
              >
                <Sparkles className="w-5 h-5 text-black" />
                Claim Room Coordinates
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-10 py-5 rounded-2xl backdrop-blur-xl bg-zinc-950/40 border border-white/10 hover:border-white/20 text-white font-bold font-outfit text-lg uppercase tracking-widest transition-all duration-300 hover:bg-zinc-900/40"
              >
                Enter Stronghold
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Live Cybernetic Gameplay Metrics Showcase */}
      <section className="relative z-10 py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-outfit text-3xl sm:text-5xl font-black uppercase tracking-wider text-white mb-4">
            Authoritative Breach Operations
          </h2>
          <p className="text-zinc-500 text-sm sm:text-base font-sans max-w-xl mx-auto">
            Experience asynchronous competitive raid loops managed by secure server-side logic and optimized client-side visuals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Room Editor Showcase */}
          <div className="group relative backdrop-blur-xl bg-zinc-950/40 border border-white/5 hover:border-cyan-500/30 rounded-3xl overflow-hidden transition-all duration-500 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <div className="relative h-64 sm:h-72 w-full overflow-hidden border-b border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
              <Image
                src="/screenshots/room_editor.png"
                alt="Bedroom Fortification Blueprint"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-md bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 text-xxs font-mono uppercase tracking-widest">
                System // Blueprint Mode
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-3">
                <Grid3X3 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg sm:text-xl font-bold text-white font-outfit uppercase tracking-wider">
                  Tactical Room Customizer
                </h3>
              </div>
              <p className="text-zinc-400 text-sm font-sans leading-relaxed">
                Design a custom, pixel-aligned bedroom layout using a robust isometric editor. Place beds, desk arrays, and shelves strategically to block intruder pathfinding and map active combat choke points.
              </p>
            </div>
          </div>

          {/* Recon Map Showcase */}
          <div className="group relative backdrop-blur-xl bg-zinc-950/40 border border-white/5 hover:border-orange-500/30 rounded-3xl overflow-hidden transition-all duration-500 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <div className="relative h-64 sm:h-72 w-full overflow-hidden border-b border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
              <Image
                src="/screenshots/recon_map.png"
                alt="Neighborhood Sector Recon Map"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-md bg-orange-950/80 border border-orange-500/30 text-orange-400 text-xxs font-mono uppercase tracking-widest">
                Recon // Neighborhood Block
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-3">
                <Target className="w-5 h-5 text-orange-400" />
                <h3 className="text-lg sm:text-xl font-bold text-white font-outfit uppercase tracking-wider">
                  Global Recon Map
                </h3>
              </div>
              <p className="text-zinc-400 text-sm font-sans leading-relaxed">
                Scout the surrounding neighborhood block to identify tactical targets. Scan defense ratings, inspect raidable overflow capacities, and pay Intel details to reveal locked traps and entry points.
              </p>
            </div>
          </div>

          {/* Active Raid Showcase */}
          <div className="group relative backdrop-blur-xl bg-zinc-950/40 border border-white/5 hover:border-purple-500/30 rounded-3xl overflow-hidden transition-all duration-500 shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
            <div className="relative h-64 sm:h-72 w-full overflow-hidden border-b border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
              <Image
                src="/screenshots/active_raid.png"
                alt="Tactical Squad Breach Action"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute top-4 left-4 z-20 px-3 py-1 rounded-md bg-purple-950/80 border border-purple-500/30 text-purple-400 text-xxs font-mono uppercase tracking-widest">
                Action // Active Breach
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-3">
                <Swords className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg sm:text-xl font-bold text-white font-outfit uppercase tracking-wider">
                  Tactical Squad Breaching
                </h3>
              </div>
              <p className="text-zinc-400 text-sm font-sans leading-relaxed">
                Breach locked doors, vents, or skylights. Command 2-4 squad members equipped with customizable weapons and gear. Deploy Medkits, clear barriers with Breach Charges, or stun turrets with EMPs in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gameplay Pillars Cards Grid */}
      <section className="relative z-10 py-16 px-4 sm:px-8 max-w-7xl mx-auto bg-[radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.03),transparent_60%)] border-y border-white/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="p-6 rounded-2xl bg-zinc-950/30 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h4 className="text-white font-bold font-outfit mb-2 uppercase text-sm tracking-wider">My Room, My Fortress</h4>
            <p className="text-zinc-400 text-xs font-sans leading-relaxed">
              Complete ownership. Make your bedroom uniquely yours using extensive wall picker systems and customized structural tiles while strengthening barricade blockades.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950/30 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-white font-bold font-outfit mb-2 uppercase text-sm tracking-wider">Secured Fortifications</h4>
            <p className="text-zinc-400 text-xs font-sans leading-relaxed">
              Place traps, sentry autoguns, and patrol guards within strategic perimeter defense slots to maintain an authoritative stronghold against raids.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950/30 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="text-white font-bold font-outfit mb-2 uppercase text-sm tracking-wider">Strategic Tech Tree</h4>
            <p className="text-zinc-400 text-xs font-sans leading-relaxed">
              Expand your tactical specialization. Spend earned Tech Points across modular Offense, Defense, and Utility upgrade nodes to unlock new structures.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-950/30 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-white font-bold font-outfit mb-2 uppercase text-sm tracking-wider">Asymmetric PvP Loops</h4>
            <p className="text-zinc-400 text-xs font-sans leading-relaxed">
              Gain prestige points by completing victories. Plunder unprotected resource overflows, re-watch automated defense logs, and trigger direct revenge raids.
            </p>
          </div>
        </div>
      </section>

      {/* PWA Active Installer section */}
      <section className="relative z-10 py-20 px-4 sm:px-8">
        <PwaInstallCTA />
      </section>

      {/* Cybernetic Footer */}
      <footer className="relative z-10 bg-black border-t border-white/5 py-12 px-4 sm:px-8 text-center text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold tracking-widest text-zinc-300 uppercase">
              ROOM INVADERS // ALT Games
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium font-sans">
            <Link href="/terms" className="hover:text-cyan-400 transition-colors duration-300">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-cyan-400 transition-colors duration-300">
              Privacy Policy
            </Link>
            <a href="https://github.com/wdt1983/Room-Invaders" className="hover:text-cyan-400 transition-colors duration-300" target="_blank" rel="noopener noreferrer">
              Development Hub
            </a>
          </div>

          <p className="text-[10px] font-mono text-zinc-600">
            © {new Date().getFullYear()} Applied Logic Technologies, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
