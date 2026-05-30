"use client";

import React, { useEffect, useState } from "react";
import { useRoomStore } from "@/lib/store/useRoomStore";
import { EventBus } from "@/game/EventBus";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { updateBossPedestalSettingsAction } from "@/app/actions/boss-pedestal";
import { SoundManager } from "@/game/objects/SoundManager";
import { Loader2, Sliders, Palette, Zap, Lock, Unlock, Trophy } from "lucide-react";
import { toast } from "sonner";

const BOSSES = [
  { id: "boss-ironjaw", name: "Ironjaw", sprite: "boss_ironjaw", desc: "Heavy mechanical exo-armor plating." },
  { id: "boss-whisper", name: "Whisper", sprite: "boss_whisper", desc: "Classified tactical light-bending stealth suit." },
  { id: "boss-volkov", name: "Volkov", sprite: "boss_volkov", desc: "Colonel Volkov's dual autocannon tank chassis." },
  { id: "boss-circuit", name: "Circuit", sprite: "boss_circuit", desc: "Super-charged electromagnetic node grid." },
  { id: "boss-warden", name: "The Warden", sprite: "boss_warden", desc: "Fractured cryptographic central core." }
];

export function BossPedestalDialog() {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [loadingClears, setLoadingClears] = useState(false);
  const [clearedBosses, setClearedBosses] = useState<Set<string>>(new Set());

  // Hologram settings states
  const [selectedBoss, setSelectedBoss] = useState("boss-ironjaw");
  const [holoColor, setHoloColor] = useState("#06b6d4");
  const [flicker, setFlicker] = useState(0.15);
  const [scanlines, setScanlines] = useState(0.40);
  const [noise, setNoise] = useState(0.10);
  const [savingHolo, setSavingHolo] = useState(false);

  const placedItems = useRoomStore((state) => state.placedItems);
  const targetItem = placedItems.find(
    (p) => coords && p.gridX === coords.x && p.gridY === coords.y
  );

  useEffect(() => {
    if (targetItem?.hologramSettings) {
      setSelectedBoss(targetItem.hologramSettings.boss || "boss-ironjaw");
      setHoloColor(targetItem.hologramSettings.color || "#06b6d4");
      setFlicker(targetItem.hologramSettings.flicker ?? 0.15);
      setScanlines(targetItem.hologramSettings.scanlines ?? 0.40);
      setNoise(targetItem.hologramSettings.noise ?? 0.10);
    } else {
      setSelectedBoss("boss-ironjaw");
      setHoloColor("#06b6d4");
      setFlicker(0.15);
      setScanlines(0.40);
      setNoise(0.10);
    }
  }, [targetItem]);

  useEffect(() => {
    const handleOpen = (payload: { gridX: number; gridY: number }) => {
      setCoords({ x: payload.gridX, y: payload.gridY });
      setOpen(true);
      
      // Fetch authoritative boss clears on mount
      setLoadingClears(true);
      const fetchClears = async () => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data, error } = await supabase
              .from("boss_clears")
              .select("boss_id")
              .eq("player_id", user.id);
            
            if (data && !error) {
              const clears = new Set(data.map((d: any) => d.boss_id));
              setClearedBosses(clears);
            }
          }
        } catch (err) {
          console.error("Failed to load boss clears:", err);
        } finally {
          setLoadingClears(false);
        }
      };
      fetchClears();
    };

    EventBus.on("open-boss-pedestal-dialog", handleOpen);

    return () => {
      EventBus.off("open-boss-pedestal-dialog", handleOpen);
    };
  }, []);

  if (!open || !targetItem) return null;

  const handleSaveHologram = async () => {
    setSavingHolo(true);
    SoundManager.getInstance().playSfx("click");

    try {
      const payloadSettings = {
        color: holoColor,
        flicker,
        scanlines,
        noise,
        boss: selectedBoss
      };

      const res = await updateBossPedestalSettingsAction(targetItem.id, payloadSettings);

      if (res.success && res.settings) {
        toast.success("Holographic display updated authorized!");
        // Update local room Zustand store
        useRoomStore.getState().updateHologramSettingsAt(targetItem.gridX, targetItem.gridY, res.settings);
        
        // Notify Phaser scene to redraw immediately
        EventBus.emit("pedestal-updated", {
          id: targetItem.id,
          gridX: targetItem.gridX,
          gridY: targetItem.gridY,
          hologramSettings: res.settings
        });

        setOpen(false);
      } else {
        toast.error(res.error || "Failed to update hologram settings.");
      }
    } catch (err: any) {
      console.error("Hologram save error caught:", err);
      toast.error(err.message || "An error occurred while saving display settings.");
    } finally {
      setSavingHolo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) SoundManager.getInstance().playSfx("click"); }}>
      <DialogContent className="max-w-md bg-background/90 backdrop-blur-xl border-2 border-primary/20 shadow-2xl rounded-2xl p-6 flex flex-col gap-5 overflow-hidden text-foreground">
        <DialogHeader className="pb-2 border-b border-border/10 flex flex-row items-center gap-3">
          <div className="p-2 border border-cyan-500/20 bg-cyan-500/10 rounded-xl">
            <Trophy className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <DialogTitle className="text-sm font-extrabold uppercase tracking-widest text-primary">
              Holographic Trophy Console
            </DialogTitle>
            <DialogDescription className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Select and customize boss projections
            </DialogDescription>
          </div>
        </DialogHeader>

        {loadingClears ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            <span className="text-[10px] font-black tracking-widest uppercase text-cyan-500/80">
              Querying raid logs...
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
            {/* Boss Select Grid */}
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-extrabold uppercase text-muted-foreground tracking-wider">
                Select Defeated Boss:
              </span>
              <div className="flex flex-col gap-2">
                {BOSSES.map((boss) => {
                  const isCleared = clearedBosses.has(boss.id);
                  const isSelected = selectedBoss === boss.id;

                  return (
                    <button
                      key={boss.id}
                      disabled={!isCleared}
                      onClick={() => {
                        setSelectedBoss(boss.id);
                        SoundManager.getInstance().playSfx("click");
                      }}
                      className={`flex items-center justify-between p-3 border rounded-xl transition-all duration-300 relative text-left ${
                        !isCleared
                          ? "border-muted/30 bg-muted/5 opacity-55 cursor-not-allowed"
                          : isSelected
                          ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)] cursor-pointer"
                          : "border-border/30 bg-muted/10 hover:border-border/60 hover:bg-muted/20 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg border ${
                          !isCleared ? "border-muted/20 bg-muted/5" : isSelected ? "border-cyan-500/30 bg-cyan-500/20" : "border-border/30 bg-muted/5"
                        }`}>
                          {isCleared ? (
                            <Unlock className={`w-3.5 h-3.5 ${isSelected ? "text-cyan-400" : "text-muted-foreground"}`} />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${isCleared ? (isSelected ? "text-cyan-400" : "text-foreground") : "text-muted-foreground/70"}`}>
                            {boss.name} {isCleared && <span className="text-[8px] text-emerald-500 uppercase ml-1 font-black">Cleared</span>}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-semibold leading-relaxed mt-0.5">
                            {boss.desc}
                          </span>
                        </div>
                      </div>
                      {!isCleared && (
                        <span className="text-[8px] border border-amber-500/30 bg-amber-500/5 text-amber-500/80 px-2 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
                          Locked
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customizer Slider Panel */}
            <div className="border border-cyan-500/20 bg-cyan-950/20 backdrop-blur rounded-xl p-3.5 flex flex-col gap-3.5 mt-2">
              <div className="text-xs font-black tracking-wider uppercase text-cyan-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Hologram Display Panel
              </div>
              
              {/* Color Presets */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-extrabold uppercase text-muted-foreground flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Tint Color Preset:
                </span>
                <div className="flex gap-2">
                  {[
                    { hex: "#06b6d4", label: "Cyan" },
                    { hex: "#10b981", label: "Green" },
                    { hex: "#f59e0b", label: "Amber" },
                    { hex: "#a855f7", label: "Purple" },
                    { hex: "#ef4444", label: "Red" }
                  ].map((preset) => (
                    <button
                      key={preset.hex}
                      onClick={() => {
                        setHoloColor(preset.hex);
                        SoundManager.getInstance().playSfx("click");
                      }}
                      className={`size-6 rounded-full border cursor-pointer transition-all duration-300 ${
                        holoColor === preset.hex
                          ? "border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: preset.hex }}
                      title={preset.label}
                    />
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-extrabold uppercase text-muted-foreground">
                    <span>Scanline Opacity:</span>
                    <span className="text-cyan-400">{Math.round(scanlines * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={scanlines}
                    onChange={(e) => setScanlines(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 bg-cyan-950/40 rounded h-1 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-extrabold uppercase text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Zap className="w-3 h-3 text-cyan-400" /> Flicker Intensity:</span>
                    <span className="text-cyan-400">{Math.round(flicker * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={flicker}
                    onChange={(e) => setFlicker(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 bg-cyan-950/40 rounded h-1 cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[9px] font-extrabold uppercase text-muted-foreground">
                    <span>Digital Noise:</span>
                    <span className="text-cyan-400">{Math.round(noise * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={noise}
                    onChange={(e) => setNoise(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 bg-cyan-950/40 rounded h-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Save CTA */}
              <Button
                disabled={savingHolo}
                onClick={handleSaveHologram}
                className="w-full h-8 mt-1 bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_12px_#06b6d4] text-black text-[10px] font-black tracking-widest uppercase rounded-lg transition-all duration-300 cursor-pointer"
              >
                {savingHolo ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    LOCKING display...
                  </>
                ) : (
                  "Lock Display Settings"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
