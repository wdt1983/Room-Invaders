"use client";

import { useMemo } from "react";
import { useUIStore } from "@/lib/store/useUIStore";
import { EventBus } from '@/game/EventBus';
import { Card } from '@/components/ui/card';
import { useRoomStore } from '@/lib/store/useRoomStore';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { Lock, Cpu } from 'lucide-react';

export function ItemPanel() {
  const mode = useUIStore((state) => state.mode);
  const selectedItemKey = useUIStore((state) => state.selectedItemKey);
  const setSelectedItemKey = useUIStore((state) => state.setSelectedItemKey);
  const catalog = useRoomStore((state) => state.catalog);
  const playerLevel = usePlayerStore((state) => state.playerLevel);
  const unlockedTechs = usePlayerStore((state) => state.unlockedTechs);

  const unlockedIdsSet = useMemo(() => new Set(unlockedTechs), [unlockedTechs]);

  if (mode !== 'edit') return null;

  return (
    <div className="absolute bottom-20 left-0 right-0 h-24 bg-background/80 backdrop-blur-md border-t border-border flex items-center px-4 overflow-x-auto gap-2 z-40 select-none">
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
              className={`min-w-[100px] cursor-pointer border-2 transition-all p-2 flex flex-col items-center gap-2 relative ${
                selectedItemKey === item.sprite_key ? 'border-primary' : 'border-transparent'
              } ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
              title={isTechLocked ? "Research Node Required in Squad & Tech Core" : undefined}
            >
              {isLocked && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg z-10">
                  {isTechLocked ? (
                    <Cpu className="w-6 h-6 text-cyan-400 drop-shadow-md animate-pulse" />
                  ) : (
                    <Lock className="w-6 h-6 text-white drop-shadow-md" />
                  )}
                </div>
              )}
              {/* placeholder visual */}
              <div className="w-8 h-8 bg-muted-foreground/20 rounded flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground uppercase">{item.sprite_key.substring(0,3)}</span>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-semibold truncate w-[80px]" title={item.name}>{item.name}</p>
                {scrapCost > 0 ? (
                  <p className="text-[10px] text-muted-foreground">{scrapCost} Scrap</p>
                ) : null}
                {isLevelLocked && (
                  <p className="text-[10px] text-destructive font-bold">Lvl {item.unlock_level}</p>
                )}
                {!isLevelLocked && isTechLocked && (
                  <p className="text-[9px] text-cyan-400 font-extrabold tracking-wide uppercase">Research Req</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
