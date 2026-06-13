import * as Phaser from 'phaser';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { DEFAULT_SQUAD_HP, type HasHp } from '@/game/systems/CombatSystem';
import { EventBus } from '@/game/EventBus';
import { usePlayerStore } from '@/lib/store/usePlayerStore';

export class EntitySprite extends Phaser.GameObjects.Image implements HasHp {
  public currentGridX: number;
  public currentGridY: number;
  /** Stable identifier used by the CombatSystem in EventBus payloads. For
   *  squad units this is 'member_X'. */
  public entityId: string;
  public name: string;
  public hp: number;
  public maxHp: number;
  public speed: number;
  public activeAbility: string | null;
  public passiveGear: string | null;
  public weapon: string | null;
  public armor: string | null;
  public meleeDamage: number;
  public isBoss: boolean = false;
  public isHostile: boolean = false;

  constructor(
    scene: Phaser.Scene,
    startGridX: number,
    startGridY: number,
    textureKey: string,
    options: {
      entityId?: string;
      name?: string;
      maxHp?: number;
      speed?: number;
      activeAbility?: string | null;
      passiveGear?: string | null;
      weapon?: string | null;
      armor?: string | null;
      isBoss?: boolean;
      isHostile?: boolean;
    } = {},
  ) {
    super(scene, 0, 0, textureKey);
    this.currentGridX = startGridX;
    this.currentGridY = startGridY;
    this.entityId = options.entityId ?? 'player';
    this.name = options.name ?? 'Squad Member';
    this.activeAbility = options.activeAbility ?? null;
    this.passiveGear = options.passiveGear ?? null;
    this.weapon = options.weapon ?? null;
    this.armor = options.armor ?? null;
    this.isBoss = options.isBoss ?? false;
    this.isHostile = options.isHostile ?? false;

    if (this.isBoss) {
      this.setScale(1.5);
      this.setTint(0xffcccc); // Red-tinted glow
    } else {
      this.setScale(1.2); // Make the squad/minions slightly larger and more premium
      if (this.isHostile) {
        this.setTint(0xffaa99); // Curated premium light-red/orange neon glow for hostile drones
      } else {
        this.setTint(0x99ff99); // Curated premium light-green neon glow for squad drones!
      }
    }

    const activeEffects = usePlayerStore.getState().activeEffects;

    // 1. Calculate individualized maxHp from armor and global multipliers
    let calculatedMaxHp = options.maxHp ?? Math.round(DEFAULT_SQUAD_HP * (activeEffects.squadHpMult ?? 1.0));
    if (this.armor === 'reinforced_vest') calculatedMaxHp = Math.round(calculatedMaxHp * 1.15);
    else if (this.armor === 'tactical_armor') calculatedMaxHp = Math.round(calculatedMaxHp * 1.35);
    this.maxHp = calculatedMaxHp;
    this.hp = this.maxHp;

    // 2. Calculate individualized movement speed from adrenaline gear and global multipliers
    let calculatedSpeed = options.speed ?? (1.0 * (activeEffects.squadSpeedMult ?? 1.0));
    if (this.passiveGear === 'adrenaline_rush') calculatedSpeed = calculatedSpeed * 1.10;
    this.speed = calculatedSpeed;

    // 3. Calculate individualized melee damage from weapons and global multipliers
    let baseDmg = 10 * (activeEffects.squadMeleeDmgMult ?? 1.0);
    if (this.weapon === 'heavy_machete') baseDmg = 15;
    else if (this.weapon === 'demo_hammer') baseDmg = 20;
    this.meleeDamage = Math.round(baseDmg);

    this.setOrigin(0.5, 1);
    this.setVisible(true);
    this.setAlpha(1.0);
    this.scene.add.existing(this);

    // Initial depth setting
    this.setDepth(this.currentGridX + this.currentGridY + 2);

    this.scene.events.on("raider-textures-regenerated", this.onRaiderTexturesRegenerated, this);
  }

