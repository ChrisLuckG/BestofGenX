"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, BookOpen } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import AlertModal from "@/components/AlertModal";
import RankingItemRow from "@/components/RankingItemRow";

interface RankingItem {
  id: string;
  title: string;
  description?: string;
  image?: string;
  upvotes: number;
  downvotes: number;
  score: number;
}

interface Poll {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  items?: RankingItem[];
  totalVotes: number;
  linkedArticleId?: string;
  articleImage?: string;
}

interface DesktopRankingDetailPageProps {
  poll: Poll;
  onBack: () => void;
  onOpenArticle?: (articleId: string) => void;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
}

export default function DesktopRankingDetailPage({ poll, onBack, onOpenArticle, onShowLogin, onCoinAnimation }: DesktopRankingDetailPageProps) {
  const { user } = useAuth();
  const [localPoll, setLocalPoll] = useState(poll);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [votingItem, setVotingItem] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | undefined>(undefined);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Guards against the race where a user can vote before we've confirmed
  // whether they already voted (existing-vote check is async).
  const [votesLoaded, setVotesLoaded] = useState(false);

  // Get or create visitor ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      let vid = localStorage.getItem('bogx-visitor-id');
      if (!vid) {
        vid = `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        localStorage.setItem('bogx-visitor-id', vid);
      }
      setVisitorId(vid);
    }
  }, []);

  // Load user's existing votes
  useEffect(() => {
    setVotesLoaded(false);
    const loadVotes = async () => {
      if (!user?.id && !visitorId) {
        setVotesLoaded(true);
        return;
      }
      
      try {
        const params = new URLSearchParams();
        if (user?.id) params.set('userId', user.id);
        if (visitorId) params.set('visitorId', visitorId);
        
        const res = await fetch(`/api/polls/${poll._id}/vote?${params}`);
        const data = await res.json();
        
        if (data.success && data.votes) {
          setUserVotes(data.votes);
        }
      } catch (e) {
        console.error('Failed to load votes:', e);
      } finally {
        setVotesLoaded(true);
      }
    };
    
    loadVotes();
  }, [poll._id, user?.id, visitorId]);

  const handleVote = async (itemId: string, voteType: 'up' | 'down') => {
    console.log('Desktop handleVote:', { itemId, voteType, userId: user?.id, userVotes });
    
    // Block voting until we've confirmed whether the user already voted -
    // prevents the race where a click during the initial load slips through.
    if (!votesLoaded) return;
    
    // Require login
    if (!user?.id) {
      console.log('No user, showing login modal');
      setShowLoginModal(true);
      return;
    }
    
    // Already voted same type? Do nothing
    if (userVotes[itemId] === voteType) {
      return;
    }

    const oldVoteType = userVotes[itemId];
    const isNewVote = !oldVoteType;

    // OPTIMISTIC UPDATE: apply instantly for immediate feedback, rollback on failure
    setLocalPoll(prev => ({
      ...prev,
      items: prev.items?.map(item => {
        if (item.id !== itemId) return item;
        if (oldVoteType) {
          return {
            ...item,
            upvotes: oldVoteType === 'up' ? item.upvotes - 1 : (voteType === 'up' ? item.upvotes + 1 : item.upvotes),
            downvotes: oldVoteType === 'down' ? item.downvotes - 1 : (voteType === 'down' ? item.downvotes + 1 : item.downvotes),
          };
        }
        return {
          ...item,
          upvotes: voteType === 'up' ? item.upvotes + 1 : item.upvotes,
          downvotes: voteType === 'down' ? item.downvotes + 1 : item.downvotes,
        };
      })
    }));
    setUserVotes(prev => ({ ...prev, [itemId]: voteType }));
    if (isNewVote) {
      onCoinAnimation?.(0.01);
    }

    const rollback = () => {
      setLocalPoll(prev => ({
        ...prev,
        items: prev.items?.map(item => {
          if (item.id !== itemId) return item;
          const reverted = {
            ...item,
            upvotes: voteType === 'up' ? item.upvotes - 1 : item.upvotes,
            downvotes: voteType === 'down' ? item.downvotes - 1 : item.downvotes,
          };
          if (oldVoteType) {
            return {
              ...reverted,
              upvotes: oldVoteType === 'up' ? reverted.upvotes + 1 : reverted.upvotes,
              downvotes: oldVoteType === 'down' ? reverted.downvotes + 1 : reverted.downvotes,
            };
          }
          return reverted;
        })
      }));
      setUserVotes(prev => {
        const next = { ...prev };
        if (oldVoteType) next[itemId] = oldVoteType;
        else delete next[itemId];
        return next;
      });
    };

    try {
      const res = await fetch(`/api/polls/${poll._id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId: itemId,
          userId: user?.id,
          visitorId,
          voteType,
        }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        console.error('Vote failed, rolling back:', data.error);
        rollback();
      }
    } catch (e) {
      console.error('Vote failed, rolling back:', e);
      rollback();
    }
  };

  // Sort items by upvotes (highest first)
  const sortedItems = [...(localPoll.items || [])].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

  // Show skeleton while loading votes
  if (!votesLoaded) {
    return (
      <div className="h-full flex flex-col bg-[#F5F0E8] overflow-hidden animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
          <div className="w-8 h-8 rounded-lg bg-skeleton" />
          <div className="flex-1">
            <div className="h-3 w-16 bg-skeleton rounded mb-2" />
            <div className="h-6 w-48 bg-skeleton rounded" />
          </div>
        </div>
        {/* Description Skeleton */}
        <div className="px-4 py-3 border-b border-warm">
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-lg bg-skeleton" />
            <div className="flex-1">
              <div className="h-4 w-full bg-skeleton rounded mb-2" />
              <div className="h-4 w-3/4 bg-skeleton rounded mb-2" />
              <div className="h-3 w-20 bg-skeleton rounded" />
            </div>
          </div>
        </div>
        {/* Items Skeleton */}
        <div className="flex-1 p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 bg-cream rounded-xl border border-warm">
              <div className="w-8 h-8 rounded-full bg-skeleton" />
              <div className="w-12 h-12 rounded-lg bg-skeleton" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-skeleton rounded mb-1" />
                <div className="h-3 w-48 bg-skeleton rounded" />
              </div>
              <div className="flex gap-2">
                <div className="w-16 h-8 rounded-lg bg-skeleton" />
                <div className="w-16 h-8 rounded-lg bg-skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F5F0E8] overflow-hidden">
      {/* Header - sticky like other pages */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-[#F5F0E8]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-cream border border-warm hover:bg-[#E36B11]/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Rankroll</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Vote & rank your favorites</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E36B11] rounded-lg shadow-sm">
            <span className="text-sm">🪙</span>
            <span className="text-xs font-bold text-white">
              {(Object.keys(userVotes).length * 0.01).toFixed(2)} of {((poll.items?.length || 0) * 0.01).toFixed(2)} BOGX
            </span>
          </div>
          {poll.linkedArticleId && onOpenArticle && (
            <button
              onClick={() => onOpenArticle(String(poll.linkedArticleId))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E36B11]/10 text-[#E36B11] text-xs font-semibold rounded-lg hover:bg-[#E36B11]/20 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              Read Story
            </button>
          )}
        </div>
      </div>

      {/* Title + Subtitle/Description with Image */}
      <div className="px-4 py-3 border-b border-warm">
        <h1 className="font-display text-2xl text-gray-900 uppercase mb-3">{poll.title}</h1>
        <div className="flex items-start gap-4">
          {/* Article Image */}
          {poll.articleImage && (
            <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-skeleton">
              <img src={poll.articleImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {(poll.subtitle || poll.description) && (
              <p className="text-sm text-gray-600">{poll.subtitle || poll.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{localPoll.totalVotes} total votes</p>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="divide-y divide-warm">
          {sortedItems.map((item, index) => (
            <RankingItemRow
              key={item.id}
              item={item}
              rank={index + 1}
              userVote={userVotes[item.id]}
              isVoting={votingItem === item.id || !votesLoaded}
              isDesktop={true}
              onVote={handleVote}
            />
          ))}
        </div>
      </div>

      {/* Login Required Modal */}
      <AlertModal
        show={showLoginModal}
        type="login"
        title="LOGIN REQUIRED"
        message="Log in or create a free account to vote and earn BOGX."
        onClose={() => setShowLoginModal(false)}
        buttonText="LOGIN"
        onButtonClick={() => {
          setShowLoginModal(false);
          onShowLogin?.();
        }}
        embedded
      />
    </div>
  );
}
