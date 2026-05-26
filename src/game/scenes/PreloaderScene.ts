import * as Phaser from "phaser";
import { SoundManager } from "@/game/objects/SoundManager";

const LORE_SNIPPETS = [
  "THE FRACTURE: In 2029, the centralized power grid collapsed. The elite retreated to armored bunkers.",
  "THE NETWORK: A resilient, decentralized peer-to-peer mesh-net built by renegade hackers to swap resources.",
  "SECURITY PROTOCOL: Unshielded coords have exposed resource caps. Secure your perimeter to repel intruders.",
  "BREACHING ADVICE: Multiple breach points divide turret firing arcs. Plan co-ordinated squad entry angles.",
  "EMP TACTICS: Electromagnetic stuns shut down defenses temporarily. Use this window to breach barricades.",
  "DEEP NET: The golden loot stash contains rare credits and contraband. Defend it at all costs.",
  "DECENTRALIZED NODE: Your local console is fully synced. OFFLINE buffer ready to cache outgoing data."
];

export class PreloaderScene extends Phaser.Scene {
  private targetScene: string = "RoomScene";
  private percent: number = 0;
  
  // UI Objects
  private borderGraphics!: Phaser.GameObjects.Graphics;
  private progressGraphics!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;
  private loreText!: Phaser.GameObjects.Text;
  private pwaText!: Phaser.GameObjects.Text;
  private loreTimer!: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: "PreloaderScene" });
  }

  init(data: { targetScene?: string }) {
    this.targetScene = data.targetScene || "RoomScene";
    this.percent = 0;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    // 1. Draw a high-tech cyan vector grid pattern in background
    const gridGraphics = this.add.graphics().setAlpha(0.06);
    gridGraphics.lineStyle(1.0, 0x06b6d4, 1.0);
    const gridSize = 40;
    for (let x = 0; x < w; x += gridSize) {
      gridGraphics.lineBetween(x, 0, x, h);
    }
    for (let y = 0; y < h; y += gridSize) {
      gridGraphics.lineBetween(0, y, w, y);
    }

    // Play tactical staging briefing BGM
    SoundManager.getInstance().playMusic('briefing_room');

    // 2. Branded console titles
    this.titleText = this.add.text(w / 2, h / 2 - 80, "CONNECTING TO SECURE MESH-NET...", {
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#06b6d4",
      align: "center",
      stroke: "#000000",
      strokeThickness: 3
    }).setOrigin(0.5);

    // Glowing Title effect
    this.tweens.add({
      targets: this.titleText,
      alpha: { from: 0.5, to: 1.0 },
      yoyo: true,
      repeat: -1,
      duration: 1000,
      ease: "Sine.easeInOut"
    });

    // Percent indicator
    this.percentText = this.add.text(w / 2, h / 2 - 40, "0%", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 4
    }).setOrigin(0.5);

    // 3. Neon loading bar placeholder
    const barW = Math.min(400, w - 80);
    const barH = 14;
    const barX = (w - barW) / 2;
    const barY = h / 2 - 10;

    // Draw loading bar outline (cyan neon glow)
    this.borderGraphics = this.add.graphics();
    this.borderGraphics.lineStyle(4, 0x06b6d4, 0.3); // outer soft glow
    this.borderGraphics.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
    this.borderGraphics.lineStyle(1.5, 0x06b6d4, 1.0); // inner neon beam
    this.borderGraphics.strokeRect(barX, barY, barW, barH);

    this.progressGraphics = this.add.graphics();

    // 4. Lore snippets ticker
    const randomLore = LORE_SNIPPETS[Math.floor(Math.random() * LORE_SNIPPETS.length)];
    this.loreText = this.add.text(w / 2, h / 2 + 50, randomLore, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#10b981", // Matrix green
      align: "center",
      wordWrap: { width: barW + 40 },
      stroke: "#000000",
      strokeThickness: 2
    }).setOrigin(0.5);

    // Swap lore every 1.5 seconds
    this.loreTimer = this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => {
        const nextLore = LORE_SNIPPETS[Math.floor(Math.random() * LORE_SNIPPETS.length)];
        this.tweens.add({
          targets: this.loreText,
          alpha: 0,
          duration: 150,
          onComplete: () => {
            this.loreText.setText(nextLore);
            this.tweens.add({
              targets: this.loreText,
              alpha: 1,
              duration: 150
            });
          }
        });
      }
    });

    // 5. Stylized PWA Offline-ready indicator
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const pwaStatus = `[ MESH NODE: SECURE // CHANNEL: ${isOnline ? "ONLINE" : "OFFLINE-CACHED"} ]`;
    this.pwaText = this.add.text(w / 2, h - 40, pwaStatus, {
      fontFamily: "monospace",
      fontSize: "9px",
      color: "#64748b", // Slate
      align: "center"
    }).setOrigin(0.5);

    // 6. Animate progress 0 -> 100% over 2.0s
    this.tweens.add({
      targets: this,
      percent: 100,
      duration: 2000,
      ease: "Quad.easeOut",
      onUpdate: () => {
        const curPercent = Math.floor(this.percent);
        this.percentText.setText(`${curPercent}%`);

        // Redraw progress bar fill
        this.progressGraphics.clear();
        if (curPercent > 0) {
          const fillW = (barW * this.percent) / 100;
          this.progressGraphics.fillStyle(0x06b6d4, 0.85);
          this.progressGraphics.fillRect(barX + 2, barY + 2, fillW - 4, barH - 4);
        }
      },
      onComplete: () => {
        // Stop staging loop and transition to target
        SoundManager.getInstance().stopMusic();
        // Play soothing connection successful beep
        SoundManager.getInstance().playSfx('heal');

        this.time.delayedCall(200, () => {
          this.scene.start(this.targetScene);
        });
      }
    });

    // Handle Resize events to keep everything perfectly centered
    this.scale.on("resize", this.handleResize, this);

    this.events.once("shutdown", () => this.shutdown());
    this.events.once("destroy", () => this.shutdown());
  }

  private handleResize(gameSize: Phaser.Structs.Size) {
    if (!this.titleText || !this.titleText.active) return;
    if (!this.percentText || !this.percentText.active) return;
    if (!this.pwaText || !this.pwaText.active) return;
    if (!this.borderGraphics || !this.borderGraphics.active) return;
    if (!this.loreText || !this.loreText.active) return;

    const w = gameSize.width;
    const h = gameSize.height;

    // Recenter title and loader elements
    this.titleText.setPosition(w / 2, h / 2 - 80);
    this.percentText.setPosition(w / 2, h / 2 - 40);
    this.pwaText.setPosition(w / 2, h - 40);

    const barW = Math.min(400, w - 80);
    const barH = 14;
    const barX = (w - barW) / 2;
    const barY = h / 2 - 10;

    this.borderGraphics.clear();
    this.borderGraphics.lineStyle(4, 0x06b6d4, 0.3);
    this.borderGraphics.strokeRect(barX - 2, barY - 2, barW + 4, barH + 4);
    this.borderGraphics.lineStyle(1.5, 0x06b6d4, 1.0);
    this.borderGraphics.strokeRect(barX, barY, barW, barH);

    this.loreText.setPosition(w / 2, h / 2 + 50);
    this.loreText.setWordWrapWidth(barW + 40);
  }

  shutdown() {
    if (this.loreTimer) {
      this.loreTimer.remove(false);
      this.loreTimer = undefined as unknown as Phaser.Time.TimerEvent;
    }
    this.scale.off("resize", this.handleResize, this);
  }
}
