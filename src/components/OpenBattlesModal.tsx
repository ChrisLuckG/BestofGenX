"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Swords, Clock, RotateCcw, Play, Loader2, ShieldX, Check, XCircle, Gamepad2 } from "lucide-react";
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
  /** Set once that player pressed START - from then on backing out is a forfeit. */
  creatorStartedAt?: string;
  opponentStartedAt?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onPlayBattle: (battleId: string) => void; // Navigate directly to that battle
  /**
   * Balance delta plus how it should read in the header. A refund is NOT a win:
   * it must use 'hold' (gold, gentle), otherwise cancelling a battle plays the
   * same green "you earned coins" animation as actually winning one.
   */
  onCoinsChange?: (amount: number, variant?: 'gain' | 'loss' | 'hold') => void;
  onShowLogin?: () => void;
  accentColor?: 'orange' | 'purple'; // orange for Arcade, purple for BattlesPage
  /** Fires whenever the number of battles needing attention changes, so the
      parent's badge updates immediately (e.g. after Give Up) instead of only
      on the next refresh. */
  onCountChange?: (count: number) => void;
  /** ID of the battle currently being played - shows "In Play" instead of Cancel */
  currentlyPlayingBattleId?: string;
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

export default function OpenBattlesModal({ isOpen, onClose, userId, onPlayBattle, onCoinsChange, onShowLogin, accentColor = 'orange', onCountChange, currentlyPlayingBattleId }: Props) {
  // Color classes based on accent
  const colors = accentColor === 'purple' 
    ? { bg: 'bg-[#A855F7]', bgLight: 'bg-[#A855F7]/10', border: 'border-[#A855F7]/40', text: 'text-[#A855F7]', gradient: 'from-[#A855F7]/5' }
    : { bg: 'bg-[#E36B11]', bgLight: 'bg-[#E36B11]/10', border: 'border-[#E36B11]/40', text: 'text-[#E36B11]', gradient: 'from-[#E36B11]/5' };
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
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

  // Animate in/out with fade
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay for smooth fade-in
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      // Fade out first, then unmount
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 500); // Wait for fade animation
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  // Report the badge-relevant count upwards on every change (cancel, decline,
  // forfeit, accept). Skipped while loading so the badge isn't reset to 0
  // before the first fetch resolves.
  useEffect(() => {
    if (!isOpen || loading) return;
    onCountChange?.(battles.length + incomingChallenges.length);
  }, [isOpen, loading, battles, incomingChallenges]);

  // Auto-close when all items are removed - show empty state briefly then fade out
  const checkAndCloseIfEmpty = (
    newBattles: Battle[], 
    newDeclined: Battle[], 
    newIncoming: Battle[]
  ) => {
    if (newBattles.length === 0 && newDeclined.length === 0 && newIncoming.length === 0) {
      // Show "No Open Battles" state for a moment, then fade out
      setTimeout(() => onClose(), 1200);
    }
  };

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
        setBattles(prev => {
          const newBattles = prev.filter(b => b._id !== battle._id);
          checkAndCloseIfEmpty(newBattles, declinedBattles, incomingChallenges);
          return newBattles;
        });
        if (data.refunded && onCoinsChange) onCoinsChange(data.refunded, 'hold');
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
        setIncomingChallenges(prev => {
          const newIncoming = prev.filter(b => b._id !== battle._id);
          checkAndCloseIfEmpty(battles, declinedBattles, newIncoming);
          return newIncoming;
        });
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
    setDeclinedBattles(prev => {
      const newDeclined = prev.filter(b => b._id !== battle._id);
      checkAndCloseIfEmpty(battles, newDeclined, incomingChallenges);
      return newDeclined;
    });
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
        // Trust the server, don't assume: /forfeit only refunds when the caller
        // hasn't played a round yet (`cancelled: true`). A real forfeit awards the
        // pot to the opponent and leaves this balance untouched — crediting
        // +wager there would show coins the user never got back.
        if (type === "cancelWaiting" && onCoinsChange) {
          onCoinsChange(data.refunded ?? battle.wager, 'hold');
        } else if (type === "forfeit" && onCoinsChange && data.cancelled) {
          onCoinsChange(data.refunded ?? battle.wager, 'hold');
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

  const openBattles = battles.filter(b => b.status === "open");
  const activeBattles = battles.filter(b => b.status === "active");
  const totalCount = battles.length + declinedBattles.length + incomingChallenges.length;

  if (!shouldRender) return null;

  const modalContent = (
    <div 
      className={`fixed left-0 right-0 z-[150] transition-transform duration-500 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'} bottom-16 sm:bottom-0`}
    >
      {/* Banner Container - grows up to 80% of viewport before scrolling */}
      <div className="shadow-[0_-4px_20px_rgba(0,0,0,0.15)] rounded-t-2xl overflow-hidden border-t border-warm" style={{ maxHeight: '80vh', backgroundColor: '#F5F0E8' }}>
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#E5DDD0]">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center`}>
              <Swords className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">My Open Battles</span>
              {totalCount > 0 && (
                <span className={`ml-2 px-2 py-0.5 ${colors.bg} text-white text-[10px] font-bold rounded-full`}>{totalCount}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - scrollable only after 80vh */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 70px)', scrollbarWidth: "none" }}>
          <div className="px-4 py-3 space-y-3">
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
            <div className="text-center py-6">
              <div className={`w-12 h-12 rounded-xl ${colors.bgLight} flex items-center justify-center mx-auto mb-3`}>
                <Loader2 className={`w-6 h-6 ${colors.text} animate-spin`} />
              </div>
              <p className="text-gray-900 font-semibold text-sm">Loading...</p>
              <p className="text-gray-400 text-xs mt-1">Checking your battles</p>
            </div>
          ) : battles.length === 0 && declinedBattles.length === 0 && incomingChallenges.length === 0 ? (
            <div className="text-center py-6">
              <div className={`w-12 h-12 rounded-xl ${colors.bgLight} flex items-center justify-center mx-auto mb-3`}>
                <Swords className={`w-6 h-6 ${colors.text}`} />
              </div>
              <p className="text-gray-900 font-semibold text-sm">No Open Battles</p>
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
                          {currentlyPlayingBattleId === battle._id ? (
                            <span className="flex items-center gap-1 px-2.5 py-1.5 bg-green-100 border border-green-200 text-green-600 rounded-lg text-xs font-bold flex-shrink-0">
                              <Gamepad2 className="w-3 h-3" />
                              In Play
                            </span>
                          ) : (
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
                          )}
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
                        <p className={`text-xs font-bold ${colors.text} uppercase tracking-wide mb-1 flex items-center gap-1`}><Gamepad2 className="w-3 h-3" /> You haven&apos;t played your rounds yet</p>
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
                                      {isCreator
                                        ? `Your open battle — ${otherPlayer?.username || 'an opponent'} joined it`
                                        : battle.challengedUser
                                          ? `${otherPlayer?.username || 'They'} challenged you — you accepted`
                                          : `You joined ${otherPlayer?.username || 'their'}'s open battle`}
                                    </p>
                                    {/* Origin trace — makes it verifiable where this battle came from */}
                                    <p className="text-[9px] text-gray-400 font-mono mt-0.5 break-all" title={battle._id}>
                                      ID {battle._id}
                                    </p>
                                    <p className="text-[9px] text-gray-400 font-mono">
                                      created via: {(battle as any).createdVia || 'unknown'}
                                      {(battle as any).acceptedVia ? ` · joined via: ${(battle as any).acceptedVia}` : ''}
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
                                    {/* "Not played yet" is not the same as "not started": once START
                                        was pressed the wager is committed, so the label must not keep
                                        promising a free cancel. */}
                                    {(isCreator ? battle.creatorStartedAt : battle.opponentStartedAt) ? 'Give Up' : 'Cancel'}
                                  </button>
                                  <button
                                    onClick={() => { onClose(); onPlayBattle(battle._id); }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 ${colors.bg} text-white rounded-lg text-xs font-bold hover:opacity-80 transition-colors shadow-sm`}
                                  >
                                    <Play className="w-3 h-3 fill-current" />
                                    {isCreator ? 'Play Now' : 'Continue'}
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
    </div>
  );

  // Get confirm modal text based on type
  const getConfirmModalProps = () => {
    const { battle, type } = confirmModal;
    if (!battle) return { title: "", message: "", confirmText: "", confirmColor: "red" as const };
    
    if (type === "forfeit") {
      // A battle you already armed with START costs the wager, even with zero
      // answers submitted - mirror /api/battles/[id]/forfeit instead of promising
      // a refund the server will refuse.
      const isCreator = battle.creator?._id === userId;
      const armed = isCreator ? !!battle.creatorStartedAt : !!battle.opponentStartedAt;
      if (armed) {
        return {
          title: "Give Up?",
          message: `You already started this battle, so your opponent wins the full pot of ${formatCurrency(battle.wager * 2)}. This cannot be undone.`,
          confirmText: "Give Up",
          confirmColor: "red" as const,
        };
      }
      return {
        title: "Cancel Battle?",
        message: `You haven't started yet, so both players get their ${formatCurrency(battle.wager)} wager back. Nobody loses.`,
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

  // Portal to body so the panel escapes the main content stacking context (main has z-0)
  return (
    <>
      {typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent}
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
