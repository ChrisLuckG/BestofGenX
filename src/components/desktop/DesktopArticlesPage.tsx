"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FileText, Search, ChevronRight, Check, Heart, MessageCircle, Eye, Clock, Loader2 } from "lucide-react";
import { FeedSkeleton } from "./DesktopSkeletons";
import CardMoodReactions from "@/components/CardMoodReactions";
import { useAuth } from "@/context/AuthContext";
import { isVideoUrl } from "@/utils/media";

const ARTICLES_PER_PAGE = 7;

interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  thumbnailPosition?: { x: number; y: number };
  coverPosition?: { x: number; y: number };
  category: string;
  contentType?: string;
  authorName?: string;
  authorAvatar?: string;
  authorEmoji?: string;
  readTime?: number;
  trending?: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  createdAt?: string;
  personCountry?: string;
  personCountryCode?: string;
}

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  if (date.getFullYear() !== now.getFullYear()) {
    return `${month} ${day}, ${date.getFullYear()}`;
  }
  return `${month} ${day}`;
};

const CATEGORY_LABELS: Record<string, string> = {
  'movies-tv': 'Movies & TV',
  'music': 'Music',
  'gaming': 'Gaming',
  'sports': 'Sports',
  'tech': 'Tech',
  'culture': 'Culture',
  'news': 'News',
  'lifestyle': 'Lifestyle',
  'rip': 'RIP',
  'eastercorn': 'Eastercorn',
};

interface DesktopArticlesPageProps {
  onOpenArticle: (articleId: string) => void;
  onShowLogin?: () => void;
}

type FilterType = 'all' | 'unread' | 'top-commented' | 'most-liked' | 'newest' | 'oldest';

