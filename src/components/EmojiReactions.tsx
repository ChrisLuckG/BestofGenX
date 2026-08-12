"use client";

import { useState, useEffect, useRef } from "react";
import { GENX_MOODS, DEFAULT_MOOD, getMoodById } from "@/config/moods";
import { REACTION_REWARD } from "@/config/rewards";

export interface EmojiReactionsProps {
  articleId: string;
  userId?: string;
  isLoggedIn: boolean;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
  initialReactions?: Record<string, number>;
  userReaction?: string | null;
  showAll?: boolean; // Show all 5 emojis inline instead of picker
}

export default function EmojiReactions({
  articleId,
  userId,
  isLoggedIn,
  onShowLogin,
  onCoinAnimation,
  initialReactions = {},
  userReaction: initialUserReaction = null,
  showAll = false,
}: EmojiReactionsProps) {
  const [reactions, setReactions] = useState<Record<string, number>>(initialReactions);
  const [userReaction, setUserReaction] = useState<string | null>(initialUserReaction);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);
  // Whether this user already collected the one-time reward for this article.
  // Filled by the fetch below and used to fire the coin animation on click
  // instead of waiting for the POST to answer.
  const rewardedRef = useRef(false);

  // Fetch reactions on mount - only once per articleId
  useEffect(() => {
    // Skip if already fetched for this articleId
    if (fetchedRef.current === articleId) return;
    
    let cancelled = false;
    const fetchReactions = async () => {
      try {
        const res = await fetch(`/api/articles/react?articleId=${articleId}&userId=${userId || ''}`);
        const data = await res.json();
        if (!cancelled && data.success) {
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
    return () => { cancelled = true; };
  }, [articleId, userId]);

  const totalReactions = Object.values(reactions).reduce((sum, count) => sum + count, 0);

  const handleReaction = async (emojiId: string) => {
    // Guest user: handle locally with localStorage
    if (!isLoggedIn || !userId) {
      const guestReactedKey = `bogx_guest_reacted_${articleId}`;
      const alreadyReacted = localStorage.getItem(guestReactedKey);
      
      if (alreadyReacted) {
        // Already reacted to this article - just toggle UI
        const isRemoving = userReaction === emojiId;
        if (isRemoving) {
          setUserReaction(null);
          setReactions(prev => ({
            ...prev,
            [emojiId]: Math.max(0, (prev[emojiId] || 0) - 1),
          }));
        } else {
          if (userReaction) {
            setReactions(prev => ({
              ...prev,
              [userReaction]: Math.max(0, (prev[userReaction] || 0) - 1),
            }));
          }
          setUserReaction(emojiId);
          setReactions(prev => ({
            ...prev,
            [emojiId]: (prev[emojiId] || 0) + 1,
          }));
        }
        return;
      }
      
      // First reaction for guest - award coins locally
      localStorage.setItem(guestReactedKey, emojiId);
      const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
      localStorage.setItem('bogx_guest_coins', String(Math.round((guestCoins + REACTION_REWARD) * 100) / 100));
      
      // Update UI immediately
      setUserReaction(emojiId);
      setReactions(prev => ({
        ...prev,
        [emojiId]: (prev[emojiId] || 0) + 1,
      }));
      onCoinAnimation?.(REACTION_REWARD);
      return;
    }

    setLoading(true);
    setShowPicker(false);

    // Optimistic update
    const prevReaction = userReaction;
    const prevReactions = { ...reactions };
    const isRemoving = userReaction === emojiId;

    // Play the coin animation NOW instead of after the round trip. Coins are due
    // once per article and only when a reaction is set (never on removal), so the
    // client can decide this on its own. The POST remains authoritative for the
    // wallet, it just no longer delays the visual feedback.
    const willEarn = !isRemoving && !rewardedRef.current;
    if (willEarn) {
      rewardedRef.current = true;
      onCoinAnimation?.(REACTION_REWARD);
      // Notify leaderboard/rankings to refresh instantly
      window.dispatchEvent(new CustomEvent('bogx-updated'));
    }

    if (isRemoving) {
      // Remove reaction
      setUserReaction(null);
      setReactions(prev => ({
        ...prev,
        [emojiId]: Math.max(0, (prev[emojiId] || 0) - 1),
      }));
    } else {
      // Add/change reaction
      if (prevReaction) {
        setReactions(prev => ({
          ...prev,
          [prevReaction]: Math.max(0, (prev[prevReaction] || 0) - 1),
        }));
      }
      setUserReaction(emojiId);
      setReactions(prev => ({
        ...prev,
        [emojiId]: (prev[emojiId] || 0) + 1,
      }));
    }

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
        // Safety net only: fires when the server paid out although the client
        // believed it was already settled, so no earned coin goes unshown.
        if (!willEarn && data.coinsEarned > 0) {
          rewardedRef.current = true;
          onCoinAnimation?.(data.coinsEarned);
        }
      } else {
        // Revert on error
        setReactions(prevReactions);
        setUserReaction(prevReaction);
        if (willEarn) rewardedRef.current = false;
      }
    } catch {
      // Revert on error
      setReactions(prevReactions);
      setUserReaction(prevReaction);
      if (willEarn) rewardedRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  // Get top 3 reactions to display
  const topReactions = Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Show all 5 emojis inline (for article end)
  if (showAll) {
    return (
      <div className="flex items-center gap-4">
        {GENX_MOODS.map((mood) => {
          const count = reactions[mood.id] || 0;
          const isSelected = userReaction === mood.id;
          return (
            <button
              key={mood.id}
              onClick={() => handleReaction(mood.id)}
              disabled={loading}
              className={`flex flex-col items-center transition-all duration-200 ${
                isSelected ? 'scale-125' : 'hover:scale-110 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="relative">
                <img 
                  src={mood.image} 
                  alt={mood.label} 
                  className={`w-10 h-10 object-contain ${isSelected ? 'drop-shadow-lg' : ''}`} 
                />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 bg-[#E36B11] rounded-full flex items-center justify-center text-white text-[9px] font-bold">
                    {count}
                  </span>
                )}
              </div>
              <span className={`text-[9px] mt-1 whitespace-nowrap ${isSelected ? 'text-[#E36B11] font-bold' : 'text-gray-500'}`}>
                {mood.label}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main button - no background */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        disabled={loading}
        className="relative transition-transform hover:scale-110"
      >
        {topReactions.length > 0 ? (
          <img 
            src={getMoodById(topReactions[0][0])?.image || DEFAULT_MOOD.image} 
            alt="React" 
            className="w-8 h-8 object-contain drop-shadow-lg" 
          />
        ) : (
          <img src={DEFAULT_MOOD.image} alt="React" className="w-8 h-8 object-contain drop-shadow-lg" />
        )}
        {totalReactions > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 bg-[#E36B11] rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
            {totalReactions}
          </span>
        )}
      </button>

      {/* Picker popup - appears above the button */}
      {showPicker && (
        <>
          <div 
            className="fixed inset-0 z-[9999] bg-black/10" 
            onClick={() => setShowPicker(false)}
          />
          <div className="absolute top-full right-0 mt-2 z-[10000] px-3 py-2 bg-cream border border-warm shadow-xl rounded-xl flex items-center gap-3">
            {GENX_MOODS.map((mood) => {
              // Same selected-state treatment as the showAll variant above, so
              // the user can always tell which mood they picked.
              const isSelected = userReaction === mood.id;
              const count = reactions[mood.id] || 0;
              return (
                <button
                  key={mood.id}
                  onClick={() => handleReaction(mood.id)}
                  className={`flex flex-col items-center transition-all duration-200 ${
                    isSelected ? 'scale-110' : 'opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  <div className="relative w-12 h-12 flex items-center justify-center">
                    <img
                      src={mood.image}
                      alt={mood.label}
                      className={`w-12 h-12 object-contain rounded-full ${
                        isSelected ? 'ring-2 ring-[#E36B11] ring-offset-1 ring-offset-cream drop-shadow-lg' : ''
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
        </>
      )}
    </div>
  );
}
