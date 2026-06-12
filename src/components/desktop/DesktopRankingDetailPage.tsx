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
    const loadVotes = async () => {
      if (!user?.id && !visitorId) return;
      
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
      }
    };
    
    loadVotes();
  }, [poll._id, user?.id, visitorId]);

  const handleVote = async (itemId: string, voteType: 'up' | 'down') => {
    console.log('Desktop handleVote:', { itemId, voteType, userId: user?.id, userVotes });
    
    // Require login
    if (!user?.id) {
      console.log('No user, showing login modal');
      setShowLoginModal(true);
      return;
    }
    
    // Already voted same type? Do nothing
    if (userVotes[itemId] === voteType) {
      console.log('Already voted same type, skipping');
      return;
    }
    
    if (votingItem) {
      console.log('Already voting');
      return;
    }
    
    const oldVoteType = userVotes[itemId];
    setVotingItem(itemId);
    
    try {
      console.log('Voting:', { pollId: poll._id, itemId, voteType, userId: user?.id, visitorId, changing: !!oldVoteType });
      
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
      console.log('Vote response:', data);
      
      if (data.success) {
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
        setUserVotes({ ...userVotes, [itemId]: voteType });
        
        // Award coins only for first vote
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

  // Sort items by upvotes (highest first)
  const sortedItems = [...(localPoll.items || [])].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

  return (
    <div className="h-full flex flex-col bg-[#F5F0E8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-cream border border-warm hover:bg-[#D4873A]/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-[#D4873A] uppercase tracking-wider">RANKING</span>
          <h1 className="font-bold text-gray-900 truncate">{poll.title}</h1>
        </div>
        {poll.linkedArticleId && onOpenArticle && (
          <button
            onClick={() => onOpenArticle(String(poll.linkedArticleId))}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D4873A]/10 text-[#D4873A] text-xs font-semibold rounded-lg hover:bg-[#D4873A]/20 transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            Read Story
          </button>
        )}
      </div>

      {/* Description with Image */}
      <div className="px-4 py-3 border-b border-warm bg-[#D4873A]/[0.02]">
        <div className="flex items-start gap-4">
          {/* Article Image */}
          {poll.articleImage && (
            <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-skeleton">
              <img src={poll.articleImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {poll.description && (
              <p className="text-sm text-gray-600">{poll.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{localPoll.totalVotes} total votes</p>
          </div>
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-transparent to-[#D4873A]/[0.03]" style={{ scrollbarWidth: 'none' }}>
        <div className="divide-y divide-warm">
          {sortedItems.map((item, index) => (
            <RankingItemRow
              key={item.id}
              item={item}
              rank={index + 1}
              userVote={userVotes[item.id]}
              isVoting={votingItem === item.id}
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
