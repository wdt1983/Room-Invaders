'use client';

import { useEffect } from 'react';
import { useUIStore } from '@/lib/store/useUIStore';
import { EventBus } from '@/game/EventBus';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCw } from 'lucide-react';

export function ContextMenu() {
  const { contextMenu, openContextMenu, closeContextMenu } = useUIStore();
  const mode = useUIStore((state) => state.mode);

  useEffect(() => {
    const handleOpen = (payload: {
      spriteKey?: string;
      x: number;
      y: number;
      entityId?: string;
      gridX?: number;
      gridY?: number;
    }) => {
      openContextMenu(payload);
    };

    EventBus.on('open-context-menu', handleOpen);

    return () => {
      EventBus.off('open-context-menu', handleOpen);
    };
  }, [openContextMenu]);

  if (!contextMenu?.visible) return null;

  const canRemove =
    mode === 'edit' &&
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
        <Card className="w-48 shadow-xl bg-background/95 backdrop-blur border-primary/20">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm font-semibold capitalize text-primary">
              {contextMenu.spriteKey?.replace(/_/g, ' ') || 'Object'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 flex flex-col gap-2">
            {canRemove ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => {
                    EventBus.emit('request-rotation', {
                      x: contextMenu.gridX,
                      y: contextMenu.gridY,
                    });
                    closeContextMenu();
                  }}
                >
                  <RotateCw className="mr-2 size-3.5" />
                  Rotate 90°
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => {
                    EventBus.emit('request-removal', {
                      x: contextMenu.gridX,
                      y: contextMenu.gridY,
                    });
                    closeContextMenu();
                  }}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Remove (50% refund)
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="default"
                className="w-full justify-start"
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
              variant="secondary"
              className="w-full justify-start"
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
