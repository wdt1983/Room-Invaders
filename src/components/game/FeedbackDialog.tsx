"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { usePlayerStore } from "@/lib/store/usePlayerStore";
import { submitBetaFeedback } from "@/app/actions/feedback";
import { 
  MessageSquare, 
  Bug, 
  Sparkles, 
  TrendingUp, 
  Star, 
  Loader2, 
  Terminal, 
  Info 
} from "lucide-react";
import { toast } from "sonner";

/**
 * Feedback Dialog component.
 * Premium Outfit-typography styled dialog that lets testers report bugs,
 * suggest balance updates, or request features, transmitting diagnostics instantly.
 */
export function FeedbackDialog() {
  const pathname = usePathname();
  const playerLevel = usePlayerStore((state) => state.playerLevel);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form states
  const [category, setCategory] = useState<string>("bug"); // "bug" | "balance" | "feature" | "general"
  const [ratingGameplay, setRatingGameplay] = useState<number>(5);
  const [ratingVisuals, setRatingVisuals] = useState<number>(5);
  const [ratingPerformance, setRatingPerformance] = useState<number>(5);
  const [comments, setComments] = useState<string>("");
  const [attachDiagnostics, setAttachDiagnostics] = useState<boolean>(true);

  // Ratings hovered states for premium feedback styling
  const [hoveredGameplay, setHoveredGameplay] = useState<number | null>(null);
  const [hoveredVisuals, setHoveredVisuals] = useState<number | null>(null);
  const [hoveredPerformance, setHoveredPerformance] = useState<number | null>(null);

  const resetForm = () => {
    setCategory("bug");
    setRatingGameplay(5);
    setRatingVisuals(5);
    setRatingPerformance(5);
    setComments("");
    setAttachDiagnostics(true);
  };

  const handleTransmit = () => {
    if (!comments.trim()) {
      toast.error("Feedback transmission rejected: Please add details.");
      return;
    }

    startTransition(async () => {
      const metadata = attachDiagnostics ? {
        playerLevel,
        activePath: pathname,
        userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "SSR",
        screenWidth: typeof window !== "undefined" ? window.innerWidth : 0,
        screenHeight: typeof window !== "undefined" ? window.innerHeight : 0,
      } : {
        playerLevel,
        activePath: pathname,
      };

      const result = await submitBetaFeedback({
        category,
        ratingGameplay,
        ratingVisuals,
        ratingPerformance,
        comments,
        metadata,
      });

      if (result.success) {
        toast.success("Feedback report transmitted! Operations center notified.");
        resetForm();
        setIsOpen(false);
      } else {
        toast.error(`Transmission failed: ${result.error}`);
      }
    });
  };

  const categories = [
    { id: "bug", label: "Bug Report", icon: Bug, color: "text-red-400 border-red-500/20 bg-red-950/20 active:border-red-400 hover:border-red-500/50 hover:bg-red-500/10" },
    { id: "balance", label: "Balance Tuning", icon: TrendingUp, color: "text-amber-400 border-amber-500/20 bg-amber-950/20 active:border-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10" },
    { id: "feature", label: "Feature Request", icon: Sparkles, color: "text-purple-400 border-purple-500/20 bg-purple-950/20 active:border-purple-400 hover:border-purple-500/50 hover:bg-purple-500/10" },
    { id: "general", label: "General Feedback", icon: MessageSquare, color: "text-cyan-400 border-cyan-500/20 bg-cyan-950/20 active:border-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10" },
  ];

  const renderStars = (
    rating: number, 
    setRating: (r: number) => void, 
    hovered: number | null, 
    setHovered: (h: number | null) => void,
    colorClass: string
  ) => {
    return (
      <div className="flex items-center gap-1.5 select-none">
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = hovered !== null ? star <= hovered : star <= rating;
          return (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              className="transition-all hover:scale-125 focus:outline-none"
            >
              <Star
                className={`size-4.5 ${
                  isActive 
                    ? `${colorClass} fill-current drop-shadow-[0_0_4px_rgba(255,255,255,0.2)]` 
                    : "text-muted-foreground/45"
                }`}
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            className="size-8 border-border text-muted-foreground hover:bg-muted/10 hover:text-foreground touch-target-expand"
            title="Transmit feedback or bug reports"
          >
            <Bug className="size-4 text-amber-500/80 hover:text-amber-400 transition-colors animate-pulse" />
          </Button>
        }
      />
      <DialogContent className="w-full sm:max-w-lg bg-card/95 border border-primary/20 backdrop-blur-md flex flex-col p-6 text-xs text-foreground font-sans">
        <DialogHeader className="pb-3 border-b border-border/50">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2 font-display">
            <Terminal className="size-5 text-amber-400" />
            Beta Operations Terminal
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-sans">
            Transmit bug reports, suggest strategic balance tuning, or request features directly to the developer operations hub.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[70vh] pr-1">
          {/* Category Selector */}
          <div className="space-y-2">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold font-mono">1. Select Transmission Category</span>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const CatIcon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                      isSelected 
                        ? "border-primary text-primary bg-primary/10 shadow-[0_0_8px_rgba(249,115,22,0.15)] font-bold scale-[1.01]" 
                        : cat.color
                    }`}
                  >
                    <CatIcon className={`size-4 ${isSelected ? "text-primary animate-pulse" : ""}`} />
                    <span className="font-medium text-[11px]">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ratings Matrix */}
          <div className="space-y-2.5 bg-background/40 border border-border/40 p-3.5 rounded-xl">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold font-mono block">2. System Performance Evaluations</span>
            
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-muted-foreground">Tactical & Gameplay Balance:</span>
                {renderStars(ratingGameplay, setRatingGameplay, hoveredGameplay, setHoveredGameplay, "text-amber-400")}
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-muted-foreground">Cyber Visuals & Audio:</span>
                {renderStars(ratingVisuals, setRatingVisuals, hoveredVisuals, setHoveredVisuals, "text-purple-400")}
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-muted-foreground">Controls & Engine Performance:</span>
                {renderStars(ratingPerformance, setRatingPerformance, hoveredPerformance, setHoveredPerformance, "text-cyan-400")}
              </div>
            </div>
          </div>

          {/* Comments Textarea */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold font-mono">3. Transmission Details</span>
              <span className={`text-[9px] font-mono ${comments.length > 800 ? "text-red-400" : "text-muted-foreground/60"}`}>
                {comments.length} / 1000 characters
              </span>
            </div>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value.slice(0, 1000))}
              placeholder={
                category === "bug" 
                  ? "Specify what went wrong. Include step-by-step instructions to reproduce the glitch, and state your mobile/desktop device..."
                  : category === "balance"
                  ? "Detail which trap, turret, or squad weapon needs tuning, and specify your recommended numbers or costs..."
                  : "Detail your requests or general experience..."
              }
              rows={4}
              className="w-full bg-background/50 border border-border/60 focus:border-primary/50 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-primary/30 text-[11px] font-sans leading-relaxed resize-none text-foreground placeholder:text-muted-foreground/50 transition-all shadow-inner"
            />
          </div>

          {/* Diagnostics Accordion */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={attachDiagnostics}
                onChange={(e) => setAttachDiagnostics(e.target.checked)}
                className="rounded border-border bg-background text-primary focus:ring-primary size-3.5 transition-all"
              />
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                Attach active coordinate telemetry
                <span title="Transmits standard environment states to diagnose errors faster">
                  <Info className="size-3 text-muted-foreground/45" />
                </span>
              </span>
            </label>

            {attachDiagnostics && (
              <div className="border border-border/40 bg-background/30 p-2.5 rounded-lg font-mono text-[9px] text-muted-foreground/80 space-y-1 select-all shadow-inner">
                <div className="flex gap-1.5"><span className="text-amber-500 font-semibold">[SEC]</span><span>SYSTEM_LEVEL:</span><span className="text-foreground">{playerLevel}</span></div>
                <div className="flex gap-1.5"><span className="text-cyan-500 font-semibold">[SEC]</span><span>ACTIVE_ROUTE:</span><span className="text-foreground">{pathname}</span></div>
                <div className="flex gap-1.5"><span className="text-purple-500 font-semibold">[SEC]</span><span>RESOLUTION:</span><span className="text-foreground">
                  {typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "SSR"}
                </span></div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-0">
          <DialogClose
            render={
              <Button 
                type="button" 
                variant="outline" 
                className="text-xs font-bold border-border/80 hover:bg-muted font-mono"
              >
                Abort
              </Button>
            }
          />
          <Button
            type="button"
            onClick={handleTransmit}
            disabled={isPending || !comments.trim()}
            className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground font-mono shadow-[0_0_8px_rgba(249,115,22,0.2)]"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                TRANSMITTING...
              </>
            ) : (
              "TRANSMIT REPORT"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
