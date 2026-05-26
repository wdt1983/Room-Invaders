'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Swords, Shield, Users, CheckCircle2, Circle, Play, XCircle, LogOut,
  Terminal, Heart, Zap, Loader2, Sparkles, AlertCircle, RefreshCw
} from 'lucide-react';
import {
  createJointRaidLobby,
  joinJointRaidLobby,
  readyUpForJointRaid,
  cancelJointRaidLobby,
  leaveJointRaidLobby,
  launchJointRaid
} from '@/app/actions/joint-raid';

interface JointParticipant {
  id: string;
  profile_id: string;
  squad_hp_contribution: number;
  squad_damage_bonus: number;
  is_ready: boolean;
  joined_at: string;
  profiles: {
    username: string;
  };
}

interface LobbyData {
  id: string;
  district_id: string;
  host_id: string;
  target_id: string;
  target_name: string;
  target_difficulty: 'easy' | 'medium' | 'hard';
  status: 'recruiting' | 'active' | 'completed' | 'cancelled';
  max_participants: number;
  created_at: string;
}

interface JointRaidLobbyProps {
  districtId: string;
  userId: string;
  username: string;
}

export function JointRaidLobby({ districtId, userId, username }: JointRaidLobbyProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lobby, setLobby] = useState<LobbyData | null>(null);
  const [participants, setParticipants] = useState<JointParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states for creating a lobby
  const [selectedDifficulty, setSelectedDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');
  const [selectedTargetId, setSelectedTargetId] = useState('procedural-tier-1');
  const [selectedTargetName, setSelectedTargetName] = useState('Sector Alpha Outpost');

  // Real-time raid tracking state for observers
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [liveHp, setLiveHp] = useState(100);
  const [liveMaxHp, setLiveMaxHp] = useState(100);

  const channelRef = useRef<any>(null);
  const liveChannelRef = useRef<any>(null);

  // Targets preset list based on difficulty
  const targetPresets = {
    easy: [
      { id: 'procedural-tier-1', name: 'Abandoned Apartment (Tier 1)' },
      { id: 'tier1-abandoned-apartment', name: 'Static Compound Alpha' }
    ],
    medium: [
      { id: 'procedural-tier-3', name: 'Corner Store Compound (Tier 3)' },
      { id: 'tier1-corner-store', name: 'Static Depo Beta' }
    ],
    hard: [
      { id: 'procedural-tier-5', name: 'Secured Comm Station (Tier 5)' },
      { id: 'tier1-corner-store', name: 'Static Core Fortress' }
    ]
  };

  useEffect(() => {
    // Sync targets presets when difficulty changes
    const presets = targetPresets[selectedDifficulty];
    if (presets && presets[0]) {
      setSelectedTargetId(presets[0].id);
      setSelectedTargetName(presets[0].name);
    }
  }, [selectedDifficulty]);

  // Fetch lobby and participants for this district
  const fetchLobbyState = async () => {
    try {
      const supabase = createClient();
      
      // Fetch recruiting or active lobby for this district
      const { data: lobbies, error: lErr } = await (supabase.from('joint_raid_lobbies') as any)
        .select('*')
        .eq('district_id', districtId)
        .in('status', ['recruiting', 'active'])
        .order('created_at', { ascending: false });

      if (lErr) throw lErr;

      const activeLobby = lobbies && lobbies[0] ? lobbies[0] : null;
      setLobby(activeLobby);

      if (activeLobby) {
        // Fetch participants for this lobby
        const { data: parts, error: pErr } = await (supabase.from('joint_raid_participants') as any)
          .select(`
            *,
            profiles:profile_id ( username )
          `)
          .eq('lobby_id', (activeLobby as any).id)
          .order('joined_at', { ascending: true });

        if (pErr) throw pErr;
        setParticipants((parts as any) || []);
      } else {
        setParticipants([]);
        setLiveLogs([]);
      }
    } catch (err) {
      console.error('[JointRaidLobby] State fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLobbyState();
  }, [districtId]);

  // Subscribes to real-time lobby synchronization channel
  useEffect(() => {
    if (!lobby) return;

    const supabase = createClient();
    const lobbyChannel = supabase.channel(`joint-raid-lobby:${lobby.id}`, {
      config: { broadcast: { self: false } }
    });

    channelRef.current = lobbyChannel;

    lobbyChannel.on('broadcast', { event: 'player_joined' }, () => {
      fetchLobbyState();
    });

    lobbyChannel.on('broadcast', { event: 'player_ready' }, () => {
      fetchLobbyState();
    });

    lobbyChannel.on('broadcast', { event: 'player_left' }, () => {
      fetchLobbyState();
    });

    lobbyChannel.on('broadcast', { event: 'lobby_cancelled' }, () => {
      toast.info('Raid lobby has been cancelled by host.');
      fetchLobbyState();
    });

    lobbyChannel.on('broadcast', { event: 'lobby_launched' }, (payload: any) => {
      toast.success('Cooperative Breach Launched!');
      setLobby(prev => prev ? { ...prev, status: 'active' } : null);
      fetchLobbyState();
    });

    lobbyChannel.subscribe();

    // Subscribe to live updates if lobby is active
    if (lobby.status === 'active') {
      const liveChannel = supabase.channel(`joint-raid-live:${lobby.id}`, {
        config: { broadcast: { self: false } }
      });

      liveChannelRef.current = liveChannel;

      liveChannel.on('broadcast', { event: 'raid_action_log' }, (payload: any) => {
        const entry = payload.payload;
        if (entry && entry.text) {
          setLiveLogs((prev) => [...prev, entry.text]);
        }
      });

      liveChannel.on('broadcast', { event: 'raid_stats_update' }, (payload: any) => {
        const stats = payload.payload;
        if (stats) {
          setLiveHp(stats.hp);
          setLiveMaxHp(stats.maxHp);
        }
      });

      liveChannel.on('broadcast', { event: 'raid_completed' }, (payload: any) => {
        toast.success(`Raid complete! Outcome: ${payload.payload.outcome.toUpperCase()}`);
        fetchLobbyState();
      });

      liveChannel.subscribe();
    }

    return () => {
      lobbyChannel.unsubscribe();
      if (liveChannelRef.current) {
        liveChannelRef.current.unsubscribe();
      }
    };
  }, [lobby?.id, lobby?.status]);

  const handleCreateLobby = () => {
    startTransition(async () => {
      const res = await createJointRaidLobby(selectedTargetId, selectedTargetName, selectedDifficulty);
      if (res.success) {
        toast.success('Raid Briefing Room established.');
        await fetchLobbyState();
      } else {
        toast.error('Failed to establish briefing room', { description: res.error });
      }
    });
  };

  const handleJoinLobby = (id: string) => {
    startTransition(async () => {
      const res = await joinJointRaidLobby(id);
      if (res.success) {
        toast.success('Joined tactical squad briefing.');
        await fetchLobbyState();
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'player_joined',
            payload: { username }
          });
        }
      } else {
        toast.error('Failed to join', { description: res.error });
      }
    });
  };

  const handleToggleReady = (ready: boolean) => {
    if (!lobby) return;
    startTransition(async () => {
      const res = await readyUpForJointRaid(lobby.id, ready);
      if (res.success) {
        await fetchLobbyState();
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'player_ready',
            payload: { username, ready }
          });
        }
      } else {
        toast.error('Failed to update readiness status.');
      }
    });
  };

  const handleCancelLobby = () => {
    if (!lobby) return;
    startTransition(async () => {
      const res = await cancelJointRaidLobby(lobby.id);
      if (res.success) {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'lobby_cancelled',
            payload: {}
          });
        }
        toast.success('Lobby disbanded.');
        await fetchLobbyState();
      } else {
        toast.error('Failed to cancel lobby.');
      }
    });
  };

  const handleLeaveLobby = () => {
    if (!lobby) return;
    startTransition(async () => {
      const res = await leaveJointRaidLobby(lobby.id);
      if (res.success) {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'player_left',
            payload: { username }
          });
        }
        toast.success('Left lobby.');
        await fetchLobbyState();
      } else {
        toast.error('Failed to leave lobby.');
      }
    });
  };

  const handleLaunchRaid = () => {
    if (!lobby) return;
    startTransition(async () => {
      const res = await launchJointRaid(lobby.id);
      if (res.success) {
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'lobby_launched',
            payload: { targetId: lobby.target_id }
          });
        }
        toast.success('Launching breach vector!');
        
        // Host navigates to Phaser raid screen
        router.push(`/raid/${lobby.target_id}?lobbyId=${lobby.id}`);
      } else {
        toast.error('Failed to launch raid', { description: res.error });
      }
    });
  };

  const isHost = lobby?.host_id === userId;
  const myParticipant = participants.find(p => p.profile_id === userId);
  const everyoneReady = participants.length >= 2 && participants.every(p => p.is_ready);

  const totalAllyHpBonus = participants
    .filter(p => p.profile_id !== lobby?.host_id)
    .reduce((sum, p) => sum + p.squad_hp_contribution, 0);

  const totalAllyDmgBonus = participants
    .filter(p => p.profile_id !== lobby?.host_id)
    .reduce((sum, p) => sum + p.squad_damage_bonus, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-card/10 backdrop-blur border border-border/40 rounded-2xl select-none">
        <Loader2 className="size-6 text-primary animate-spin mr-2" />
        <span className="text-xs text-muted-foreground uppercase font-mono tracking-wider">Scanning frequencies...</span>
      </div>
    );
  }

  // --- 1. RECONNAISSANCE OBSERVER MONITOR MODE ---
  if (lobby && lobby.status === 'active') {
    return (
      <Card className="border-rose-500/20 bg-card/40 backdrop-blur shadow-2xl relative overflow-hidden select-none">
        {/* Glow scanner effect */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-rose-500/60 shadow-[0_0_8px_rgba(244,63,94,0.6)] animate-pulse" />
        
        <CardHeader className="pb-3 border-b border-border/40 bg-rose-950/10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="size-2 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              <CardTitle className="text-sm font-black text-rose-400 uppercase tracking-widest font-mono">
                Cooperative Mission Monitor
              </CardTitle>
            </div>
            <span className="text-[9px] border border-rose-500/30 bg-rose-500/10 text-rose-300 font-extrabold px-1.5 py-0.5 rounded-full font-mono uppercase animate-pulse">
              Live Operations
            </span>
          </div>
          <CardDescription className="text-xs">
            Assisting host <strong className="text-foreground">@{participants.find(p => p.profile_id === lobby.host_id)?.profiles.username}</strong> in raiding <strong className="text-foreground">{lobby.target_name}</strong>.
          </CardDescription>
        </CardHeader>

        <CardContent className="py-4 space-y-4 font-mono text-xs">
          {/* Buff details */}
          <div className="grid grid-cols-2 gap-4 bg-background/40 border border-border/40 rounded-xl p-3">
            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground uppercase font-semibold">District Combined HP</span>
              <div className="flex items-center gap-1.5 text-rose-400 font-black">
                <Heart className="size-4" />
                <span>{liveHp} / {liveMaxHp} HP</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[9px] text-muted-foreground uppercase font-semibold">Allied Firepower Bonus</span>
              <div className="flex items-center gap-1.5 text-cyan-400 font-black">
                <Zap className="size-4" />
                <span>+{totalAllyDmgBonus} Combined Dmg</span>
              </div>
            </div>
          </div>

          {/* Combined HP Progress bar */}
          <div className="space-y-1">
            <div className="h-2 w-full bg-background/50 rounded-full border border-border/30 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-500 to-rose-600 shadow-[0_0_8px_rgba(244,63,94,0.5)] transition-all duration-300"
                style={{ width: `${Math.max(0, Math.min(100, (liveHp / liveMaxHp) * 100))}%` }}
              />
            </div>
          </div>

          {/* Tactical operation log terminal */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase font-bold">
              <Terminal className="size-3.5" />
              <span>Real-Time Operation Feed</span>
            </div>
            <div className="h-40 bg-black/75 border border-border/40 rounded-xl p-3 overflow-y-auto space-y-1.5 text-[10px] text-zinc-300 shadow-inner">
              {liveLogs.length === 0 ? (
                <div className="flex items-center gap-1.5 text-muted-foreground/60 italic animate-pulse">
                  <RefreshCw className="size-3 animate-spin" />
                  <span>Calibrating telemetry links... awaiting host breach.</span>
                </div>
              ) : (
                liveLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="text-muted-foreground/50 select-none">[{idx + 1}]</span>
                    <span className={log.includes('destroyed') ? 'text-orange-400' : log.includes('secured') || log.includes('SUCCESSFUL') ? 'text-emerald-400 font-bold' : log.includes('damaged') ? 'text-rose-400' : 'text-zinc-300'}>
                      {log}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-4 border-t border-border/40 bg-background/10 text-[10px] text-muted-foreground flex justify-between items-center">
          <div className="flex items-center gap-1">
            <Sparkles className="size-3 text-cyan-400 animate-spin" />
            <span>Telemetry synchronizing over Supabase Realtime</span>
          </div>
          {isHost && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancelLobby}
              disabled={isPending}
              className="h-7 text-[9px] font-black uppercase rounded-lg"
            >
              <XCircle className="size-3 mr-1" /> Terminate Raid
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  }

  // --- 2. ACTIVE LOBBY PREP BRIEFING MODE ---
  if (lobby) {
    return (
      <Card className="border-cyan-500/20 bg-card/40 backdrop-blur shadow-2xl relative select-none">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />

        <CardHeader className="pb-3 border-b border-border/40 bg-cyan-950/10">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="size-4.5 text-cyan-400" />
              <CardTitle className="text-sm font-black text-white uppercase tracking-widest font-mono">
                Joint Raid Briefing
              </CardTitle>
            </div>
            <span className="text-[10px] bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 font-extrabold px-2 py-0.5 rounded-full font-mono uppercase">
              {participants.length} / {lobby.max_participants} Raiders
            </span>
          </div>
          <CardDescription className="text-xs">
            Forming cooperative breach team to storm <strong className="text-foreground">{lobby.target_name}</strong> ({lobby.target_difficulty.toUpperCase()}).
          </CardDescription>
        </CardHeader>

        <CardContent className="py-4 space-y-4 font-mono text-xs">
          {/* Participant Roster */}
          <div className="space-y-2">
            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Tactical Squad Roster</span>
            <div className="grid grid-cols-1 gap-2">
              {participants.map((p) => {
                const isUserHost = p.profile_id === lobby.host_id;
                const isMe = p.profile_id === userId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      isMe ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-background/30 border-border/30'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {p.is_ready ? (
                        <CheckCircle2 className="size-4.5 text-emerald-400" />
                      ) : (
                        <Circle className="size-4.5 text-amber-500" />
                      )}
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span className="text-white">@{p.profiles.username}</span>
                          {isUserHost && (
                            <span className="text-[8px] bg-primary/20 text-primary border border-primary/30 px-1 rounded uppercase font-semibold">Host</span>
                          )}
                          {isMe && (
                            <span className="text-[8px] bg-zinc-700 text-zinc-300 px-1 rounded uppercase font-semibold">You</span>
                          )}
                        </div>
                        <div className="flex gap-2.5 text-[9px] text-muted-foreground mt-0.5">
                          <span>HP contribution: <strong className="text-rose-400">+{p.squad_hp_contribution}</strong></span>
                          <span>Dmg bonus: <strong className="text-cyan-400">+{p.squad_damage_bonus}</strong></span>
                        </div>
                      </div>
                    </div>
                    <div>
                      {p.is_ready ? (
                        <span className="text-[9px] text-emerald-400 font-extrabold uppercase">Ready</span>
                      ) : (
                        <span className="text-[9px] text-amber-500 font-semibold uppercase animate-pulse">Prepping...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Joint Power Stat Bonuses Display */}
          <div className="grid grid-cols-2 gap-4 bg-background/50 border border-border/40 rounded-xl p-3 shadow-inner">
            <div className="space-y-0.5">
              <span className="text-[8px] text-muted-foreground uppercase font-semibold">Total HP Pool Boost</span>
              <div className="text-rose-400 font-black text-sm">+{totalAllyHpBonus} Squad HP</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-[8px] text-muted-foreground uppercase font-semibold">Total Squad Dmg Boost</span>
              <div className="text-cyan-400 font-black text-sm">+{totalAllyDmgBonus} Combat Dmg</div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2 pb-4 border-t border-border/40 bg-background/10 flex flex-col gap-3">
          {isHost ? (
            <div className="flex w-full gap-2.5">
              <Button
                variant="outline"
                onClick={handleCancelLobby}
                disabled={isPending}
                className="flex-1 font-bold border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 uppercase text-[10px] h-10 rounded-xl"
              >
                <XCircle className="size-4 mr-1.5" /> Cancel Lobby
              </Button>
              <Button
                onClick={handleLaunchRaid}
                disabled={!everyoneReady || isPending}
                className="flex-2 font-black bg-cyan-600 hover:bg-cyan-500 text-white uppercase text-[10px] h-10 rounded-xl shadow-lg shadow-cyan-500/25 disabled:bg-cyan-950/20 disabled:text-cyan-900 disabled:border-cyan-950"
              >
                <Play className="size-4 mr-1.5 fill-white" /> Launch Breach ({participants.length} / 4)
              </Button>
            </div>
          ) : !myParticipant ? (
            <Button
              onClick={() => handleJoinLobby(lobby.id)}
              disabled={isPending || participants.length >= lobby.max_participants}
              className="w-full font-black bg-cyan-600 hover:bg-cyan-500 text-white uppercase text-[10px] h-10 rounded-xl shadow-lg shadow-cyan-500/25"
            >
              <Users className="size-4 mr-1.5" /> Join Tactical Squad ({participants.length} / {lobby.max_participants})
            </Button>
          ) : (
            <div className="flex w-full gap-2.5">
              <Button
                variant="outline"
                onClick={handleLeaveLobby}
                disabled={isPending}
                className="flex-1 font-bold border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 uppercase text-[10px] h-10 rounded-xl"
              >
                <LogOut className="size-4 mr-1.5" /> Leave Lobby
              </Button>
              {myParticipant.is_ready ? (
                <Button
                  onClick={() => handleToggleReady(false)}
                  disabled={isPending}
                  className="flex-2 font-black bg-amber-600 hover:bg-amber-500 text-white uppercase text-[10px] h-10 rounded-xl"
                >
                  Cancel Ready
                </Button>
              ) : (
                <Button
                  onClick={() => handleToggleReady(true)}
                  disabled={isPending}
                  className="flex-2 font-black bg-emerald-600 hover:bg-emerald-500 text-white uppercase text-[10px] h-10 rounded-xl shadow-lg shadow-emerald-500/25"
                >
                  Ready Up
                </Button>
              )}
            </div>
          )}

          {!everyoneReady && isHost && (
            <div className="flex items-center gap-1.5 text-[9px] text-amber-500 font-semibold uppercase self-center mt-1">
              <AlertCircle className="size-3.5" />
              <span>Awaiting all raiders to ready up (requires min. 2 players)</span>
            </div>
          )}
        </CardFooter>
      </Card>
    );
  }

  // --- 3. CREATE LOBBY LOBBY-SELECTION MODE ---
  return (
    <Card className="border-border bg-card/20 backdrop-blur shadow-xl select-none">
      <CardHeader className="pb-3 border-b border-border/50 bg-background/5">
        <div className="flex items-center gap-2">
          <Swords className="size-4.5 text-primary" />
          <CardTitle className="text-sm font-bold flex items-center gap-1 text-foreground uppercase tracking-wider">
            Establish Cooperative Raid Lobby
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Rally your district members to form an insertion team, combining stats against high-value targets.
        </CardDescription>
      </CardHeader>

      <CardContent className="py-4 space-y-4 text-xs font-mono">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Difficulty Dropdown */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Operations Difficulty</label>
            <select
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value as any)}
              className="w-full h-10 px-2 rounded-xl border border-border bg-background/50 text-xs font-bold text-foreground focus:outline-none focus:border-cyan-500/50"
            >
              <option value="easy">Easy (Loot x1.0, 90s Timer)</option>
              <option value="medium">Medium (Loot x1.5, 120s Timer)</option>
              <option value="hard">Hard (Loot x2.2, 150s Timer)</option>
            </select>
          </div>

          {/* Target Outpost selector */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Target Outpost Sectors</label>
            <select
              value={selectedTargetId}
              onChange={(e) => {
                setSelectedTargetId(e.target.value);
                const preset = targetPresets[selectedDifficulty].find(t => t.id === e.target.value);
                if (preset) setSelectedTargetName(preset.name);
              }}
              className="w-full h-10 px-2 rounded-xl border border-border bg-background/50 text-xs font-bold text-foreground focus:outline-none focus:border-cyan-500/50"
            >
              {targetPresets[selectedDifficulty].map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Info panel explaining bonuses */}
        <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 text-[10px] leading-relaxed text-muted-foreground space-y-1">
          <div className="font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <Shield className="size-3 text-cyan-400" /> Cooperative Raid Mechanics
          </div>
          <p>
            When launching a joint raid, participants contribute active squad members passive stat boosts (+50 HP and +10 damage per member) directly to the host's squad. All plundered loot is divided equally among participants.
          </p>
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-4 border-t border-border/50 bg-background/10 flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground">Caps at 4 raiders (1 host + 3 allies)</span>
        <Button
          onClick={handleCreateLobby}
          disabled={isPending}
          className="font-bold bg-primary hover:bg-primary/95 text-primary-foreground text-[10px] h-9 rounded-xl shadow-lg shadow-primary/10"
        >
          <Swords className="size-3.5 mr-1.5" /> Create Lobby
        </Button>
      </CardFooter>
    </Card>
  );
}
