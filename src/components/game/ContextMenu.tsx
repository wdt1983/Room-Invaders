'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/store/useUIStore';
import { EventBus } from '@/game/EventBus';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCw, FileImage, Move } from 'lucide-react';
import { useRoomStore } from '@/lib/store/useRoomStore';

export function ContextMenu() {
  const {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    setMovingItem,
    setSelectedItemKey,
    setMode,
  } = useUIStore();
  const mode = useUIStore((state) => state.mode);
  const catalog = useRoomStore((state) => state.catalog);

  useEffect(() => {
    const handleOpen = (payload: {
      spriteKey?: string;
      x: number;
      y: number;
      entityId?: string;
      gridX?: number;
      gridY?: number;
      isDamaged?: boolean;
    }) => {
      openContextMenu(payload);
    };

    EventBus.on('open-context-menu', handleOpen);

    return () => {
      EventBus.off('open-context-menu', handleOpen);
    };
  }, [openContextMenu]);

  if (!contextMenu?.visible) return null;

  const catalogItem = catalog.find((c) => c.sprite_key === contextMenu.spriteKey);
  const originalScrapCost = Number(catalogItem?.cost?.scrap) || 0;
  const repairCost = Math.max(5, Math.floor(originalScrapCost * 0.4));

  const canRemove =
    typeof contextMenu.gridX === 'number' &&
    typeof contextMenu.gridY === 'number';

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={closeContextMenu}
        onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
      />
      <div
        className="absolute z-50 animate-in fade-in zoom-in-95 duration-100"
        style={{ left: contextMenu.x, top: contextMenu.y }}
      >
        <Card className="w-52 shadow-2xl bg-background/90 backdrop-blur-lg border-2 border-primary/30 shadow-primary/5 rounded-xl overflow-hidden">
          <CardHeader className="p-3 pb-2 border-b border-border/10 bg-muted/10">
            <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.1)] flex items-center gap-1.5">
              <span className="w-1 h-3 bg-primary rounded-full animate-pulse shrink-0" />
              {contextMenu.spriteKey?.replace(/_/g, ' ') || 'Object'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-3 flex flex-col gap-2 bg-background/40">
            {contextMenu.spriteKey === 'furniture_custom_poster' && typeof contextMenu.gridX === 'number' && typeof contextMenu.gridY === 'number' && (
              <Button
                size="sm"
                variant="default"
                className="w-full justify-start border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/25 hover:border-cyan-500/50 hover:shadow-[0_0_12px_rgba(6,182,212,0.3)] font-bold transition-all duration-300 rounded-lg text-xs group cursor-pointer"
                onClick={() => {
                  EventBus.emit('open-poster-dialog', {
                    gridX: contextMenu.gridX,
                    gridY: contextMenu.gridY,
                  });
                  closeContextMenu();
                }}
              >
                <FileImage className="mr-2 size-3.5 text-cyan-400 group-hover:scale-110 transition-transform duration-300" />
                Edit Custom Poster
              </Button>
            )}
            {contextMenu.isDamaged && typeof contextMenu.gridX === 'number' && typeof contextMenu.gridY === 'number' && (
              <Button
                size="sm"
                variant="default"
                className="w-full justify-start border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/50 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse font-bold transition-all duration-300 rounded-lg text-xs"
                onClick={() => {
                  EventBus.emit('request-repair', {
                    x: contextMenu.gridX,
                    y: contextMenu.gridY,
                  });
                  closeContextMenu();
                }}
              >
                <span className="mr-2">🔧</span>
                Repair ({repairCost} Scrap)
              </Button>
            )}
            {canRemove ? (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="w-full justify-start cursor-pointer border border-cyan-500/20 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 hover:shadow-[0_0_12px_rgba(6,182,212,0.25)] transition-all duration-300 rounded-lg text-xs group"
                  onClick={() => {
                    if (typeof contextMenu.gridX === 'number' && typeof contextMenu.gridY === 'number' && contextMenu.spriteKey) {
                      const catalogItem = catalog.find((c) => c.sprite_key === contextMenu.spriteKey);
                      setMovingItem({ x: contextMenu.gridX, y: contextMenu.gridY });
                      setSelectedItemKey(contextMenu.spriteKey);
                      EventBus.emit('item-selected', {
                        key: contextMenu.spriteKey,
                        type: catalogItem?.type ?? 'furniture',
                        stats: catalogItem?.stats ?? {},
                        footprint: catalogItem?.footprint ?? { w: 1, h: 1 },
                      });
                      setMode('edit');
                    }
                    closeContextMenu();
                  }}
                >
                  <Move className="mr-2 size-3.5 transition-transform duration-300 group-hover:scale-115 text-cyan-400" />
                  Move Furniture
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full justify-start cursor-pointer border border-border/20 bg-muted/20 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-300 rounded-lg text-xs group"
                  onClick={() => {
                    EventBus.emit('request-rotation', {
                      x: contextMenu.gridX,
                      y: contextMenu.gridY,
                    });
                    closeContextMenu();
                  }}
                >
                  <RotateCw className="mr-2 size-3.5 transition-transform duration-500 group-hover:rotate-180 text-muted-foreground group-hover:text-primary" />
                  Rotate 90°
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="w-full justify-start cursor-pointer border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all duration-300 rounded-lg text-xs group"
                  onClick={() => {
                    EventBus.emit('request-removal', {
                      x: contextMenu.gridX,
                      y: contextMenu.gridY,
                    });
                    closeContextMenu();
                  }}
                >
                  <Trash2 className="mr-2 size-3.5 transition-transform duration-300 group-hover:scale-115 text-emerald-400/70 group-hover:text-emerald-400" />
                  Recycle (+50% Scrap)
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="default"
                className="w-full justify-start cursor-pointer border border-border/20 bg-muted/20 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-300 rounded-lg text-xs"
                onClick={() => {
                  console.log(`Inspecting [${contextMenu.spriteKey}]`);
                  closeContextMenu();
                }}
              >
                Inspect
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start cursor-pointer border border-border/20 bg-transparent hover:bg-muted/30 transition-all duration-300 rounded-lg text-xs"
              onClick={closeContextMenu}
            >
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
