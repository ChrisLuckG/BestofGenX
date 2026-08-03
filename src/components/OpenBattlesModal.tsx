"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Swords, Clock, RotateCcw, Play, Loader2, ShieldX, Check, XCircle } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import ConfirmModal from "./ConfirmModal";
import CountryFlag from "./CountryFlag";

interface Battle {
  _id: string;
  topic: string;
  wager: number;
  rounds: number;
  status: "open" | "active" | "cancelled";
  isPrivate?: boolean;
  creator: { _id: string; username: string; avatar?: string };
  opponent?: { _id: string; username: string; avatar?: string };
  challengedUser?: { _id: string; username: string; avatar?: string; countryFlag?: string };
  declinedBy?: { _id: string; username: string; avatar?: string };
  declinedAt?: string;
  createdAt: string;
  acceptedAt?: string;
  creatorResults?: { round: number }[];
  opponentResults?: { round: number }[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onPlayBattle: (battleId: string) => void; // Navigate directly to that battle
  onCoinsChange?: (amount: number) => void;
  onShowLogin?: () => void;
  accentColor?: 'orange' | 'purple'; // orange for Arcade, purple for BattlesPage
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

export default function OpenBattlesModal({ isOpen, onClose, userId, onPlayBattle, onCoinsChange, onShowLogin, accentColor = 'orange' }: Props) {
  // Color classes based on accent
  const colors = accentColor === 'purple' 
    ? { bg: 'bg-[#A855F7]', bgLight: 'bg-[#A855F7]/10', border: 'border-[#A855F7]/40', text: 'text-[#A855F7]', gradient: 'from-[#A855F7]/5' }
    : { bg: 'bg-[#D4873A]', bgLight: 'bg-[#D4873A]/10', border: 'border-[#D4873A]/40', text: 'text-[#D4873A]', gradient: 'from-[#D4873A]/5' };
  const [battles, setBattles] = useState<Battle[]>([]);
  const [incomingChallenges, setIncomingChallenges] = useState<Battle[]>([]);
  const [declinedBattles, setDeclinedBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [declining, setDeclining] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    battle: Battle | null;
    type: "cancel" | "forfeit" | "cancelWaiting";
  }>({ isOpen: false, battle: null, type: "cancel" });

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/battles?status=open&userId=${userId}`).then(r => r.json()).catch(() => ({ battles: [] })),
      fetch(`/api/battles?status=active&userId=${userId}`).then(r => r.json()).catch(() => ({ battles: [] })),
      fetch(`/api/battles?status=declined&userId=${userId}`).then(r => r.json()).catch(() => ({ battles: [] })),
      fetch(`/api/battles/pending?userId=${userId}`).then(r => r.json()).catch(() => ({ battles: [] })),
    ]).then(([openData, activeData, declinedData, pendingData]) => {
      const open: Battle[] = (openData.battles || []).filter((b: Battle) => b.creator?._id === userId);
      const active: Battle[] = (activeData.battles || []).filter((b: Battle) =>
        b.creator?._id === userId || b.opponent?._id === userId
      );
      setBattles([...open, ...active]);
      setDeclinedBattles(declinedData.battles || []);
      // Incoming challenges: battles where user is the opponent and status is open
      setIncomingChallenges(pendingData.battles || []);
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

  const handleDecline = async (battle: Battle) => {
    setDeclining(battle._id);
    try {
      const res = await fetch(`/api/battles/${battle._id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oderId: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setIncomingChallenges(prev => prev.filter(b => b._id !== battle._id));
        window.dispatchEvent(new Event("bogx-updated"));
      } else {
        alert(data.error || "Could not decline battle");
      }
    } catch {
      alert("Network error");
    } finally {
      setDeclining(null);
    }
  };

