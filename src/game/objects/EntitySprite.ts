import * as Phaser from 'phaser';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { DEFAULT_SQUAD_HP, type HasHp } from '@/game/systems/CombatSystem';
import { EventBus } from '@/game/EventBus';

export class EntitySprite extends Phaser.GameObjects.Image implements HasHp {
  public currentGridX: number;
  public currentGridY: number;
  /** Stable identifier used by the CombatSystem in EventBus payloads. For
   *  single-squad MVP this is `'player'`; future multi-squad / NPC guards
   *  will assign unique labels. */
  public entityId: string;
  public hp: number;
  public maxHp: number;

  constructor(
    scene: Phaser.Scene,
    startGridX: number,
    startGridY: number,
    textureKey: string,
    options: { entityId?: string; maxHp?: number } = {},
  ) {
    super(scene, 0, 0, textureKey);
    this.currentGridX = startGridX;
    this.currentGridY = startGridY;
    this.entityId = options.entityId ?? 'player';
    this.maxHp = options.maxHp ?? DEFAULT_SQUAD_HP;
    this.hp = this.maxHp;

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

    const tweens: Phaser.Types.Tweens.TweenBuilderConfig[] = path.map((node, index) => {
      const screenPos = IsometricEngine.worldToScreen(node.x, node.y, currentRotation);
      return {
        targets: this,
        x: screenPos.x + offsetX,
        y: screenPos.y + offsetY,
        duration: 300, // 300ms per tile
        ease: 'Linear',
        onUpdate: () => {
          // Dynamically update depth as it moves
          const approxWorld = IsometricEngine.screenToWorld(this.x, this.y, offsetX, offsetY, currentRotation);
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
    const screenPos = IsometricEngine.worldToScreen(this.currentGridX, this.currentGridY, currentRotation);
    this.setPosition(screenPos.x + offsetX, screenPos.y + offsetY);
    this.setDepth(this.currentGridX + this.currentGridY + 2);
  }
}
