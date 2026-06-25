"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Target, Clock, Check, Loader2, Trophy, Calendar, HelpCircle, X, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import BackButton from "@/components/BackButton";
import GameIntroModal from "@/components/GameIntroModal";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import { shouldAutoShowIntro, incrementGamePlayCount } from "@/utils/gameIntro";

interface PredictionOption {
  id: string;
  label: string;
}

interface Prediction {
  _id: string;
  question: string;
  category: string;
  options: PredictionOption[];
  pointsReward: number;
  closesAt: string;
  genXRelated: boolean;
  myPick: string | null;
  status: "active" | "resolved";
  correctOptionId: string | null;
}

interface GroupedPredictions {
  key: string;
  label: string;
  isUpcoming: boolean;
  items: Prediction[];
  closesAt?: string;
  isPast?: boolean;
}

function groupByDate(predictions: Prediction[]): GroupedPredictions[] {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  
  const groups = new Map<string, Prediction[]>();
  
  for (const p of predictions) {
    // Group ALL predictions by their closesAt date
    const dateKey = new Date(p.closesAt).toISOString().slice(0, 10);
    const existing = groups.get(dateKey);
    if (existing) existing.push(p);
    else groups.set(dateKey, [p]);
  }
  
  return Array.from(groups.entries())
    .map(([key, items]) => {
      const date = new Date(key);
      const isUpcoming = items.some(p => p.status === "active");
      const isPast = key < todayKey;
      
      // Always show the actual date - e.g. "Thu, May 29" or "Fri, May 30"
      const label = date.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
      
      // Find earliest closesAt time for countdown (for active predictions)
      const earliestClose = items
        .filter(p => p.status === "active")
        .map(p => p.closesAt)
        .sort()[0] || items[0]?.closesAt;
      
      return { key, label, isUpcoming, items, closesAt: earliestClose, isPast };
    })
    .sort((a, b) => {
      // Upcoming (active) first, then past
      if (a.isUpcoming && !b.isUpcoming) return -1;
      if (!a.isUpcoming && b.isUpcoming) return 1;
      // Within same category, sort by date (soonest first for upcoming, newest first for past)
      if (a.isUpcoming) return a.key.localeCompare(b.key); // Soonest first
      return b.key.localeCompare(a.key); // Newest first for past
    });
}

interface PredictionsGameProps {
  onBack: () => void;
  /** Open the login flow. View defaults to 'login'; pass 'register' to open sign-up tab. */
  onShowLogin?: (view?: 'login' | 'register') => void;
  /** If true, render modals inline (for desktop) */
  embedded?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  sport: "bg-green-500/20 text-green-700",
  politics: "bg-red-500/20 text-red-700",
  entertainment: "bg-purple-500/20 text-purple-700",
  music: "bg-pink-500/20 text-pink-700",
  tech: "bg-blue-500/20 text-blue-700",
  world: "bg-cyan-500/20 text-cyan-700",
  other: "bg-gray-500/20 text-gray-700",
};

function computeTimeLeft(closesAt: string): { label: string; tone: "open" | "soon" | "closed" } {
  const diff = new Date(closesAt).getTime() - Date.now();
  if (diff <= 0) return { label: "Closed", tone: "closed" };
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  let label: string;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const remH = h % 24;
    label = `${d}d ${remH}h ${m}m ${s}s`;
  } else if (h >= 1) {
    label = `${h}h ${m}m ${s}s`;
  } else if (m >= 1) {
    label = `${m}m ${s}s`;
  } else {
    label = `${s}s`;
  }
  const tone: "open" | "soon" | "closed" = h < 1 && m < 60 ? "soon" : "open";
  return { label, tone };
}

