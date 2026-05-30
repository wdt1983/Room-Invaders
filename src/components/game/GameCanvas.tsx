"use client";

import { useEffect, useRef, useState } from "react";
import { initGame, destroyGame } from "@/game/PhaserGame";
import * as Sentry from "@sentry/nextjs";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * React wrapper for the Phaser game canvas.
 *
 * Mounts a full-size container div, initializes Phaser on mount,
 * and destroys it on unmount to prevent memory leaks.
 *
 * React Strict Mode safety: destroyGame is called in the cleanup,
 * so the remount cycle creates a fresh instance without duplicates.
 *
 * Captures Phaser and WebGL rendering crashes inside a local state boundary,
 * presenting a premium React visualizer recovery card.
 */

const CONTAINER_ID = "phaser-game-container";

export function GameCanvas() {
  const initialized = useRef(false);
  const [phaserError, setPhaserError] = useState<string | null>(null);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      // Check if error originates from the phaser container canvas or within phaser core
      const targetElement = document.getElementById(CONTAINER_ID);
      const isPhaserError = 
        event.filename?.includes("phaser") || 
        event.message?.includes("WebGL") || 
        event.message?.includes("Phaser") ||
        (targetElement && targetElement.contains(event.target as Node));

      if (isPhaserError) {
        console.error("[Phaser Boundary] Canvas engine exception caught:", event.error);
        setPhaserError(event.message || "Phaser scene execution failure");
        
        // Capture to Sentry
        Sentry.captureException(event.error || new Error(event.message), {
          tags: {
            boundary: "phaser-canvas-container",
          },
        });
      }
    };

    window.addEventListener("error", handleWindowError);

    // Prevent double-init in Strict Mode's initial mount
    try {
      if (!initialized.current && !phaserError) {
        initGame(CONTAINER_ID);
        initialized.current = true;
      }
    } catch (err: any) {
      console.error("[Phaser Boundary] Init failure:", err);
      setTimeout(() => {
        setPhaserError(err.message || "Phaser initialization failed");
      }, 0);
      Sentry.captureException(err, { tags: { boundary: "phaser-init" } });
    }

    return () => {
      destroyGame();
      initialized.current = false;
      window.removeEventListener("error", handleWindowError);
    };
  }, [phaserError]);

  if (phaserError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-black/90 p-4 border border-destructive/20 rounded-2xl select-none text-center font-sans">
        <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse mb-3" />
        <h3 className="text-sm font-extrabold text-foreground mb-1 uppercase tracking-wide">
          Phaser Engine Disrupted
        </h3>
        <p className="text-[11px] text-muted-foreground max-w-[260px] mb-4 leading-normal">
          WebGL memory allocation or scene execution failed. Stronghold visual schematic lost sync.
        </p>
        <div className="text-[9px] font-mono bg-black/60 border border-muted/10 p-2 rounded max-w-[280px] break-all text-muted-foreground mb-4 select-text">
          {phaserError}
        </div>
        <Button
          onClick={() => {
            setPhaserError(null);
            initialized.current = false;
            // Force recreation
            setTimeout(() => {
              try {
                initGame(CONTAINER_ID);
                initialized.current = true;
              } catch (e: any) {
                setPhaserError(e.message);
              }
            }, 100);
          }}
          size="sm"
          className="font-bold bg-cyan-600/90 hover:bg-cyan-500 text-[10px] gap-1 h-8"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reboot Visualizer
        </Button>
      </div>
    );
  }

  return (
    <div
      id={CONTAINER_ID}
      className="h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
