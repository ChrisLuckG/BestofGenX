"use client";

import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { GENX_MOODS, DEFAULT_MOOD, getMoodById } from "@/config/moods";
import { REACTION_REWARD } from "@/config/rewards";

interface CardMoodReactionsProps {
  articleId: string;
  userId?: string;
  isLoggedIn: boolean;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
  size?: 'xs' | 'sm' | 'md';
  // When true, NEVER fire the individual fetch — the parent (e.g. WelcomeReel)
  // is responsible for loading all reaction data in a single batched request
  // and passing it down via initialReactions/initialUserReaction once ready.
  // This must be a static flag (not derived from whether data has arrived
  // yet), otherwise every card fires its own request during the brief window
  // before the batched fetch resolves (N+1 request storm / ERR_INSUFFICIENT_RESOURCES).
  useExternalData?: boolean;
  initialReactions?: Record<string, number>;
  initialUserReaction?: string | null;
  // Whether this user already collected the one-time reward for this article.
  // Supplied by the parent's batched fetch so the coin animation can start on
  // click rather than after the POST comes back.
  initialRewarded?: boolean;
  // Called after a reaction changed so the parent can update its batched
  // reactionsMap. Without this the parent keeps serving stale initial data and
  // any remount of this card (the feed re-creates its card components on every
  // render) throws away the new count AND the local rewarded flag - which made
  // the coin animation replay on every further click.
  onReactionChange?: (
    articleId: string,
    data: { reactions: Record<string, number>; userReaction: string | null; rewarded: boolean }
  ) => void;
}

const SIZES = {
  xs: 'w-5 h-5',
  sm: 'w-6 h-6',
  md: 'w-7 h-7',
};

const TEXT_SIZES = {
  xs: 'text-[8px]',
  sm: 'text-xs',
  md: 'text-sm',
};