  public walkPath(path: { x: number; y: number }[], offsetX: number, offsetY: number, currentRotation: number, onComplete?: () => void): void {
    // Stop any existing tweens
    this.scene.tweens.killTweensOf(this);

    if (path.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    const gridSize = (this.scene as any).gridSize || (this.scene as any).grid_size || 10;

    const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = path.map((node, index) => {
      const screenPos = IsometricEngine.worldToScreen(node.x, node.y, currentRotation, gridSize);
      return {
        targets: this,
        x: screenPos.x + offsetX,
        y: screenPos.y + offsetY,
        duration: Math.round(300 / this.speed), // Scaled dynamically by active effects speed
        ease: 'Linear',
        onStart: () => {
          const dx = node.x - this.currentGridX;
          const dy = node.y - this.currentGridY;
          let dir = 0;
          if (dx > 0) dir = 0;
          else if (dy > 0) dir = 1;
          else if (dx < 0) dir = 2;
          else if (dy < 0) dir = 3;

          const baseKey = this.texture.key.replace(/_dir_\d/g, '');
          const dirKey = `${baseKey}_dir_${dir}`;
          if (this.scene.textures.exists(dirKey)) {
            this.setTexture(dirKey);
          }

          // Immersive squash-and-stretch step bobbing (GDD Step 1 walk animation)
          const baseScaleX = this.isBoss ? 1.5 : 1.2;
          const baseScaleY = this.isBoss ? 1.5 : 1.2;
          this.scene.tweens.add({
            targets: this,
            scaleY: baseScaleY * 1.06,
            scaleX: baseScaleX * 0.94,
            duration: Math.round(150 / this.speed),
            yoyo: true,
            ease: 'Quad.easeInOut',
            onComplete: () => {
              if (this.active) {
                this.scaleX = baseScaleX;
                this.scaleY = baseScaleY;
              }
            }
          });
        },
        onUpdate: () => {
          // Dynamically update depth as it moves
          const approxWorld = IsometricEngine.screenToWorld(this.x, this.y, offsetX, offsetY, currentRotation, gridSize);
          this.setDepth(approxWorld.x + approxWorld.y + 2);
        },
        onComplete: () => {
          this.currentGridX = node.x;
          this.currentGridY = node.y;

          // Spawn a minor puff of grey dust particles (GDD Step 1 footstep landing)
          const particleKey = 'glow_particle';
          if (!this.scene.textures.exists(particleKey)) {
            const dotGraphics = this.scene.make.graphics();
            dotGraphics.fillStyle(0xffffff, 1);
            dotGraphics.fillCircle(2, 2, 2);
            dotGraphics.generateTexture(particleKey, 4, 4);
            dotGraphics.destroy();
          }

          const dust = this.scene.add.particles(this.x, this.y, particleKey, {
            speed: { min: 10, max: 40 },
            scale: { start: 0.6, end: 0 },
            alpha: { start: 0.5, end: 0 },
            lifespan: { min: 200, max: 400 },
            tint: 0x94a3b8, // slate dust color
            maxParticles: 6,
            frequency: -1,
          });
          dust.setDepth(this.depth - 0.5);
          this.scene.time.delayedCall(450, () => {
            dust.destroy();
          });

          // Per-tile hook: TrapSystem (3.0.8) subscribes here to trigger
          // step-on traps. Turret LOS acquisition (3.0.10) and loot-stash
          // hold timers (3.0.12) will subscribe to the same event. If a
          // listener kills tweens on this target (e.g. stun), the remaining
          // chain entries after this one won't execute.
          EventBus.emit('entity-entered-tile', {
            entityId: this.entityId,
            x: node.x,
            y: node.y,
          });
          if (index === path.length - 1 && onComplete) {
            onComplete();
          }
        }
      };
    });

    if (tweens.length > 0) {
      this.scene.tweens.chain({ tweens });
    }
  }

  public updateIsometricPosition(currentRotation: number, offsetX: number, offsetY: number): void {
    const gridSize = (this.scene as any).gridSize || (this.scene as any).grid_size || 10;
    const screenPos = IsometricEngine.worldToScreen(this.currentGridX, this.currentGridY, currentRotation, gridSize);
    this.setPosition(screenPos.x + offsetX, screenPos.y + offsetY);
    this.setDepth(this.currentGridX + this.currentGridY + 2);
  }

  public refreshWeaponAndArmor(): void {
    let slotNumber = 1;
    if (this.entityId.startsWith('member_')) {
      const idx = parseInt(this.entityId.replace('member_', ''), 10);
      if (!isNaN(idx)) {
        try {
          if (typeof window !== "undefined") {
            const prepMembers = (window as any).useRaidStore?.getState().prepSquadMembers || [];
            const member = prepMembers[idx];
            if (member) {
              slotNumber = member.slotNumber;
            }
          }
        } catch (e) {
          console.warn("Failed to read prepSquadMembers", e);
        }
      }
    } else if (this.texture && this.texture.key.includes('slot_')) {
      const match = this.texture.key.match(/slot_(\d)/);
      if (match) {
        slotNumber = parseInt(match[1], 10);
      }
    }

    try {
      if (typeof window !== "undefined") {
        const members = (window as any).useSquadStore?.getState().members || [];
        const member = members.find((m: any) => m.slotNumber === slotNumber);
        if (member) {
          this.weapon = member.weapon || null;
          this.armor = member.armor || null;
          
          const activeEffects = (window as any).usePlayerStore?.getState().activeEffects || {};
          
          let calculatedMaxHp = Math.round(DEFAULT_SQUAD_HP * (activeEffects.squadHpMult ?? 1.0));
          if (this.armor === 'reinforced_vest') calculatedMaxHp = Math.round(calculatedMaxHp * 1.15);
          else if (this.armor === 'tactical_armor') calculatedMaxHp = Math.round(calculatedMaxHp * 1.35);
          this.maxHp = calculatedMaxHp;
          
          let baseDmg = 10 * (activeEffects.squadMeleeDmgMult ?? 1.0);
          if (this.weapon === 'heavy_machete') baseDmg = 15;
          else if (this.weapon === 'demo_hammer') baseDmg = 20;
          this.meleeDamage = Math.round(baseDmg);
        }
      }
    } catch (e) {
      console.warn("Failed to update weapon and armor on entity sprite", e);
    }
  }

  private onRaiderTexturesRegenerated(): void {
    this.refreshWeaponAndArmor();
    this.refreshTexture();
  }

  private refreshTexture(): void {
    if (this.texture) {
      const key = this.texture.key;
      if (key === 'entity_drone' || key.startsWith('entity_drone_dir_') || key.startsWith('entity_drone_slot_')) {
        this.setTexture(key);
      }
    }
  }

  public destroy(fromScene?: boolean): void {
    this.scene.events.off("raider-textures-regenerated", this.onRaiderTexturesRegenerated, this);
    super.destroy(fromScene);
  }
}
