"use client";

import { useEffect, useRef } from "react";
import { initGame, destroyGame } from "@/game/PhaserGame";

/**
 * React wrapper for the Phaser game canvas.
 *
 * Mounts a full-size container div, initializes Phaser on mount,
 * and destroys it on unmount to prevent memory leaks.
 *
 * React Strict Mode safety: destroyGame is called in the cleanup,
 * so the remount cycle creates a fresh instance without duplicates.
 */

const CONTAINER_ID = "phaser-game-container";

export function GameCanvas() {
  const initialized = useRef(false);

  useEffect(() => {
    // Prevent double-init in Strict Mode's initial mount
    if (!initialized.current) {
      initGame(CONTAINER_ID);
      initialized.current = true;
    }

    return () => {
      destroyGame();
      initialized.current = false;
    };
  }, []);

  return (
    <div
      id={CONTAINER_ID}
      className="h-full w-full"
    />
  );
}
