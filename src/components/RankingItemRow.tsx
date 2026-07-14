"use client";

import { ChevronUp, ChevronDown, TrendingUp } from "lucide-react";
import RankingItemImage from "@/components/RankingItemImage";

interface RankingItemRowProps {
  item: {
    id: string;
    title: string;
    description?: string;
    image?: string;
    upvotes: number;
    downvotes: number;
    score: number;
  };
  rank: number;
  userVote?: 'up' | 'down';
  isVoting: boolean;
  isDesktop: boolean;
  onVote: (itemId: string, voteType: 'up' | 'down') => void;
}

/**
 * Shared ranking item row component.
 * Used by: RankingPollCard (in articles) and DesktopRankingDetailPage (standalone).
 * Change the design HERE once and it applies everywhere.
 */
export default function RankingItemRow({ 
  item, 
  rank, 
  userVote, 
  isVoting, 
  isDesktop,
  onVote 
}: RankingItemRowProps) {
  return (
    <div className="p-3 hover:bg-[#D4873A]/[0.02] transition-colors">
      {isDesktop ? (
        /* Desktop: 3-column layout - Image | Text | Voting */
        <div className="flex items-center gap-4">
          {/* Column 1: Image */}
          <RankingItemImage image={item.image} rank={rank} title={item.title} size="large" />
          
          {/* Column 2: Content - full text, aligned to top */}
          <div className="flex-1 min-w-0 self-start">
            <div className="flex items-center gap-2">
              <h4 className="font-display text-lg text-gray-900">{item.title}</h4>
              {item.score > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                  <TrendingUp className="w-3 h-3" />
                  RISING
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-sm text-gray-900 mt-1">{item.description}</p>
            )}
          </div>

          {/* Column 3: Vote Buttons - vertical */}
          <div className="flex flex-col gap-2 flex-shrink-0 w-28">
            <button
              onClick={() => onVote(item.id, 'up')}
              disabled={isVoting || userVote === 'up'}
              className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg transition-all ${
                userVote === 'up'
                  ? 'bg-[#D4873A] text-white cursor-default'
                  : 'bg-[#D4873A]/10 text-gray-500 hover:bg-[#D4873A]/20 hover:text-[#D4873A] cursor-pointer'
              } ${isVoting ? 'opacity-50' : ''}`}
            >
              <ChevronUp className="w-5 h-5" />
              <span className="text-sm font-bold">{item.upvotes || 0}</span>
            </button>
            <button
              onClick={() => onVote(item.id, 'down')}
              disabled={isVoting || userVote === 'down'}
              className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg transition-all ${
                userVote === 'down'
                  ? 'bg-[#D4873A] text-white cursor-default'
                  : 'bg-[#D4873A]/5 text-[#D4873A]/50 hover:bg-[#D4873A]/10 hover:text-[#D4873A]/70 cursor-pointer'
              } ${isVoting ? 'opacity-50' : ''}`}
            >
              <ChevronDown className="w-5 h-5" />
              <span className="text-sm font-bold">{item.downvotes || 0}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mobile: Large image with voting beside, text at bottom */
        <>
          <div className="flex items-stretch gap-3 mb-2">
            <RankingItemImage image={item.image} rank={rank} title={item.title} size="large" />
            
            {/* Voting buttons - vertical, fill remaining space */}
            <div className="flex-1 flex flex-col gap-1">
              <button
                onClick={() => onVote(item.id, 'up')}
                disabled={isVoting || userVote === 'up'}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg transition-all ${
                  userVote === 'up'
                    ? 'bg-[#D4873A] text-white cursor-default'
                    : 'bg-[#D4873A]/10 text-gray-500 hover:bg-[#D4873A]/20 hover:text-[#D4873A] cursor-pointer'
                } ${isVoting ? 'opacity-50' : ''}`}
              >
                <ChevronUp className="w-5 h-5" />
                <span className="text-sm font-bold">{item.upvotes || 0}</span>
              </button>
              <button
                onClick={() => onVote(item.id, 'down')}
                disabled={isVoting || userVote === 'down'}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg transition-all ${
                  userVote === 'down'
                    ? 'bg-[#D4873A] text-white cursor-default'
                    : 'bg-[#D4873A]/5 text-[#D4873A]/50 hover:bg-[#D4873A]/10 hover:text-[#D4873A]/70 cursor-pointer'
                } ${isVoting ? 'opacity-50' : ''}`}
              >
                <ChevronDown className="w-5 h-5" />
                <span className="text-sm font-bold">{item.downvotes || 0}</span>
              </button>
            </div>
          </div>

          {/* Text */}
          <div>
            <h4 className="font-display text-xl text-gray-900">{item.title}</h4>
            {item.description && (
              <p className="text-sm text-gray-900 mt-1">{item.description}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
