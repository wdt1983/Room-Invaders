// src/app/(game)/social/page.tsx
//
// Phase 5 Tasks 5.0.13 - 5.0.15 — Social Friendship network management dashboard.
// Manages search, requests pending, accepted friend arrays, and read-only visit launch actions.

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Check, X, Search, Shield, Eye, Swords, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { TradingTerminal } from "@/components/game/TradingTerminal";

interface Friend {
  friendshipId: string;
  id: string;
  username: string;
  player_level: number;
}

interface Request {
  friendshipId: string;
  id: string;
  username: string;
  player_level: number;
}

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<"friends" | "received" | "sent" | "trades">("friends");
  const [searchUsername, setSearchUsername] = useState("");
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<Request[]>([]);
  const [sentRequests, setSentRequests] = useState<Request[]>([]);

  const supabase = createClient();

  const fetchSocialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    // 1. Fetch Friends (Accepted status)
    const { data: acceptedRows } = await (supabase
      .from("friendships") as any)
      .select(`
        id,
        sender_id,
        receiver_id,
        sender:sender_id ( id, username, player_level ),
        receiver:receiver_id ( id, username, player_level )
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq("status", "accepted");

    const mappedFriends = (acceptedRows || []).map((row: any) => {
      const isSender = row.sender_id === user.id;
      const opponent = isSender ? row.receiver : row.sender;
      const opponentData = Array.isArray(opponent) ? opponent[0] : opponent;
      return {
        friendshipId: row.id,
        id: opponentData?.id,
        username: opponentData?.username || "Survivor",
        player_level: opponentData?.player_level || 1,
      };
    });
    setFriends(mappedFriends);

    // 2. Fetch Received pending requests
    const { data: receivedRows } = await (supabase
      .from("friendships") as any)
      .select(`
        id,
        sender:sender_id ( id, username, player_level )
      `)
      .eq("receiver_id", user.id)
      .eq("status", "pending");

    const mappedReceived = (receivedRows || []).map((row: any) => {
      const senderData = Array.isArray(row.sender) ? row.sender[0] : row.sender;
      return {
        friendshipId: row.id,
        id: senderData?.id,
        username: senderData?.username || "Survivor",
        player_level: senderData?.player_level || 1,
      };
    });
    setReceivedRequests(mappedReceived);

    // 3. Fetch Sent pending requests
    const { data: sentRows } = await (supabase
      .from("friendships") as any)
      .select(`
        id,
        receiver:receiver_id ( id, username, player_level )
      `)
      .eq("sender_id", user.id)
      .eq("status", "pending");

    const mappedSent = (sentRows || []).map((row: any) => {
      const receiverData = Array.isArray(row.receiver) ? row.receiver[0] : row.receiver;
      return {
        friendshipId: row.id,
        id: receiverData?.id,
        username: receiverData?.username || "Survivor",
        player_level: receiverData?.player_level || 1,
      };
    });
    setSentRequests(mappedSent);
  };

  useEffect(() => {
    fetchSocialData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim() || !currentUserId) return;

    setIsSearching(true);
    setSearchResult(null);

    // Exact username search
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, username, player_level")
      .eq("username", searchUsername.trim())
      .neq("id", currentUserId)
      .maybeSingle();

    if (error) {
      toast.error("Error searching user");
    } else if (!profile) {
      toast.error("User not found");
    } else {
      setSearchResult(profile);
    }
    setIsSearching(false);
  };

  const handleSendRequest = async (receiverId: string) => {
    if (!currentUserId) return;

    // Check if already friends or pending
    const isAlreadyFriend = friends.some(f => f.id === receiverId);
    const isAlreadySent = sentRequests.some(r => r.id === receiverId);
    const isAlreadyReceived = receivedRequests.some(r => r.id === receiverId);

    if (isAlreadyFriend) {
      toast.error("You are already friends with this player");
      return;
    }
    if (isAlreadySent) {
      toast.error("Friend request already sent");
      return;
    }
    if (isAlreadyReceived) {
      toast.error("You have a pending request from this player. Accept it under 'Received Requests'.");
      return;
    }

    const { error } = await (supabase
      .from("friendships") as any)
      .insert({
        sender_id: currentUserId,
        receiver_id: receiverId,
        status: "pending"
      });

    if (error) {
      toast.error("Failed to send request", { description: error.message });
    } else {
      toast.success("Friend request sent successfully!");
      setSearchUsername("");
      setSearchResult(null);
      fetchSocialData();
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    const { error } = await (supabase
      .from("friendships") as any)
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", friendshipId);

    if (error) {
      toast.error("Failed to accept friend request");
    } else {
      toast.success("Friend request accepted!");
      fetchSocialData();
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    const { error } = await (supabase
      .from("friendships") as any)
      .delete()
      .eq("id", friendshipId);

    if (error) {
      toast.error("Failed to remove friend request");
    } else {
      toast.success("Request removed successfully");
      fetchSocialData();
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl h-full overflow-y-auto pb-20 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="rounded-xl bg-primary/10 border border-primary/20 p-2 text-primary">
          <Users className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-sans">Social Network</h1>
          <p className="text-xs text-muted-foreground">Manage friends, visit bases in read-only mode, or launch scouts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left column: Add Friends Search */}
        <div className="md:col-span-1 space-y-6">
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-foreground">Find Survivor</CardTitle>
              <CardDescription className="text-[10px]">Enter exact username to request contact.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-2">
                <Input
                  placeholder="Username"
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  className="h-8 text-xs bg-background/50 border-border/60"
                />
                <Button type="submit" size="icon-sm" className="h-8 w-8 shrink-0 bg-primary/80 hover:bg-primary">
                  <Search className="size-4" />
                </Button>
              </form>

              {searchResult && (
                <div className="mt-4 border border-primary/20 bg-primary/5 rounded-xl p-3.5 space-y-3.5 shadow-inner">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{searchResult.username}</h4>
                      <span className="text-[10px] text-muted-foreground font-semibold">Level {searchResult.player_level}</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleSendRequest(searchResult.id)}
                    className="w-full text-xs font-bold h-7 gap-1 bg-primary/80 hover:bg-primary"
                  >
                    <UserPlus className="size-3.5" />
                    Send Request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Friends Tabs */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-primary/20 bg-card/40 backdrop-blur shadow-xl">
            <CardHeader className="pb-3 border-b border-border/50">
              <div className="flex bg-background/50 border border-border/40 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setActiveTab("friends")}
                  className={`flex-1 py-1 rounded font-bold text-center transition-all ${activeTab === "friends" ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
                >
                  Friends ({friends.length})
                </button>
                <button
                  onClick={() => setActiveTab("received")}
                  className={`flex-1 py-1 rounded font-bold text-center transition-all relative ${activeTab === "received" ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
                >
                  Received ({receivedRequests.length})
                  {receivedRequests.length > 0 && (
                    <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-red-500 animate-ping"></span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("sent")}
                  className={`flex-1 py-1 rounded font-bold text-center transition-all ${activeTab === "sent" ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
                >
                  Sent ({sentRequests.length})
                </button>
                <button
                  onClick={() => setActiveTab("trades")}
                  className={`flex-1 py-1 rounded font-bold text-center transition-all ${activeTab === "trades" ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground"}`}
                >
                  Trading
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {activeTab === "friends" && (
                <div className="space-y-4">
                  {friends.length > 0 ? (
                    friends.map((friend) => (
                      <div key={friend.id} className="flex flex-col sm:flex-row sm:items-center justify-between border border-border/50 bg-background/20 p-3.5 rounded-xl gap-3 shadow-inner">
                        <div>
                          <h4 className="text-sm font-bold text-foreground">{friend.username}</h4>
                          <span className="text-[10px] text-muted-foreground font-semibold">Stronghold Tier {friend.player_level}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/visit/${friend.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-[10.5px] font-bold gap-1 border-border/80 hover:bg-muted text-cyan-400">
                              <Eye className="size-3.5" />
                              Visit Base
                            </Button>
                          </Link>
                          <Link href={`/raid/${friend.id}`}>
                            <Button variant="outline" size="sm" className="h-7 text-[10.5px] font-bold gap-1 border-border/80 hover:bg-muted text-red-400">
                              <Swords className="size-3.5" />
                              Scout / Raid
                            </Button>
                          </Link>
                          <Button 
                            onClick={() => handleDeclineRequest(friend.friendshipId)}
                            variant="ghost" 
                            size="icon-sm" 
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            title="Remove Friend"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="size-10 mx-auto opacity-35 mb-2" />
                      <p className="text-xs">Your friends list is currently empty.</p>
                      <p className="text-[10px] text-muted-foreground/80 mt-1 leading-normal max-w-xs mx-auto">
                        Search and request contacts with survivors to explore layouts.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "received" && (
                <div className="space-y-4">
                  {receivedRequests.length > 0 ? (
                    receivedRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between border border-border/50 bg-background/20 p-3.5 rounded-xl shadow-inner">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{req.username}</h4>
                          <span className="text-[10px] text-muted-foreground">Level {req.player_level}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => handleAcceptRequest(req.friendshipId)}
                            size="sm" 
                            className="h-7 text-[10px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500"
                          >
                            <Check className="size-3.5" />
                            Accept
                          </Button>
                          <Button 
                            onClick={() => handleDeclineRequest(req.friendshipId)}
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-[10px] font-bold gap-1 border-border/80 hover:bg-muted text-red-400"
                          >
                            <X className="size-3.5" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="size-10 mx-auto opacity-35 mb-2" />
                      <p className="text-xs">No pending inbound requests.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "sent" && (
                <div className="space-y-4">
                  {sentRequests.length > 0 ? (
                    sentRequests.map((req) => (
                      <div key={req.id} className="flex items-center justify-between border border-border/50 bg-background/20 p-3.5 rounded-xl shadow-inner">
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{req.username}</h4>
                          <span className="text-[10px] text-muted-foreground font-semibold">Level {req.player_level}</span>
                        </div>
                        <Button 
                          onClick={() => handleDeclineRequest(req.friendshipId)}
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold gap-1 border-border/80 hover:bg-muted text-muted-foreground hover:text-red-400"
                        >
                          <X className="size-3" />
                          Cancel Request
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShieldAlert className="size-10 mx-auto opacity-35 mb-2" />
                      <p className="text-xs">No outbound requests in transit.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "trades" && (
                <TradingTerminal friends={friends} currentUserId={currentUserId || ""} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
