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
    this.scene.add.existing(this);

    // Initial depth setting
    this.setDepth(this.currentGridX + this.currentGridY + 2);
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
        onUpdate: () => {
          // Dynamically update depth as it moves
          const approxWorld = IsometricEngine.screenToWorld(this.x, this.y, offsetX, offsetY, currentRotation, gridSize);
          this.setDepth(approxWorld.x + approxWorld.y + 2);
        },
        onComplete: () => {
          this.currentGridX = node.x;
          this.currentGridY = node.y;
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
}
