"use client";

import { useUIStore } from "@/lib/store/useUIStore";
import { EventBus } from '@/game/EventBus';
import { Card } from '@/components/ui/card';
import { useRoomStore } from '@/lib/store/useRoomStore';
import { usePlayerStore } from '@/lib/store/usePlayerStore';
import { Lock } from 'lucide-react';

export function ItemPanel() {
  const mode = useUIStore((state) => state.mode);
  const selectedItemKey = useUIStore((state) => state.selectedItemKey);
  const setSelectedItemKey = useUIStore((state) => state.setSelectedItemKey);
  const catalog = useRoomStore((state) => state.catalog);
  const playerLevel = usePlayerStore((state) => state.playerLevel);

  if (mode !== 'edit') return null;

  return (
    <div className="absolute bottom-20 left-0 right-0 h-24 bg-background/80 backdrop-blur-md border-t border-border flex items-center px-4 overflow-x-auto gap-2">
      <div className="flex space-x-2">
        {catalog.map((item) => {
          const isLocked = item.unlock_level > playerLevel;
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
            >
              {isLocked && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-lg z-10">
                  <Lock className="w-6 h-6 text-white drop-shadow-md" />
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
                {isLocked && (
                  <p className="text-[10px] text-destructive font-bold">Lvl {item.unlock_level}</p>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
