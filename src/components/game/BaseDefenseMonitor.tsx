'use client';

import { useState, useEffect, useRef } from 'react';
import { useRoomStore } from '@/lib/store/useRoomStore';
import { EventBus } from '@/game/EventBus';
import { createClient } from '@/lib/supabase/client';
import { IsometricEngine } from '@/game/systems/IsometricEngine';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  ShieldAlert, 
  ShieldCheck, 
  Activity, 
  Play, 
  Square, 
  Terminal, 
  Cpu, 
  DoorClosed, 
  PlusCircle 
} from 'lucide-react';

interface LogMessage {
  id: string;
  time: string;
  text: string;
  type: 'info' | 'warn' | 'success' | 'danger';
}

interface BaseDefenseMonitorProps {
  user: {
    id: string;
    email?: string;
  };
}

export function BaseDefenseMonitor({ user }: BaseDefenseMonitorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [breachActive, setBreachActive] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [energy, setEnergy] = useState(50);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [activeMode, setActiveMode] = useState<'normal' | 'select-turret' | 'select-tile'>('normal');

  const placedItems = useRoomStore((state) => state.placedItems);
  const catalog = useRoomStore((state) => state.catalog);
  const gridSize = useRoomStore((state) => state.gridSize) || 10;
  const entryPoints = useRoomStore((state) => state.entryPoints) || [];

  const supabaseRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const energyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simIndexRef = useRef<number>(0);
  const simPathRef = useRef<{ x: number; y: number }[]>([]);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addLog = (text: string, type: LogMessage['type'] = 'info') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [
      { id: Math.random().toString(), time, text, type },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  };

  const cleanupRealtime = () => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
  };

  const cleanupTimers = () => {
    if (energyTimerRef.current) clearInterval(energyTimerRef.current);
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
  };

  const startEnergyRegen = () => {
    if (energyTimerRef.current) clearInterval(energyTimerRef.current);
    energyTimerRef.current = setInterval(() => {
      setEnergy(prev => Math.min(100, prev + 10));
    }, 1000);
  };

  const stopEnergyRegen = () => {
    if (energyTimerRef.current) {
      clearInterval(energyTimerRef.current);
      energyTimerRef.current = null;
    }
  };

  // Initialize logs with system diagnostics
  useEffect(() => {
    addLog("SECURITY OPERATIONAL CENTER initialization success.", "success");
    addLog("All tripwire grids report normal statuses.", "info");
    addLog("Ready for active breach tracking.", "info");

    return () => {
      cleanupRealtime();
      cleanupTimers();
    };
  }, []);

  // Cooldown ticking
  useEffect(() => {
    if (Object.keys(cooldowns).length > 0) {
      if (!cooldownTimerRef.current) {
        cooldownTimerRef.current = setInterval(() => {
          setCooldowns(prev => {
            const next = { ...prev };
            let active = false;
            for (const key in next) {
              if (next[key] > 0) {
                next[key] = Math.max(0, next[key] - 1);
                if (next[key] > 0) active = true;
              }
            }
            if (!active) {
              if (cooldownTimerRef.current) {
                clearInterval(cooldownTimerRef.current);
                cooldownTimerRef.current = null;
              }
            }
            return next;
          });
        }, 1000);
      }
    }
  }, [cooldowns]);

  // Real-time Supabase socket connection for live PvP breaches
  useEffect(() => {
    if (!user?.id || isSimulating) return;

    try {
      const supabase = createClient();
      supabaseRef.current = supabase;

      const channel = supabase.channel(`pvp-raid:${user.id}`, {
        config: { broadcast: { self: false } }
      });

      channel.on('broadcast', { event: 'breach-started' }, (payload: any) => {
        setBreachActive(true);
        setIsOpen(true);
        setEnergy(30);
        addLog("🚨 SYSTEM INTRUSION DETECTED! Perimeter breached!", "danger");
        EventBus.emit('pvp-breach-started');
        
        // Start Energy regeneration loop (+10/sec)
        startEnergyRegen();
      });

      channel.on('broadcast', { event: 'attacker-moved' }, (payload: any) => {
        const { memberIndex, x, y, hp, maxHp } = payload.payload;
        addLog(`Hostile blip active at sector [${x}, ${y}] — HP: ${hp}/${maxHp}`, "warn");
        EventBus.emit('pvp-attacker-moved', { memberIndex, x, y, hp, maxHp });
      });

      channel.on('broadcast', { event: 'raid-completed' }, (payload: any) => {
        const { outcome, reason } = payload.payload;
        const type = outcome === 'victory' ? 'danger' : 'success';
        addLog(`Raid Completed. Outcome: ${outcome.toUpperCase()} — ${reason}`, type);
        setBreachActive(false);
        EventBus.emit('pvp-raid-completed');
        stopEnergyRegen();
      });

      channel.subscribe();
      channelRef.current = channel;
    } catch (err) {
      console.error("[BaseDefenseMonitor] Supabase client init failure:", err);
    }

    return () => {
      cleanupRealtime();
    };
  }, [user?.id, isSimulating]);

  // Local Breach Simulation System (Sandbox)
  const startSimulation = () => {
    if (breachActive) return;
    cleanupRealtime();
    cleanupTimers();

    setIsSimulating(true);
    setBreachActive(true);
    setIsOpen(true);
    setEnergy(30);
    setCooldowns({});
    setLogs([]);

    addLog("Initializing local sandbox intrusion test...", "info");
    addLog("🚨 SIMULATION STARTED: Simulated Vanguard breaching wall!", "danger");

    // Resolve a starting point from real entries, or fallback to (0,1)
    const entry = entryPoints[0] || { wall: 'north', position: 2 };
    let startX = 1, startY = 1;
    if (entry.wall === 'north') { startX = entry.position; startY = 1; }
    else if (entry.wall === 'south') { startX = entry.position; startY = gridSize - 2; }
    else if (entry.wall === 'east') { startX = gridSize - 2; startY = entry.position; }
    else if (entry.wall === 'west') { startX = 1; startY = entry.position; }

    // Plot simulated A* style coordinate steps to far corner
    const endX = gridSize - 3;
    const endY = gridSize - 3;

    // Generate line path
    const path: { x: number; y: number }[] = [];
    let cx = startX;
    let cy = startY;
    path.push({ x: cx, y: cy });

    while (cx !== endX || cy !== endY) {
      if (cx < endX) cx++;
      else if (cx > endX) cx--;
      if (cy < endY) cy++;
      else if (cy > endY) cy--;
      path.push({ x: cx, y: cy });
    }

    simPathRef.current = path;
    simIndexRef.current = 0;

    EventBus.emit('pvp-breach-started');
    startEnergyRegen();

    // Trigger crawler loop
    runSimTick();
  };

  const runSimTick = () => {
    if (simTimerRef.current) clearTimeout(simTimerRef.current);

    const path = simPathRef.current;
    const idx = simIndexRef.current;

    if (idx >= path.length) {
      // Reached loot vault! Attacker wins simulation
      addLog("💀 SIMULATION OVER: Attacker secured loot stash!", "danger");
      endSimulation('defeat');
      return;
    }

    const currentCoords = path[idx];
    addLog(`Intruder coordinates scanned: sector [${currentCoords.x}, ${currentCoords.y}] — Squad HP: 85/100`, "warn");
    EventBus.emit('pvp-attacker-moved', {
      memberIndex: 0,
      x: currentCoords.x,
      y: currentCoords.y,
      hp: 85,
      maxHp: 100
    });

    simIndexRef.current = idx + 1;

    // Next step in 2 seconds
    simTimerRef.current = setTimeout(runSimTick, 2000);
  };

  const endSimulation = (outcome: 'victory' | 'defeat') => {
    setIsSimulating(false);
    setBreachActive(false);
    stopEnergyRegen();
    cleanupTimers();
    EventBus.emit('pvp-raid-completed');
    addLog(`Simulation terminated: ${outcome === 'victory' ? 'Intruder routed successfully!' : 'Security breached.'}`, outcome === 'victory' ? 'success' : 'danger');
  };

  const stopSimulationManually = () => {
    addLog("Simulation manual override ceasefire.", "info");
    endSimulation('victory');
  };

  // Broadcast Tactical Actions
  const triggerBlastDoors = () => {
    if (energy < 35) {
      addLog("Energy insufficient for Security Stun Lock (35 Energy).", "danger");
      return;
    }
    if (cooldowns['blast-doors'] > 0) return;

    setEnergy(prev => prev - 35);
    setCooldowns(prev => ({ ...prev, 'blast-doors': 15 }));
    addLog("🔒 Cyber Lockdown Broadcast: Blast Doors Activating...", "success");

    if (isSimulating) {
      addLog("Blast doors slammed shut! Attacker stunned for 3 seconds.", "success");
      // Delay simulated crawler by inserting stun window
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
      simTimerRef.current = setTimeout(runSimTick, 5000); // 2s original + 3s stun
    } else if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'defender-action',
        payload: { type: 'security-lock' }
      });
    }

    EventBus.emit('execute-ability', { ability: 'blast-doors' });
  };

  const startOverchargeSelection = () => {
    if (energy < 15) {
      addLog("Energy insufficient for Weapon Overcharge (15 Energy).", "danger");
      return;
    }
    if (cooldowns['overcharge'] > 0) return;

    setActiveMode('select-turret');
    addLog("⚡ OVERCHARGE MODE: Click a placed turret to boost firing rate.", "info");

    // Phaser click listener helper for selection
    const handlePhaserSelect = (pointer: any) => {
      const scene = pointer.manager.game.scene.keys.RoomScene;
      if (!scene) return;
      
      const worldCoords = scene.gridSystem ? 
        pointer.manager.game.scene.keys.RoomScene.gridSystem.screenToWorld ? null : null : null; // Safe fallback
      
      // Let's resolve coordinates from screenToWorld
      const coords = IsometricEngine.screenToWorld(pointer.worldX, pointer.worldY, scene.offsetX, scene.offsetY, scene.currentRotation);
      
      const targetItem = placedItems.find(i => i.gridX === coords.x && i.gridY === coords.y);
      const targetCatalog = catalog.find(c => c.sprite_key === targetItem?.spriteKey);
      
      if (targetCatalog?.type === 'turret') {
        executeOvercharge(coords.x, coords.y, targetCatalog.name);
      } else {
        addLog("Selection cancelled: Not a valid active weapon turret.", "warn");
      }
      
      setActiveMode('normal');
      scene.input.off('pointerdown', handlePhaserSelect);
    };

    const scene = (window as any).game?.scene?.keys?.RoomScene;
    if (scene) {
      scene.input.once('pointerdown', handlePhaserSelect);
    }
  };

  const executeOvercharge = (x: number, y: number, name: string) => {
    setEnergy(prev => prev - 15);
    setCooldowns(prev => ({ ...prev, 'overcharge': 5 }));
    addLog(`⚡ Broadcasting energy overcharge grid at [${x}, ${y}] (${name}).`, "success");

    if (isSimulating) {
      // Simulate overcharge response
      addLog(`Weapon [${name}] fire-rate +100% and range boosted for 5s!`, "success");
    } else if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'defender-action',
        payload: { type: 'overcharge', x, y }
      });
    }

    // Trigger local Phaser overcharge visuals in builder
    const scene = (window as any).game?.scene?.keys?.RoomScene;
    if (scene) {
      const turretSprite = scene.furnitureItems.find((f: any) => f.gridX === x && f.gridY === y);
      if (turretSprite && turretSprite.active) {
        turretSprite.setTint(0xff3333);
        scene.tweens.add({
          targets: turretSprite,
          scaleX: { from: 1.0, to: 1.25 },
          scaleY: { from: 1.0, to: 1.25 },
          yoyo: true,
          repeat: 3,
          duration: 300,
          onComplete: () => {
            if (turretSprite.active) turretSprite.clearTint();
          }
        });
      }
    }
  };

  const startSpawnDroneSelection = () => {
    if (energy < 25) {
      addLog("Energy insufficient for Sentinel Drone dispatch (25 Energy).", "danger");
      return;
    }
    if (cooldowns['spawn-drone'] > 0) return;

    setActiveMode('select-tile');
    addLog("🚁 DRONE DISPATCH: Select an unoccupied floor grid to deploy guard drone.", "info");

    const handlePhaserSelect = (pointer: any) => {
      const scene = (window as any).game?.scene?.keys?.RoomScene;
      if (!scene) return;

      const coords = IsometricEngine.screenToWorld(pointer.worldX, pointer.worldY, scene.offsetX, scene.offsetY, scene.currentRotation);

      if (scene.gridSystem.isTileWalkable(coords.x, coords.y)) {
        executeSpawnDrone(coords.x, coords.y);
      } else {
        addLog("Selection cancelled: Sector coordinates blocked or occupied.", "warn");
      }

      setActiveMode('normal');
      scene.input.off('pointerdown', handlePhaserSelect);
    };

    const scene = (window as any).game?.scene?.keys?.RoomScene;
    if (scene) {
      scene.input.once('pointerdown', handlePhaserSelect);
    }
  };

  const executeSpawnDrone = (x: number, y: number) => {
    setEnergy(prev => prev - 25);
    setCooldowns(prev => ({ ...prev, 'spawn-drone': 10 }));
    addLog(`🚁 Sentinel drone deployed to sector location [${x}, ${y}]!`, "success");

    if (isSimulating) {
      addLog("Guard Drone successfully engaged target squad vector.", "success");
    } else if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'defender-action',
        payload: { type: 'spawn-drone', x, y }
      });
    }

    // Draw holographic guard spawn visual inside builder RoomScene
    const scene = (window as any).game?.scene?.keys?.RoomScene;
    if (scene) {
      const flash = scene.add.graphics();
      flash.setDepth(100);
      const screenPos = IsoworldToScreen(scene, x, y);
      
      flash.lineStyle(2, 0xff5555, 1.0);
      flash.strokeCircle(screenPos.x, screenPos.y, 25);
      scene.tweens.add({
        targets: flash,
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        duration: 500,
        onComplete: () => flash.destroy()
      });
    }
  };

  const IsoworldToScreen = (scene: any, x: number, y: number) => {
    const pos = IsometricEngine.worldToScreen(x, y, scene.currentRotation);
    return { x: pos.x + scene.offsetX, y: pos.y + scene.offsetY };
  };

  return (
    <>
      {/* Floating pulsing diagnostics alert trigger */}
      <div className="absolute top-24 left-4 z-30">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 font-extrabold tracking-wider text-xs border uppercase rounded-xl px-4 py-2.5 transition-all duration-500 shadow-2xl backdrop-blur-md ${
            breachActive
              ? "bg-red-500/10 border-red-500/50 text-red-400 hover:bg-red-500/25 animate-pulse shadow-red-500/20"
              : "bg-background/80 border-primary/20 text-primary hover:bg-primary/10 hover:border-primary/40 shadow-primary/5"
          }`}
        >
          {breachActive ? (
            <ShieldAlert className="size-4 animate-bounce text-red-400" />
          ) : (
            <ShieldCheck className="size-4 text-emerald-400" />
          )}
          SOC CONTROL {breachActive && <span className="text-[10px] bg-red-500 text-white font-black px-1.5 py-0.5 rounded animate-pulse">BREACH ACTIVE</span>}
        </Button>
      </div>

      {/* Slide-out Operations Console drawer */}
      {isOpen && (
        <div className="absolute top-20 right-4 bottom-24 w-80 z-30 flex flex-col gap-4 bg-background/85 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl p-4 overflow-hidden animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/10 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className={`size-5 ${breachActive ? "text-red-400 animate-spin" : "text-primary"}`} />
              <div>
                <h2 className="text-sm font-black text-white tracking-wide uppercase">BASE SECURITY OPERATIONS</h2>
                <p className="text-[9px] text-muted-foreground uppercase font-mono">Terminal active • ID: {user?.id?.slice(0, 8)}</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-white transition-colors duration-200 text-xs font-black bg-muted/20 px-2 py-1 rounded"
            >
              CLOSE
            </button>
          </div>

          {/* Sandbox controls */}
          <div className="bg-muted/10 border border-primary/10 rounded-xl p-3 flex flex-col gap-2">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center gap-1.5">
              <Activity className="size-3.5 text-primary animate-pulse" />
              Defense Diagnostics & Test Loop
            </span>

            {!breachActive ? (
              <Button
                size="sm"
                onClick={startSimulation}
                className="w-full bg-primary/10 hover:bg-primary/25 border border-primary/30 text-primary font-black uppercase text-xs tracking-wider transition-all duration-300 rounded-lg py-2 flex items-center justify-center gap-2"
              >
                <Play className="size-3 text-primary" />
                Simulate Stronghold Breach
              </Button>
            ) : isSimulating ? (
              <Button
                size="sm"
                onClick={stopSimulationManually}
                variant="destructive"
                className="w-full bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 font-black uppercase text-xs tracking-wider transition-all duration-300 rounded-lg py-2 flex items-center justify-center gap-2"
              >
                <Square className="size-3 text-red-400" />
                Terminate Sandbox Loop
              </Button>
            ) : (
              <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                LIVE PVP COUNTER-BREACH ACTIVE!
              </div>
            )}
          </div>

          {/* Core active abilities controls */}
          {breachActive && (
            <div className="flex flex-col gap-3">
              {/* Energy bar */}
              <div className="flex flex-col gap-1 bg-background/50 border border-border/10 rounded-xl p-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase">
                  <span>Defender Grid Energy</span>
                  <span className="text-yellow-400 font-extrabold flex items-center gap-0.5">
                    <Zap className="size-3 text-yellow-400 shrink-0" />
                    {energy}/100
                  </span>
                </div>
                <div className="h-2 w-full bg-muted/20 border border-muted/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)] transition-all duration-300"
                    style={{ width: `${energy}%` }}
                  />
                </div>
              </div>

              {/* Action Buttons Group */}
              <div className="flex flex-col gap-2">
                {/* Blast doors */}
                <Button
                  onClick={triggerBlastDoors}
                  disabled={energy < 35 || cooldowns['blast-doors'] > 0 || activeMode !== 'normal'}
                  className={`w-full justify-between items-center font-black uppercase text-xs tracking-wider border rounded-xl px-4 py-3 transition-all duration-300 ${
                    cooldowns['blast-doors'] > 0
                      ? "bg-muted/10 border-muted-foreground/10 text-muted-foreground cursor-not-allowed"
                      : "bg-blue-500/10 hover:bg-blue-500/25 border-blue-500/30 text-blue-400 hover:shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <DoorClosed className="size-4 text-blue-400" />
                    Blast Door Stun
                  </span>
                  <span className="font-extrabold text-[10px] font-mono flex items-center gap-0.5 bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded">
                    {cooldowns['blast-doors'] > 0 ? `${cooldowns['blast-doors']}S` : "35 E"}
                  </span>
                </Button>

                {/* Overcharge turret */}
                <Button
                  onClick={startOverchargeSelection}
                  disabled={energy < 15 || cooldowns['overcharge'] > 0 || activeMode !== 'normal'}
                  className={`w-full justify-between items-center font-black uppercase text-xs tracking-wider border rounded-xl px-4 py-3 transition-all duration-300 ${
                    cooldowns['overcharge'] > 0
                      ? "bg-muted/10 border-muted-foreground/10 text-muted-foreground cursor-not-allowed"
                      : "bg-yellow-500/10 hover:bg-yellow-500/25 border-yellow-500/30 text-yellow-400 hover:shadow-[0_0_12px_rgba(234,179,8,0.2)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Zap className="size-4 text-yellow-400" />
                    Overcharge Turret
                  </span>
                  <span className="font-extrabold text-[10px] font-mono flex items-center gap-0.5 bg-yellow-500/20 border border-yellow-500/30 px-1.5 py-0.5 rounded">
                    {cooldowns['overcharge'] > 0 ? `${cooldowns['overcharge']}S` : "15 E"}
                  </span>
                </Button>

                {/* Sentinel drone */}
                <Button
                  onClick={startSpawnDroneSelection}
                  disabled={energy < 25 || cooldowns['spawn-drone'] > 0 || activeMode !== 'normal'}
                  className={`w-full justify-between items-center font-black uppercase text-xs tracking-wider border rounded-xl px-4 py-3 transition-all duration-300 ${
                    cooldowns['spawn-drone'] > 0
                      ? "bg-muted/10 border-muted-foreground/10 text-muted-foreground cursor-not-allowed"
                      : "bg-red-500/10 hover:bg-red-500/25 border-red-500/30 text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <PlusCircle className="size-4 text-red-400" />
                    Deploy Patrol Drone
                  </span>
                  <span className="font-extrabold text-[10px] font-mono flex items-center gap-0.5 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded">
                    {cooldowns['spawn-drone'] > 0 ? `${cooldowns['spawn-drone']}S` : "25 E"}
                  </span>
                </Button>
              </div>

              {activeMode !== 'normal' && (
                <div className="text-[10px] text-center font-bold text-primary animate-pulse bg-primary/10 border border-primary/30 p-2 rounded-lg">
                  SELECT TARGET DIRECTLY IN PHASER GAME VIEW SCREEN
                </div>
              )}
            </div>
          )}

          {/* Active security logs feed */}
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground flex items-center gap-1.5 shrink-0">
              <Terminal className="size-3.5 text-primary" />
              Tactical Operations Feed Logs
            </span>
            <div className="flex-1 bg-black/60 border border-border/10 rounded-xl p-3 font-mono text-[9px] leading-relaxed overflow-y-auto flex flex-col gap-1.5 text-left select-none">
              {logs.length === 0 ? (
                <div className="text-muted-foreground/60 italic text-center pt-8">No security logs recorded.</div>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0 select-none">[{log.time}]</span>
                    <span className={
                      log.type === 'danger' ? 'text-red-400 font-extrabold' :
                      log.type === 'warn' ? 'text-yellow-400' :
                      log.type === 'success' ? 'text-emerald-400' : 'text-zinc-300'
                    }>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
