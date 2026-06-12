"use client";

import { useState, useEffect } from "react";
import { Vote, ChevronRight, Clock, Info } from "lucide-react";
import { PollsSkeleton } from "./DesktopSkeletons";
import DesktopRankingDetailPage from "./DesktopRankingDetailPage";
import RankingItemImage from "@/components/RankingItemImage";

interface Poll {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: 'simple' | 'quiz' | 'ranking';
  totalVotes: number;
  items?: any[];
  linkedArticleId?: string;
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

// Ranking Card with its own countdown
function RankingCard({ poll, onClick }: { poll: Poll; onClick: () => void }) {
  const countdown = useCountdown(poll.closesAt);
  const top3 = [...(poll.items || [])].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 3);
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl overflow-hidden hover:shadow-xl hover:border-[#D4873A]/50 hover:scale-[1.02] transition-all duration-300 group relative border border-warm"
    >
      {/* Background Image with Overlay */}
      <div className={`relative overflow-hidden ${countdown ? 'h-64' : 'h-44'}`}>
        {poll.articleImage ? (
          <img src={poll.articleImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#D4873A]/20 to-[#D4873A]/5" />
        )}
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />
        
        {/* Content */}
        <div className="absolute inset-0 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="h-6 inline-flex items-center px-2 bg-[#D4873A] text-white text-xs font-display uppercase tracking-wider rounded">
              RANKING
            </span>
            {/* Vote Now Button with votes count - same height as RANKING badge */}
            <div className="h-6 flex items-center gap-1 bg-white/20 backdrop-blur-sm group-hover:bg-[#D4873A] px-2 rounded transition-all duration-300 border border-white/30">
              <span className="text-xs font-display text-white group-hover:text-white uppercase tracking-wider">Vote Now</span>
              <span className="text-white/60 group-hover:text-white/80">·</span>
              <Vote className="w-2.5 h-2.5 text-white/80 group-hover:text-white" />
              <span className="text-[10px] font-bold text-white group-hover:text-white">{poll.totalVotes}</span>
              <ChevronRight className="w-2.5 h-2.5 text-white group-hover:text-white" />
            </div>
          </div>
          <h4 className="text-2xl font-display text-white group-hover:text-[#D4873A] transition-colors leading-tight mt-4">
            {poll.title}
          </h4>
          {poll.subtitle && (
            <p className="text-sm text-white/80 mt-1 line-clamp-1">{poll.subtitle}</p>
          )}
        </div>
        
        {/* Countdown Timer Bar - INSIDE image container, at bottom */}
        {countdown && (
          <div className="absolute bottom-2 left-2 right-2 px-3 py-2 flex items-center justify-between rounded-lg border border-[#D4873A]/40" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
            {/* Left: Clock + ENDS IN + Time */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
              <div>
                <span className="text-[7px] font-medium text-white/50 group-hover:text-white uppercase block transition-colors">ENDS IN</span>
                <span className="font-display text-lg text-[#D4873A] group-hover:text-white transition-colors normal-case" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
                  {countdown.expired ? 'Ended' : `${countdown.days > 0 ? countdown.days + 'd ' : ''}${countdown.hours.toString().padStart(2, '0')}h ${countdown.minutes.toString().padStart(2, '0')}m ${countdown.seconds.toString().padStart(2, '0')}s`}
                </span>
              </div>
            </div>
            
            {/* Separator */}
            <div className="w-px h-6 bg-white/30 group-hover:bg-white/50 transition-colors" />
            
            {/* Right: Info + Text */}
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-white/50 group-hover:text-white flex-shrink-0 transition-colors" />
              <span className="text-[9px] text-white/50 group-hover:text-white leading-tight max-w-[160px] transition-colors">
                After the deadline, voting remains open and rankings continue to evolve.
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Top 3 Preview */}
      {top3.length > 0 && (
        <div className="bg-cream">
          {top3.map((item, idx) => {
            const rank = idx + 1;
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-warm last:border-b-0">
                <RankingItemImage image={item.image} rank={rank} title={item.title} />
                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm line-clamp-2">{item.title}</p>
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
        </div>
      )}
    </button>
  );
}

interface DesktopRankrollPageProps {
  onOpenArticle?: (articleId: string) => void;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
}

export default function DesktopRankrollPage({ onOpenArticle, onShowLogin, onCoinAnimation }: DesktopRankrollPageProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRanking, setSelectedRanking] = useState<Poll | null>(null);

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

  // Handle back from detail page - refresh polls to show updated votes
  const handleBackFromDetail = () => {
    setSelectedRanking(null);
    loadPolls(); // Refresh to show updated rankings
  };

  // If a ranking is selected, show the detail page
  if (selectedRanking) {
    return (
      <DesktopRankingDetailPage
        poll={selectedRanking}
        onBack={handleBackFromDetail}
        onOpenArticle={onOpenArticle}
        onShowLogin={onShowLogin}
        onCoinAnimation={onCoinAnimation}
      />
    );
  }

  // Filter to only show ranking type polls
  const rankingPolls = polls.filter(p => p.type === 'ranking');
  const otherPolls = polls.filter(p => p.type !== 'ranking');

  return (
    <div className="h-full flex flex-col bg-[#F5F0E8] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Vote className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Rankroll</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Vote & rank your favorites</span>
          </div>
        </div>
        <div className="w-48" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-gradient-to-b from-transparent to-[#D4873A]/[0.03]" style={{ scrollbarWidth: "none" }}>

        {loading ? (
          <PollsSkeleton />
        ) : rankingPolls.length === 0 && otherPolls.length === 0 ? (
          <div className="text-center py-12">
            <Vote className="w-10 h-10 text-[#D4873A]/30 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No Rankrolls open right now.</p>
            <p className="text-gray-400 text-xs mt-1">New votes drop regularly — check back soon!</p>
          </div>
        ) : (
          <>
            {/* Ranking Lists Section */}
            {rankingPolls.length > 0 && (
              <div>
                <div className="grid grid-cols-2 gap-4">
                  {rankingPolls.map((poll) => (
                    <RankingCard key={poll._id} poll={poll} onClick={() => setSelectedRanking(poll)} />
                  ))}
                </div>
              </div>
            )}

            {/* Other Polls Section (simple, quiz) */}
            {otherPolls.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Polls</h3>
                <div className="grid grid-cols-2 gap-4">
                  {otherPolls.map((poll) => (
                    <button
                      key={poll._id}
                      className="w-full text-left rounded-2xl overflow-hidden hover:shadow-lg transition-all group border border-warm"
                    >
                      {/* Header with gradient */}
                      <div className="relative h-24 bg-gradient-to-br from-[#D4873A]/30 to-[#D4873A]/10">
                        <div className="absolute inset-0 p-4 flex flex-col justify-end">
                          <span className="inline-block px-2 py-0.5 bg-gray-700 text-white text-[10px] font-bold uppercase tracking-wider rounded w-fit mb-1">
                            {poll.type === 'quiz' ? 'QUIZ' : 'POLL'}
                          </span>
                          <h4 className="font-display text-lg text-gray-900 group-hover:text-[#D4873A] transition-colors line-clamp-1 uppercase">
                            {poll.title}
                          </h4>
                        </div>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/50 flex items-center justify-center group-hover:bg-[#D4873A] transition-colors">
                          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-white" />
                        </div>
                      </div>
                      {/* Footer */}
                      <div className="bg-cream px-4 py-2 border-t border-warm">
                        <p className="text-xs text-gray-400">{poll.totalVotes} votes</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
