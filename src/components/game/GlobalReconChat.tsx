'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EventBus } from '@/game/EventBus';
import { Button } from '@/components/ui/button';
import { Send, MessageSquare, MapPin, User, Navigation } from 'lucide-react';

interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  coordinates?: { lat: number; lng: number };
}

interface GlobalReconChatProps {
  playerProfile: {
    id: string;
    username: string;
    player_level: number;
  };
}

export function GlobalReconChat({ playerProfile }: GlobalReconChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const channelRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Supabase Broadcast Channel Setup
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('global-recon-chat', {
      config: { broadcast: { self: true } }
    });

    channelRef.current = channel;

    // Listen for incoming chat messages
    channel.on('broadcast', { event: 'chat-message' }, (payload: any) => {
      const msg = payload.payload;
      setMessages((prev) => {
        // Deduplicate
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-100);
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setMessages((prev) => [
          ...prev,
          {
            id: 'sys-connected',
            username: 'SYSTEM',
            text: '🛰️ SECURE VECTOR CHAT LINK ESTABLISHED.',
            timestamp: Date.now(),
            isSystem: true
          }
        ]);
      }
    });

    // Listen for external coordinates sharing events (e.g. from the Scout Dialogs)
    const handleBroadcastCoordinates = (data: { name: string; lat: number; lng: number; level: number }) => {
      const text = `📍 [SCOUT DISPATCH] Outpost spotted: ${data.name} (Lvl ${data.level}) at Lat: ${data.lat.toFixed(5)}, Lng: ${data.lng.toFixed(5)}`;
      channel.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: {
          id: Math.random().toString(),
          username: playerProfile.username,
          text,
          timestamp: Date.now(),
          coordinates: { lat: data.lat, lng: data.lng }
        }
      });
    };

    EventBus.on('broadcast-recon-coordinates', handleBroadcastCoordinates);

    return () => {
      channel.unsubscribe();
      EventBus.off('broadcast-recon-coordinates', handleBroadcastCoordinates);
    };
  }, [playerProfile.username]);

  // Send standard text message
  const handleSendMessage = () => {
    if (!inputText.trim() || !channelRef.current) return;

    const messagePayload: ChatMessage = {
      id: Math.random().toString(),
      username: playerProfile.username,
      text: inputText.trim(),
      timestamp: Date.now()
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: messagePayload
    });

    setInputText('');
  };

  // Share current GPS location
  const handleShareCurrentLocation = () => {
    if (!channelRef.current) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const text = `📍 Current sector beacons active: Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

          channelRef.current.send({
            type: 'broadcast',
            event: 'chat-message',
            payload: {
              id: Math.random().toString(),
              username: playerProfile.username,
              text,
              timestamp: Date.now(),
              coordinates: { lat, lng }
            }
          });
        },
        (error) => {
          console.warn("[GlobalReconChat] Geolocation failed:", error);
        }
      );
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-background/80 border border-primary/20 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/40 p-3 bg-muted/10 shrink-0">
        <MessageSquare className="w-4 h-4 text-cyan-400" />
        <span className="text-[11px] font-black text-white tracking-wider uppercase">Recon Communications</span>
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-auto" />
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-mono text-[10px] leading-relaxed">
        {messages.length === 0 ? (
          <div className="text-muted-foreground/60 italic text-center pt-16 uppercase">
            No active frequencies scanned.
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.username === playerProfile.username;
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${
                  msg.isSystem ? 'text-cyan-400 font-extrabold' : 'text-zinc-200'
                }`}
              >
                {/* Meta details */}
                <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground">
                  <User className="w-2.5 h-2.5" />
                  <span className={isMe ? 'text-primary font-bold' : ''}>
                    {msg.username}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </div>

                {/* Message text */}
                <div className={`p-2 rounded-lg ${msg.isSystem ? 'bg-cyan-950/20 border border-cyan-500/10' : 'bg-muted/10'}`}>
                  <span>{msg.text}</span>

                  {/* Clickable Coordinate Focus Badge */}
                  {msg.coordinates && (
                    <div className="mt-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => EventBus.emit('focus-map-coordinates', msg.coordinates)}
                        className="h-6 gap-1 px-2 text-[9px] border-cyan-500/40 text-cyan-400 bg-cyan-950/30 hover:bg-cyan-950/50 hover:text-cyan-300 font-black rounded-md uppercase"
                      >
                        <Navigation className="w-2.5 h-2.5 text-cyan-400" />
                        Focus Map Coordinates
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input controls */}
      <div className="p-3 border-t border-border/40 bg-muted/5 shrink-0 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type transmission..."
            className="flex-1 bg-black/60 border border-primary/20 rounded-xl px-3 py-2 text-[10px] text-zinc-100 placeholder:text-muted-foreground/60 font-mono focus:outline-none focus:border-cyan-500/60"
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="h-8 w-8 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white shrink-0 shadow-lg shadow-cyan-500/10"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleShareCurrentLocation}
          className="w-full h-7 gap-1.5 text-[9px] font-bold border border-border/40 bg-background/40 hover:bg-muted/50 hover:text-foreground text-muted-foreground rounded-xl uppercase shrink-0"
        >
          <MapPin className="w-3 h-3 text-cyan-400" />
          Broadcast GPS Location
        </Button>
      </div>
    </div>
  );
}
