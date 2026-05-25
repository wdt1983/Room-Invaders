"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ShieldAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GlobalErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorBoundary({ error, reset }: GlobalErrorBoundaryProps) {
  useEffect(() => {
    // Log the unhandled root crash to Sentry authoritatively
    console.error("[GlobalErrorBoundary] Critical app crash caught:", error);
    Sentry.captureException(error, {
      tags: {
        boundary: "global-root",
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full flex flex-col bg-[#050505] text-foreground font-sans select-none items-center justify-center p-6">
        <div className="max-w-md w-full border border-red-500/20 bg-[#0d0d0d]/80 backdrop-blur-md rounded-2xl p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
          
          {/* Pulsing Glowing Alert Cpu */}
          <div className="mx-auto rounded-full bg-red-500/10 border border-red-500/20 p-4 w-16 h-16 flex items-center justify-center text-red-500 mb-6">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>

          <h2 className="text-xl font-black tracking-tight text-white mb-2 uppercase">
            System Critical Error
          </h2>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            The base stronghold operating system crashed. Quantum matrix memory allocations have been disrupted. A manual reboot is required.
          </p>

          {/* Error Details */}
          <div className="mb-8 rounded-lg bg-black/60 border border-red-500/10 p-3 text-left">
            <div className="text-[10px] font-mono text-red-500/80 font-bold mb-1 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Core Exception Trace:
            </div>
            <div className="text-[11px] font-mono text-muted-foreground break-all line-clamp-3">
              {error.stack || error.message || "Unhandled root layout exception"}
            </div>
            {error.digest && (
              <div className="text-[9px] font-mono text-muted-foreground/60 mt-1">
                Digest: {error.digest}
              </div>
            )}
          </div>

          {/* Reboot CTA */}
          <Button
            onClick={() => reset()}
            className="w-full font-bold bg-red-600 hover:bg-red-500 border border-red-500/20 text-white gap-2 h-11 uppercase tracking-wide shadow-lg shadow-red-500/10"
          >
            Reboot Stronghold
          </Button>

        </div>
      </body>
    </html>
  );
}
