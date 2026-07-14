"use client";

import { useState, useEffect } from "react";
import { CheckCircle, BookOpen } from "lucide-react";

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
  image?: string;
  options: PollOption[];
  totalVotes: number;
  status: 'active' | 'closed' | 'draft';
  linkedArticleId?: string;
}

interface PollCardProps {
  poll: Poll;
  userId?: string;
  visitorId?: string;
  variant?: 'compact' | 'full';
  onVote?: (pollId: string, optionId: string) => void;
  onOpenArticle?: (articleId: string) => void;
}

export default function PollCard({ poll, userId, visitorId, variant = 'full', onVote, onOpenArticle }: PollCardProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [votedOption, setVotedOption] = useState<string | null>(null);
  const [localPoll, setLocalPoll] = useState(poll);
  const [isVoting, setIsVoting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if user has already voted
  useEffect(() => {
    const checkVote = async () => {
      if (!userId && !visitorId) return;
      
      try {
        const params = new URLSearchParams();
        if (userId) params.set('userId', userId);
        if (visitorId) params.set('visitorId', visitorId);
        
        const res = await fetch(`/api/polls/${poll._id}/vote?${params}`);
        const data = await res.json();
        
        if (data.success && data.hasVoted) {
          setHasVoted(true);
          setVotedOption(data.votedOption);
        }
      } catch (e) {
        console.error('Failed to check vote status:', e);
      }
    };
    
    checkVote();
  }, [poll._id, userId, visitorId]);

  const handleVote = async (optionId: string) => {
    if (hasVoted || isVoting) return;
    
    setIsVoting(true);
    
    // Ensure we have a visitorId
    let vid = visitorId;
    if (!vid && typeof window !== 'undefined') {
      vid = localStorage.getItem('bogx-visitor-id') || undefined;
      if (!vid) {
        vid = `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        localStorage.setItem('bogx-visitor-id', vid);
      }
    }
    
    try {
      const res = await fetch(`/api/polls/${poll._id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId,
          userId,
          visitorId: vid,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setHasVoted(true);
        setVotedOption(optionId);
        setLocalPoll(data.poll);
        setIsExpanded(false); // Collapse after voting
        onVote?.(poll._id, optionId);
      } else if (data.alreadyVoted) {
        setHasVoted(true);
        setIsExpanded(false);
      }
    } catch (e) {
      console.error('Vote failed:', e);
    } finally {
      setIsVoting(false);
    }
  };

  const getPercentage = (votes: number) => {
    if (localPoll.totalVotes === 0) return 0;
    return Math.round((votes / localPoll.totalVotes) * 100);
  };

  // Compact preview (not expanded and not voted)
  if (!isExpanded && !hasVoted) {
    return (
      <div className="bg-cream border border-warm rounded-xl overflow-hidden p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-[#D4873A] uppercase tracking-wider">RANKROLL</span>
            <h3 className="font-display text-lg text-gray-900 uppercase">{poll.title}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-500">{poll.options.length} options · {localPoll.totalVotes} votes</p>
              {poll.linkedArticleId && onOpenArticle && (
                <>
                  <span className="text-gray-300">·</span>
                  <button
                    onClick={() => onOpenArticle(String(poll.linkedArticleId))}
                    className="text-xs text-[#D4873A] hover:underline flex items-center gap-1"
                  >
                    <BookOpen className="w-3 h-3" />
                    Read story
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="px-3 py-1.5 bg-[#D4873A] text-white text-sm font-bold rounded-lg hover:bg-[#C4772A] transition-colors flex-shrink-0"
          >
            Vote
          </button>
        </div>
      </div>
    );
  }

  // Expanded voting view or results view - same compact layout
  return (
    <div className="bg-cream border border-warm rounded-xl overflow-hidden p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-[#D4873A] uppercase tracking-wider">RANKROLL</span>
          <h3 className="font-display text-lg text-gray-900 uppercase">{poll.title}</h3>
          {poll.subtitle && <p className="text-sm text-gray-700 line-clamp-1">{poll.subtitle}</p>}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-gray-500">{localPoll.totalVotes} {localPoll.totalVotes === 1 ? 'vote' : 'votes'}</p>
            {poll.linkedArticleId && onOpenArticle && (
              <>
                <span className="text-gray-300">·</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onOpenArticle(String(poll.linkedArticleId)); }}
                  className="text-xs text-[#D4873A] hover:underline flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  Read story
                </button>
              </>
            )}
          </div>
        </div>
        {hasVoted ? (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 text-center px-3 py-1.5 rounded-lg hover:bg-[#D4873A]/10 transition-colors"
          >
            <div className="text-xs text-gray-900">Your vote</div>
            <div className="text-sm font-bold text-[#D4873A] flex items-center gap-1">
              {localPoll.options.find(o => o.id === votedOption)?.label || '—'}
              <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="px-3 py-1.5 bg-[#D4873A] text-white text-sm font-bold rounded-lg hover:bg-[#C4772A] transition-colors flex-shrink-0"
          >
            Vote
          </button>
        )}
      </div>
      
      {/* Voting options - show when expanded */}
      {isExpanded && (
        <div className="mt-4 space-y-2">
          {localPoll.options.map((option) => {
            const percentage = getPercentage(option.votes);
            const isSelected = votedOption === option.id;
            
            return hasVoted ? (
              <div
                key={option.id}
                className={`w-full relative overflow-hidden rounded-lg border ${
                  isSelected ? 'border-[#D4873A] bg-[#D4873A]/10' : 'border-warm bg-cream'
                }`}
              >
                {/* Progress bar */}
                <div 
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    isSelected ? 'bg-[#D4873A]/20' : 'bg-gray-100'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    {option.emoji && <span className="text-xl">{option.emoji}</span>}
                    <span className={`font-display text-sm uppercase ${isSelected ? 'text-gray-900' : 'text-gray-900'}`}>
                      {option.label}
                    </span>
                    {isSelected && <CheckCircle className="w-4 h-4 text-[#D4873A]" />}
                  </div>
                  <span className={`text-sm font-bold ${isSelected ? 'text-[#D4873A]' : 'text-gray-900'}`}>
                    {percentage}%
                  </span>
                </div>
              </div>
            ) : (
              <button
                key={option.id}
                onClick={() => handleVote(option.id)}
                className="w-full flex items-center gap-2 p-3 rounded-lg border border-warm transition-all text-left hover:border-[#D4873A] hover:bg-[#D4873A]/5 cursor-pointer"
              >
                {option.emoji && <span className="text-xl">{option.emoji}</span>}
                <span className="font-display text-sm text-gray-900 uppercase">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