  const handleDismissDeclined = async (battle: Battle) => {
    setDismissing(battle._id);
    // Optimistic removal - this is just a notice, no need to block on the network
    setDeclinedBattles(prev => prev.filter(b => b._id !== battle._id));
    try {
      await fetch(`/api/battles/${battle._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
    } catch {
      // Silently ignore - worst case it reappears next time the modal is opened
    } finally {
      setDismissing(null);
    }
  };

  const handleAccept = async (battle: Battle) => {
    setAccepting(battle._id);
    try {
      const res = await fetch(`/api/battles/${battle._id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opponentId: userId }),
      });
      const data = await res.json();
      if (data.success) {
        setIncomingChallenges(prev => prev.filter(b => b._id !== battle._id));
        window.dispatchEvent(new Event("bogx-updated"));
        onClose();
        onPlayBattle(battle._id);
      } else {
        alert(data.error || "Could not accept battle");
      }
    } catch {
      alert("Network error");
    } finally {
      setAccepting(null);
    }
  };

  const showCancelWaitingConfirm = (battle: Battle) => {
    setConfirmModal({ isOpen: true, battle, type: "cancelWaiting" });
  };

  const showForfeitConfirm = (battle: Battle) => {
    setConfirmModal({ isOpen: true, battle, type: "forfeit" });
  };

  const handleConfirmAction = async () => {
    const { battle, type } = confirmModal;
    if (!battle) return;

    setCancelling(battle._id);
    setConfirmModal({ isOpen: false, battle: null, type: "cancel" });

    try {
      let endpoint = "";
      if (type === "cancelWaiting") {
        endpoint = `/api/battles/${battle._id}/cancel-waiting`;
      } else if (type === "forfeit") {
        endpoint = `/api/battles/${battle._id}/forfeit`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oderId: userId }),
      });
      const data = await res.json();
      
      if (data.success) {
        setBattles(prev => prev.filter(b => b._id !== battle._id));
        window.dispatchEvent(new Event("bogx-updated"));
        if (type === "cancelWaiting" && onCoinsChange) {
          onCoinsChange(battle.wager);
        } else if (type === "forfeit" && onCoinsChange) {
          // YOUR TURN = not yet played → backend refunds wager (no loss)
          onCoinsChange(battle.wager);
        }
      } else {
        alert(data.error || "Action failed");
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
  const totalCount = battles.length + declinedBattles.length + incomingChallenges.length;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Dark overlay - covers EVERYTHING */}
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#F5F0E8] rounded-t-2xl sm:rounded-2xl shadow-2xl border-2 border-[#E5DDD0] flex flex-col overflow-hidden" style={{ maxHeight: "80vh" }}>
        {/* Handle - only on mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className={`w-10 h-1 rounded-full ${colors.bgLight}`} />
        </div>

        {/* Header - BOGX style */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#E5DDD0] bg-[#F5F0E8] rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
              <Swords className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-base">My Open Battles</span>
              {totalCount > 0 && (
                <span className={`ml-2 px-2 py-0.5 ${colors.bg} text-white text-xs font-bold rounded-full`}>{totalCount}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - CREAM background */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#F5F0E8]" style={{ scrollbarWidth: "none", backgroundColor: "#F5F0E8" }}>
          {!userId ? (
            <div className="text-center py-10">
              <Swords className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-900 font-semibold">Login to see your battles</p>
              <p className="text-gray-500 text-sm mt-1">Challenge other players and win BOGX!</p>
              {onShowLogin && (
                <button
                  onClick={() => { onClose(); onShowLogin(); }}
                  className={`mt-4 px-6 py-2 ${colors.bg} text-white rounded-lg font-bold hover:opacity-80 transition-colors`}
                >
                  Login
                </button>
              )}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className={`w-6 h-6 ${colors.text} animate-spin`} />
            </div>
          ) : battles.length === 0 && declinedBattles.length === 0 && incomingChallenges.length === 0 ? (
            <div className="text-center py-10">
              <Swords className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">No open battles</p>
              <p className="text-gray-400 text-xs mt-1">Create a challenge in the Arcade!</p>
            </div>
          ) : (
            <>
              {/* Incoming challenges - Accept or Deny */}
              {incomingChallenges.length > 0 && (
                <div>
                  <p className={`text-xs font-bold ${colors.text} uppercase tracking-wide mb-2`}>⚔️ Incoming Challenges</p>
                  <div className="space-y-2">
                    {incomingChallenges.map(battle => (
                      <div key={battle._id} className={`rounded-xl ${colors.bgLight} border-2 ${colors.border} p-3`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                            {battle.creator?.avatar ? (
                              <img src={battle.creator.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            ) : (
                              <Swords className={`w-5 h-5 ${colors.text}`} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-sm font-bold truncate">
                              {battle.creator?.username || "Someone"} challenges you!
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`${colors.text} text-xs font-bold`}>{formatCurrency(battle.wager)} wager</span>
                              <span className="text-gray-400 text-xs">·</span>
                              <span className="text-gray-600 text-xs">{battle.topic || "Mixed"}</span>
                              <span className="text-gray-400 text-xs">·</span>
                              <span className="text-gray-600 text-xs">{battle.rounds} rounds</span>
                            </div>
                          </div>
                        </div>
                        {/* Accept / Deny buttons */}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => handleDecline(battle)}
                            disabled={declining === battle._id || accepting === battle._id}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            {declining === battle._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <XCircle className="w-4 h-4" />
                            )}
                            Deny
                          </button>
                          <button
                            onClick={() => handleAccept(battle)}
                            disabled={declining === battle._id || accepting === battle._id}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 ${colors.bg} text-white rounded-lg text-sm font-bold hover:opacity-80 transition-colors disabled:opacity-50`}
                          >
                            {accepting === battle._id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Accept & Play
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Declined battles */}
              {declinedBattles.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">Battle Denied</p>
                  <div className="space-y-2">
                    {declinedBattles.map(battle => (
                      <div key={battle._id} className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                          {battle.declinedBy?.avatar ? (
                            <img src={battle.declinedBy.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                          ) : (
                            <ShieldX className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 text-sm font-semibold truncate">
                            {battle.declinedBy?.username || "Opponent"} declined
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-green-600 text-xs font-bold">{formatCurrency(battle.wager)} refunded</span>
                            <span className="text-gray-400 text-xs">·</span>
                            <span className="text-gray-600 text-xs">{battle.topic}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 bg-red-100 text-red-600 rounded-lg flex-shrink-0">Denied</span>
                        <button
                          onClick={() => handleDismissDeclined(battle)}
                          disabled={dismissing === battle._id}
                          aria-label="Dismiss"
                          className="w-6 h-6 rounded-full flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting for opponent */}
              {openBattles.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Waiting for opponent</p>
                  <div className="space-y-2">
                    {openBattles.map(battle => (
                      <div key={battle._id} className="rounded-xl bg-[#EDE8E0] border border-[#E0D9CD] p-3">
                        <div className="flex items-center gap-3">
                          {/* Only show an avatar for private challenges - we know exactly who we're waiting on */}
                          {battle.challengedUser && (
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-[#E0D9CD] flex items-center justify-center overflow-hidden">
                                {battle.challengedUser.avatar ? (
                                  <img src={battle.challengedUser.avatar} className="w-10 h-10 rounded-xl object-cover scale-150" alt="" />
                                ) : (
                                  <span className="text-sm font-bold text-gray-500">{battle.challengedUser.username?.[0]?.toUpperCase()}</span>
                                )}
                              </div>
                              {battle.challengedUser.countryFlag && (
                                <CountryFlag 
                                  flag={battle.challengedUser.countryFlag} 
                                  className="absolute -bottom-1 -right-1 w-4 h-3 rounded-[2px] border border-white shadow-sm" 
                                />
                              )}
                            </div>
                          )}
                          <p className="flex-1 min-w-0 text-gray-900 text-sm font-semibold truncate">
                            {battle.challengedUser ? `vs ${battle.challengedUser.username}` : (battle.topic || "Mixed")}
                          </p>
                          <button
                            onClick={() => handleCancel(battle)}
                            disabled={cancelling === battle._id}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors disabled:opacity-50 flex-shrink-0"
                          >
                            {cancelling === battle._id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3 h-3" />
                            )}
                            {cancelling === battle._id ? "" : "Cancel"}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap pl-[52px]">
                          <span className={`${colors.text} text-xs font-bold`}>{formatCurrency(battle.wager)} wager</span>
                          <span className="text-gray-400 text-xs">·</span>
                          <span className="text-gray-600 text-xs">{battle.rounds} rounds</span>
                          <span className="text-gray-400 text-xs">·</span>
                          <span className="flex items-center gap-0.5 text-gray-500 text-xs">
                            <Clock className="w-3 h-3" />{timeAgo(battle.createdAt)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Active battles - games already accepted */}
              {activeBattles.length > 0 && (() => {
                // Split into YOUR TURN vs WAITING
                const yourTurn: Battle[] = [];
                const waitingForThem: Battle[] = [];
                
                activeBattles.forEach(battle => {
                  const isCreator = battle.creator?._id === userId;
                  const creatorPlayed = (battle.creatorResults?.length || 0) > 0;
                  const opponentPlayed = (battle.opponentResults?.length || 0) > 0;
                  
                  if (isCreator) {
                    // You are creator
                    if (!creatorPlayed) yourTurn.push(battle); // You haven't played yet
                    else if (!opponentPlayed) waitingForThem.push(battle); // Waiting for opponent
                  } else {
                    // You are opponent
                    if (!opponentPlayed) yourTurn.push(battle); // You haven't played yet
                    else if (!creatorPlayed) waitingForThem.push(battle); // Waiting for creator
                  }
                });
                
                return (
                  <>
                    {/* YOUR TURN - you need to play */}
                    {yourTurn.length > 0 && (
                      <div>
                        <p className={`text-xs font-bold ${colors.text} uppercase tracking-wide mb-1`}>🎮 YOUR TURN — Play Now!</p>
                        <div className="space-y-2">
                          {yourTurn.map(battle => {
                            const isCreator = battle.creator?._id === userId;
                            const otherPlayer = isCreator ? battle.opponent : battle.creator;
                            return (
                              <div key={battle._id} className={`rounded-xl bg-white border-2 ${colors.border} p-3 shadow-sm`}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl ${colors.bgLight} flex items-center justify-center flex-shrink-0 overflow-hidden`}>
                                    {otherPlayer?.avatar ? (
                                      <img src={otherPlayer.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                                    ) : (
                                      <Swords className={`w-5 h-5 ${colors.text}`} />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-gray-900 text-sm font-bold truncate">vs {otherPlayer?.username || "?"}</p>
                                    <p className="text-[10px] text-gray-400 -mt-0.5">
                                      {isCreator ? 'You created this — your wager was taken at creation' : 'You accepted this challenge'}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className={`px-2 py-0.5 ${colors.bgLight} ${colors.text} text-xs font-bold rounded-full flex items-center gap-1`}>
                                        <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                                        {formatCurrency(battle.wager)}
                                      </span>
                                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">{battle.topic || "Mixed"}</span>
                                      <span
                                        className="flex items-center gap-1 text-gray-400 text-xs"
                                        title={new Date(battle.createdAt).toLocaleString()}
                                      >
                                        <Clock className="w-3 h-3" />
                                        {isCreator ? 'Created' : 'Sent'} {new Date(battle.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {new Date(battle.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      {/* Proof of when YOU accepted (wager deducted from you) — only
                                          relevant/shown when you're the opponent, since the accept
                                          endpoint is what deducted your wager in that case. If you're
                                          the creator, your wager was taken at creation instead (see
                                          "Created" timestamp above) — acceptedAt doesn't apply to you. */}
                                      {!isCreator && battle.acceptedAt && (
                                        <span
                                          className="flex items-center gap-1 text-[10px] text-green-600 font-medium"
                                          title={new Date(battle.acceptedAt).toLocaleString()}
                                        >
                                          <Check className="w-3 h-3" />
                                          You accepted {new Date(battle.acceptedAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })} · {new Date(battle.acceptedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      )}
                                      {!isCreator && !battle.acceptedAt && (
                                        <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold">
                                          ⚠️ No accept record found — please report this
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => showForfeitConfirm(battle)}
                                    disabled={cancelling === battle._id}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                                  >
                                    {cancelling === battle._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                    {isCreator ? 'Cancel' : 'Deny'}
                                  </button>
                                  <button
                                    onClick={() => { onClose(); onPlayBattle(battle._id); }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 ${colors.bg} text-white rounded-lg text-xs font-bold hover:opacity-80 transition-colors shadow-sm`}
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    {isCreator ? 'Play Now' : 'Accept'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* WAITING - opponent needs to play */}
                    {waitingForThem.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">⏳ WAITING FOR OPPONENT</p>
                        <p className="text-[10px] text-gray-400 mb-2">You played — waiting for them to finish. Cancel to get wager back.</p>
                        <div className="space-y-2">
                          {waitingForThem.map(battle => {
                            const isCreator = battle.creator?._id === userId;
                            const otherPlayer = isCreator ? battle.opponent : battle.creator;
                            return (
                              <div key={battle._id} className="rounded-xl bg-[#EDE8E0] border border-[#E0D9CD] p-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-[#E0D9CD] flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    {otherPlayer?.avatar ? (
                                      <img src={otherPlayer.avatar} className="w-10 h-10 rounded-xl object-cover" alt="" />
                                    ) : (
                                      <Clock className="w-5 h-5 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-gray-700 text-sm font-bold truncate">vs {otherPlayer?.username || "?"}</p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <span className={`px-2 py-0.5 ${colors.bgLight} ${colors.text} text-xs font-bold rounded-full flex items-center gap-1`}>
                                        <img src="/images/bogxcoin.png" alt="" className="w-3 h-3" />
                                        {formatCurrency(battle.wager)}
                                      </span>
                                      <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">{battle.topic || "Mixed"}</span>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => showCancelWaitingConfirm(battle)}
                                    disabled={cancelling === battle._id}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                                  >
                                    {cancelling === battle._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Get confirm modal text based on type
  const getConfirmModalProps = () => {
    const { battle, type } = confirmModal;
    if (!battle) return { title: "", message: "", confirmText: "", confirmColor: "red" as const };
    
    if (type === "forfeit") {
      return {
        title: "Cancel Battle?",
        message: `You haven't played yet, so both players get their ${formatCurrency(battle.wager)} wager back. Nobody loses.`,
        confirmText: "Cancel Battle",
        confirmColor: "red" as const,
      };
    } else if (type === "cancelWaiting") {
      return {
        title: "Cancel Battle?",
        message: `Both players get their ${formatCurrency(battle.wager)} wager back. The battle will be cancelled.`,
        confirmText: "Cancel Battle",
        confirmColor: "red" as const,
      };
    }
    return { title: "", message: "", confirmText: "", confirmColor: "red" as const };
  };

  // Render via portal to ensure it's above everything
  if (typeof document !== 'undefined') {
    return (
      <>
        {createPortal(modalContent, document.body)}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          onClose={() => setConfirmModal({ isOpen: false, battle: null, type: "cancel" })}
          onConfirm={handleConfirmAction}
          loading={cancelling === confirmModal.battle?._id}
          {...getConfirmModalProps()}
        />
      </>
    );
  }
  return modalContent;
}
