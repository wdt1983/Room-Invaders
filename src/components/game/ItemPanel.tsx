"use client";

import { useMemo, useState } from "react";
import { useUIStore } from "@/lib/store/useUIStore";
import { EventBus } from '@/game/EventBus';
import { Card } from '@/components/ui/card';
import { useRoomStore } from '@/lib/store/useRoomStore';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { Lock, Cpu, Hammer, Palette } from 'lucide-react';
import { saveRoomCosmetics } from "@/app/(game)/room/actions";
import { toast } from "sonner";

const WALL_COLOR_PRESETS = [
  { name: 'Tech Grey', hex: '#888888', value: 0x888888, glow: 'shadow-slate-500/20' },
  { name: 'Cyber Cyan', hex: '#06b6d4', value: 0x06b6d4, glow: 'shadow-cyan-500/20' },
  { name: 'Matrix Green', hex: '#10b981', value: 0x10b981, glow: 'shadow-emerald-500/20' },
  { name: 'Warning Amber', hex: '#f59e0b', value: 0xf59e0b, glow: 'shadow-amber-500/20' },
  { name: 'Laser Red', hex: '#ef4444', value: 0xef4444, glow: 'shadow-red-500/20' },
  { name: 'Void Purple', hex: '#8b5cf6', value: 0x8b5cf6, glow: 'shadow-violet-500/20' },
];

const FLOOR_MATERIAL_PRESETS = [
  { id: 'tile', name: 'Cyber Grid', icon: '🌐', desc: 'Cyan glowing circuit subgrid' },
  { id: 'wood', name: 'Mahogany', icon: '🪵', desc: 'Plated warm mahogany wood' },
  { id: 'carpet', name: 'Carpet', icon: '🧶', desc: 'Cozy dark stipple grid' },
  { id: 'concrete', name: 'Concrete', icon: '🪨', desc: 'Cold cracked concrete slabs' },
] as const;

