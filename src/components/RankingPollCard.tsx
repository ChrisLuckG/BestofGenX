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

  // Debug: log poll data
  useEffect(() => {
    console.log('RankingPollCard received poll:', { _id: poll._id, title: poll.title, itemCount: poll.items?.length });
  }, [poll]);

  // Keep original order from initial load (don't re-sort during session)
  // The items are already sorted by the server
  const sortedItems = localPoll.items || [];

  // Load existing votes
  useEffect(() => {
    const loadVotes = async () => {
      const visitorId = localStorage.getItem('bogx-visitor-id');
      if (!user?.id && !visitorId) return;

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
      }
    };
    loadVotes();
  }, [poll._id, user?.id]);

  const handleVote = async (itemId: string, voteType: 'up' | 'down') => {
    console.log('handleVote called:', { itemId, voteType, userId: user?.id, currentVotes: userVotes });
    
    // Require login - show modal
    if (!user?.id) {
      console.log('No user, showing login modal');
      setShowLoginModal(true);
      return;
    }

    // Already voted on this item with same type? Do nothing
    if (userVotes[itemId] === voteType) {
      console.log('Already voted same type, skipping');
      return;
    }
    
    // Already voted with different type? Allow changing vote (no extra coins)
    const isChangingVote = !!userVotes[itemId];

    setVotingItem(itemId);

    const requestBody = {
      userId: user.id,
      optionId: itemId,
      voteType,
    };
    console.log('Sending vote:', { pollId: poll._id, ...requestBody });

    try {
      const res = await fetch(`/api/polls/${poll._id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();
      console.log('Vote response:', data);
      
      if (data.success) {
        const oldVoteType = userVotes[itemId];
        
        // Update vote counts locally but DON'T re-sort the list
        setLocalPoll(prev => ({
          ...prev,
          items: prev.items?.map(item => {
            if (item.id !== itemId) return item;
            
            // If changing vote, remove old and add new
            if (oldVoteType) {
              return {
                ...item,
                upvotes: oldVoteType === 'up' ? item.upvotes - 1 : (voteType === 'up' ? item.upvotes + 1 : item.upvotes),
                downvotes: oldVoteType === 'down' ? item.downvotes - 1 : (voteType === 'down' ? item.downvotes + 1 : item.downvotes),
              };
            }
            
            // New vote
            return { 
              ...item, 
              upvotes: voteType === 'up' ? item.upvotes + 1 : item.upvotes,
              downvotes: voteType === 'down' ? item.downvotes + 1 : item.downvotes,
            };
          })
        }));
        
        // Mark the vote locally
        setUserVotes(prev => ({ ...prev, [itemId]: voteType }));
        
        // Award coins only for first vote (data.coinsAwarded will be 0 for vote changes)
        if (data.coinsAwarded > 0) {
          onCoinAnimation?.(data.coinsAwarded);
        }
      } else {
        console.error('Vote failed:', data.error);
      }
    } catch (e) {
      console.error('Vote failed:', e);
    } finally {
      setVotingItem(null);
    }
  };


  return (
    <div className="bg-cream rounded-2xl border border-warm overflow-hidden">
      {/* Vote count header - minimal */}
      <div className="px-4 py-2 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent flex items-center justify-between">
        <span className="text-xs text-gray-900">{localPoll.totalVotes} total votes</span>
        {Object.keys(userVotes).length > 0 && (
          <span className="text-xs text-[#D4873A] font-medium flex items-center gap-1">
            ✓ You voted
          </span>
        )}
      </div>

      {/* Items */}
      <div className="divide-y divide-[#D4873A]/20">
        {sortedItems.map((item, index) => (
          <RankingItemRow
            key={item.id}
            item={item}
            rank={index + 1}
            userVote={userVotes[item.id]}
            isVoting={votingItem === item.id}
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
        message="Log in or create a free account to vote and earn points."
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
