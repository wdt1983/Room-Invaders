"use client";

import { useState, useEffect } from "react";
import { usePlayerStore, type RaiderCosmetics } from "@/lib/store/usePlayerStore";
import { updateRaiderCosmeticsAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  User, 
  Palette, 
  Sparkles, 
  Save, 
  Check, 
  X, 
  Shield, 
  Flame, 
  Eye, 
  Footprints, 
  Scissors, 
  Shirt 
} from "lucide-react";

// Curated Sleek Cyberpunk Color Catalog
const CYBER_COLORS = [
  { name: "Cyan Spark", value: 0x06b6d4, hex: "#06b6d4" },
  { name: "Toxic Lime", value: 0x10b981, hex: "#10b981" },
  { name: "Neon Violet", value: 0x8b5cf6, hex: "#8b5cf6" },
  { name: "Glitch Pink", value: 0xec4899, hex: "#ec4899" },
  { name: "Cyber Amber", value: 0xf59e0b, hex: "#f59e0b" },
  { name: "Crimson Core", value: 0xef4444, hex: "#ef4444" },
  { name: "Matrix Green", value: 0x22c55e, hex: "#22c55e" },
  { name: "Carbon Slate", value: 0x1e293b, hex: "#1e293b" },
  { name: "Void Slate", value: 0x0f172a, hex: "#0f172a" },
  { name: "Desert Tan", value: 0xd2b48c, hex: "#d2b48c" },
  { name: "Leather Brown", value: 0x451a03, hex: "#451a03" },
  { name: "Breaker Blue", value: 0x1e3a8a, hex: "#1e3a8a" },
];

const PRESETS = {
  tactical: {
    name: "Tactical Raider",
    description: "Standard military issue slate armor and deep blue combat cargo pants.",
    cosmetics: {
      preset: "tactical",
      gender: "male",
      helmetColor: 0x1e293b,
      visorColor: 0x06b6d4,
      vestColor: 0x334155,
      pantsColor: 0x1e3a8a,
      bootsColor: 0x0f172a,
      hairColor: 0xd97706,
    } as RaiderCosmetics,
  },
  rustic: {
    name: "Rustic Raider",
    description: "Tan leather desert trench coat, rugged brown boots, and amber facial visor.",
    cosmetics: {
      preset: "rustic",
      gender: "female",
      helmetColor: 0x451a03,
      visorColor: 0xf59e0b,
      vestColor: 0xd2b48c,
      pantsColor: 0x78350f,
      bootsColor: 0x451a03,
      hairColor: 0x78350f,
    } as RaiderCosmetics,
  },
  neon: {
    name: "Neon Cyberpunk",
    description: "Highly vibrant neon purple plates, deep pink laser visor, and emerald ponytail.",
    cosmetics: {
      preset: "neon",
      gender: "female",
      helmetColor: 0x0f172a,
      visorColor: 0xec4899,
      vestColor: 0x8b5cf6,
      pantsColor: 0x0f172a,
      bootsColor: 0x1e293b,
      hairColor: 0x10b981,
    } as RaiderCosmetics,
  },
};

