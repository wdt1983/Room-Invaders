import { Outfit } from "next/font/google";
import Link from "next/link";
import { Shield, ChevronLeft, Eye, Terminal, Lock } from "lucide-react";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export default function PrivacyPolicy() {
  return (
    <div className={`${outfit.variable} min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-cyan-500 selection:text-black`}>
      {/* Background Cyber Grid Backdrop */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0c0c0c_1px,transparent_1px),linear-gradient(to_bottom,#0c0c0c_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      
      {/* Ambient Pulsing Light */}
      <div className="absolute top-0 right-0 w-[40%] h-[30%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-black/40 border-b border-white/5 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-cyan-400 transition-colors duration-300 font-outfit text-sm font-bold uppercase tracking-wider">
            <ChevronLeft className="w-4 h-4" />
            Return Home
          </Link>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="font-outfit text-md font-extrabold tracking-widest text-zinc-300">
              ROOM INVADERS LEGAL
            </span>
          </div>
        </div>
      </header>

      {/* Content Section */}
      <main className="relative z-10 max-w-4xl mx-auto py-12 px-4 sm:px-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-xl bg-zinc-900/60 border border-white/10 mb-6 font-mono text-xs text-zinc-400 uppercase">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          Document // Privacy Policy
        </div>

        <h1 className="font-outfit text-4xl sm:text-5xl font-black uppercase tracking-wider bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">
          Privacy Policy
        </h1>
        <p className="text-zinc-500 text-xs font-mono mb-8">
          LAST MODIFIED: MAY 25, 2026 // VERSION 1.0.0
        </p>

        {/* Highlight Callout */}
        <div className="flex items-start gap-4 p-5 rounded-2xl backdrop-blur-xl bg-zinc-950/60 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.05)] mb-8 font-sans">
          <Lock className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-outfit">Our Commitment to Cryptographic Privacy</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              We respect your privacy and are committed to protecting it. This Privacy Policy details what information we collect, how it is authoritatively processed, and the measures we employ to secure your survivor telemetry.
            </p>
          </div>
        </div>

        {/* Privacy Body */}
        <div className="space-y-8 backdrop-blur-xl bg-zinc-950/20 border border-white/5 rounded-3xl p-6 sm:p-10 font-sans text-sm text-zinc-400 leading-relaxed">
          
          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">01 //</span> Information We Collect
            </h2>
            <p>
              When participating in Room Invaders, we collect certain personal and technical information to maintain account authorization and authorize fair gameplay mechanics:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
              <li><strong className="text-white">Account Registration Credentials:</strong> Email addresses and passwords are collected to uniquely register your account profile via Supabase Auth services.</li>
              <li><strong className="text-white">Gameplay Telemetry:</strong> To validate asynchronous PvE and PvP raids, our servers capture placed fixture coordinates, inventory balances (scrap, components, credits, intel, contraband), leveling progress (XP), and detailed raid action logs.</li>
              <li><strong className="text-white">Telemetry & Error Logging:</strong> We utilize Sentry error tracking software to capture client-side engine exceptions, WebGL rendering anomalies, and Deno runtime errors to maintain stability.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">02 //</span> How We Use Your Information
            </h2>
            <p>
              We process your digital data for the following legitimate business and gaming purposes:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
              <li>To maintain account sessions, token rotations, and database Row-Level Security (RLS) policies.</li>
              <li>To authoritatively process squad breaches, calculate post-raid rewards, and update quest milestones inside secure Edge Functions.</li>
              <li>To monitor performance thresholds and keep frame rates at a target 30fps minimum on budget devices.</li>
              <li>To generate anonymized telemetry logs mapping signup registration counts and retention cohorts (D1/D7).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">03 //</span> Sharing & Disclosing Information
            </h2>
            <p>
              We value your privacy. We do <strong className="text-white">NOT</strong> sell, trade, or rent your personal information to third-party advertisers under any circumstances.
            </p>
            <p>
              Information is only shared with standard cloud infra providers necessary to run the game, including: (a) Supabase (database storage and Deno edge servers), (b) Vercel (PWA hosting and file content delivery networks), and (c) Sentry (exception telemetry).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">04 //</span> Data Security & Encryption
            </h2>
            <p>
              We implement comprehensive physical, administrative, and technological security measures designed to secure your virtual parameters from loss, theft, or unauthorized modification.
            </p>
            <p>
              All traffic between your client device PWA and our backend is encrypted in transit using standard Transport Layer Security (TLS/SSL) protocols. Passwords are salted and hashed natively on the database server.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">05 //</span> Your Rights & Access Controls
            </h2>
            <p>
              Depending on your location (e.g. GDPR in the European Union or CCPA in California), you possess specific legal rights regarding your personal data. These include the right to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
              <li>Request a copy of the personal credentials we hold about you.</li>
              <li>Request corrections or deletions of your profile and historical logs.</li>
              <li>Withdraw your consent to data processing (which may require account termination).</li>
            </ul>
            <p>
              To exercise any of these options or request full deletion of your database coordinates, please contact our privacy desk directly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">06 //</span> Policy Updates & Contacts
            </h2>
            <p>
              We may revise this Privacy Policy periodically. If we implement material changes, we will update the version details and notify active strongholds via quest dashboard announcements.
            </p>
            <p>
              For privacy concerns, data exports, or general compliance questions:
            </p>
            <div className="mt-2 p-4 rounded-xl bg-zinc-900/60 border border-white/5 font-mono text-xs text-zinc-300">
              Applied Logic Technologies, LLC<br />
              Attn: ALT Games Division // Room Invaders Team<br />
              Email: privacy@altgames.appliedlogictech.com
            </div>
          </section>

        </div>
      </main>

      {/* Mini Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-zinc-600 relative z-10">
        <p>© {new Date().getFullYear()} Applied Logic Technologies, LLC. att. Room Invaders legal framework.</p>
      </footer>
    </div>
  );
}
