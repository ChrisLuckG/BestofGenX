"use client";

import { useEffect, useState } from "react";
import { BookOpen, ChevronRight } from "lucide-react";

/**
 * "Read the story" link from a rankroll back to the article that embeds it.
 * Shared by the mobile rankroll overlay and DesktopRankingDetailPage.
 *
 * Resolves the article itself via /api/polls/[id] (`linkedArticle`): the link
 * normally lives only in the article HTML (data-rankroll-id on the Vote CTA),
 * so poll.linkedArticleId is usually empty and cannot be relied on.
 */
export default function RankrollArticleLink({ pollId, onOpenArticle, className = "" }: {
  pollId: string;
  onOpenArticle: (articleId: string) => void;
  className?: string;
}) {
  const [article, setArticle] = useState<{ _id: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setArticle(null);
    setLoading(true);
    fetch(`/api/polls/${pollId}`)
      .then(r => r.json())
      .then(data => { 
        if (!cancelled && data.success) setArticle(data.linkedArticle || null); 
        if (!cancelled) setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pollId]);

  // Loading skeleton
  if (loading) {
    return (
      <div className={`w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/60 border border-[#E36B11]/25 ${className}`}>
        <span className="w-9 h-9 rounded-lg bg-[#E36B11]/30 animate-pulse shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block w-20 h-3 bg-[#E36B11]/20 rounded animate-pulse mb-1" />
          <span className="block w-48 h-4 bg-gray-200 rounded animate-pulse" />
        </span>
      </div>
    );
  }

  // No article linked
  if (!article) return null;

  return (
    <button
      onClick={() => onOpenArticle(article._id)}
      className={`group w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/60 border border-[#E36B11]/25 hover:border-[#E36B11]/60 hover:bg-white transition-colors text-left ${className}`}
    >
      <span className="w-9 h-9 rounded-lg bg-[#E36B11] flex items-center justify-center shrink-0">
        <BookOpen className="w-4 h-4 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[11px] tracking-wider text-[#E36B11] uppercase leading-tight">Read the story</span>
        <span className="block text-sm font-semibold text-gray-900 leading-snug line-clamp-2 sm:truncate">{article.title}</span>
      </span>
      <ChevronRight className="w-5 h-5 text-[#E36B11] shrink-0 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