export function ItemPanel() {
  const mode = useUIStore((state) => state.mode);
  const selectedItemKey = useUIStore((state) => state.selectedItemKey);
  const setSelectedItemKey = useUIStore((state) => state.setSelectedItemKey);
  const catalog = useRoomStore((state) => state.catalog);
  const playerLevel = usePlayerStore((state) => state.playerLevel);
  const unlockedTechs = usePlayerStore((state) => state.unlockedTechs);

  const cosmetics = useRoomStore((state) => state.cosmetics);
  const setCosmetics = useRoomStore((state) => state.setCosmetics);

  const [activeTab, setActiveTab] = useState<'defenses' | 'aesthetics'>('defenses');

  const unlockedIdsSet = useMemo(() => new Set(unlockedTechs), [unlockedTechs]);

  if (mode !== 'edit') return null;

  const handleSelectColor = async (colorValue: number) => {
    const updated = { ...cosmetics, wallColor: colorValue };
    setCosmetics(updated);
    EventBus.emit('cosmetics-changed', updated);
    
    // Save to database
    const res = await saveRoomCosmetics(updated);
    if (!res.success) {
      toast.error("Failed to sync room aesthetics with network");
    }
  };

  const handleSelectFloor = async (floorId: 'wood' | 'carpet' | 'tile' | 'concrete') => {
    const updated = { ...cosmetics, floorType: floorId };
    setCosmetics(updated);
    EventBus.emit('cosmetics-changed', updated);

    // Save to database
    const res = await saveRoomCosmetics(updated);
    if (!res.success) {
      toast.error("Failed to sync room aesthetics with network");
    }
  };

  return (
    <div className="absolute bottom-20 left-0 right-0 h-28 bg-background/80 backdrop-blur-md border-t border-border flex items-center px-4 overflow-hidden gap-4 z-40 select-none">
      
      {/* Side Tabs Console */}
      <div className="flex flex-col gap-1.5 shrink-0 border-r border-border/40 pr-3 justify-center h-full">
        <button
          onClick={() => setActiveTab('defenses')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
            activeTab === 'defenses'
              ? 'bg-primary/10 text-primary border-primary/30 shadow-md shadow-primary/5'
              : 'border-transparent text-muted-foreground hover:bg-muted/10'
          }`}
        >
          <Hammer className="size-3.5" />
          Defenses
        </button>
        <button
          onClick={() => setActiveTab('aesthetics')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
            activeTab === 'aesthetics'
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-md shadow-cyan-500/5'
              : 'border-transparent text-muted-foreground hover:bg-muted/10'
          }`}
        >
          <Palette className="size-3.5" />
          Aesthetics
        </button>
      </div>

      {/* Main Drawer Content */}
      <div className="flex-1 h-full flex items-center overflow-x-auto py-2">
        {activeTab === 'defenses' ? (
          /* Tab 1: Defenses */
          <div className="flex space-x-2">
            {catalog.map((item) => {
              const isLevelLocked = item.unlock_level > playerLevel;
              const isTechLocked = !!(item.tech_tree_node && !unlockedIdsSet.has(item.tech_tree_node));
              const isLocked = isLevelLocked || isTechLocked;
              const scrapCost = item.cost?.scrap || 0;

              return (
                <Card
                  key={item.id}
                  onClick={() => {
                    if (!isLocked) {
                      setSelectedItemKey(item.sprite_key);
                      EventBus.emit('item-selected', {
                        key: item.sprite_key,
                        type: item.type,
                        stats: item.stats ?? {},
                      });
                    }
                  }}
                  className={`min-w-[100px] cursor-pointer border-2 transition-all p-2 flex flex-col items-center gap-1.5 relative ${
                    selectedItemKey === item.sprite_key ? 'border-primary bg-primary/5' : 'border-transparent bg-background/40'
                  } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
                  title={isTechLocked ? "Research Node Required in Squad & Tech Core" : undefined}
                >
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg z-10">
                      {isTechLocked ? (
                        <Cpu className="w-5 h-5 text-cyan-400 drop-shadow-md animate-pulse" />
                      ) : (
                        <Lock className="w-5 h-5 text-white drop-shadow-md" />
                      )}
                    </div>
                  )}
                  {/* Procedural icon standin */}
                  <div className="w-7 h-7 bg-muted-foreground/10 border border-muted/20 rounded flex items-center justify-center">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">
                      {item.sprite_key.substring(0, 3)}
                    </span>
                  </div>
                  <div className="text-center w-full">
                    <p className="text-[9.5px] font-bold truncate w-[85px] text-foreground/90" title={item.name}>
                      {item.name}
                    </p>
                    {scrapCost > 0 ? (
                      <p className="text-[8.5px] font-semibold text-muted-foreground">{scrapCost} Scrap</p>
                    ) : null}
                    {isLevelLocked && (
                      <p className="text-[8.5px] text-destructive font-bold">Lvl {item.unlock_level}</p>
                    )}
                    {!isLevelLocked && isTechLocked && (
                      <p className="text-[8.5px] text-cyan-400 font-extrabold uppercase">Research</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Tab 2: Base Aesthetics Customizer */
          <div className="flex gap-6 h-full items-center min-w-[500px]">
            {/* Wall Colors segment */}
            <div className="flex flex-col gap-2 border-r border-border/30 pr-6 h-full justify-center">
              <span className="text-[10px] font-extrabold text-muted-foreground tracking-wider uppercase">
                Wall Color Presets
              </span>
              <div className="flex gap-2">
                {WALL_COLOR_PRESETS.map((preset) => {
                  const isActive = cosmetics.wallColor === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => handleSelectColor(preset.value)}
                      style={{ backgroundColor: preset.hex }}
                      title={preset.name}
                      className={`size-6 rounded-full transition-all border-2 relative shrink-0 ${
                        isActive
                          ? 'border-white scale-110 shadow-lg ring-2 ring-cyan-500/50'
                          : 'border-transparent opacity-75 hover:opacity-100 hover:scale-105'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute inset-0.5 rounded-full border border-black/40" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Floor Materials segment */}
            <div className="flex flex-col gap-2 h-full justify-center">
              <span className="text-[10px] font-extrabold text-muted-foreground tracking-wider uppercase">
                Floor Materials
              </span>
              <div className="flex gap-2">
                {FLOOR_MATERIAL_PRESETS.map((mat) => {
                  const isActive = cosmetics.floorType === mat.id;
                  return (
                    <button
                      key={mat.id}
                      onClick={() => handleSelectFloor(mat.id)}
                      title={mat.desc}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left min-w-[110px] transition-all bg-background/40 hover:bg-muted/10 ${
                        isActive
                          ? 'border-cyan-400 text-cyan-300 bg-cyan-400/5 shadow-md shadow-cyan-500/5'
                          : 'border-border/60 text-muted-foreground'
                      }`}
                    >
                      <span className="text-sm shrink-0">{mat.icon}</span>
                      <div className="flex flex-col">
                        <span className="text-[9.5px] font-bold tracking-wide">
                          {mat.name}
                        </span>
                        <span className="text-[8px] opacity-60 truncate w-[60px]">
                          {mat.id}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