export default function CharacterCustomizer() {
  const [isOpen, setIsOpen] = useState(false);
  const storeCosmetics = usePlayerStore((state) => state.raiderCosmetics);
  const setRaiderCosmetics = usePlayerStore((state) => state.setRaiderCosmetics);

  // Local editor state
  const [localCosmetics, setLocalCosmetics] = useState<RaiderCosmetics>({
    preset: "tactical",
    gender: "male",
    helmetColor: 0x1e293b,
    visorColor: 0x06b6d4,
    vestColor: 0x334155,
    pantsColor: 0x1e3a8a,
    bootsColor: 0x0f172a,
    hairColor: 0xd97706,
  });

  const [activeTab, setActiveTab] = useState<"preset" | "helmet" | "visor" | "vest" | "pants" | "boots" | "hair">("preset");
  const [isSaving, setIsSaving] = useState(false);

  // Sync from store when opened or store hydrates
  useEffect(() => {
    if (storeCosmetics) {
      setLocalCosmetics(storeCosmetics);
    }
  }, [storeCosmetics, isOpen]);

  // Direct live texture updates on pointer adjust (allows real-time preview!)
  const updateLocalValue = (key: keyof RaiderCosmetics, value: any) => {
    const updated = { ...localCosmetics, [key]: value };
    
    // If presets are selected, update matching colors automatically
    if (key === "preset" && (value === "rustic" || value === "neon" || value === "tactical")) {
      const presetData = PRESETS[value as keyof typeof PRESETS].cosmetics;
      Object.assign(updated, presetData);
    }

    setLocalCosmetics(updated);

    // Live update in the running Phaser canvas (for direct preview)
    if (typeof window !== "undefined") {
      const roomScene = (window as any).game?.scene?.keys?.RoomScene;
      if (roomScene) {
        import("@/game/scenes/BootScene").then(({ BootScene }) => {
          BootScene.regenerateRaiderTextures(roomScene, updated);
        });
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await updateRaiderCosmeticsAction(localCosmetics);
      if (res.success) {
        setRaiderCosmetics(localCosmetics);
        toast.success("Raider squad cosmetics locked and loaded!", {
          description: "All squad members successfully updated.",
        });
        setIsOpen(false);
      } else {
        toast.error(res.error || "Failed to commit customization.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save customization.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Revert to original store value on cancel to clean preview
    if (storeCosmetics) {
      setLocalCosmetics(storeCosmetics);
      // Revert Phaser canvas
      if (typeof window !== "undefined") {
        const roomScene = (window as any).game?.scene?.keys?.RoomScene;
        if (roomScene) {
          import("@/game/scenes/BootScene").then(({ BootScene }) => {
            BootScene.regenerateRaiderTextures(roomScene, storeCosmetics);
          });
        }
      }
    }
    setIsOpen(false);
  };

  const activeColorValue = localCosmetics[activeTab + "Color" as keyof RaiderCosmetics] as number;

  return (
    <>
      {/* Immersive Cyberpunk Floating Trigger Button */}
      <div className="absolute top-36 left-4 z-30">
        <Button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 font-extrabold tracking-wider text-xs border border-primary/20 bg-background/80 hover:bg-primary/10 hover:border-primary/40 rounded-xl px-4 py-2.5 transition-all duration-300 shadow-2xl backdrop-blur-md text-primary"
        >
          <Sparkles className="size-4 text-primary animate-pulse" />
          CUSTOMIZE SQUAD
        </Button>
      </div>

      {/* Main glassmorphic drawer */}
      {isOpen && (
        <div className="absolute top-20 right-4 bottom-24 w-[360px] z-45 flex flex-col gap-4 bg-background/85 backdrop-blur-xl border border-primary/20 shadow-2xl rounded-2xl p-4 overflow-hidden animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/10 pb-3">
            <div className="flex items-center gap-2">
              <Palette className="size-5 text-primary animate-pulse" />
              <div>
                <h2 className="text-sm font-black text-white tracking-wide uppercase">CHARACTER CUSTOMIZER</h2>
                <p className="text-[9px] text-muted-foreground uppercase font-mono">Modulate Raider Anatomy Vectors</p>
              </div>
            </div>
            <button 
              onClick={handleClose}
              className="text-muted-foreground hover:text-white transition-colors duration-200 text-xs font-black bg-muted/20 hover:bg-muted/40 p-1.5 rounded-lg"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Gender Select Cards */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateLocalValue("gender", "male")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase border transition-all duration-300 ${
                localCosmetics.gender === "male"
                  ? "bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                  : "bg-muted/10 border-border/15 text-muted-foreground hover:bg-muted/25 hover:text-white"
              }`}
            >
              <User className="size-4 shrink-0" />
              MALE UNIT
            </button>
            <button
              onClick={() => updateLocalValue("gender", "female")}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-xs uppercase border transition-all duration-300 ${
                localCosmetics.gender === "female"
                  ? "bg-primary/10 border-primary text-primary shadow-[0_0_10px_rgba(6,182,212,0.15)]"
                  : "bg-muted/10 border-border/15 text-muted-foreground hover:bg-muted/25 hover:text-white"
              }`}
            >
              <User className="size-4 shrink-0" />
              FEMALE UNIT
            </button>
          </div>

          {/* Customizer Tabs Navigation */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted/30 select-none">
            {[
              { id: "preset", label: "Presets", icon: Sparkles },
              { id: "helmet", label: "Helmet", icon: Shield },
              { id: "visor", label: "Visor", icon: Eye },
              { id: "vest", label: "Torso Vest", icon: Shirt },
              { id: "pants", label: "Pants", icon: Shirt },
              { id: "boots", label: "Boots", icon: Footprints },
              { id: "hair", label: localCosmetics.gender === "female" ? "Ponytail" : "Hair", icon: Scissors },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase border whitespace-nowrap transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted/5 border-border/5 text-muted-foreground hover:bg-muted/15 hover:text-white"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Active Tab Editor Content Panel */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-0 text-left">
            {activeTab === "preset" ? (
              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">CHOOSE AN APPEARANCE PRESET</span>
                {Object.entries(PRESETS).map(([key, data]) => (
                  <Card
                    key={key}
                    onClick={() => updateLocalValue("preset", key)}
                    className={`cursor-pointer transition-all duration-300 border bg-zinc-950/40 hover:bg-zinc-900/60 ${
                      localCosmetics.preset === key
                        ? "border-primary shadow-[0_0_15px_rgba(6,182,212,0.1)] scale-[1.01]"
                        : "border-border/10 hover:border-border/30"
                    }`}
                  >
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        key === "tactical" ? "bg-cyan-500/10 text-cyan-400" :
                        key === "rustic" ? "bg-amber-500/10 text-amber-400" : "bg-purple-500/10 text-purple-400"
                      }`}>
                        <Shield className="size-5 shrink-0" />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <span className="text-xs font-black text-white uppercase tracking-wide flex items-center gap-1.5">
                          {data.name}
                          {localCosmetics.preset === key && <Check className="size-3.5 text-primary shrink-0" />}
                        </span>
                        <p className="text-[9px] text-muted-foreground leading-normal mt-1">{data.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    CHOOSE CURATED CYBER TINT
                  </span>
                  <span className="text-[9px] text-primary/80 font-mono">
                    HEX: #{activeColorValue?.toString(16).padStart(6, '0').toUpperCase()}
                  </span>
                </div>
                
                {/* Visual Swatch Color Selector Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {CYBER_COLORS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => updateLocalValue(activeTab + "Color" as keyof RaiderCosmetics, color.value)}
                      className={`h-11 rounded-xl relative border transition-all duration-300 flex items-center justify-center group ${
                        activeColorValue === color.value
                          ? "border-white scale-[1.06] shadow-xl"
                          : "border-border/10 hover:border-border/30 hover:scale-[1.03]"
                      }`}
                      style={{ 
                        backgroundColor: color.hex,
                        boxShadow: activeColorValue === color.value ? `0 0 15px ${color.hex}66` : undefined
                      }}
                      title={color.name}
                    >
                      {activeColorValue === color.value && (
                        <div className="bg-black/60 rounded-full p-0.5 border border-white/20">
                          <Check className="size-3 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Cybernetic active hint */}
                <div className="mt-4 bg-muted/10 border border-primary/10 rounded-xl p-3 flex flex-col gap-1">
                  <span className="text-[9px] font-black uppercase text-primary tracking-wider flex items-center gap-1">
                    <Flame className="size-3 text-primary animate-pulse" />
                    Procedural Voxel Compiled
                  </span>
                  <p className="text-[9px] text-muted-foreground leading-normal">
                    This tint is mapped and injected directly into the Phaser vector preloader and will reflect instantly on your standing raiders.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Operations Actions Save/Apply */}
          <div className="flex gap-2 pt-2 border-t border-border/10 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 bg-muted/10 border-border/15 hover:bg-muted/20 text-white font-black uppercase text-xs rounded-xl py-4"
            >
              CANCEL
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-primary hover:bg-primary/90 text-black font-black uppercase text-xs rounded-xl py-4 flex items-center justify-center gap-1.5"
            >
              <Save className="size-3.5 text-black" />
              {isSaving ? "SAVING..." : "LOCK COSMETICS"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