// Live countdown badge component
function LiveCountdownBadge({ closesAt }: { closesAt: string }) {
  const [timeData, setTimeData] = useState(() => computeTimeLeft(closesAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeData(computeTimeLeft(closesAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  const bgColor =
    timeData.tone === "closed"
      ? "bg-gray-400/20"
      : timeData.tone === "soon"
        ? "bg-red-500/20"
        : "bg-[#D4873A]/20";
  const textColor =
    timeData.tone === "closed"
      ? "text-gray-500"
      : timeData.tone === "soon"
        ? "text-red-600"
        : "text-[#D4873A]";

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${bgColor} ${textColor}`}>
      <Clock className="w-3 h-3" />
      {timeData.label}
    </span>
  );
}

// Countdown badge for group headers
function GroupCountdown({ closesAt }: { closesAt: string }) {
  const [timeData, setTimeData] = useState(() => computeTimeLeft(closesAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeData(computeTimeLeft(closesAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  if (timeData.tone === "closed") {
    return (
      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
        Closed
      </span>
    );
  }

  const bgColor = timeData.tone === "soon" ? "bg-red-100" : "bg-[#D4873A]/10";
  const textColor = timeData.tone === "soon" ? "text-red-600" : "text-[#D4873A]";

  return (
    <span className={`text-xs font-semibold ${bgColor} ${textColor} px-2 py-0.5 rounded flex items-center gap-1`}>
      <Clock className="w-3.5 h-3.5" />
      {timeData.label}
    </span>
  );
}

// Grouped list with calendar headers
function GroupedPredictionsList({
  predictions,
  submitting,
  onPick,
}: {
  predictions: Prediction[];
  submitting: string | null;
  onPick: (predictionId: string, optionId: string) => void;
}) {
  const grouped = useMemo(() => groupByDate(predictions), [predictions]);
  
  // Track if we've shown the "Past Results" separator
  let shownPastSeparator = false;

  return (
    <>
      {grouped.map((group, groupIdx) => {
        // Show separator before first past group
        const showPastSeparator = !group.isUpcoming && !shownPastSeparator;
        if (showPastSeparator) shownPastSeparator = true;

        return (
          <div key={group.key}>
            {/* Past Results Separator */}
            {showPastSeparator && groupIdx > 0 && (
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-300" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Past Results</span>
                <div className="flex-1 h-px bg-gray-300" />
              </div>
            )}

            {/* Date Header */}
            <div className="flex items-center gap-2 mb-3 mt-1">
              <Calendar className={`w-5 h-5 ${group.isUpcoming ? "text-[#D4873A]" : "text-gray-400"}`} />
              <span className={`text-sm font-bold uppercase tracking-wide ${group.isUpcoming ? "text-gray-900" : "text-gray-500"}`}>
                {group.label}
              </span>
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                {group.items.length} {group.items.length === 1 ? 'game' : 'games'}
              </span>
              {group.isUpcoming && group.closesAt && (
                <GroupCountdown closesAt={group.closesAt} />
              )}
            </div>

            {/* Prediction Cards */}
            <div className="space-y-3 mb-4">
              {group.items.map((p) => (
                <PredictionCard
                  key={p._id}
                  prediction={p}
                  submitting={submitting}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// Individual prediction card
function PredictionCard({
  prediction: p,
  submitting,
  onPick,
}: {
  prediction: Prediction;
  submitting: string | null;
  onPick: (predictionId: string, optionId: string) => void;
}) {
  const isResolved = p.status === "resolved";
  const userWon = isResolved && p.myPick === p.correctOptionId;
  const userLost = isResolved && p.myPick && p.myPick !== p.correctOptionId;

  return (
    <div className={`rounded-2xl border shadow-sm p-4 ${
      isResolved ? "bg-gray-50 border-gray-200" : "bg-white border-warm"
    }`}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[p.category] || CATEGORY_COLORS.other}`}>
          {p.category}
        </span>
        {p.genXRelated && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4873A]/15 text-[#D4873A]">GenX</span>
        )}
        {isResolved ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Resolved</span>
        ) : (
          <LiveCountdownBadge closesAt={p.closesAt} />
        )}
        {/* Result badge for user */}
        {userWon && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3" /> +{p.pointsReward} BOGX
          </span>
        )}
        {userLost && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
            <XCircle className="w-3 h-3" /> Wrong
          </span>
        )}
        {!isResolved && (
          <span className={`text-[10px] font-bold ml-auto ${p.myPick ? 'text-yellow-600' : 'text-[#D4873A]'}`}>
            {p.myPick ? (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {p.pointsReward} BOGX on hold
              </span>
            ) : (
              `+${p.pointsReward} BOGX`
            )}
          </span>
        )}
      </div>

      <p className={`text-[15px] font-bold mb-3 leading-snug ${isResolved ? "text-gray-700" : "text-gray-900"}`}>
        {p.question}
      </p>

      <div className="grid grid-cols-1 gap-2">
        {p.options.map((o) => {
          const selected = p.myPick === o.id;
          const isCorrect = p.correctOptionId === o.id;

          if (isResolved) {
            // Resolved: show results
            return (
              <div
                key={o.id}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium ${
                  isCorrect
                    ? "bg-green-100 text-green-800 border border-green-300"
                    : selected
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-gray-100 text-gray-500 border border-gray-200"
                }`}
              >
                <span>{o.label}</span>
                {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                {selected && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
              </div>
            );
          }

          // Active: allow picking
          return (
            <button
              key={o.id}
              onClick={() => onPick(p._id, o.id)}
              disabled={submitting === p._id}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                selected
                  ? "bg-[#D4873A] text-white shadow-sm"
                  : "bg-cream text-gray-700 hover:bg-[#D4873A]/10 border border-warm"
              }`}
            >
              <span>{o.label}</span>
              {selected && <Check className="w-4 h-4" />}
            </button>
          );
        })}
      </div>

      {!isResolved && p.myPick && (
        <p className="text-[11px] text-gray-400 mt-2 text-center">
          Your pick is locked in. You can change it until it closes.
        </p>
      )}
      {isResolved && !p.myPick && (
        <p className="text-[11px] text-gray-400 mt-2 text-center">
          You didn't participate in this prediction.
        </p>
      )}
    </div>
  );
}

