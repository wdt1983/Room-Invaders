"use client";

import { useMemo, useState } from "react";
import { useUIStore } from "@/lib/store/useUIStore";
import { EventBus } from '@/game/EventBus';
import { Card } from '@/components/ui/card';
import { useRoomStore } from '@/lib/store/useRoomStore';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { Lock, Cpu, Hammer, Palette, Target, Zap, Shield, Wrench } from 'lucide-react';
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

const TYPE_STYLES = {
  turret: {
    activeBorder: 'border-red-500 bg-red-950/20 ring-1 ring-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.25)]',
    activeText: 'text-red-400',
    hoverBg: 'hover:border-red-500/40 hover:bg-red-950/5',
    badgeBg: 'bg-red-500/10 border-red-500/20 text-red-400',
    icon: Target,
  },
  trap: {
    activeBorder: 'border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    activeText: 'text-amber-400',
    hoverBg: 'hover:border-amber-500/40 hover:bg-amber-950/5',
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    icon: Zap,
  },
  barricade: {
    activeBorder: 'border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    activeText: 'text-emerald-400',
    hoverBg: 'hover:border-emerald-500/40 hover:bg-emerald-950/5',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    icon: Shield,
  },
  furniture: {
    activeBorder: 'border-cyan-500 bg-cyan-950/20 ring-1 ring-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.25)]',
    activeText: 'text-cyan-400',
    hoverBg: 'hover:border-cyan-500/40 hover:bg-cyan-950/5',
    badgeBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
    icon: Wrench,
  },
} as const;

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
              const styleKey = (item.type in TYPE_STYLES) ? (item.type as keyof typeof TYPE_STYLES) : 'furniture';
              const typeStyle = TYPE_STYLES[styleKey];
              const IconComponent = typeStyle.icon;

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
                  className={`min-w-[110px] cursor-pointer border transition-all duration-300 p-2.5 flex flex-col items-center gap-2 relative rounded-xl bg-background/30 backdrop-blur-sm select-none ${
                    selectedItemKey === item.sprite_key 
                      ? `${typeStyle.activeBorder} scale-[1.03]` 
                      : `border-border/20 ${typeStyle.hoverBg} hover:scale-[1.02] hover:-translate-y-0.5`
                  } ${isLocked ? 'opacity-40 cursor-not-allowed filter grayscale-[30%]' : ''}`}
                  title={isTechLocked ? "Research Node Required in Squad & Tech Core" : undefined}
                >
                  {isLocked && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl z-10">
                      {isTechLocked ? (
                        <Cpu className="w-5 h-5 text-cyan-400 drop-shadow-md animate-pulse" />
                      ) : (
                        <Lock className="w-5 h-5 text-white drop-shadow-md" />
                      )}
                    </div>
                  )}
                  {/* Premium Glowing Icon Badge */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-300 ${
                    selectedItemKey === item.sprite_key
                      ? `${typeStyle.badgeBg} border-transparent scale-105 shadow-[inset_0_0_8px_rgba(255,255,255,0.05)]`
                      : 'bg-muted-foreground/5 border-border/20 text-muted-foreground hover:text-foreground'
                  }`}>
                    <IconComponent className="size-4.5" />
                  </div>
                  <div className="text-center w-full">
                    <p className="text-[9.5px] font-bold truncate w-[90px] text-foreground/90" title={item.name}>
                      {item.name}
                    </p>
                    {scrapCost > 0 ? (
                      <p className="text-[8.5px] font-semibold text-muted-foreground">{scrapCost} Scrap</p>
                    ) : null}
                    {isLevelLocked && (
                      <p className="text-[8.5px] text-destructive font-bold">Lvl {item.unlock_level}</p>
                    )}
                    {!isLevelLocked && isTechLocked && (
                      <p className="text-[7.5px] text-cyan-400 font-extrabold uppercase tracking-widest">Research</p>
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
                      className={`size-6 rounded-full transition-all border-2 relative shrink-0 duration-300 ${
                        isActive
                          ? `border-white scale-115 shadow-lg ${preset.glow} ring-2 ring-cyan-400/60 -translate-y-0.5`
                          : 'border-background/50 opacity-75 hover:opacity-100 hover:scale-110 hover:-translate-y-0.5'
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
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-left min-w-[120px] transition-all duration-300 bg-background/30 backdrop-blur-sm cursor-pointer hover:-translate-y-0.5 hover:scale-[1.02] ${
                        isActive
                          ? 'border-cyan-500 text-cyan-300 bg-cyan-500/10 shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                          : 'border-border/40 text-muted-foreground hover:border-border/80 hover:text-foreground'
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
