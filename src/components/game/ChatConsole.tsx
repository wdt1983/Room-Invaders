'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { EventBus } from '@/game/EventBus';
import { Button } from '@/components/ui/button';
import { 
  Globe, 
  Users, 
  Shield, 
  Send, 
  MessageSquare, 
  MapPin, 
  User, 
  Navigation, 
  ChevronLeft, 
  Lock, 
  X,
  MessageCircle
} from 'lucide-react';

interface ChatMessage {
  id: string;
  username: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  coordinates?: { lat: number; lng: number };
}

interface ChatConsoleProps {
  playerProfile: {
    id: string;
    username: string;
    player_level: number;
  };
  districtId?: string | null;
  mode?: 'inline' | 'floating';
}

export function ChatConsole({ playerProfile, districtId, mode = 'inline' }: ChatConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'district' | 'friends'>('global');
  const [inputText, setInputText] = useState('');
  
  // Message stores
  const [globalMessages, setGlobalMessages] = useState<ChatMessage[]>([]);
  const [districtMessages, setDistrictMessages] = useState<ChatMessage[]>([]);
  const [dmMessages, setDmMessages] = useState<ChatMessage[]>([]);
  
  // Friendships and DM state
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
  
  // Unread indicators
  const [unreadGlobal, setUnreadGlobal] = useState(false);
  const [unreadDistrict, setUnreadDistrict] = useState(false);
  const [unreadFriends, setUnreadFriends] = useState(false);

  // References to active Supabase channels
  const globalChannelRef = useRef<any>(null);
  const districtChannelRef = useRef<any>(null);
  const dmChannelRef = useRef<any>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of active feed
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [globalMessages, districtMessages, dmMessages, selectedFriend, activeTab]);

  // Handle outside clicks to close floating drawer
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode !== 'floating' || !isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, mode]);

  // Fetch Friends Roster client-side
  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const supabase = createClient();
        const { data: friendshipRows } = await supabase
          .from("friendships")
          .select("sender_id, receiver_id, status")
          .eq("status", "accepted")
          .or(`sender_id.eq.${playerProfile.id},receiver_id.eq.${playerProfile.id}`);

        if (friendshipRows && friendshipRows.length > 0) {
          const friendIds = friendshipRows.map((r: any) => 
            r.sender_id === playerProfile.id ? r.receiver_id : r.sender_id
          );
          
          const { data: friendProfiles } = await supabase
            .from("profiles")
            .select("id, username, player_level")
            .in("id", friendIds);
            
          setFriends(friendProfiles || []);
        } else {
          setFriends([]);
        }
      } catch (err) {
        console.warn("[ChatConsole] Failed to fetch friends list:", err);
      }
    };

    fetchFriends();
    
    // Refresh friends roster every 15s in background
    const interval = setInterval(fetchFriends, 15000);
    return () => clearInterval(interval);
  }, [playerProfile.id]);

  // Setup Global Channel subscription
  useEffect(() => {
    const supabase = createClient();
    const channelName = 'global-recon-chat';
    
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } }
    });

    globalChannelRef.current = channel;

    channel.on('broadcast', { event: 'chat-message' }, (payload: any) => {
      const msg = payload.payload;
      setGlobalMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-100);
      });

      if (activeTab !== 'global') {
        setUnreadGlobal(true);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setGlobalMessages((prev) => [
          ...prev,
          {
            id: 'sys-global-connected',
            username: 'SYSTEM',
            text: '🛰️ GLOBAL SCAN FREQUENCY OPENED.',
            timestamp: Date.now(),
            isSystem: true
          }
        ]);
      }
    });

    // Listen for coordinate-share events emitted from the map
    const handleBroadcastCoordinates = (data: { name: string; lat: number; lng: number; level: number }) => {
      const text = `📍 [SCOUT UPDATE] Target base spotted: ${data.name} (Lvl ${data.level}) at Lat: ${data.lat.toFixed(5)}, Lng: ${data.lng.toFixed(5)}`;
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
  }, [playerProfile.username, activeTab]);

  // Setup District Channel subscription
  useEffect(() => {
    if (!districtId) {
      setDistrictMessages([]);
      return;
    }

    const supabase = createClient();
    const channelName = `chat:district:${districtId}`;
    
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } }
    });

    districtChannelRef.current = channel;

    channel.on('broadcast', { event: 'district-message' }, (payload: any) => {
      const msg = payload.payload;
      setDistrictMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-100);
      });

      if (activeTab !== 'district') {
        setUnreadDistrict(true);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setDistrictMessages((prev) => [
          ...prev,
          {
            id: 'sys-dist-connected',
            username: 'SYSTEM',
            text: '⚡ COOPERATIVE SECTOR FREQUENCY ENGAGED.',
            timestamp: Date.now(),
            isSystem: true
          }
        ]);
      }
    });

    return () => {
      channel.unsubscribe();
      districtChannelRef.current = null;
    };
  }, [districtId, activeTab]);

  // Setup Friend/DM Channel subscription on selection
  useEffect(() => {
    if (dmChannelRef.current) {
      dmChannelRef.current.unsubscribe();
      dmChannelRef.current = null;
    }
    
    setDmMessages([]);

    if (!selectedFriend) return;

    const supabase = createClient();
    // Deterministic channel name based on sorted member IDs
    const sortedHash = [playerProfile.id, selectedFriend.id].sort().join('-');
    const channelName = `chat:friend:${sortedHash}`;
    
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } }
    });

    dmChannelRef.current = channel;

    channel.on('broadcast', { event: 'dm-message' }, (payload: any) => {
      const msg = payload.payload;
      setDmMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg].slice(-100);
      });
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setDmMessages([
          {
            id: `sys-dm-${selectedFriend.id}`,
            username: 'SYSTEM',
            text: `🔒 P2P CHANNEL ESTABLISHED WITH ${selectedFriend.username.toUpperCase()}`,
            timestamp: Date.now(),
            isSystem: true
          }
        ]);
      }
    });

    return () => {
      channel.unsubscribe();
      dmChannelRef.current = null;
    };
  }, [selectedFriend, playerProfile.id]);

  // Reset tab unread highlights when selected
  useEffect(() => {
    if (activeTab === 'global') setUnreadGlobal(false);
    if (activeTab === 'district') setUnreadDistrict(false);
    if (activeTab === 'friends') setUnreadFriends(false);
  }, [activeTab]);

  // Send message through active channel
  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const payload: ChatMessage = {
      id: Math.random().toString(),
      username: playerProfile.username,
      text: inputText.trim(),
      timestamp: Date.now()
    };

    if (activeTab === 'global' && globalChannelRef.current) {
      globalChannelRef.current.send({
        type: 'broadcast',
        event: 'chat-message',
        payload
      });
    } else if (activeTab === 'district' && districtChannelRef.current) {
      globalChannelRef.current?.send({
        type: 'broadcast',
        event: 'chat-message',
        payload: {
          ...payload,
          text: `📢 [District] ${payload.text}`
        }
      });
      districtChannelRef.current.send({
        type: 'broadcast',
        event: 'district-message',
        payload
      });
    } else if (activeTab === 'friends' && selectedFriend && dmChannelRef.current) {
      dmChannelRef.current.send({
        type: 'broadcast',
        event: 'dm-message',
        payload
      });
    }

    setInputText('');
  };

  // Share Geolocation GPS details
  const handleShareCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const text = `📍 Ping coordinates broadcasted: Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

          const payload: ChatMessage = {
            id: Math.random().toString(),
            username: playerProfile.username,
            text,
            timestamp: Date.now(),
            coordinates: { lat, lng }
          };

          if (activeTab === 'global' && globalChannelRef.current) {
            globalChannelRef.current.send({
              type: 'broadcast',
              event: 'chat-message',
              payload
            });
          } else if (activeTab === 'district' && districtChannelRef.current) {
            districtChannelRef.current.send({
              type: 'broadcast',
              event: 'district-message',
              payload
            });
          } else if (activeTab === 'friends' && selectedFriend && dmChannelRef.current) {
            dmChannelRef.current.send({
              type: 'broadcast',
              event: 'dm-message',
              payload
            });
          }
        },
        (error) => {
          console.warn("[ChatConsole] Geolocation share failed:", error);
        }
      );
    }
  };

  const activeMessages = 
    activeTab === 'global' ? globalMessages :
    activeTab === 'district' ? districtMessages :
    dmMessages;

  const chatContainerClass = mode === 'floating'
    ? 'flex flex-col h-[520px] bg-background/90 border border-primary/20 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl w-full h-full'
    : 'flex flex-col h-[500px] bg-background/80 border border-primary/20 backdrop-blur-xl rounded-2xl overflow-hidden shadow-2xl w-full';

  const consoleHeaderColor = 
    activeTab === 'global' ? 'border-cyan-500/20 text-cyan-400' :
    activeTab === 'district' ? 'border-purple-500/20 text-purple-400' :
    'border-emerald-500/20 text-emerald-400';

  const tabGlowIndicator = (tab: typeof activeTab, activeColor: string) => {
    return activeTab === tab ? `w-1.5 h-1.5 rounded-full ${activeColor} animate-pulse ml-auto` : '';
  };

  const renderContent = () => (
    <div className={chatContainerClass}>
      {/* Header */}
      <div className={`flex items-center gap-2 border-b p-3 bg-muted/10 shrink-0 ${consoleHeaderColor}`}>
        {activeTab === 'global' && <Globe className="w-4 h-4 text-cyan-400" />}
        {activeTab === 'district' && <Shield className="w-4 h-4 text-purple-400" />}
        {activeTab === 'friends' && <Users className="w-4 h-4 text-emerald-400" />}
        
        <span className="text-[11px] font-black tracking-wider uppercase font-mono text-zinc-100">
          {activeTab === 'global' && 'Recon Comms Net'}
          {activeTab === 'district' && `Sector net: ${districtId ? 'CONNECTED' : 'STANDBY'}`}
          {activeTab === 'friends' && (selectedFriend ? `P2P: ${selectedFriend.username.toUpperCase()}` : 'Secure Contact Roster')}
        </span>

        {activeTab === 'global' && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-auto" />}
        {activeTab === 'district' && districtId && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse ml-auto" />}
        {activeTab === 'friends' && selectedFriend && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-auto" />}
        
        {mode === 'floating' && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(false)}
            className="w-6 h-6 rounded-md hover:bg-white/10 hover:text-white p-0 shrink-0 ml-auto"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Main Console Section */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Navigation Sidebar Panel */}
        <div className="w-12 border-r border-border/40 bg-muted/5 shrink-0 flex flex-col items-center py-4 gap-4">
          {/* Global tab trigger */}
          <button
            onClick={() => { setActiveTab('global'); setSelectedFriend(null); }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center relative transition-all duration-300 ${
              activeTab === 'global' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
          >
            <Globe className="w-4 h-4" />
            {unreadGlobal && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-cyan-400 border border-background" />
            )}
          </button>

          {/* District tab trigger */}
          <button
            onClick={() => { setActiveTab('district'); setSelectedFriend(null); }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center relative transition-all duration-300 ${
              activeTab === 'district' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
          >
            <Shield className="w-4 h-4" />
            {unreadDistrict && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-purple-400 border border-background" />
            )}
          </button>

          {/* Friends/DM tab trigger */}
          <button
            onClick={() => setActiveTab('friends')}
            className={`w-8 h-8 rounded-xl flex items-center justify-center relative transition-all duration-300 ${
              activeTab === 'friends' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            {unreadFriends && (
              <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-emerald-400 border border-background" />
            )}
          </button>
        </div>

        {/* Console Body view */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 bg-background/20">
          
          {/* Locked view for District if player has no district */}
          {activeTab === 'district' && !districtId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none uppercase font-mono">
              <Lock className="w-10 h-10 text-purple-500/50 mb-3 animate-pulse" />
              <span className="text-[10px] font-black text-purple-400">District Link offline</span>
              <p className="text-[8px] text-muted-foreground/70 max-w-[200px] mt-2 leading-relaxed normal-case font-sans">
                Erect or settle in a Stronghold District node grid to establish secure faction frequencies.
              </p>
            </div>
          ) : activeTab === 'friends' && !selectedFriend ? (
            
            /* Friends Roster panel */
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
              <div className="text-[8px] font-black tracking-widest text-muted-foreground uppercase pb-1.5 border-b border-border/40 font-mono">
                Active Contact Grid
              </div>
              
              {friends.length === 0 ? (
                <div className="text-muted-foreground/50 text-[9px] font-mono italic text-center pt-16 uppercase leading-relaxed p-4 select-none">
                  No accepted friendly frequencies found.<br />
                  <span className="text-[8px] font-bold text-primary/60">Visit Social Terminal to send links.</span>
                </div>
              ) : (
                friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriend(friend)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-primary/5 bg-muted/5 hover:border-emerald-500/30 hover:bg-emerald-950/15 text-left transition-all duration-300 group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 font-extrabold text-[10px]">
                      {friend.username.substring(0, 2).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5 font-mono">
                      <span className="text-xs font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors uppercase truncate">
                        {friend.username}
                      </span>
                      <span className="text-[8px] text-muted-foreground uppercase">
                        SQUAD LEVEL: {friend.player_level}
                      </span>
                    </div>

                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 group-hover:animate-ping" />
                  </button>
                ))
              )}
            </div>
          ) : (
            
            /* Dynamic active Chat ledger feed */
            <>
              {activeTab === 'friends' && selectedFriend && (
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/30 bg-muted/10 shrink-0 select-none">
                  <button
                    onClick={() => setSelectedFriend(null)}
                    className="p-1 rounded-md text-muted-foreground hover:bg-white/10 hover:text-white transition-colors duration-200"
                  >
                    <ChevronLeft className="w-4 h-4 text-emerald-400" />
                  </button>
                  <span className="text-[9px] font-black uppercase text-emerald-400 font-mono">
                    CONTACT LEDGER
                  </span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-mono text-[10px] leading-relaxed">
                {activeMessages.length === 0 ? (
                  <div className="text-muted-foreground/60 italic text-center pt-24 uppercase">
                    Frequency scanned. Empty ledger.
                  </div>
                ) : (
                  activeMessages.map((msg) => {
                    const isMe = msg.username === playerProfile.username;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col gap-1 ${
                          msg.isSystem ? 'text-primary font-bold' : 'text-zinc-200'
                        }`}
                      >
                        {/* Message Meta Info */}
                        <div className="flex items-center gap-1.5 text-[8px] text-muted-foreground select-none">
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

                        {/* Message Text bubble */}
                        <div className={`p-2 rounded-lg ${msg.isSystem ? 'bg-muted/10 border border-primary/10' : 'bg-muted/10'}`}>
                          <span>{msg.text}</span>

                          {/* Coordinates panning focal badge */}
                          {msg.coordinates && (
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => EventBus.emit('focus-map-coordinates', msg.coordinates)}
                                className={`h-6 gap-1 px-2 text-[9px] font-black rounded-md uppercase border-primary/30 bg-primary/10 hover:bg-primary/20 ${
                                  activeTab === 'global' ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30' :
                                  activeTab === 'district' ? 'border-purple-500/40 text-purple-400 bg-purple-950/30' :
                                  'border-emerald-500/40 text-emerald-400 bg-emerald-950/30'
                                }`}
                              >
                                <Navigation className="w-2.5 h-2.5" />
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

              {/* Chat Input panel */}
              <div className="p-3 border-t border-border/40 bg-muted/5 shrink-0 flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Encode packet..."
                    className="flex-1 bg-black/60 border border-primary/20 rounded-xl px-3 py-2 text-[10px] text-zinc-100 placeholder:text-muted-foreground/60 font-mono focus:outline-none focus:border-cyan-500/60"
                  />
                  <Button
                    size="icon"
                    onClick={handleSendMessage}
                    disabled={!inputText.trim()}
                    className={`h-8 w-8 rounded-xl shrink-0 shadow-lg ${
                      activeTab === 'global' ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/10' :
                      activeTab === 'district' ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/10' :
                      'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/10'
                    } text-white`}
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
                  <MapPin className="w-3 h-3 text-primary" />
                  Broadcast GPS Location
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );

  if (mode === 'inline') {
    return renderContent();
  }

  // Floating Retractable Toggle Drawer mode
  return (
    <>
      {/* Floating Toggle Button bubble */}
      <div className="fixed bottom-20 right-4 z-40">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-center rounded-full w-12 h-12 transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl border backdrop-blur-md ${
            isOpen 
              ? 'bg-red-500/10 border-red-500/50 text-red-400 shadow-red-500/15'
              : 'bg-background/80 border-primary/20 text-cyan-400 hover:border-cyan-500/40 hover:text-white shadow-primary/5'
          }`}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-red-400" />
          ) : (
            <div className="relative">
              <MessageCircle className="w-5 h-5" />
              {(unreadGlobal || unreadDistrict || unreadFriends) && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 border border-background animate-pulse" />
              )}
            </div>
          )}
        </Button>
      </div>

      {/* Slide-out Drawer Panel overlay */}
      {isOpen && (
        <div 
          ref={drawerRef}
          className="fixed top-20 left-4 bottom-24 w-80 sm:w-96 z-40 flex flex-col bg-background/90 border border-primary/20 shadow-2xl rounded-2xl p-0 overflow-hidden animate-in slide-in-from-left duration-300"
        >
          {renderContent()}
        </div>
      )}
    </>
  );
}
