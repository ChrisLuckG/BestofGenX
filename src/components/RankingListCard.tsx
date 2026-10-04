"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Vote, Check, Clock, Info } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import RankingItemImage from "@/components/RankingItemImage";

interface RankingItem {
  id: string;
  title: string;
  description?: string;
  image?: string;
  videoUrl?: string;
  upvotes: number;
  downvotes: number;
  score: number;
}

interface RankingList {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  articleImage?: string; // Cover image from linked article
  items: RankingItem[];
  totalVotes: number;
  status: 'active' | 'closed' | 'draft';
  linkedArticleId?: string;
  closesAt?: string; // ISO date string for countdown
}

// Countdown helper
function formatCountdown(endsAt: string): { days: number; hours: number; minutes: number; seconds: number; expired: boolean } {
  const now = new Date().getTime();
  const end = new Date(endsAt).getTime();
  const diff = end - now;
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds, expired: false };
}

interface RankingListCardProps {
  poll: RankingList;
  userId?: string;
  visitorId?: string;
  onOpenArticle?: (articleId: string) => void;
  onOpenRankroll?: (pollId: string) => void;
  onCoinAnimation?: (amount: number) => void;
}

export default function RankingListCard({ poll, onOpenArticle, onOpenRankroll, onCoinAnimation }: RankingListCardProps) {
  const { user } = useAuth();
  const [linkedArticleId, setLinkedArticleId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; expired: boolean } | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!poll.closesAt) return;
    
    const updateCountdown = () => {
      setCountdown(formatCountdown(poll.closesAt!));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [poll.closesAt]);

  // Find the article that links to this poll
  useEffect(() => {
    const findLinkedArticle = async () => {
      try {
        const res = await fetch(`/api/articles?linkedContentId=${poll._id}&limit=1`);
        const data = await res.json();
        if (data.success && data.articles?.length > 0) {
          setLinkedArticleId(data.articles[0]._id);
        }
      } catch (e) {
        console.error('Failed to find linked article:', e);
      }
    };
    findLinkedArticle();
  }, [poll._id]);

  // Check if user has voted and how many
  const [votedCount, setVotedCount] = useState(0);
  useEffect(() => {
    const checkVotes = async () => {
      const visitorId = localStorage.getItem('bogx-visitor-id');
      if (!user?.id && !visitorId) return;

      try {
        const params = new URLSearchParams();
        if (user?.id) params.set('userId', user.id);
        else if (visitorId) params.set('visitorId', visitorId);

        const res = await fetch(`/api/polls/${poll._id}/vote?${params}`);
        const data = await res.json();
        if (data.success && data.votes) {
          const count = Object.keys(data.votes).length;
          if (count > 0) {
            setHasVoted(true);
            setVotedCount(count);
          }
        }
      } catch (e) {
        console.error('Failed to check votes:', e);
      }
    };
    checkVotes();
  }, [poll._id, user?.id]);

  // Sort items by upvotes (highest first) - show top 3 preview
  const sortedItems = [...(poll.items || [])].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 3);

  const handleClick = () => {
    if (linkedArticleId && onOpenArticle) {
      onOpenArticle(linkedArticleId);
    } else if (onOpenRankroll) {
      onOpenRankroll(poll._id);
    }
  };

  return (
    <button 
      onClick={handleClick}
      disabled={!linkedArticleId && !onOpenRankroll}
      className="w-full text-left rounded-2xl overflow-hidden hover:shadow-lg transition-all group border border-warm"
    >
      {/* Header with Background Image - use articleImage, fallback to image, then first item */}
      <div className="relative aspect-[16/9]">
        {(poll.articleImage || poll.image || poll.items?.[0]?.image) ? (
          <img src={poll.articleImage || poll.image || poll.items?.[0]?.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#E36B11]/20 to-[#E36B11]/5" />
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        
        {/* Content */}
        <div className="absolute inset-0 p-4 flex flex-col justify-between">
          {/* Top Row: countdown badge (left) + vote button (right). The orange
              "RANKING" badge that used to sit on the left is gone - it labelled
              the card as a ranking on a page that only shows rankings. The
              countdown, which used to live in its own bar below the Top 3 list,
              now fills that same left slot instead, since it is the only other
              badge-like element this card has. */}
          <div className="flex items-center justify-between">
            {countdown ? (
              <div className="h-6 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 rounded border border-white/20">
                <span className="relative flex-shrink-0 flex items-center justify-center">
                  {!countdown.expired && (
                    <span className="absolute inset-0 rounded-full bg-[#E36B11]/40 animate-ping" />
                  )}
                  <Clock className={`relative w-3 h-3 text-[#E36B11] ${!countdown.expired ? 'animate-pulse' : ''}`} />
                </span>
                <span className="font-display text-xs text-white tracking-wider tabular-nums">
                  {countdown.expired ? 'ENDED' : (
                    <>
                      {countdown.days > 0 && <>{countdown.days}d </>}
                      {countdown.hours.toString().padStart(2, '0')}h {countdown.minutes.toString().padStart(2, '0')}m
                    </>
                  )}
                </span>
              </div>
            ) : <span />}
            {hasVoted ? (
              <div className="h-6 flex items-center gap-1 bg-[#E36B11] px-2 rounded transition-colors border border-white/30">
                <span className="text-sm">🪙</span><span className="text-xs font-display text-white">{(votedCount * 0.01).toFixed(2)}/{((poll.items?.length || 0) * 0.01).toFixed(2)} BOGX</span>
                <span className="text-white/60">·</span>
                <Vote className="w-2.5 h-2.5 text-white" />
                <span className="text-xs font-display text-white">{poll.totalVotes}</span>
              </div>
            ) : (
              <div className="h-6 flex items-center gap-1 bg-white/20 backdrop-blur-sm hover:bg-[#E36B11] px-2 rounded transition-all duration-300 border border-white/30">
                <span className="text-sm">🪙</span><span className="text-xs font-display text-white">0/{((poll.items?.length || 0) * 0.01).toFixed(2)} BOGX</span>
                <span className="text-white/60">·</span>
                <Vote className="w-2.5 h-2.5 text-white/80" />
                <span className="text-xs font-display text-white">{poll.totalVotes}</span>
                <ChevronRight className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          
          {/* Bottom: Title + Stats */}
          <div>
            <h3 className="font-display text-2xl md:text-3xl text-white group-hover:text-[#E36B11] transition-colors line-clamp-2 leading-tight uppercase">
              {poll.title}
            </h3>
          </div>
        </div>
      </div>

      {/* Top 3 Preview - fixed height */}
      <div className="bg-cream h-[168px]">
        {sortedItems.map((item, index) => {
          const rank = index + 1;
          
          return (
            <div key={item.id} className="px-3 h-[56px] flex items-center gap-3 border-b border-warm last:border-b-0">
              <RankingItemImage image={item.image} videoUrl={item.videoUrl} rank={rank} title={item.title} disableVideo={true} />
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-display text-sm text-gray-900 truncate uppercase">{item.title}</h4>
              </div>
              
              {/* Score + Arrow */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-[#E36B11]">
                  <span className="text-xs">↑</span>
                  <span className="font-bold text-sm">{item.upvotes || 0}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </div>
          );
        })}
        {/* Fill empty slots if less than 3 items */}
        {Array.from({ length: Math.max(0, 3 - sortedItems.length) }).map((_, idx) => (
          <div key={`empty-${idx}`} className="px-3 h-[56px] flex items-center gap-3 border-b border-warm last:border-b-0">
            <div className="w-16 h-10 rounded bg-skeleton" />
            <div className="flex-1">
              <div className="w-20 h-4 bg-skeleton rounded" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Countdown explainer - at bottom, after Top 3. The actual time now lives
          in the badge on the image (top row), so this bar only carries the
          "what happens after" note that badge has no room for. */}
      {countdown && (
        <div className="px-3 py-2 flex items-center gap-1.5 bg-[#E36B11]/10 border-t border-[#E36B11]/20">
          <Info className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
          <span className="text-[8px] text-gray-500 leading-tight">
            After the deadline, voting remains open and rankings continue to evolve.
          </span>
        </div>
      )}
    </button>
  );
}
