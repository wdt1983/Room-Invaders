import * as Phaser from "phaser";
import { gameConfig } from "./config";

/**
 * Singleton manager for the Phaser Game instance.
 *
 * - `initGame(containerId)` creates the game only if one doesn't already exist.
 * - `destroyGame()` tears it down cleanly, preventing memory leaks and
 *   duplicate canvases during React Strict Mode unmount/remount cycles.
 *
 * SSR-safe: returns null when `window` is not available.
 */

let gameInstance: Phaser.Game | null = null;

/**
 * Initialize a Phaser Game instance bound to the given container element.
 * No-ops if an instance already exists or if running on the server.
 */
export function initGame(containerId: string): Phaser.Game | null {
  // Guard: SSR — Phaser requires the DOM
  if (typeof window === "undefined") return null;

  // Guard: Singleton — prevent duplicate instances
  if (gameInstance) return gameInstance;

  gameInstance = new Phaser.Game({
    ...gameConfig,
    parent: containerId,
  });

  // Attach to window for global access
  (window as any).game = gameInstance;

  return gameInstance;
}

/**
 * Destroy the active Phaser Game instance.
 * Removes the canvas, clears all scenes, and nullifies the reference.
 */
export function destroyGame(): void {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
    if (typeof window !== "undefined") {
      delete (window as any).game;
    }
  }
}

/**
 * Returns the current Phaser Game instance (or null if not yet initialized).
 * Useful for external systems (e.g., Zustand stores) that need game access.
 */
export function getGame(): Phaser.Game | null {
  return gameInstance;
}
