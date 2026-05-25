"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ShieldAlert, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GameShellErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log the error to Sentry authoritatively
    console.error("[GameShellErrorBoundary] Route exception caught:", error);
    Sentry.captureException(error, {
      tags: {
        boundary: "game-shell-layout",
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-background/95 p-6 select-none font-sans">
      <div className="max-w-md w-full border border-destructive/20 bg-card/45 backdrop-blur-md rounded-2xl p-8 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        {/* Pulsing Glowing Alert Shield */}
        <div className="mx-auto rounded-full bg-destructive/10 border border-destructive/20 p-4 w-16 h-16 flex items-center justify-center text-destructive mb-6">
          <ShieldAlert className="w-8 h-8 animate-pulse text-red-500" />
        </div>

        <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-2">
          Sync Coordinates Disrupted
        </h2>
        <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
          The quantum navigation grid encountered a positioning error. The connection to your stronghold room was temporarily desynchronized.
        </p>

        {/* Error Details Accordion */}
        <div className="mb-8 rounded-lg bg-black/40 border border-muted/20 p-3 text-left">
          <div className="text-[10px] font-mono text-destructive/80 font-bold mb-1 uppercase tracking-wider">
            Exception Log:
          </div>
          <div className="text-[11px] font-mono text-muted-foreground break-all line-clamp-2">
            {error.message || "Unknown routing exception"}
          </div>
          {error.digest && (
            <div className="text-[9px] font-mono text-muted-foreground/60 mt-1">
              Digest: {error.digest}
            </div>
          )}
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="w-full font-bold bg-cyan-600/90 hover:bg-cyan-500 border border-cyan-500/20 text-white gap-2 h-10 shadow-lg shadow-cyan-500/10"
          >
            <RefreshCw className="w-4 h-4 animate-spin-slow" />
            Sync Coordinates
          </Button>

          <Link href="/room" className="w-full">
            <Button
              variant="outline"
              className="w-full font-bold border-muted/20 hover:border-muted/40 bg-background/40 hover:bg-background/80 text-foreground gap-2 h-10"
            >
              <Home className="w-4 h-4" />
              Return to Base
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
