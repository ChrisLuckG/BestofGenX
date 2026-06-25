"use client";

import { useEffect, useState } from "react";
import { X, Swords, Clock, RotateCcw, Play, Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/currency";

interface Battle {
  _id: string;
  topic: string;
  wager: number;
  rounds: number;
  status: "open" | "active";
  creator: { _id: string; username: string; avatar?: string };
  opponent?: { _id: string; username: string; avatar?: string };
  createdAt: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onPlayBattle: (battleId: string) => void; // Navigate directly to that battle
  onCoinsChange?: (amount: number) => void;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

export default function OpenBattlesModal({ isOpen, onClose, userId, onPlayBattle, onCoinsChange }: Props) {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/battles?status=open&userId=${userId}`).then(r => r.json()).catch(() => ({ battles: [] })),
      fetch(`/api/battles?status=active&userId=${userId}`).then(r => r.json()).catch(() => ({ battles: [] })),
    ]).then(([openData, activeData]) => {
      const open: Battle[] = (openData.battles || []).filter((b: Battle) => b.creator?._id === userId);
      const active: Battle[] = (activeData.battles || []).filter((b: Battle) =>
        b.creator?._id === userId || b.opponent?._id === userId
      );
      setBattles([...open, ...active]);
    }).finally(() => setLoading(false));
  }, [isOpen, userId]);

  const handleCancel = async (battle: Battle) => {
    setCancelling(battle._id);
    try {
      const res = await fetch(`/api/battles/${battle._id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setCancelledIds(prev => new Set(Array.from(prev).concat([battle._id])));
        setBattles(prev => prev.filter(b => b._id !== battle._id));
        if (data.refunded && onCoinsChange) onCoinsChange(data.refunded);
        window.dispatchEvent(new Event("bogx-updated"));
      } else {
        alert(data.error || "Could not cancel battle");
      }
    } catch {
      alert("Network error");
    } finally {
      setCancelling(null);
    }
  };

  if (!isOpen) return null;

  const openBattles = battles.filter(b => b.status === "open");
  const activeBattles = battles.filter(b => b.status === "active");

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-cream rounded-t-2xl shadow-2xl border-t border-warm flex flex-col" style={{ maxHeight: "82vh" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-warm">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-[#D4873A]" />
            <span className="font-bold text-gray-900">My Open Battles</span>
            {battles.length > 0 && (
              <span className="px-1.5 py-0.5 bg-[#D4873A]/15 text-[#D4873A] text-xs font-bold rounded">{battles.length}</span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-[#D4873A] animate-spin" />
            </div>
          ) : battles.length === 0 ? (
            <div className="text-center py-10">
              <Swords className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No open battles</p>
              <p className="text-gray-400 text-xs mt-1">Create a challenge in the Arcade!</p>
            </div>
          ) : (
            <>
              {/* Waiting for opponent */}
              {openBattles.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Waiting for opponent</p>
                  <div className="space-y-2">
                    {openBattles.map(battle => (
                      <div key={battle._id} className="rounded-xl bg-gray-800 border border-gray-700 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#D4873A]/20 flex items-center justify-center flex-shrink-0">
                          <Swords className="w-5 h-5 text-[#D4873A]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{battle.topic || "Mixed"}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[#D4873A] text-xs font-bold">{formatCurrency(battle.wager)} wager</span>
                            <span className="text-gray-500 text-xs">·</span>
                            <span className="text-gray-400 text-xs">{battle.rounds} rounds</span>
                            <span className="text-gray-500 text-xs">·</span>
                            <span className="flex items-center gap-0.5 text-gray-400 text-xs">
                              <Clock className="w-3 h-3" />{timeAgo(battle.createdAt)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancel(battle)}
                          disabled={cancelling === battle._id}
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          {cancelling === battle._id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          {cancelling === battle._id ? "" : "Cancel + Refund"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active battles */}
              {activeBattles.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Active — your turn</p>
                  <div className="space-y-2">
                    {activeBattles.map(battle => {
                      const isCreator = battle.creator?._id === userId;
                      const otherPlayer = isCreator ? battle.opponent : battle.creator;
                      return (
                        <div key={battle._id} className="rounded-xl bg-purple-900/40 border border-purple-500/30 p-3 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            {otherPlayer?.avatar ? (
                              <img src={otherPlayer.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            ) : (
                              <Swords className="w-5 h-5 text-purple-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-semibold truncate">vs {otherPlayer?.username || "?"}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[#D4873A] text-xs font-bold">{formatCurrency(battle.wager)} wager</span>
                              <span className="text-gray-500 text-xs">·</span>
                              <span className="text-gray-400 text-xs">{battle.topic || "Mixed"}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => { onClose(); onPlayBattle(battle._id); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-500/30 border border-purple-500/50 text-purple-300 rounded-lg text-xs font-bold hover:bg-purple-500/40 transition-colors flex-shrink-0"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            Play Now
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