export default function PredictionsGame({ onBack, onShowLogin, embedded = false }: PredictionsGameProps) {
  const { user, isLoggedIn, updateUser } = useAuth();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  // Auto-show the intro for first-timers; logged-in users who have played
  // twice skip it and can re-open it any time from the help (?) button.
  const [showIntro, setShowIntro] = useState(() => shouldAutoShowIntro("predictions", isLoggedIn));
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  // Confirmation modal for new predictions (wager)
  const [confirmPick, setConfirmPick] = useState<{ predictionId: string; optionId: string; optionLabel: string; wager: number } | null>(null);
  // In-page info banner. Logged-in users can permanently dismiss it (stored
  // in localStorage). Guests' dismissals are state-only so the banner comes
  // back on every refresh, which keeps the explanation visible to new visitors.
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isLoggedIn && localStorage.getItem("bogx_pred_info_dismissed") === "1") {
      setShowInfoBanner(false);
    } else {
      setShowInfoBanner(true);
    }
  }, [isLoggedIn]);
  const dismissInfoBanner = () => {
    setShowInfoBanner(false);
    if (isLoggedIn && typeof window !== "undefined") {
      try { localStorage.setItem("bogx_pred_info_dismissed", "1"); } catch { /* ignore */ }
    }
  };
  // Pending pick to apply after the user successfully logs in
  const [pendingPick, setPendingPick] = useState<{ predictionId: string; optionId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = user?.id ? `/api/predictions?userId=${user.id}` : "/api/predictions";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) setPredictions(data.predictions);
    } catch (e) {
      console.error("Failed to load predictions:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Apply any pending pick once the user has logged in
  useEffect(() => {
    if (isLoggedIn && user?.id && pendingPick) {
      const { predictionId, optionId } = pendingPick;
      setPendingPick(null);
      // Defer to next tick so state has settled
      setTimeout(() => pick(predictionId, optionId), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.id]);

  // Called when user clicks an option - shows confirmation for new picks
  const requestPick = (predictionId: string, optionId: string) => {
    if (!isLoggedIn || !user?.id) {
      setPendingPick({ predictionId, optionId });
      setShowLoginRequired(true);
      return;
    }
    const prediction = predictions.find((p) => p._id === predictionId);
    if (!prediction) return;

    // If user already has a pick, just change it (no confirmation needed)
    if (prediction.myPick) {
      submitPick(predictionId, optionId);
      return;
    }

    // New prediction: show confirmation modal
    const option = prediction.options.find((o) => o.id === optionId);
    setConfirmPick({
      predictionId,
      optionId,
      optionLabel: option?.label || "",
      wager: prediction.pointsReward,
    });
  };

  // Actually submit the pick to API
  const submitPick = async (predictionId: string, optionId: string) => {
    if (!user?.id) return;
    setSubmitting(predictionId);
    setConfirmPick(null);
    // Optimistic
    setPredictions((prev) => prev.map((p) => (p._id === predictionId ? { ...p, myPick: optionId } : p)));
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, predictionId, optionId }),
      });
      const data = await res.json();
      if (!data.success) {
        // Revert on error
        load();
        alert(data.error || "Failed to submit prediction");
        return;
      }
      // Deduct points from local user state (triggers animation in header)
      if (data.wagerDeducted && user.coins !== undefined) {
        updateUser({ coins: user.coins - data.wagerDeducted });
      }
      // Count this as a play so the intro stops auto-opening after two picks.
      incrementGamePlayCount("predictions");
    } catch (e) {
      console.error("Failed to submit prediction:", e);
      load();
    } finally {
      setSubmitting(null);
    }
  };

  // Legacy alias for pending pick after login
  const pick = submitPick;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      <LoginRequiredModal
        isOpen={showLoginRequired}
        onClose={() => { setShowLoginRequired(false); setPendingPick(null); }}
        onLogin={() => { setShowLoginRequired(false); onShowLogin?.('login'); }}
        onRegister={() => { setShowLoginRequired(false); onShowLogin?.('register'); }}
        title="Log in to lock in your pick"
        message="Predictions are free to view, but you need a free account to submit one. We'll bring you right back to this question after you sign in."
      />

      {/* Confirmation Modal for new predictions */}
      {confirmPick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setConfirmPick(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Prediction</h3>
              <p className="text-sm text-gray-500 mt-1">Review your selection before confirming</p>
            </div>

            {/* Content */}
            <div className="px-6 py-5">
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Your pick</p>
                <p className="font-semibold text-gray-900">{confirmPick.optionLabel}</p>
              </div>

              <div className="flex items-center justify-between py-3 border-t border-gray-100">
                <span className="text-sm text-gray-600">BOGX to wager</span>
                <span className="font-semibold text-gray-900">{confirmPick.wager} BOGX</span>
              </div>

              <p className="text-xs text-gray-400 mt-3 leading-relaxed">
                BOGX will be held until the prediction closes. If correct, you'll receive your wager back plus winnings.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setConfirmPick(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => submitPick(confirmPick.predictionId, confirmPick.optionId)}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <GameIntroModal
        isOpen={showIntro}
        onClose={() => setShowIntro(false)}
        onAction={() => setShowIntro(false)}
        icon={Target}
        title="Predictions"
        subtitle="Call the outcome, earn BOGX."
        actionLabel="Start predicting"
        embedded={embedded}
        rules={[
          { icon: Target, text: "Pick the outcome you think will happen for each question." },
          { icon: Trophy, text: "Get it right and earn BOGX — no stakes, no risk." },
          { icon: Calendar, text: "All predictions close before the 9:00 AM CET break, so lock in early." },
          { icon: Check, text: "You can change your pick any time until it closes." },
        ]}
      />
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent flex items-center gap-3">
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-[#D4873A]" />
          <span className="font-display text-lg tracking-wider text-gray-900">Predictions</span>
        </div>
        <button
          onClick={() => setShowIntro(true)}
          aria-label="How to play"
          title="How to play"
          className="ml-auto w-9 h-9 rounded-full border border-warm bg-white text-[#D4873A] hover:bg-[#D4873A]/10 transition-colors flex items-center justify-center shadow-sm"
        >
          <HelpCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Intro banner - dismissible. Hidden permanently for logged-in users
          once closed; for guests it returns on every page refresh. */}
      {showInfoBanner && (
        <div className="px-4 pt-3">
          <div className="relative rounded-2xl bg-gradient-to-br from-[#D4873A]/10 to-transparent border border-warm p-3 pr-9">
            <p className="text-[13px] text-gray-600 leading-relaxed">
              Predict today's outcomes and earn BOGX if you're right. All predictions close before
              the 9:00 AM CET break — lock in your picks early!
            </p>
            <button
              onClick={dismissInfoBanner}
              aria-label="Dismiss"
              title="Dismiss"
              className="absolute top-2 right-2 w-7 h-7 rounded-full text-gray-500 hover:text-gray-800 hover:bg-black/5 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#D4873A] animate-spin" />
          </div>
        ) : predictions.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No predictions right now.</p>
            <p className="text-gray-400 text-xs mt-1">Check back soon — fresh ones drop daily!</p>
          </div>
        ) : (
          <GroupedPredictionsList
            predictions={predictions}
            submitting={submitting}
            onPick={requestPick}
          />
        )}
      </div>
    </div>
  );
}
