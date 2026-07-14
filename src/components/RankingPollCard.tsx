"use client";

import { useState, useEffect } from "react";
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

interface RankingPoll {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  items: RankingItem[];
  totalVotes: number;
  type: 'ranking';
}

interface RankingPollCardProps {
  poll: RankingPoll;
  onPointsAwarded?: (points: number) => void; // Callback with points awarded (0 if already claimed)
  onShowLogin?: () => void; // Callback to show login modal
  onCoinAnimation?: (amount: number) => void; // Callback for coin animation
  isDesktop?: boolean; // Desktop uses compact single-row layout
}

export default function RankingPollCard({ poll, onPointsAwarded, onShowLogin, onCoinAnimation, isDesktop = false }: RankingPollCardProps) {
  const { user } = useAuth();
  const [localPoll, setLocalPoll] = useState(poll);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down'>>({});
  const [votingItem, setVotingItem] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Guards against the race where a user can vote before we've confirmed
  // whether they already voted (existing-vote check is async).
  const [votesLoaded, setVotesLoaded] = useState(false);

  // Debug: log poll data
  useEffect(() => {
    console.log('RankingPollCard received poll:', { _id: poll._id, title: poll.title, itemCount: poll.items?.length });
  }, [poll]);

  // Keep original order from initial load (don't re-sort during session)
  // The items are already sorted by the server
  const sortedItems = localPoll.items || [];

  // Load existing votes
  useEffect(() => {
    setVotesLoaded(false);
    const loadVotes = async () => {
      const visitorId = localStorage.getItem('bogx-visitor-id');
      if (!user?.id && !visitorId) {
        setVotesLoaded(true);
        return;
      }

      try {
        const params = new URLSearchParams();
        if (user?.id) params.set('userId', user.id);
        else if (visitorId) params.set('visitorId', visitorId);

        const res = await fetch(`/api/polls/${poll._id}/vote?${params}`);
        const data = await res.json();
        console.log('Loaded votes:', data);
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
  }, [poll._id, user?.id]);

  const handleVote = async (itemId: string, voteType: 'up' | 'down') => {
    // Block voting until we've confirmed whether the user already voted -
    // prevents the race where a click during the initial load slips through.
    if (!votesLoaded) return;

    // Require login - show modal
    if (!user?.id) {
      setShowLoginModal(true);
      return;
    }

    // Already voted on this item with same type? Do nothing
    if (userVotes[itemId] === voteType) {
      return;
    }

    const oldVoteType = userVotes[itemId];
    const isNewVote = !oldVoteType;

    // OPTIMISTIC UPDATE: apply instantly so the UI + coin animation feel immediate.
    // Rolled back below if the server call fails.
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

    try {
      const res = await fetch(`/api/polls/${poll._id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, optionId: itemId, voteType }),
      });

      const data = await res.json();

      if (!data.success) {
        console.error('Vote failed, rolling back:', data.error);
        rollbackVote(itemId, voteType, oldVoteType);
      }
    } catch (e) {
      console.error('Vote failed, rolling back:', e);
      rollbackVote(itemId, voteType, oldVoteType);
    }
  };

  // Revert an optimistic vote update if the server call fails
  const rollbackVote = (itemId: string, appliedVoteType: 'up' | 'down', previousVoteType?: 'up' | 'down') => {
    setLocalPoll(prev => ({
      ...prev,
      items: prev.items?.map(item => {
        if (item.id !== itemId) return item;
        const reverted = {
          ...item,
          upvotes: appliedVoteType === 'up' ? item.upvotes - 1 : item.upvotes,
          downvotes: appliedVoteType === 'down' ? item.downvotes - 1 : item.downvotes,
        };
        if (previousVoteType) {
          return {
            ...reverted,
            upvotes: previousVoteType === 'up' ? reverted.upvotes + 1 : reverted.upvotes,
            downvotes: previousVoteType === 'down' ? reverted.downvotes + 1 : reverted.downvotes,
          };
        }
        return reverted;
      })
    }));
    setUserVotes(prev => {
      const next = { ...prev };
      if (previousVoteType) next[itemId] = previousVoteType;
      else delete next[itemId];
      return next;
    });
  };


  return (
    <div className="bg-cream rounded-2xl border border-warm overflow-hidden">
      {/* Vote count header */}
      <div className="px-4 py-2 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">{localPoll.totalVotes} total votes</span>
          {Object.keys(userVotes).length > 0 && (
            <span className="text-xs text-[#D4873A] font-medium flex items-center gap-1">
              ✓ You voted
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-[#D4873A]/20">
        {sortedItems.map((item, index) => (
          <RankingItemRow
            key={item.id}
            item={item}
            rank={index + 1}
            userVote={userVotes[item.id]}
            isVoting={votingItem === item.id || !votesLoaded}
            isDesktop={isDesktop}
            onVote={handleVote}
          />
        ))}
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