function CardMoodReactionsInner({
  articleId,
  userId,
  isLoggedIn,
  onShowLogin,
  onCoinAnimation,
  size = 'sm',
  useExternalData = false,
  initialReactions,
  initialUserReaction,
  initialRewarded,
  onReactionChange,
}: CardMoodReactionsProps) {
  const [reactions, setReactions] = useState<Record<string, number>>(initialReactions || {});
  const [userReaction, setUserReaction] = useState<string | null>(initialUserReaction ?? null);
  // Kept in a ref, not state: it is only read inside the click handler and must
  // not trigger a re-render of the card (these render by the dozen in the feed).
  const rewardedRef = useRef<boolean>(initialRewarded ?? false);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<string | null>(useExternalData ? articleId : null);
  const isMountedRef = useRef(true);

  const imgSize = SIZES[size];
  const textSize = TEXT_SIZES[size];

  // When in external-data mode, sync local state whenever the parent's
  // batched data updates/refreshes (e.g. once the batch fetch resolves).
  useEffect(() => {
    if (useExternalData) {
      setReactions(initialReactions || {});
      setUserReaction(initialUserReaction ?? null);
      // Never downgrade back to "not rewarded": a click may have already claimed
      // it locally before the parent's refreshed batch arrives.
      if (initialRewarded) rewardedRef.current = true;
    }
  }, [articleId, useExternalData, initialReactions, initialUserReaction, initialRewarded]);

  // Fetch reactions on mount - only once per articleId, and NEVER when the
  // parent has taken over data loading via useExternalData (e.g. WelcomeReel
  // batches all cards' reactions into one request instead of N).
  useEffect(() => {
    if (useExternalData) return;
    isMountedRef.current = true;
    
    // Skip if already fetched for this articleId
    if (fetchedRef.current === articleId) return;
    
    const fetchReactions = async () => {
      try {
        const res = await fetch(`/api/articles/react?articleId=${articleId}&userId=${userId || ''}`);
        const data = await res.json();
        if (isMountedRef.current && data.success) {
          setReactions(data.reactions || {});
          setUserReaction(data.userReaction || null);
          if (data.rewarded) rewardedRef.current = true;
          fetchedRef.current = articleId;
        }
      } catch {
        // Ignore errors
      }
    };
    fetchReactions();
    
    return () => { isMountedRef.current = false; };
  }, [articleId, useExternalData]); // Only depend on articleId, not userId

  const totalReactions = Object.values(reactions).reduce((sum, count) => sum + count, 0);

  // Get top reactions (those with votes > 0), sorted by count.
  // The user's own reaction is pinned first so it is always visible - otherwise
  // it can fall outside the 3 icons we render and it looks like the click was lost.
  const topReactions = Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort((a, b) => {
      if (a[0] === userReaction) return -1;
      if (b[0] === userReaction) return 1;
      return b[1] - a[1];
    });

  const handleReaction = async (emojiId: string) => {
    if (!isLoggedIn || !userId) {
      onShowLogin?.();
      return;
    }

    setLoading(true);
    setShowPicker(false);

    // Optimistic update
    const prevReaction = userReaction;
    const prevReactions = { ...reactions };
    const isRemoving = userReaction === emojiId;

    // Play the coin animation NOW instead of after the round trip. Whether coins
    // are due is fully known client-side: the reward is paid once per article and
    // only when a reaction is set (never on removal). The POST stays the source of
    // truth for the wallet - it just no longer gates the animation, which used to
    // make the reward feel delayed on a slow connection.
    const willEarn = !isRemoving && !rewardedRef.current;
    if (willEarn) {
      rewardedRef.current = true; // claim locally so a second click can't re-animate
      onCoinAnimation?.(REACTION_REWARD);
    }

    // Build the optimistic counts once so the same value can be pushed to the
    // parent - it must not keep serving the pre-click data to a remounted card.
    const optimisticReactions = { ...prevReactions };
    const optimisticUserReaction = isRemoving ? null : emojiId;
    if (isRemoving) {
      optimisticReactions[emojiId] = Math.max(0, (optimisticReactions[emojiId] || 0) - 1);
    } else {
      if (prevReaction) {
        optimisticReactions[prevReaction] = Math.max(0, (optimisticReactions[prevReaction] || 0) - 1);
      }
      optimisticReactions[emojiId] = (optimisticReactions[emojiId] || 0) + 1;
    }

    setUserReaction(optimisticUserReaction);
    setReactions(optimisticReactions);
    onReactionChange?.(articleId, {
      reactions: optimisticReactions,
      userReaction: optimisticUserReaction,
      rewarded: rewardedRef.current,
    });

    try {
      const res = await fetch('/api/articles/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, emojiId, userId }),
      });

      const data = await res.json();
      if (data.success) {
        setReactions(data.reactions);
        setUserReaction(data.userReaction);
        // Normally already animated above. This only fires in the rare case where
        // the server paid out although the client thought it was settled (e.g. the
        // rewarded flag was stale), so no earned coin ever goes unshown.
        if (!willEarn && data.coinsEarned > 0) {
          rewardedRef.current = true;
          onCoinAnimation?.(data.coinsEarned);
        }
        // Push the authoritative result up. `rewarded` is true as soon as a
        // reaction is set: the server pays out at most once per article, so any
        // later click must never animate coins again - not even after a remount.
        onReactionChange?.(articleId, {
          reactions: data.reactions,
          userReaction: data.userReaction,
          rewarded: rewardedRef.current || data.userReaction !== null,
        });
      } else {
        // Revert on error
        setReactions(prevReactions);
        setUserReaction(prevReaction);
        if (willEarn) rewardedRef.current = false; // nothing was claimed after all
        onReactionChange?.(articleId, {
          reactions: prevReactions,
          userReaction: prevReaction,
          rewarded: rewardedRef.current,
        });
      }
    } catch {
      // Revert on error
      setReactions(prevReactions);
      setUserReaction(prevReaction);
      if (willEarn) rewardedRef.current = false;
      onReactionChange?.(articleId, {
        reactions: prevReactions,
        userReaction: prevReaction,
        rewarded: rewardedRef.current,
      });
    } finally {
      setLoading(false);
    }
  };

  const closePicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPicker(false);
  };

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn || !userId) {
      onShowLogin?.();
      return;
    }
    // Calculate position based on button - keep within screen bounds
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const pickerWidth = 340; // Approximate picker width
      const pickerHeight = 90; // Approximate picker height
      let left = rect.left + rect.width / 2;
      let top = rect.top - pickerHeight - 10; // Above the button with gap
      
      // Keep picker within screen bounds horizontally
      if (left - pickerWidth / 2 < 10) {
        left = pickerWidth / 2 + 10; // Don't go past left edge
      } else if (left + pickerWidth / 2 > window.innerWidth - 10) {
        left = window.innerWidth - pickerWidth / 2 - 10; // Don't go past right edge
      }
      
      // If would go above screen, show below button instead
      if (top < 10) {
        top = rect.bottom + 10;
      }
      
      setPickerPosition({ top, left });
    }
    setTimeout(() => setShowPicker(true), 0);
  };

  return (
    <>
      {/* Inline display - shows top voted moods */}
      <button
        ref={buttonRef}
        onClick={openPicker}
        disabled={loading}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        <span className="flex items-center -space-x-2">
          {topReactions.length > 0 ? (
            // Show moods that have votes - use DEFAULT_MOOD if mood not found
            topReactions.slice(0, 3).map(([moodId]) => {
              const mood = getMoodById(moodId) || DEFAULT_MOOD;
              return (
                <img key={moodId} src={mood.image} alt="" className={`${imgSize} rounded-full`} />
              );
            })
          ) : (
            // Default: show single default mood icon
            <img src={DEFAULT_MOOD.image} alt="" className={`${imgSize}`} />
          )}
        </span>
        <span className={`font-medium ${textSize}`}>{totalReactions}</span>
      </button>

      {/* Picker popup - rendered via portal at body level */}
      {showPicker && typeof document !== 'undefined' && createPortal(
        <>
          <div 
            className="fixed inset-0 z-[9999] bg-black/10" 
            onClick={closePicker}
          />
          <div 
            className="fixed z-[10000] px-3 py-2 bg-[#F5F0E8] border border-[#E5DDD0] shadow-xl rounded-xl flex items-center gap-3 -translate-x-1/2"
            style={{ top: pickerPosition.top, left: pickerPosition.left }}
          >
            {GENX_MOODS.map((mood) => {
              // Highlight the mood the user picked, matching the in-article
              // picker: scaled up, ring + shadow, orange label, others dimmed.
              const isSelected = userReaction === mood.id;
              const count = reactions[mood.id] || 0;
              return (
                <button
                  key={mood.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReaction(mood.id);
                  }}
                  className={`flex flex-col items-center transition-all duration-200 ${
                    isSelected ? 'scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <img
                      src={mood.image}
                      alt={mood.label}
                      className={`w-12 h-12 object-contain rounded-full ${
                        isSelected ? 'ring-2 ring-[#E36B11] ring-offset-1 ring-offset-[#F5F0E8] drop-shadow-lg' : ''
                      }`}
                    />
                    {count > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 bg-[#E36B11] rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                        {count}
                      </span>
                    )}
                  </div>
                  <span className={`text-[8px] mt-0.5 whitespace-nowrap ${
                    isSelected ? 'text-[#E36B11] font-bold' : 'text-gray-900'
                  }`}>
                    {mood.label}
                  </span>
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// Memoize to prevent re-renders when parent re-renders
const CardMoodReactions = memo(CardMoodReactionsInner, (prevProps, nextProps) => {
  // Only re-render if articleId, userId, isLoggedIn, or the pre-fetched data changes.
  // initialRewarded is part of the comparison: it decides whether a click pays
  // coins, so a stale value here would let the animation replay.
  return prevProps.articleId === nextProps.articleId && 
         prevProps.userId === nextProps.userId &&
         prevProps.isLoggedIn === nextProps.isLoggedIn &&
         prevProps.useExternalData === nextProps.useExternalData &&
         prevProps.initialReactions === nextProps.initialReactions &&
         prevProps.initialUserReaction === nextProps.initialUserReaction &&
         prevProps.initialRewarded === nextProps.initialRewarded;
});

export default CardMoodReactions;
