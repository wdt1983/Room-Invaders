// src/components/game/GeoMapScanner.tsx
//
// Milestone 9A — Geo-located Map Scanner (Task 9.0.1)
// Integrates Mapbox GL JS for real-world base scanning with native browser GPS.
// Falls back to a premium, highly interactive HTML5 Canvas Radar scanner when Mapbox tokens are missing.

"use client";

import { useEffect, useRef, useState, MouseEvent } from "react";
import { Compass, Loader2, RefreshCw, Crosshair, ZoomIn, ZoomOut, Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatConsole } from "./ChatConsole";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { EventBus } from "@/game/EventBus";

interface ScoutTarget {
  id: string;
  username: string;
  player_level: number;
  room_level: number;
  grid_size: number;
  defense_rating: number;
  scrap_overflow: number;
  components_overflow: number;
}

interface FriendProfile {
  id: string;
  username: string;
  player_level: number;
  room_level?: number;
  defense_rating?: number;
}

interface GeoMapScannerProps {
  playerProfile: {
    id: string;
    username: string;
    player_level: number;
  };
  pvpTargets: ScoutTarget[];
  friends: FriendProfile[];
  onScout: (target: ScoutTarget) => void;
}

interface GeoNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  // Canvas coordinate coordinates (relative to player center)
  relX: number;
  relY: number;
  type: "player" | "friend" | "house" | "apartment" | "store" | "warehouse" | "outpost" | "pvp";
  level: number;
  defenseRating: number;
  scrapOverflow: number;
  componentsOverflow: number;
  blipAlpha: number; // For fading canvas animation
}

