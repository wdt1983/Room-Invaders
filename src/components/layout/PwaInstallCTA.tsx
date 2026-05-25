"use client";

import { useEffect, useState } from "react";
import { Download, Check, HelpCircle, ArrowUpRight, Share2, Plus } from "lucide-react";

export function PwaInstallCTA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installStatus, setInstallStatus] = useState<"idle" | "installing" | "installed" | "declined">("idle");

  useEffect(() => {
    // 1. Detect if already running as standalone PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      if (isStandaloneMode) {
        setInstallStatus("installed");
      }
    };
    
    checkStandalone();

    // 2. Detect iOS
    const detectIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isApple);
    };
    
    detectIOS();

    // 3. Capture beforeinstallprompt event for Chromium browsers
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    setInstallStatus("installing");
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallStatus("installed");
      setIsInstallable(false);
      setDeferredPrompt(null);
    } else {
      setInstallStatus("declined");
    }
  };

  if (isStandalone || installStatus === "installed") {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center backdrop-blur-xl bg-emerald-950/20 border border-emerald-500/20 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.05)] max-w-md mx-auto transition-all duration-500 animate-fade-in">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mb-4 animate-pulse">
          <Check className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold text-emerald-400 mb-2 font-outfit">Stronghold Offline & Synced</h3>
        <p className="text-sm text-zinc-400 leading-relaxed font-sans">
          Room Invaders PWA is installed and initialized. Launch from your home screen for high-performance offline gameplay and exclusive immersive shell mode.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto backdrop-blur-xl bg-zinc-950/40 border border-white/10 hover:border-cyan-500/30 transition-all duration-500 shadow-[0_0_40px_rgba(0,0,0,0.6)] rounded-3xl p-6 sm:p-8 relative overflow-hidden">
      {/* Background Decorative Cyber grid */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.08),transparent_70%)] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-4">
          <Download className="w-6 h-6 animate-bounce" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2 font-outfit tracking-wide uppercase">
          Fortify Your Device
        </h3>
        <p className="text-zinc-400 text-sm mb-6 max-w-sm font-sans leading-relaxed">
          Install the official Progressive Web App for optimized frame rates, full-screen zero-browser-UI layout, and instant network synchronization.
        </p>

        {isInstallable ? (
          <button
            onClick={handleInstallClick}
            disabled={installStatus === "installing"}
            className="group relative flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold font-outfit text-base uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
          >
            {installStatus === "installing" ? (
              <>
                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Encrypting...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                Deploy PWA Stronghold
              </>
            )}
          </button>
        ) : isIOS ? (
          <div className="w-full text-left space-y-4 bg-zinc-900/60 border border-white/5 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm uppercase tracking-wider font-outfit">
              <ArrowUpRight className="w-4 h-4" /> iOS Installation Required
            </div>
            <div className="space-y-3 text-zinc-300 text-sm font-sans">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-zinc-800 text-cyan-400 text-xs font-bold shrink-0">1</div>
                <p>Open this page in the native <strong className="text-white font-medium">Safari</strong> browser.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-zinc-800 text-cyan-400 text-xs font-bold shrink-0">2</div>
                <p className="flex items-center gap-1.5 flex-wrap">
                  Tap the native iOS Share button <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-white text-xs border border-white/10"><Share2 className="w-3.5 h-3.5 text-zinc-400" /> Share</span> in Safari.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-zinc-800 text-cyan-400 text-xs font-bold shrink-0">3</div>
                <p className="flex items-center gap-1.5 flex-wrap">
                  Scroll down the share sheet and select <strong className="text-white font-medium flex items-center gap-1"><Plus className="w-4 h-4 text-zinc-400" /> Add to Home Screen</strong>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full text-left space-y-3 bg-zinc-900/40 border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 font-semibold text-xs uppercase tracking-wider font-outfit">
              <HelpCircle className="w-4 h-4" /> Installation Assistant
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed font-sans">
              No direct browser installation prompt found. If you are on desktop Chrome or Edge, click the <strong className="text-zinc-200">Install icon (📥)</strong> in the top-right of your URL address bar to secure your dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
