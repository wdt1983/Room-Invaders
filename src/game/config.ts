import * as Phaser from "phaser";
import { BootScene } from "@/game/scenes/BootScene";
import { PreloaderScene } from "@/game/scenes/PreloaderScene";
import { RoomScene } from "@/game/scenes/RoomScene";
import { RoomEditorScene } from "@/game/scenes/RoomEditorScene";
import { RaidScene } from "@/game/scenes/RaidScene";

/**
 * Core Phaser game configuration.
 *
 * Uses Scale.RESIZE so the canvas naturally fills the parent container
 * (the flex-1 <main> in the game layout).
 *
 * Scene selection: BootScene inspects `window.location.pathname` in `create()`
 * to decide which scene to start — /raid routes into RaidScene, everything
 * else into RoomScene. The scene list is order-independent; only BootScene
 * must be first (Phaser starts the first scene by default).
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: "#000000",
  pixelArt: true,
  roundPixels: true,
  render: {
    antialias: false,
    pixelArt: true,
    roundPixels: true,
    powerPreference: "high-performance",
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: "100%",
    height: "100%",
  },
  scene: [BootScene, PreloaderScene, RoomScene, RoomEditorScene, RaidScene],
};
