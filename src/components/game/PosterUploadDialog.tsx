"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRoomStore } from "@/lib/store/useRoomStore";
import { EventBus } from "@/game/EventBus";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { moderateCustomPosterAction, updateHologramSettingsAction } from "@/app/actions/poster";
import { SoundManager } from "@/game/objects/SoundManager";
import { FileImage, ShieldAlert, CheckCircle, AlertTriangle, Loader2, Sliders, Palette, Zap } from "lucide-react";
import { toast } from "sonner";

export function PosterUploadDialog() {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hologram settings states
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
      setHoloColor(targetItem.hologramSettings.color || "#06b6d4");
      setFlicker(targetItem.hologramSettings.flicker ?? 0.15);
      setScanlines(targetItem.hologramSettings.scanlines ?? 0.40);
      setNoise(targetItem.hologramSettings.noise ?? 0.10);
    } else {
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
      // Reset state
      setFilePreview(null);
      setSelectedFile(null);
      setScanning(false);
      setUploading(false);
      setScanLogs([]);
    };

    EventBus.on("open-poster-dialog", handleOpen);

    return () => {
      EventBus.off("open-poster-dialog", handleOpen);
    };
  }, []);

  if (!open || !targetItem) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Type filter
    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file format. Please select an image file (PNG/JPG/JPEG).");
      return;
    }

    // Size limit: 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size too large. Maximum size allowed is 5MB.");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    SoundManager.getInstance().playSfx("click");
  };

  const executeSafetyScan = async (file: File, publicUrl: string) => {
    setScanning(true);
    setScanLogs(["[INIT] Booting safety inspection heuristics..."]);
    
    // Simulate premium holographic AI safety scan (2 seconds total)
    await new Promise((resolve) => setTimeout(resolve, 500));
    setScanLogs((prev) => [...prev, "[SCAN] Analyzing pixel arrays for explicit material..."]);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    setScanLogs((prev) => [...prev, "[COMP] Matching metadata signatures and racy checks..."]);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    setScanLogs((prev) => [...prev, "[RULE] Checking copyright flags and guidelines..."]);
    
    await new Promise((resolve) => setTimeout(resolve, 500));
    setScanLogs((prev) => [...prev, "[DONE] Safety scan finalized. Evaluating results..."]);

    const res = await moderateCustomPosterAction(targetItem.id, publicUrl);

    if (res.success) {
      if (res.status === "approved") {
        SoundManager.getInstance().playSfx("place_item");
        toast.success("Holographic poster approved and safety verified!");
      } else {
        SoundManager.getInstance().playSfx("click");
        toast.error("Moderation rejected: Content violation detected.");
      }

      // Notify Phaser engine to reload and skew texture
      EventBus.emit("poster-updated", {
        id: targetItem.id,
        gridX: targetItem.gridX,
        gridY: targetItem.gridY,
        customImageUrl: publicUrl,
        moderationStatus: res.status,
        moderationError: res.error,
        hologramSettings: targetItem.hologramSettings || { color: holoColor, flicker, scanlines, noise },
      });
    } else {
      toast.error(res.error || "Automated safety scan failed.");
    }

    setScanning(false);
    setOpen(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        toast.error("Session expired. Please log in again.");
        setUploading(false);
        return;
      }

      const userId = session.user.id;
      const fileExt = selectedFile.name.split(".").pop() || "png";
      const filePath = `${userId}/${targetItem.id}-${Date.now()}.${fileExt}`;

      // Upload file directly to Supabase storage bucket
      const { error: uploadError } = await supabase.storage
        .from("posters")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.error("Direct upload failed:", uploadError);
        toast.error("Upload failed: " + uploadError.message);
        setUploading(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("posters")
        .getPublicUrl(filePath);

      setUploading(false);
      // Run Content Safety verification pipeline
      await executeSafetyScan(selectedFile, publicUrl);
    } catch (err: any) {
      console.error("Upload error caught:", err);
      toast.error("An unexpected upload error occurred.");
      setUploading(false);
    }
  };

  const handleSaveHologram = async () => {
    setSavingHolo(true);
    try {
      const res = await updateHologramSettingsAction(targetItem.id, {
        color: holoColor,
        flicker,
        scanlines,
        noise
      });

      if (res.success) {
        SoundManager.getInstance().playSfx("place_item");
        toast.success("Holographic display configuration locked!");
        
        // Update local state in Zustand store
        useRoomStore.getState().updateHologramSettingsAt(targetItem.gridX, targetItem.gridY, res.settings);
        
        // Re-draw in Phaser immediately
        EventBus.emit("poster-updated", {
          id: targetItem.id,
          gridX: targetItem.gridX,
          gridY: targetItem.gridY,
          customImageUrl: targetItem.customImageUrl,
          moderationStatus: targetItem.moderationStatus,
          moderationError: targetItem.moderationError,
          hologramSettings: res.settings,
        });

        setOpen(false);
      } else {
        toast.error(res.error || "Failed to update hologram settings.");
      }
    } catch (err: any) {
      console.error("Hologram save error caught:", err);
      toast.error("An unexpected error occurred during filter configuration.");
    } finally {
      setSavingHolo(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md w-full border-2 border-cyan-500/30 bg-background/90 backdrop-blur-xl shadow-[0_0_24px_rgba(6,182,212,0.15)] rounded-2xl p-6 font-sans overflow-hidden select-none">
        
        {/* Cyberpunk grid background lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

        <DialogHeader className="relative z-10">
          <DialogTitle className="text-lg font-black tracking-wider uppercase text-cyan-400 flex items-center gap-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
            <span className="w-1.5 h-4 bg-cyan-400 rounded-full animate-pulse" />
            Poster Customizer Terminal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-medium">
            Stronghold Sector Position: ({targetItem.gridX}, {targetItem.gridY})
          </DialogDescription>
        </DialogHeader>

        <div className="relative z-10 flex flex-col gap-4 mt-2">
          
          {/* Terminal Screen Preview Container */}
          <div className="relative h-48 border border-cyan-500/20 bg-black/60 rounded-xl overflow-hidden flex flex-col items-center justify-center shadow-inner group">
            
            {/* Holographic glowing grids scanning line overlay */}
            {(uploading || scanning) && (
              <div className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400/80 shadow-[0_0_12px_#06b6d4] animate-bounce z-20 pointer-events-none" />
            )}

            {filePreview ? (
              <div className="relative w-full h-full flex items-center justify-center p-2 bg-muted/5">
                <img
                  src={filePreview}
                  alt="Poster preview"
                  className={`max-w-full max-h-full object-contain rounded border border-border/10 shadow-lg ${
                    scanning ? "blur-[1px] opacity-70" : ""
                  }`}
                />
                
                {scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] z-10">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 drop-shadow">
                      Inspecting safety index...
                    </span>
                  </div>
                )}
              </div>
            ) : targetItem.moderationStatus === "approved" && targetItem.customImageUrl ? (
              <div className="relative w-full h-full flex items-center justify-center p-2 bg-muted/5">
                <img
                  src={targetItem.customImageUrl}
                  alt="Approved poster"
                  className="max-w-full max-h-full object-contain rounded border border-border/10 shadow-lg"
                />
                <div className="absolute top-2 right-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 flex items-center gap-1 text-[9px] font-extrabold text-emerald-400 shadow-md backdrop-blur-sm">
                  <CheckCircle className="w-3 h-3" />
                  APPROVED
                </div>
              </div>
            ) : targetItem.moderationStatus === "rejected" ? (
              <div className="flex flex-col items-center justify-center text-center p-4">
                <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse mb-3" />
                <span className="text-xs font-black uppercase text-red-500 tracking-wider">
                  CENSORED / VIOLATION DETECTED
                </span>
                <p className="text-[10px] text-muted-foreground max-w-xs mt-1">
                  {targetItem.moderationError || "The uploaded image was flagged as inappropriate."}
                </p>
              </div>
            ) : targetItem.moderationStatus === "pending" ? (
              <div className="flex flex-col items-center justify-center text-center p-4">
                <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
                <span className="text-xs font-black uppercase text-amber-500 tracking-wider">
                  UNDER REVIEW
                </span>
                <p className="text-[10px] text-muted-foreground max-w-xs mt-1">
                  Poster is waiting for content moderation checks.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <FileImage className="w-12 h-12 text-cyan-500/30 mb-3 group-hover:scale-110 duration-500" />
                <span className="text-[10px] font-extrabold uppercase text-cyan-500/60 tracking-widest">
                  No custom image uploaded
                </span>
                <p className="text-[9px] text-muted-foreground mt-1 max-w-[200px]">
                  Select an image to render custom blueprints or decals inside your stronghold room.
                </p>
              </div>
            )}
          </div>

          {targetItem.moderationStatus === "approved" && targetItem.customImageUrl && (
            <div className="border border-cyan-500/20 bg-cyan-950/20 backdrop-blur rounded-xl p-3 flex flex-col gap-3">
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
              <div className="flex flex-col gap-2">
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
                className="w-full h-8 mt-1 bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_12px_#06b6d4] text-black text-[10px] font-black tracking-widest uppercase rounded-lg transition-all duration-300"
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
          )}

          {/* Interactive Scanning Monospace Debug Terminal */}
          {scanning && scanLogs.length > 0 && (
            <div className="border border-cyan-500/10 bg-black/90 rounded-xl p-3 font-mono text-[9px] text-cyan-400 h-28 overflow-y-auto select-text flex flex-col gap-1 shadow-inner scrollbar-thin">
              {scanLogs.map((log, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <span className="text-cyan-600 font-bold">»</span>
                  <span className="leading-relaxed whitespace-pre-wrap">{log}</span>
                </div>
              ))}
            </div>
          )}

          {/* File Picker CTA */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          <div className="flex gap-2 relative z-10">
            <Button
              variant="outline"
              disabled={uploading || scanning}
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 h-10 border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-500/40 text-xs font-extrabold gap-1.5 cursor-pointer shadow-md rounded-xl"
            >
              Select Image
            </Button>

            {filePreview && (
              <Button
                disabled={uploading || scanning}
                onClick={handleUpload}
                className="flex-1 h-10 bg-cyan-500 hover:bg-cyan-400 hover:shadow-[0_0_15px_#06b6d4] text-black text-xs font-black tracking-wider uppercase gap-1.5 cursor-pointer rounded-xl transition-all duration-300"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    Verify & Mount
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Testing note and Guidelines */}
          <div className="border border-border/10 bg-card/10 rounded-xl p-3 text-[10px] text-muted-foreground leading-relaxed">
            <h4 className="font-bold text-foreground mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              Developer Sandboxed Testing Matrix:
            </h4>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Supported resolutions: PNG, JPG, JPEG under 5MB.</li>
              <li>
                <span className="text-amber-500/80 font-bold">To test rejection outcome:</span> Upload a file with a name containing <span className="font-mono text-cyan-500">"rejected"</span> or <span className="font-mono text-cyan-500">"toxic"</span> (e.g., <span className="font-mono">toxic_meme.png</span>).
              </li>
              <li>Any other file name is automatically approved.</li>
            </ul>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
