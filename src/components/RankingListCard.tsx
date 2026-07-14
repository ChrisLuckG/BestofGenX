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

  // Check if user has voted
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
        if (data.success && data.votes && Object.keys(data.votes).length > 0) {
          setHasVoted(true);
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
          <div className="absolute inset-0 bg-gradient-to-br from-[#D4873A]/20 to-[#D4873A]/5" />
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        
        {/* Content */}
        <div className="absolute inset-0 p-4 flex flex-col justify-between">
          {/* Top Row: Badge + Vote Button - same height as desktop */}
          <div className="flex items-center justify-between">
            <span className="h-6 inline-flex items-center px-2 bg-[#D4873A] text-white text-xs font-display uppercase tracking-wider rounded">
              RANKING
            </span>
            {hasVoted ? (
              <div className="h-6 flex items-center gap-1 bg-[#D4873A] px-2 rounded transition-colors border border-white/30">
                <Check className="w-2.5 h-2.5 text-white" />
                <span className="text-xs font-display text-white uppercase tracking-wider">Voted</span>
                <span className="text-white/60">·</span>
                <Vote className="w-2.5 h-2.5 text-white" />
                <span className="text-xs font-display text-white">{poll.totalVotes}</span>
              </div>
            ) : (
              <div className="h-6 flex items-center gap-1 bg-white/20 backdrop-blur-sm hover:bg-[#D4873A] px-2 rounded transition-all duration-300 border border-white/30">
                <span className="text-xs font-display text-white uppercase tracking-wider">Vote Now</span>
                <span className="text-white/60">·</span>
                <Vote className="w-2.5 h-2.5 text-white/80" />
                <span className="text-xs font-display text-white">{poll.totalVotes}</span>
                <ChevronRight className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          
          {/* Bottom: Title + Stats */}
          <div>
            <h3 className="font-display text-xl text-white group-hover:text-[#D4873A] transition-colors line-clamp-2 leading-tight uppercase">
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
              <RankingItemImage image={item.image} rank={rank} title={item.title} />
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="font-display text-sm text-gray-900 truncate uppercase">{item.title}</h4>
              </div>
              
              {/* Score + Arrow */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1 text-[#D4873A]">
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
      
      {/* Countdown Timer Bar - at bottom, after Top 3 */}
      {countdown && (
        <div className="px-3 py-2.5 flex items-center justify-between bg-[#D4873A]/10 border-t border-[#D4873A]/20">
          {/* Left: Clock + ENDS IN + Time */}
          <div className="flex items-center gap-2">
            <div className="relative flex-shrink-0">
              {!countdown.expired && (
                <span className="absolute inset-0 rounded-full bg-[#D4873A]/40 animate-ping" />
              )}
              <Clock className={`relative w-4 h-4 text-[#D4873A] ${!countdown.expired ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <span className="text-[8px] font-semibold text-gray-600 uppercase tracking-wider block">ENDS IN</span>
              <span className="font-display text-xl text-[#D4873A] tracking-wider tabular-nums">
                {countdown.expired ? 'ENDED' : (
                  <>
                    {countdown.days > 0 && <>{countdown.days}d </>}
                    {countdown.hours.toString().padStart(2, '0')}h {countdown.minutes.toString().padStart(2, '0')}m{' '}
                    <span className="inline-block animate-pulse text-[#C4772A]">{countdown.seconds.toString().padStart(2, '0')}s</span>
                  </>
                )}
              </span>
            </div>
          </div>
          
          {/* Right: Info + Text */}
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-[8px] text-gray-500 leading-tight max-w-[120px]">
              After the deadline, voting remains open and rankings continue to evolve.
            </span>
          </div>
        </div>
      )}
    </button>
  );
}