export function GeoMapScanner({ playerProfile, pvpTargets, friends, onScout }: GeoMapScannerProps) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"loading" | "permission_denied" | "resolved">("loading");
  const [scanActive, setScanActive] = useState(false);
  const [scanProgress, setScanProgress] = useState(1); // 1 = done
  const [nodes, setNodes] = useState<GeoNode[]>([]);
  const [mapboxTokenExists, setMapboxTokenExists] = useState(false);
  const [mapZoom, setMapZoom] = useState(14);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 1. Detect Mapbox Access Token on Mount
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
    setMapboxTokenExists(token.trim().length > 0);
  }, []);

  // Listen to EventBus for map focusing commands
  useEffect(() => {
    const handleFocusCoordinates = (data: { lat: number; lng: number }) => {
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [data.lng, data.lat],
          zoom: 15,
          pitch: 45,
          bearing: 0,
          essential: true
        });
      } else {
        // Fallback for custom radar canvas: find closest node and pulse it
        const closest = nodes.find(
          (n) => Math.abs(n.lat - data.lat) < 0.005 && Math.abs(n.lng - data.lng) < 0.005
        );
        if (closest) {
          setScanActive(true);
          setScanProgress(0); // trigger sonar pulse animation
        }
      }
    };

    EventBus.on("focus-map-coordinates", handleFocusCoordinates);
    return () => {
      EventBus.off("focus-map-coordinates", handleFocusCoordinates);
    };
  }, [nodes]);

  // 2. Fetch Browser GPS Coordinates
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setCoords({ lat: 47.6062, lng: -122.3321 }); // Default Seattle center
      setGpsStatus("permission_denied");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsStatus("resolved");
      },
      (error) => {
        console.warn("[GeoMapScanner] Geolocation permission denied or failed, using Seattle fallback:", error.message);
        setCoords({ lat: 47.6062, lng: -122.3321 }); // Seattle downtown fallback
        setGpsStatus("permission_denied");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, []);

  // 3. Seed Target Coordinates dynamically around player position
  useEffect(() => {
    if (!coords) return;

    // Simple deterministic PRNG for stable scattering based on coordinates
    const seed = `${coords.lat.toFixed(4)}:${coords.lng.toFixed(4)}`;
    let randState = 5381;
    for (let i = 0; i < seed.length; i++) {
      randState = (randState * 33) ^ seed.charCodeAt(i);
    }
    const nextRand = () => {
      randState = (randState + 0x6d2b79f5) >>> 0;
      let x = randState;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };

    const scatteredNodes: GeoNode[] = [];

    // A. Add Player Base in the exact center
    scatteredNodes.push({
      id: playerProfile.id,
      name: `${playerProfile.username} Base`,
      lat: coords.lat,
      lng: coords.lng,
      relX: 0,
      relY: 0,
      type: "player",
      level: playerProfile.player_level,
      defenseRating: 120,
      scrapOverflow: 0,
      componentsOverflow: 0,
      blipAlpha: 1.0
    });

    // B. Add Friends at closer coordinates (radius within 0.005 degrees)
    friends.forEach((friend, idx) => {
      // Scatter on concentric rings
      const angle = (idx / Math.max(1, friends.length)) * Math.PI * 2 + (nextRand() * 0.5);
      const radius = 0.003 + nextRand() * 0.004; // 0.2 to 0.5 miles
      const dLat = Math.cos(angle) * radius;
      const dLng = Math.sin(angle) * radius * 1.3; // Correct longitude aspect ratio roughly

      scatteredNodes.push({
        id: friend.id,
        name: friend.username,
        lat: coords.lat + dLat,
        lng: coords.lng + dLng,
        relX: Math.cos(angle) * (100 + nextRand() * 50),
        relY: Math.sin(angle) * (100 + nextRand() * 50),
        type: "friend",
        level: friend.player_level,
        defenseRating: friend.defense_rating ?? 30,
        scrapOverflow: 0,
        componentsOverflow: 0,
        blipAlpha: 0.8
      });
    });

    // C. Add Active PvP Targets (radius within 0.007 to 0.015 degrees)
    pvpTargets.forEach((pvp, idx) => {
      const angle = (idx / Math.max(1, pvpTargets.length)) * Math.PI * 2 + (nextRand() * 1.0) + Math.PI / 4;
      const radius = 0.006 + nextRand() * 0.009; // 0.4 to 1.0 miles
      const dLat = Math.cos(angle) * radius;
      const dLng = Math.sin(angle) * radius * 1.3;

      scatteredNodes.push({
        id: pvp.id,
        name: pvp.username,
        lat: coords.lat + dLat,
        lng: coords.lng + dLng,
        relX: Math.cos(angle) * (150 + nextRand() * 80),
        relY: Math.sin(angle) * (150 + nextRand() * 80),
        type: "pvp",
        level: pvp.player_level,
        defenseRating: pvp.defense_rating,
        scrapOverflow: pvp.scrap_overflow,
        componentsOverflow: pvp.components_overflow,
        blipAlpha: 0.9
      });
    });

    // D. Add Procedural PvE targets (scattering 6 standard bases of varying sizes)
    const buildingTypes: Array<"house" | "apartment" | "store" | "warehouse" | "outpost"> = [
      "house", "apartment", "store", "warehouse", "outpost"
    ];
    
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + nextRand() * 0.7 - Math.PI / 3;
      const radius = 0.005 + nextRand() * 0.015; // 0.3 to 1.2 miles
      const dLat = Math.cos(angle) * radius;
      const dLng = Math.sin(angle) * radius * 1.3;

      const tier = Math.max(1, Math.min(10, Math.floor(2 + nextRand() * 8)));
      const bType = buildingTypes[Math.floor(nextRand() * buildingTypes.length)];

      const labels = {
        house: "Cottage Depot",
        apartment: "Apartment Cache",
        store: "Bodega Vault",
        warehouse: "Freight Locker",
        outpost: "Fortified Outpost"
      };

      scatteredNodes.push({
        id: `procedural-tier-${tier}-${i + 1}-${Math.floor(nextRand() * 10)}`,
        name: `${labels[bType]} [T${tier}]`,
        lat: coords.lat + dLat,
        lng: coords.lng + dLng,
        relX: Math.cos(angle) * (120 + nextRand() * 120),
        relY: Math.sin(angle) * (120 + nextRand() * 120),
        type: bType,
        level: tier,
        defenseRating: tier * 15 + Math.floor(nextRand() * 10),
        scrapOverflow: 0,
        componentsOverflow: 0,
        blipAlpha: 0.7
      });
    }

    setNodes(scatteredNodes);
  }, [coords, pvpTargets, friends]);

  // 4. Mapbox GL JS Mount and Sync Layer
  useEffect(() => {
    if (!coords || !mapboxTokenExists || !mapContainerRef.current || nodes.length === 0) return;

    // Load mapbox-gl dynamically to satisfy Next.js build prerendering
    let mapInstance: any = null;
    const markersList: any[] = [];

    const initMapbox = async () => {
      try {
        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

        // Mount new Mapbox instance
        mapInstance = new mapboxgl.Map({
          container: mapContainerRef.current!,
          style: "mapbox://styles/mapbox/dark-v11", // default high-quality dark vector tiles
          center: [coords.lng, coords.lat],
          zoom: mapZoom,
          pitch: 35,
          bearing: -15,
          antialias: true
        });

        mapRef.current = mapInstance;

        // Custom cyber road, land, and water colors applied once style loads
        mapInstance.on("load", () => {
          // Adjust water tint to dark cyberpunk violet
          if (mapInstance.getLayer("water")) {
            mapInstance.setPaintProperty("water", "fill-color", "#120a21");
          }
          // Adjust road outlines to neon cyan/purple dashes
          if (mapInstance.getLayer("road-primary")) {
            mapInstance.setPaintProperty("road-primary", "line-color", "#0891b2");
          }
          if (mapInstance.getLayer("building")) {
            mapInstance.setPaintProperty("building", "fill-color", "#030712");
            mapInstance.setPaintProperty("building", "fill-opacity", 0.55);
            mapInstance.setPaintProperty("building", "fill-outline-color", "#6b21a8");
          }
        });

        // Add active marker pins to map
        nodes.forEach((node) => {
          // Create highly styled cyber-pulse HTML pin elements
          const el = document.createElement("div");
          el.className = "relative flex items-center justify-center cursor-pointer select-none group";
          el.style.width = "32px";
          el.style.height = "32px";

          // Color themes based on target category
          let outerColor = "rgba(16, 185, 129, 0.4)";
          let innerColor = "bg-emerald-400 border-emerald-500 shadow-[0_0_12px_#10b981]";
          let markerShape = "rounded-full w-3.5 h-3.5";

          if (node.type === "friend") {
            outerColor = "rgba(6, 182, 212, 0.4)";
            innerColor = "bg-cyan-400 border-cyan-500 shadow-[0_0_12px_#06b6d4]";
          } else if (node.type === "pvp") {
            outerColor = "rgba(168, 85, 247, 0.5)";
            innerColor = "bg-purple-400 border-purple-500 shadow-[0_0_15px_#a855f7] rotate-45";
            markerShape = "w-3 h-3";
          } else if (["warehouse", "outpost"].includes(node.type)) {
            outerColor = "rgba(239, 68, 68, 0.5)";
            innerColor = "bg-red-400 border-red-500 shadow-[0_0_15px_#ef4444] rotate-45";
            markerShape = "w-3.5 h-3.5";
          } else if (node.type !== "player") {
            outerColor = "rgba(245, 158, 11, 0.45)";
            innerColor = "bg-amber-400 border-amber-500 shadow-[0_0_12px_#f59e0b]";
            markerShape = "rounded-full w-3 h-3";
          }

          // HTML Pulsing rings
          el.innerHTML = `
            <span class="animate-ping absolute inline-flex h-7 w-7 rounded-full opacity-60" style="background-color: ${outerColor}"></span>
            <span class="absolute inline-flex h-5 w-5 rounded-full opacity-30" style="background-color: ${outerColor}"></span>
            <span class="relative border-2 ${innerColor} ${markerShape} transition-transform duration-200 group-hover:scale-125"></span>
            
            <!-- Hover coordinates metadata indicator -->
            <div class="absolute -top-7 scale-0 group-hover:scale-100 transition-all duration-200 bg-background/90 text-[9px] font-bold font-mono px-2 py-0.5 rounded border border-primary/40 text-foreground whitespace-nowrap shadow-lg z-50">
              ${node.name}
            </div>
          `;

          // Clicking marker opens detail scout dialogue
          el.addEventListener("click", () => {
            onScout({
              id: node.id,
              username: node.name,
              player_level: node.level,
              room_level: node.level,
              grid_size: node.level <= 3 ? 10 : node.level <= 7 ? 12 : 14,
              defense_rating: node.defenseRating,
              scrap_overflow: node.scrapOverflow,
              components_overflow: node.componentsOverflow
            });
          });

          // Add to map container
          const marker = new mapboxgl.Marker(el)
            .setLngLat([node.lng, node.lat])
            .addTo(mapInstance);
          
          markersList.push(marker);
        });

      } catch (err) {
        console.error("[GeoMapScanner] Mapbox initialization failed:", err);
      }
    };

    initMapbox();

    return () => {
      markersList.forEach(m => m.remove());
      if (mapInstance) mapInstance.remove();
    };
  }, [coords, mapboxTokenExists, nodes]);

  // 5. Canvas Sonar Fallback Rendering loop (runs at 60fps)
  useEffect(() => {
    if (mapboxTokenExists || !canvasRef.current || nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = 500;

    let angle = 0;
    const speed = 0.015; // Radar rotation speed

    // Resize canvas defensively
    const handleResize = () => {
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = 500;
    };
    window.addEventListener("resize", handleResize);

    // Animation Tick
    const renderRadar = () => {
      // Dark slate fade effect to draw phosphor trail lines
      ctx.fillStyle = "rgba(3, 7, 18, 0.12)";
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const maxRadius = Math.min(cx, cy) - 20;

      // 1. Draw Grid Matrix background lines
      ctx.strokeStyle = "rgba(6, 182, 212, 0.04)";
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw concentric radar target bounds
      ctx.lineWidth = 1;
      const circles = [0.25, 0.5, 0.75, 1.0];
      circles.forEach((multiplier) => {
        const r = maxRadius * multiplier;
        ctx.strokeStyle = "rgba(6, 182, 212, 0.12)";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Print distance metrics
        ctx.fillStyle = "rgba(6, 182, 212, 0.4)";
        ctx.font = "bold 9px monospace";
        ctx.fillText(`${(multiplier * 1.5).toFixed(2)}mi`, cx + 5, cy - r + 12);
      });

      // 3. Draw crosshair intersecting lines
      ctx.strokeStyle = "rgba(6, 182, 212, 0.18)";
      ctx.beginPath();
      ctx.moveTo(cx - maxRadius, cy);
      ctx.lineTo(cx + maxRadius, cy);
      ctx.moveTo(cx, cy - maxRadius);
      ctx.lineTo(cx, cy + maxRadius);
      ctx.stroke();

      // 4. Update and paint active target blips
      nodes.forEach((node) => {
        // Calculate screen positions based on relative coordinates
        const scaleFactor = maxRadius / 260; // scale node spacing
        const sx = cx + node.relX * scaleFactor;
        const sy = cy + node.relY * scaleFactor;

        // Skip drawing if out of scope bounds
        const dist = Math.hypot(sx - cx, sy - cy);
        if (dist > maxRadius) return;

        // Calculate angular coordinate relative to scan sweep line
        const nodeAngle = Math.atan2(sy - cy, sx - cx);
        const sweepDiff = Math.abs((nodeAngle - angle + Math.PI * 2) % (Math.PI * 2));

        // When scan line hits, flash node to full brightness and pulse
        let nodeAlpha = node.blipAlpha;
        if (sweepDiff < 0.25) {
          nodeAlpha = 1.0;
          ctx.beginPath();
          ctx.arc(sx, sy, 8 + Math.sin(Date.now() / 100) * 4, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(6, 182, 212, 0.3)";
          ctx.stroke();
        }

        // Draw color-themed blip dots
        let blipColor = "16, 185, 129"; // Green (Self)
        if (node.type === "friend") blipColor = "6, 182, 212"; // Cyan
        else if (node.type === "pvp") blipColor = "168, 85, 247"; // Purple
        else if (["warehouse", "outpost"].includes(node.type)) blipColor = "239, 68, 68"; // Red
        else if (node.type !== "player") blipColor = "245, 158, 11"; // Amber

        ctx.fillStyle = `rgba(${blipColor}, ${nodeAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, node.type === "player" ? 5 : 4, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing outer dot indicator
        ctx.strokeStyle = `rgba(${blipColor}, ${nodeAlpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(sx, sy, (node.type === "player" ? 9 : 7) + Math.sin(Date.now() / 150) * 2, 0, Math.PI * 2);
        ctx.stroke();

        // Draw name labels on hover
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.font = "8px monospace";
        ctx.fillText(node.type === "player" ? "BASE" : node.name.split(" ")[0], sx + 7, sy + 3);
      });

      // 5. Draw the scanning sonar sweep line (radar sweep)
      const sweepX = cx + Math.cos(angle) * maxRadius;
      const sweepY = cy + Math.sin(angle) * maxRadius;

      // Draw sweeping line
      ctx.strokeStyle = "rgba(6, 182, 212, 0.8)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // Draw trailing green glow sector
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
      gradient.addColorStop(0, "rgba(6, 182, 212, 0.15)");
      gradient.addColorStop(1, "rgba(6, 182, 212, 0)");
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius, angle - 0.25, angle);
      ctx.lineTo(cx, cy);
      ctx.fill();

      // Increment rotation angle
      angle = (angle + speed) % (Math.PI * 2);

      // Custom Sweep Animation override (expanding scanning ring)
      if (scanActive) {
        const ringRadius = maxRadius * scanProgress;
        ctx.strokeStyle = `rgba(6, 182, 212, ${1 - scanProgress})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(renderRadar);
    };

    renderRadar();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [mapboxTokenExists, nodes, scanActive, scanProgress]);

  // 6. Handle Clicks on HTML5 Canvas to Scout Blips
  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (mapboxTokenExists || nodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const maxRadius = Math.min(cx, cy) - 20;
    const scaleFactor = maxRadius / 260;

    // Search for closest blip coordinate within 16px hit box
    let closestNode: GeoNode | null = null;
    let minDistance = 16; // Pixels

    nodes.forEach((node) => {
      if (node.type === "player") return; // Cannot scout self

      const sx = cx + node.relX * scaleFactor;
      const sy = cy + node.relY * scaleFactor;

      const clickDist = Math.hypot(clickX - sx, clickY - sy);
      if (clickDist < minDistance) {
        minDistance = clickDist;
        closestNode = node;
      }
    });

    if (closestNode) {
      const node: GeoNode = closestNode;
      onScout({
        id: node.id,
        username: node.name,
        player_level: node.level,
        room_level: node.level,
        grid_size: node.level <= 3 ? 10 : node.level <= 7 ? 12 : 14,
        defense_rating: node.defenseRating,
        scrap_overflow: node.scrapOverflow,
        components_overflow: node.componentsOverflow
      });
    }
  };

  // 7. Initiate active area sweep simulation
  const handleInitiateSweep = () => {
    if (scanActive) return;
    setScanActive(true);
    setScanProgress(0);

    // Dynamic sweep ring expansion
    const duration = 2000;
    const start = Date.now();

    const sweepTimer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1.0, elapsed / duration);
      setScanProgress(progress);

      if (progress >= 1.0) {
        clearInterval(sweepTimer);
        setScanActive(false);
        // Randomize node coordinates offsets slightly on refresh
        setNodes(prev => prev.map(node => {
          if (node.type === "player") return node;
          return {
            ...node,
            relX: node.relX + (Math.random() - 0.5) * 10,
            relY: node.relY + (Math.random() - 0.5) * 10,
            blipAlpha: 0.9
          };
        }));
      }
    }, 1000 / 60);
  };

  // Dynamic Mapbox zoom controls
  const handleZoomIn = () => {
    setMapZoom(prev => {
      const next = Math.min(18, prev + 1);
      if (mapRef.current) mapRef.current.zoomTo(next);
      return next;
    });
  };

  const handleZoomOut = () => {
    setMapZoom(prev => {
      const next = Math.max(10, prev - 1);
      if (mapRef.current) mapRef.current.zoomTo(next);
      return next;
    });
  };

  return (
    <div className="space-y-5 select-none">
      {/* Target scanning dashboard bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-background/50 border border-border/40 p-4 rounded-2xl shadow-lg backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-2 text-cyan-400">
            <Compass className={`w-6 h-6 ${scanActive ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Global GPS Position Coordinates</h3>
            <p className="text-[11px] text-muted-foreground font-mono">
              {gpsStatus === "loading" && "Initializing GPS trackers..."}
              {gpsStatus === "permission_denied" && "GPS Blocked: Seattle Fallback Grid"}
              {gpsStatus === "resolved" && coords && `Coordinates: Lat ${coords.lat.toFixed(5)} / Lng ${coords.lng.toFixed(5)}`}
            </p>
          </div>
        </div>

        <div className="flex gap-2.5 items-center">
          {/* Chat Sheet Trigger for Mobile viewports */}
          <div className="block lg:hidden">
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    className="bg-background/80 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 font-bold uppercase text-xs tracking-wider rounded-xl py-2 flex items-center justify-center gap-2 h-10"
                  />
                }
              >
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                Chat
              </SheetTrigger>
              <SheetContent side="right" className="p-0 bg-background border-l border-primary/20 sm:max-w-md h-full">
                <div className="h-full pt-6">
                  <ChatConsole playerProfile={playerProfile} mode="inline" />
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <Button
            onClick={handleInitiateSweep}
            disabled={scanActive || nodes.length === 0}
            className="bg-cyan-600 hover:bg-cyan-500 text-xs font-bold border border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)] gap-2 h-10 px-4 rounded-xl flex items-center justify-center"
          >
            {scanActive ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Scanning Vector Fields...
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                Initiate Area Sweep
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Map + Chat Grid Container */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Map Scanning Core Container */}
        <div className="lg:col-span-3 relative w-full h-[500px] rounded-2xl border border-primary/20 bg-background/50 overflow-hidden shadow-2xl">
          {/* Loading Overlay */}
          {gpsStatus === "loading" && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3 text-cyan-400">
              <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
              <span className="text-xs font-bold font-mono tracking-wider">Syncing Satellite Vectors...</span>
            </div>
          )}

          {/* 1. MAPBOX CANVAS DISPLAY */}
          {mapboxTokenExists ? (
            <div className="w-full h-full relative">
              <div ref={mapContainerRef} className="w-full h-full" />
              
              {/* Overlay Grid lines for cyberpunk styling */}
              <div className="absolute inset-0 pointer-events-none border border-primary/10 shadow-[inset_0_0_80px_rgba(3,7,18,0.7)] z-10"></div>
              
              {/* Mapbox Zoom Buttons Overlay */}
              <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 bg-background/80 border border-border/60 p-1.5 rounded-xl shadow-lg backdrop-blur">
                <Button size="icon" variant="ghost" onClick={handleZoomIn} className="w-8 h-8 rounded-lg">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={handleZoomOut} className="w-8 h-8 rounded-lg">
                  <ZoomOut className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Custom Mapbox Compass Hub Info */}
              <div className="absolute bottom-4 left-4 z-20 bg-background/80 border border-border/60 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur text-[10px] font-bold font-mono tracking-wide text-cyan-400 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Satellite Active — Vector Map Mode
              </div>
            </div>
          ) : (
            /* 2. HTML5 CANVAS RADAR DISPLAY (Fallback) */
            <div className="w-full h-full relative">
              <canvas 
                ref={canvasRef} 
                onClick={handleCanvasClick}
                className="w-full h-full bg-slate-950 block" 
              />
              {/* Visual scan warning banner */}
              <div className="absolute top-4 left-4 z-20 bg-background/90 border border-amber-500/30 px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur flex items-center gap-2 max-w-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0"></div>
                <div>
                  <h4 className="text-[10px] font-bold text-foreground">Retro Sonar Active</h4>
                  <p className="text-[9px] text-muted-foreground leading-normal mt-0.5">Mapbox key missing. Displaying custom offline radar. Click dots to scout targets!</p>
                </div>
              </div>
              
              <div className="absolute bottom-4 left-4 z-20 bg-background/95 border border-primary/30 px-3 py-1.5 rounded-xl shadow-lg backdrop-blur text-[10px] font-bold font-mono tracking-wide text-cyan-400 flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                Sweep Radius: 1.5 miles — Chebyshev Scanners
              </div>
            </div>
          )}
        </div>

        {/* Global Recon Chat Panel (Desktop side-by-side) */}
        <div className="lg:col-span-1 hidden lg:block">
          <ChatConsole playerProfile={playerProfile} mode="inline" />
        </div>
      </div>


      {/* Visual map legend for cyberpunk bases */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-background/30 border border-border/40 p-3 rounded-2xl text-[10px] font-bold text-muted-foreground font-mono shadow-inner">
        <div className="flex items-center gap-2 justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
          <span>Your Base</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]"></span>
          <span>Sanctuaries (Allies)</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <span className="w-2.5 h-2.5 bg-purple-400 rotate-45 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></span>
          <span>PvP Outposts</span>
        </div>
        <div className="flex items-center gap-2 justify-center">
          <span className="w-2.5 h-2.5 bg-red-400 rotate-45 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
          <span>T7-10 Outposts</span>
        </div>
        <div className="flex items-center gap-2 justify-center col-span-2 sm:col-span-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
          <span>T1-6 Depots</span>
        </div>
      </div>
    </div>
  );
}