export default function DesktopArticlesPage({ onOpenArticle, onShowLogin }: DesktopArticlesPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load initial articles
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/articles?status=published&mainCategory=articles&limit=${ARTICLES_PER_PAGE}&page=1`);
        const data = await res.json();
        if (data.success) {
          const EXCLUDED_TYPES = ['arcade', 'rankroll', 'music-community', 'banner-page'];
          const arts = (data.articles || []).filter((a: Article) => !EXCLUDED_TYPES.includes(a.contentType || 'article'));
          setArticles(arts);
          setHasMore(arts.length === ARTICLES_PER_PAGE);
          setPage(1);
        }
      } catch (e) {
        console.error('Failed to load articles:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load more articles
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await fetch(`/api/articles?status=published&mainCategory=articles&limit=${ARTICLES_PER_PAGE}&page=${nextPage}`);
      const data = await res.json();
      if (data.success) {
        const EXCLUDED_TYPES = ['arcade', 'rankroll', 'music-community', 'banner-page'];
        const filtered = (data.articles || []).filter((a: Article) => !EXCLUDED_TYPES.includes(a.contentType || 'article'));
        if (filtered.length > 0) {
          setArticles(prev => [...prev, ...filtered]);
          setPage(prev => prev + 1);
        }
        setHasMore(filtered.length === ARTICLES_PER_PAGE);
      }
    } catch (e) {
      console.error('Failed to load more articles:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, hasMore, loadingMore, loading]);

  // Load read articles ONLY from DB (no localStorage)
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/user/read-article?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          const dbRead: string[] = data.readArticles || [];
          setReadArticles(new Set<string>(dbRead));
        })
        .catch(() => {});
    } else {
      // Guest: no read tracking (they see all as unread)
      setReadArticles(new Set());
    }
  }, [user?.id]);

  const handleArticleClick = (articleId: string) => {
    // Optimistically update UI
    setReadArticles(prev => { const next = new Set(Array.from(prev)); next.add(articleId); return next; });
    onOpenArticle(articleId);
  };

  const filteredArticles = articles.filter((article) => {
    if (searchQuery && !article.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filter === 'unread' && readArticles.has(article._id)) {
      return false;
    }
    return true;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    if (filter === 'top-commented') return (b.comments || 0) - (a.comments || 0);
    if (filter === 'most-liked') return (b.likes || 0) - (a.likes || 0);
    if (filter === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (filter === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    return 0;
  });
  
  // First article for Hero
  const heroArticle = sortedArticles[0];
  const listArticles = sortedArticles.slice(1);

  const filters: { key: FilterType; label: string; icon?: typeof Heart }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'top-commented', label: 'Top Commented', icon: MessageCircle },
    { key: 'most-liked', label: 'Most Liked', icon: Heart },
    { key: 'newest', label: 'Newest' },
    { key: 'oldest', label: 'Oldest' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#F5F0E8] overflow-hidden">
      {/* Header with Search */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Articles</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">News & stories from the GenX world</span>
          </div>
        </div>
        {/* Search in Header */}
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-1.5 bg-cream border border-warm rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4873A]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-gradient-to-b from-transparent to-[#D4873A]/[0.03]" style={{ scrollbarWidth: "none" }}>
        {loading ? (
          <FeedSkeleton />
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-[#D4873A]/30 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No articles yet</p>
          </div>
        ) : (
          <>
            {/* Filter Chips - always visible */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {filters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
                      filter === f.key
                        ? 'bg-[#D4873A] text-white border-[#D4873A]'
                        : 'bg-cream text-gray-700 hover:bg-[#D4873A]/10 border-warm'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className="text-xs font-semibold">{f.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Empty state for filter */}
            {sortedArticles.length === 0 && filter !== 'all' && (
              <div className="text-center py-6 bg-green-50 rounded-xl border border-green-200">
                <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-gray-700 text-sm font-medium">You're all caught up!</p>
                <p className="text-gray-400 text-xs mt-1">
                  {filter === 'unread' ? 'No unread articles' : `No articles with ${filter === 'top-commented' ? 'comments' : 'likes'}`}
                </p>
              </div>
            )}

            {/* Article List */}
            <div className="space-y-3">
              {(filter === 'all' ? articles : sortedArticles).map((article) => {
                const isRead = readArticles.has(article._id);
                return (
                  <div
                    key={article._id}
                    className="w-full text-left p-4 border rounded-xl hover:border-[#D4873A]/50 hover:shadow-lg transition-all duration-200 group bg-cream border-warm"
                  >
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-skeleton cursor-pointer" onClick={() => handleArticleClick(article._id)}>
                        {article.coverImage ? (
                          isVideoUrl(article.coverImage) ? (
                            <video src={article.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" style={{ objectPosition: `${article.thumbnailPosition?.x || 50}% ${article.thumbnailPosition?.y || 50}%` }} muted autoPlay loop playsInline />
                          ) : (
                            <img src={article.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" style={{ objectPosition: `${article.thumbnailPosition?.x || 50}% ${article.thumbnailPosition?.y || 50}%` }} />
                          )
                        ) : (
                          <div className="w-full h-full bg-[#D4873A]/10 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-[#D4873A]/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleArticleClick(article._id)}>
                        <div className="flex items-center gap-2">
                          {/* Flag FIRST, then category */}
                          {article.personCountryCode && (
                            <span className="flex items-center" title={article.personCountry}>
                              <img 
                                src={`https://flagcdn.com/20x15/${article.personCountryCode.toLowerCase()}.png`}
                                alt={article.personCountry || ''}
                                className="w-5 h-[15px] object-cover border border-gray-300 rounded-sm"
                              />
                            </span>
                          )}
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4873A]">
                            {CATEGORY_LABELS[article.category] || article.category}
                          </span>
                        </div>
                        <h4 className="font-display text-xl tracking-wide text-gray-900 group-hover:text-[#D4873A] transition-colors line-clamp-2 uppercase">{article.title}</h4>
                        <div className="text-xs text-gray-400 mt-1 truncate">
                          {article.authorName || 'BOGX Team'} · {formatDate(article.createdAt)}
                        </div>
                        {/* Reactions on separate line */}
                        <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                          <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
                        </div>
                      </div>
                      {/* Coin Badge only */}
                      <div className="flex items-center flex-shrink-0">
                        <div className={`px-2 py-1 rounded-lg border-2 font-display text-sm flex items-center gap-1 ${
                          isRead ? 'border-green-500 text-green-600' : 'border-[#D4873A] text-[#D4873A]'
                        }`}>
                          {isRead && <Check className="w-3 h-3" />}
                          0.05
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Load More Trigger */}
              {!loading && hasMore && (
                <div ref={loadMoreRef} className="flex justify-center py-6">
                  {loadingMore ? (
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-sm">Loading more articles...</span>
                    </div>
                  ) : (
                    <div className="h-8" />
                  )}
                </div>
              )}
              
              {/* End of list */}
              {!loading && !hasMore && articles.length > 0 && (
                <div className="text-center py-6 text-sm text-gray-400">
                  You've reached the end
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
