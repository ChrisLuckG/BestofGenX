"use client";

import { useState, useEffect } from "react";
import { Vote, ChevronRight, Clock, Check, Filter } from "lucide-react";
import { PollsSkeleton } from "./DesktopSkeletons";
import { useAuth } from "@/context/AuthContext";

interface PollOption {
  id: string;
  label: string;
  emoji?: string;
  votes: number;
}

interface Poll {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: 'simple' | 'quiz' | 'ranking';
  totalVotes: number;
  items?: any[];
  options?: PollOption[]; // For simple polls
  linkedArticleId?: string;
  image?: string; // Main thumbnail/cover image
  articleImage?: string; // Cover image from linked article
  closesAt?: string; // ISO date string for countdown
}

// Countdown helper
function useCountdown(endsAt?: string) {
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number; expired: boolean } | null>(null);
  
  useEffect(() => {
    if (!endsAt) {
      setCountdown(null);
      return;
    }
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(endsAt).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      });
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [endsAt]);
  
  return countdown;
}

// Ranking Card - Image block left, content right
function RankingCard({ poll, onOpenArticle, onOpenRankroll }: { poll: Poll; onOpenArticle?: (articleId: string) => void; onOpenRankroll?: (poll: Poll) => void }) {
  const { user } = useAuth();
  const countdown = useCountdown(poll.closesAt);
  const top3 = [...(poll.items || [])].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 3);
  const [linkedArticleId, setLinkedArticleId] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  
  // Check if user has already voted
  useEffect(() => {
    const checkVotes = async () => {
      if (!poll._id) return;
      const params = new URLSearchParams();
      if (user?.id) params.set('userId', user.id);
      else {
        const visitorId = localStorage.getItem('visitorId');
        if (visitorId) params.set('visitorId', visitorId);
      }
      if (!params.toString()) return;
      
      try {
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
  
  const handleClick = () => {
    if (linkedArticleId && onOpenArticle) {
      onOpenArticle(linkedArticleId);
    } else if (onOpenRankroll) {
      // Pass the already-loaded poll object directly — no need to refetch
      // the same data we already have, which was causing a 1-2s delay.
      onOpenRankroll(poll);
    }
  };
  
  return (
    <button
      onClick={handleClick}
      className="w-full text-left rounded-xl overflow-hidden hover:shadow-[0_8px_30px_rgba(212,135,58,0.3)] hover:border-[#E36B11] hover:-translate-y-1.5 transition-all duration-300 group border-2 border-warm bg-cream flex"
    >
      {/* Left: Large Image Block with Timer */}
      <div className="w-48 flex-shrink-0 relative overflow-hidden">
        {(poll.articleImage || poll.image || poll.items?.[0]?.image) ? (
          <img src={poll.articleImage || poll.image || poll.items?.[0]?.image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#E36B11]/40 to-[#E36B11]/20" />
        )}
        {/* Timer at bottom of image */}
        {countdown && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-3 py-4  transition-colors duration-300">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-white/70 group-hover:text-[#E36B11] transition-colors duration-300" />
              <div>
                <span className="text-[9px] text-white/90 uppercase tracking-wider block font-semibold group-hover:text-[#E36B11] transition-colors duration-300">ENDS IN</span>
                <span className="font-display text-xl text-white tracking-wider group-hover:text-[#E36B11] transition-colors duration-300">
                  {countdown.expired ? 'ENDED' : (
                    <>
                      {countdown.days > 0 && <>{countdown.days}d </>}
                      {countdown.hours.toString().padStart(2, '0')}h {countdown.minutes.toString().padStart(2, '0')}m {countdown.seconds.toString().padStart(2, '0')}s
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Right: Header + Items */}
      <div className="flex-1 flex flex-col">
        {/* Header Row */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#E36B11]/10 border-b border-[#E36B11]/20">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-[#E36B11]" />
            <div>
              <h4 className="font-display text-lg text-gray-900 group-hover:text-[#E36B11] transition-colors duration-200 uppercase leading-tight">
                {poll.title}
              </h4>
                          </div>
          </div>
          
          {/* Right: Vote Button */}
          {hasVoted ? (
            <span className="px-4 py-2 bg-[#E36B11]/20 text-[#E36B11] border border-[#E36B11]/30 font-display text-sm uppercase tracking-wider rounded-lg flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Voted
              <span className="text-[#E36B11]/40">·</span>
              <Vote className="w-3.5 h-3.5 text-[#E36B11]/60" />
              <span>{poll.totalVotes}</span>
            </span>
          ) : (
            <span className="px-4 py-2 bg-[#E36B11] text-white font-display text-sm uppercase tracking-wider rounded-lg group-hover:bg-[#B5682A] group-hover:scale-105 group-hover:shadow-lg transition-all duration-200 flex items-center gap-1.5">
              Vote Now
              <span className="text-white/60">·</span>
              <Vote className="w-3.5 h-3.5 text-white/80" />
              <span>{poll.totalVotes}</span>
            </span>
          )}
        </div>
        
        {/* Items List */}
        <div className="bg-cream flex-1">
          {top3.map((item, idx) => {
            const rank = idx + 1;
            return (
              <div key={item.id} className="flex items-center gap-4 px-4 py-2 border-b border-warm last:border-b-0">
                {/* Rank Badge */}
                <span className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                  rank === 1 ? 'bg-[#E36B11]' : 'bg-gray-400'
                }`}>
                  {rank.toString().padStart(2, '0')}
                </span>
                {/* Image - zooms on card hover */}
                <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0">
                  {item.image ? (
                    <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                      {item.title?.charAt(0)}
                    </div>
                  )}
                </div>
                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-gray-900 text-sm truncate uppercase">{item.title}</p>
                </div>
                {/* Score */}
                <div className="flex items-center gap-1 text-[#E36B11] flex-shrink-0">
                  <span className="text-xs">↑</span>
                  <span className="font-bold text-sm">{item.upvotes || 0}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            );
          })}
        </div>
      </div>
    </button>
  );
}

// Simple Poll Card - Image block left, content right (same layout as RankingCard)
function SimplePollCard({ poll, onClick }: { poll: Poll; onClick: () => void }) {
  const { user } = useAuth();
  const countdown = useCountdown(poll.closesAt);
  const options = poll.options || [];
  const totalVotes = poll.totalVotes || 0;
  const [hasVoted, setHasVoted] = useState(false);
  
  // Check if user has already voted
  useEffect(() => {
    const checkVotes = async () => {
      if (!poll._id) return;
      const params = new URLSearchParams();
      if (user?.id) params.set('userId', user.id);
      else {
        const visitorId = localStorage.getItem('visitorId');
        if (visitorId) params.set('visitorId', visitorId);
      }
      if (!params.toString()) return;
      
      try {
        const res = await fetch(`/api/polls/${poll._id}/vote?${params}`);
        const data = await res.json();
        if (data.success && (data.hasVoted || (data.votes && Object.keys(data.votes).length > 0))) {
          setHasVoted(true);
        }
      } catch (e) {
        console.error('Failed to check votes:', e);
      }
    };
    checkVotes();
  }, [poll._id, user?.id]);
  
  // Get percentage for each option
  const getPercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((votes / totalVotes) * 100);
  };
  
  // Sort by votes and take top 3
  const topOptions = [...options].sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 3);
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl overflow-hidden hover:shadow-xl hover:border-[#E36B11]/50 transition-all duration-300 group border border-warm bg-cream flex"
    >
      {/* Left: Large Image Block with Timer */}
      <div className="w-48 flex-shrink-0 relative overflow-hidden">
        {(poll.articleImage || poll.image || poll.items?.[0]?.image) ? (
          <img src={poll.articleImage || poll.image || poll.items?.[0]?.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#E36B11]/40 to-[#E36B11]/20" />
        )}
        {/* Timer at bottom of image */}
        {countdown && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-3 py-4  transition-colors duration-300">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-white/70 group-hover:text-[#E36B11] transition-colors duration-300" />
              <div>
                <span className="text-[9px] text-white/90 uppercase tracking-wider block font-semibold group-hover:text-[#E36B11] transition-colors duration-300">ENDS IN</span>
                <span className="font-display text-xl text-white tracking-wider group-hover:text-[#E36B11] transition-colors duration-300">
                  {countdown.expired ? 'ENDED' : (
                    <>
                      {countdown.days > 0 && <>{countdown.days}d </>}
                      {countdown.hours.toString().padStart(2, '0')}h {countdown.minutes.toString().padStart(2, '0')}m {countdown.seconds.toString().padStart(2, '0')}s
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Right: Header + Options */}
      <div className="flex-1 flex flex-col">
        {/* Header Row */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#E36B11]/10 border-b border-[#E36B11]/20">
          {/* Left: Icon + Title */}
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-[#E36B11]" />
            <div>
              <h4 className="font-display text-lg text-gray-900 group-hover:text-[#E36B11] transition-colors uppercase leading-tight">
                {poll.title}
              </h4>
                          </div>
          </div>
          
          {/* Right: Vote Button */}
          {hasVoted ? (
            <span className="px-4 py-2 bg-[#E36B11]/20 text-[#E36B11] border border-[#E36B11]/30 font-display text-sm uppercase tracking-wider rounded-lg flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Voted
              <span className="text-[#E36B11]/40">·</span>
              <Vote className="w-3.5 h-3.5 text-[#E36B11]/60" />
              <span>{totalVotes}</span>
            </span>
          ) : (
            <span className="px-4 py-2 bg-[#E36B11] text-white font-display text-sm uppercase tracking-wider rounded-lg group-hover:bg-[#C4772A] transition-colors flex items-center gap-1.5">
              Vote Now
              <span className="text-white/60">·</span>
              <Vote className="w-3.5 h-3.5 text-white/80" />
              <span>{totalVotes}</span>
            </span>
          )}
        </div>
        
        {/* Options List */}
        <div className="bg-cream flex-1">
          {topOptions.map((option, idx) => {
            const percentage = getPercentage(option.votes || 0);
            return (
              <div key={option.id} className="flex items-center gap-4 px-4 h-[56px] border-b border-warm last:border-b-0 relative overflow-hidden">
                {/* Progress bar background */}
                <div 
                  className="absolute inset-y-0 left-0 bg-[#E36B11]/10 transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
                {/* Content */}
                <div className="relative flex items-center gap-3 flex-1 min-w-0">
                  {option.emoji && <span className="text-xl">{option.emoji}</span>}
                  <p className="font-display text-gray-900 text-sm truncate uppercase">{option.label}</p>
                </div>
                {/* Percentage */}
                <div className="relative flex items-center gap-3 flex-shrink-0">
                  <span className="font-bold text-sm text-[#E36B11]">{percentage}%</span>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </button>
  );
}

interface DesktopRankrollPageProps {
  onOpenArticle?: (articleId: string) => void;
  onOpenRankroll?: (poll: Poll) => void;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
}

export default function DesktopRankrollPage({ onOpenArticle, onOpenRankroll }: DesktopRankrollPageProps) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterNotVoted, setFilterNotVoted] = useState(false);
  const [votedPolls, setVotedPolls] = useState<Set<string>>(new Set());

  const loadPolls = async () => {
    try {
      const res = await fetch("/api/polls?status=active");
      const data = await res.json();
      if (data.success) {
        setPolls(data.polls || []);
      }
    } catch (e) {
      console.error("Failed to load polls:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, []);

  // Check which polls user has voted on
  useEffect(() => {
    const checkVotes = async () => {
      if (polls.length === 0) return;
      const vid = localStorage.getItem('bogx-visitor-id');
      if (!user?.id && !vid) return;

      const voted = new Set<string>();
      for (const poll of polls) {
        try {
          const params = new URLSearchParams();
          if (user?.id) params.set('userId', user.id);
          else if (vid) params.set('visitorId', vid);

          const res = await fetch(`/api/polls/${poll._id}/vote?${params}`);
          const data = await res.json();
          if (data.success && data.votes && Object.keys(data.votes).length > 0) {
            voted.add(poll._id);
          }
        } catch (e) {
          // ignore
        }
      }
      setVotedPolls(voted);
    };
    checkVotes();
  }, [polls, user?.id]);

  // Filter to only show ranking type polls
  const allRankingPolls = polls.filter(p => p.type === 'ranking');
  const allOtherPolls = polls.filter(p => p.type !== 'ranking');
  
  // Apply not-voted filter
  const rankingPolls = filterNotVoted 
    ? allRankingPolls.filter(p => !votedPolls.has(p._id))
    : allRankingPolls;
  const otherPolls = filterNotVoted 
    ? allOtherPolls.filter(p => !votedPolls.has(p._id))
    : allOtherPolls;

  return (
    <div className="h-full flex flex-col bg-[#F5F0E8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Vote className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Rankroll</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Vote & rank your favorites</span>
          </div>
        </div>
        <button
          onClick={() => setFilterNotVoted(!filterNotVoted)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterNotVoted 
              ? 'bg-[#E36B11] text-white' 
              : 'bg-[#E36B11]/10 text-[#E36B11] hover:bg-[#E36B11]/20'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Not Voted
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-gradient-to-b from-transparent to-[#E36B11]/[0.03]" style={{ scrollbarWidth: "none" }}>

        {loading ? (
          <PollsSkeleton />
        ) : rankingPolls.length === 0 && otherPolls.length === 0 ? (
          <div className="text-center py-12">
            <Vote className={`w-10 h-10 mx-auto mb-3 ${filterNotVoted ? 'text-[#E36B11]' : 'text-[#E36B11]/30'}`} />
            {filterNotVoted ? (
              <>
                <p className="text-gray-600 text-sm font-medium">All caught up!</p>
                <p className="text-gray-400 text-xs mt-1">You've voted on all available Rankrolls.</p>
              </>
            ) : (
              <>
                <p className="text-gray-500 text-sm">No Rankrolls open right now.</p>
                <p className="text-gray-400 text-xs mt-1">New votes drop regularly — check back soon!</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Ranking Lists Section */}
            {rankingPolls.length > 0 && (
              <div className="space-y-4">
                {rankingPolls.map((poll) => (
                  <RankingCard key={poll._id} poll={poll} onOpenArticle={onOpenArticle} onOpenRankroll={onOpenRankroll} />
                ))}
              </div>
            )}

            {/* Simple Polls Section */}
            {(() => {
              const simplePolls = otherPolls.filter(p => p.type === 'simple');
              return simplePolls.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Polls</h3>
                  <div className="space-y-4">
                    {simplePolls.map((poll) => (
                      <SimplePollCard 
                        key={poll._id}
                        poll={poll} 
                        onClick={() => {
                          if (poll.linkedArticleId && onOpenArticle) {
                            onOpenArticle(poll.linkedArticleId);
                          }
                        }} 
                      />
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
