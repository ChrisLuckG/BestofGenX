"use client";

import { useState, useEffect } from "react";
import { Vote } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import PollCard from "./PollCard";
import QuizPollCard from "./QuizPoll";
import RankingListCard from "./RankingListCard";

// Skeleton for Rankroll cards
function RankrollSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl overflow-hidden border border-warm bg-cream">
          {/* Header skeleton */}
          <div className="relative h-40 bg-skeleton-light overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="absolute top-4 left-4">
              <div className="w-16 h-5 bg-[#D4873A]/20 rounded animate-pulse" />
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="h-6 bg-skeleton-light rounded w-3/4 mb-2 animate-pulse" />
              <div className="h-4 bg-skeleton-light rounded w-1/2 animate-pulse" />
            </div>
            {/* Shimmer sweep */}
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" />
          </div>
          {/* Items skeleton */}
          <div className="bg-cream">
            {[1, 2, 3].map((j) => (
              <div key={j} className="px-3 py-2 flex items-center gap-3 border-b border-warm last:border-b-0">
                <div className="relative w-20 h-12 bg-skeleton-light rounded-lg overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.6s_infinite]" style={{ animationDelay: `${j * 200}ms` }} />
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-skeleton-light rounded w-3/4 animate-pulse" />
                </div>
                <div className="w-8 h-4 bg-skeleton-light rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface RankrollPageProps {
  onOpenArticle?: (articleId: string) => void;
  onCoinAnimation?: (amount: number) => void;
}

export default function RankrollPage({ onOpenArticle, onCoinAnimation }: RankrollPageProps) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitorId, setVisitorId] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Stable anonymous id for vote de-duplication
    if (typeof window !== "undefined") {
      let vid = localStorage.getItem("bogx-visitor-id");
      if (!vid) {
        vid = `v_${Math.random().toString(36).slice(2)}_${Date.now()}`;
        localStorage.setItem("bogx-visitor-id", vid);
      }
      setVisitorId(vid);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/polls?status=active");
        const data = await res.json();
        if (data.success) setPolls(data.polls);
      } catch (e) {
        console.error("Failed to load Rankrolls:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="h-full flex flex-col bg-cream overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm">
        <div className="flex items-center gap-2">
          <Vote className="w-5 h-5 text-[#D4873A]" />
          <span className="font-display text-lg tracking-wider text-gray-900">Rankroll</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ scrollbarWidth: "none" }}>

        {loading ? (
          <RankrollSkeleton />
        ) : polls.length === 0 ? (
          <div className="text-center py-12">
            <Vote className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No Rankrolls open right now.</p>
            <p className="text-gray-400 text-xs mt-1">New votes drop regularly — check back soon!</p>
          </div>
        ) : (
          polls.map((poll) => (
            <div key={poll._id}>
              {poll.type === "quiz" ? (
                <QuizPollCard poll={poll} userId={user?.id} visitorId={visitorId} onOpenArticle={onOpenArticle} />
              ) : poll.type === "ranking" ? (
                <RankingListCard poll={poll} userId={user?.id} visitorId={visitorId} onOpenArticle={onOpenArticle} onCoinAnimation={onCoinAnimation} />
              ) : (
                <PollCard poll={poll} userId={user?.id} visitorId={visitorId} onOpenArticle={onOpenArticle} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
