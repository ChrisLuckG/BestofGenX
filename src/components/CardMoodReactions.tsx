"use client";

import { useState, useEffect, useRef } from "react";
import { GENX_MOODS, DEFAULT_MOOD, getMoodById } from "@/config/moods";

interface CardMoodReactionsProps {
  articleId: string;
  userId?: string;
  isLoggedIn: boolean;
  onShowLogin?: () => void;
  size?: 'xs' | 'sm' | 'md';
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

export default function CardMoodReactions({
  articleId,
  userId,
  isLoggedIn,
  onShowLogin,
  size = 'sm',
}: CardMoodReactionsProps) {
  const [reactions, setReactions] = useState<Record<string, number>>({});
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  const imgSize = SIZES[size];
  const textSize = TEXT_SIZES[size];

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

  // Get top reactions (those with votes > 0), sorted by count
  const topReactions = Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

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
    setShowPicker(true);
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

      {/* Picker popup - fixed position above the button */}
      {showPicker && (
        <>
          <div 
            className="fixed inset-0 z-[9999] bg-black/10" 
            onClick={closePicker}
          />
          <div 
            className="fixed z-[10000] px-3 py-2 bg-cream border border-warm shadow-xl rounded-xl flex items-center gap-3 -translate-x-1/2"
            style={{ top: pickerPosition.top, left: pickerPosition.left }}
          >
            {GENX_MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReaction(mood.id);
                }}
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
    </>
  );
}
