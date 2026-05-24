"use client";

import dynamic from "next/dynamic";

/**
 * Client-side only wrapper for the GameCanvas.
 * Phaser expects the browser `window` object to be present.
 * Using next/dynamic with ssr: false inside a Client Component
 * ensures that Phaser is completely omitted from the server prerender.
 */
export const GameWrapper = dynamic(
  () => import("@/components/game/GameCanvas").then((mod) => mod.GameCanvas),
  { ssr: false }
);
