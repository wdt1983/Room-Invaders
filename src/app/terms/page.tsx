import { Outfit } from "next/font/google";
import Link from "next/link";
import { Shield, ChevronLeft, FileText, Terminal, AlertCircle } from "lucide-react";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export default function TermsOfService() {
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
          Document // Terms of Service
        </div>

        <h1 className="font-outfit text-4xl sm:text-5xl font-black uppercase tracking-wider bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">
          Terms of Service
        </h1>
        <p className="text-zinc-500 text-xs font-mono mb-8">
          LAST MODIFIED: MAY 25, 2026 // VERSION 1.0.0
        </p>

        {/* Highlight Callout */}
        <div className="flex items-start gap-4 p-5 rounded-2xl backdrop-blur-xl bg-zinc-950/60 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.05)] mb-8 font-sans">
          <AlertCircle className="w-6 h-6 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-outfit">User Agreement Notice</h3>
            <p className="text-zinc-400 text-xs leading-relaxed">
              Please read these Terms of Service carefully before utilizing our Progressive Web App. By registering an account, constructing coordinates, or participating in active raid breached instances, you explicitly agree to compile and bond with these legal policies.
            </p>
          </div>
        </div>

        {/* Terms Body */}
        <div className="space-y-8 backdrop-blur-xl bg-zinc-950/20 border border-white/5 rounded-3xl p-6 sm:p-10 font-sans text-sm text-zinc-400 leading-relaxed">
          
          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">01 //</span> Agreement to Terms
            </h2>
            <p>
              These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf of an entity (“you”) and Applied Logic Technologies, LLC, doing business as ALT Games (“Company”, “we”, “us”, or “our”), concerning your access to and use of the Room Invaders application.
            </p>
            <p>
              Our services are intended for users who are at least 13 years of age. If you are under the age of 18, you must have your parent or legal guardian's explicit permission to register and play Room Invaders.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">02 //</span> Intellectual Property Rights
            </h2>
            <p>
              Unless otherwise indicated, the application and all source code, databases, operational algorithms, client-side Web Audio synthesizers, Phaser isometric canvas scenes, graphic vectors, UI components, and trademark designs (collectively, the “Content”) are our proprietary property and are protected by copyright, trademark, and trade secret laws.
            </p>
            <p>
              We grant you a limited, non-exclusive, non-transferable, revocable license to access the game and install the PWA shell on your personal devices solely for your personal, non-commercial entertainment.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">03 //</span> Account Security & Coordinates
            </h2>
            <p>
              When establishing your stronghold, you agree to: (a) provide accurate and fresh profile credentials, (b) secure your registration credentials, and (c) immediately notify us if you detect unauthorized access to your account.
            </p>
            <p>
              Strongholds, passive resource levels, technological nodes, inventory currencies, and reputation points (RP) are virtual gameplay attributes that exist authoritatively on our database servers. They represent no real-world financial assets and are not redeemable, tradable, or transferable for cash under any circumstances.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">04 //</span> Prohibited Actions & Anti-Cheat
            </h2>
            <p>
              To maintain a fair, competitive environment for all survivors, the following behaviors are strictly prohibited and constitute a material breach of these terms:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400 text-xs">
              <li>Deploying speed hacks, automated teleport scripts, pathing injection, or macro bots to manipulate squad traversals.</li>
              <li>Exposing server endpoints, spoofing JWT authorizations, or sending forged payloads to the authoritative <code className="text-cyan-400 font-mono px-1 py-0.5 rounded bg-zinc-900">resolve-raid</code> Edge Functions.</li>
              <li>Constructing illegal room grid coordinates that bypass structural boundary guidelines or exceed defense slot caps.</li>
              <li>Uploading toxic, abusive, or copyright-infringing media files for custom wall posters (when custom uploads are active).</li>
            </ul>
            <p>
              We employ automated server-side verification systems to analyze transaction action logs. Any account verified to be running exploits will face immediate account termination and permanent coordinate ban loops.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">05 //</span> Disclaimers & Limitations of Liability
            </h2>
            <p>
              The application is provided on an AS-IS and AS-AVAILABLE basis. You agree that your use of the application and our services will be at your sole risk. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including, without limitation, the implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
            </p>
            <p>
              We will not be liable to you or any third party for any direct, indirect, incidental, special, or consequential damages arising from your access or inability to access the game, even if we have been advised of the possibility of such damages.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-outfit text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <span className="text-cyan-400 font-mono text-xs">06 //</span> Governing Law & Contact Info
            </h2>
            <p>
              These Terms of Service and your use of the application are governed by and construed in accordance with the laws of the State of Delaware, without regard to its conflict of law principles. Any legal action or proceeding arising under these terms shall be brought exclusively in the state or federal courts located in Wilmington, Delaware.
            </p>
            <p>
              If you have any questions, concerns, or coordinate disputes regarding these terms, please contact our legal cell:
            </p>
            <div className="mt-2 p-4 rounded-xl bg-zinc-900/60 border border-white/5 font-mono text-xs text-zinc-300">
              Applied Logic Technologies, LLC<br />
              Attn: ALT Games Division // Room Invaders Team<br />
              Email: legal@altgames.appliedlogictech.com
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
