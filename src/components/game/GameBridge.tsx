"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { EventBus } from "@/game/EventBus";
import {
  buyAndPlaceFurniture,
  removePlacedItem,
  rotatePlacedItem,
  repairPlacedItem,
  movePlacedItem,
} from "@/app/(game)/room/actions";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { useRoomStore, CatalogItem } from "@/lib/store/useRoomStore";
import { useUIStore } from "@/lib/store/useUIStore";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function syncDefenseStats(result: any) {
  if (
    typeof result?.defenseRating === "number" &&
    typeof result?.defenseSlotsUsed === "number" &&
    typeof result?.defenseSlotsCap === "number"
  ) {
    useRoomStore.getState().setDefenseStats({
      defenseRating: result.defenseRating,
      defenseSlotsUsed: result.defenseSlotsUsed,
      defenseSlotsCap: result.defenseSlotsCap,
    });
  }
}

/**
 * Resolve a spriteKey to its catalog display name + scrap cost. Falls back to
 * the raw key if the catalog isn't loaded for some reason — a failed lookup
 * should never swallow the toast, just give it a less-polished label.
 */
function catalogInfo(spriteKey: string): { name: string; scrapCost: number; entry: CatalogItem | undefined } {
  const entry = useRoomStore.getState().catalog.find((c) => c.sprite_key === spriteKey);
  return {
    name: entry?.name ?? spriteKey.replace(/_/g, " "),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scrapCost: Number((entry?.cost as any)?.scrap) || 0,
    entry,
  };
}

export function GameBridge() {
  useEffect(() => {
    const handlePlacementRequest = async (payload: { key: string; x: number; y: number }) => {
      const uiState = useUIStore.getState();
      const movingItem = uiState.movingItem;
      const { name, scrapCost } = catalogInfo(payload.key);

      if (movingItem) {
        const result = await movePlacedItem(movingItem.x, movingItem.y, payload.x, payload.y);

        if (result.success) {
          uiState.setMovingItem(null);
          uiState.setSelectedItemKey(null);
          uiState.setMode("view");
          
          EventBus.emit("move-success", {
            oldX: movingItem.x,
            oldY: movingItem.y,
            newX: payload.x,
            newY: payload.y,
          });

          toast.success(`Moved ${name}`);
        } else {
          toast.error("Move failed", { description: result.error });
        }
      } else {
        const result = await buyAndPlaceFurniture(payload.key, payload.x, payload.y);

        if (result.success && result.newScrap !== undefined) {
          usePlayerStore.getState().setInventory({ scrap: result.newScrap });
          syncDefenseStats(result);
          EventBus.emit("placement-success", payload);
          toast.success(`Placed ${name}`, {
            description: scrapCost > 0 ? `−${scrapCost} Scrap` : undefined,
          });
        } else {
          toast.error("Placement failed", { description: result.error });
        }
      }
    };

    const handleRemovalRequest = async (payload: { x: number; y: number }) => {
      // Look up what's on the tile BEFORE the server removes it — after
      // `removal-success` fires, `placedItems` will no longer contain the row.
      const placed = useRoomStore
        .getState()
        .placedItems.find((p) => p.gridX === payload.x && p.gridY === payload.y);
      const displayName = placed ? catalogInfo(placed.spriteKey).name : "Item";

      const result = await removePlacedItem(payload.x, payload.y);

      if (result.success) {
        if (typeof result.newScrap === "number") {
          usePlayerStore.getState().setInventory({ scrap: result.newScrap });
        }
        syncDefenseStats(result);
        EventBus.emit("removal-success", payload);
        const refund = typeof result.refund === "number" ? result.refund : 0;
        toast.success(`Removed ${displayName}`, {
          description: refund > 0 ? `+${refund} Scrap refunded` : undefined,
        });
      } else {
        toast.error("Remove failed", { description: result.error });
      }
    };

    const handleRotationRequest = async (payload: { x: number; y: number }) => {
      const result = await rotatePlacedItem(payload.x, payload.y);

      if (result.success && typeof result.rotation === "number") {
        EventBus.emit("rotation-success", {
          x: payload.x,
          y: payload.y,
          rotation: result.rotation,
        });
      } else {
        toast.error("Rotate failed", { description: result.error });
      }
    };

    const handleRepairRequest = async (payload: { x: number; y: number }) => {
      const placed = useRoomStore
        .getState()
        .placedItems.find((p) => p.gridX === payload.x && p.gridY === payload.y);
      const displayName = placed ? catalogInfo(placed.spriteKey).name : "Item";

      const toastId = toast.loading(`Repairing ${displayName}...`);
      const result = await repairPlacedItem(payload.x, payload.y);

      toast.dismiss(toastId);
      if (result.success) {
        if (typeof result.newScrap === "number") {
          usePlayerStore.getState().setInventory({ scrap: result.newScrap });
        }
        syncDefenseStats(result);
        useRoomStore.getState().repairPlacedItemAt(payload.x, payload.y);
        EventBus.emit("repair-success", payload);
        toast.success(`Repaired ${displayName}`, {
          description: `−${result.repairCost} Scrap. Base operational!`,
        });
      } else {
        toast.error("Repair failed", { description: result.error });
      }
    };

    EventBus.on("request-placement", handlePlacementRequest);
    EventBus.on("request-removal", handleRemovalRequest);
    EventBus.on("request-rotation", handleRotationRequest);
    EventBus.on("request-repair", handleRepairRequest);

    return () => {
      EventBus.off("request-placement", handlePlacementRequest);
      EventBus.off("request-removal", handleRemovalRequest);
      EventBus.off("request-rotation", handleRotationRequest);
      EventBus.off("request-repair", handleRepairRequest);
    };
  }, []);

  return null;
}
