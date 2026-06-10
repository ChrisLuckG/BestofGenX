"use client";

import { useState, useEffect, useRef } from "react";
import { GENX_MOODS, DEFAULT_MOOD, getMoodById } from "@/config/moods";

interface EmojiReactionsProps {
  articleId: string;
  userId?: string;
  isLoggedIn: boolean;
  onShowLogin?: () => void;
  initialReactions?: Record<string, number>;
  userReaction?: string | null;
}

export default function EmojiReactions({
  articleId,
  userId,
  isLoggedIn,
  onShowLogin,
  initialReactions = {},
  userReaction: initialUserReaction = null,
}: EmojiReactionsProps) {
  const [reactions, setReactions] = useState<Record<string, number>>(initialReactions);
  const [userReaction, setUserReaction] = useState<string | null>(initialUserReaction);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);

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
    if (!isLoggedIn || !userId) {
      onShowLogin?.();
      return;
    }

    setLoading(true);
    setShowPicker(false);

    // Optimistic update
    const prevReaction = userReaction;
    const prevReactions = { ...reactions };

    if (userReaction === emojiId) {
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
      } else {
        // Revert on error
        setReactions(prevReactions);
        setUserReaction(prevReaction);
      }
    } catch {
      // Revert on error
      setReactions(prevReactions);
      setUserReaction(prevReaction);
    } finally {
      setLoading(false);
    }
  };

  // Get top 3 reactions to display
  const topReactions = Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

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
          <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 bg-[#D4873A] rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-lg">
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
            {GENX_MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => handleReaction(mood.id)}
                className={`flex flex-col items-center transition-transform hover:scale-105 ${
                  userReaction === mood.id ? 'scale-105' : ''
                }`}
              >
                <div className="w-12 h-12 flex items-center justify-center">
                  <img src={mood.image} alt={mood.label} className="w-12 h-12 object-contain" />
                </div>
                <span className="text-[8px] text-gray-900 mt-0.5 whitespace-nowrap">{mood.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
