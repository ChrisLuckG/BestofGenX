"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, FileText, Check, MessageCircle, Heart, Eye, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import CardMoodReactions from "@/components/CardMoodReactions";
import { isVideoUrl } from "@/utils/media";

const ARTICLES_PER_PAGE = 7;

interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  category: string;
  contentType?: string;
  authorName?: string;
  readTime?: number;
  trending?: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  createdAt?: string;
}

// Format date as "Jun 3" or "Jun 3, 2025" if different year
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
  'rewind': 'Rewind',
  'sports': 'Sports',
  'tech': 'Tech',
  'culture': 'Culture',
  'news': 'News',
  'lifestyle': 'Lifestyle',
  'rip': 'RIP',
  'eastercorn': 'Eastercorn',
};

interface ArticlesListPageProps {
  onOpenArticle: (articleId: string) => void;
  onShowLogin?: () => void;
}

export default function ArticlesListPage({ onOpenArticle, onShowLogin }: ArticlesListPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread' | 'commented' | 'liked' | 'read' | 'newest' | 'oldest'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load initial articles
  useEffect(() => {
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/articles?status=published&mainCategory=articles&limit=${ARTICLES_PER_PAGE}&page=1`);
        const data = await res.json();
        if (data.success) {
          const EXCLUDED_TYPES = ['arcade', 'rankroll', 'music-community', 'banner-page'];
          const filtered = (data.articles || []).filter((a: Article) => !EXCLUDED_TYPES.includes(a.contentType || 'article'));
          setArticles(filtered);
          setHasMore(filtered.length === ARTICLES_PER_PAGE);
          setPage(1);
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
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
    } catch (error) {
      console.error('Error loading more articles:', error);
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

  // Handle article click - mark as read and open
  const handleArticleClick = (articleId: string) => {
    // Optimistically update UI
    setReadArticles(prev => { const next = new Set(Array.from(prev)); next.add(articleId); return next; });
    onOpenArticle(articleId);
  };

  const filteredArticles = articles.filter(article => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!article.title.toLowerCase().includes(query) && 
          !article.subtitle?.toLowerCase().includes(query)) {
        return false;
      }
    }
    // Category filter
    if (filter === 'unread') return !readArticles.has(article._id);
    return true;
  });

  // Sort based on filter
  const sortedArticles = [...filteredArticles].sort((a, b) => {
    if (filter === 'commented') return (b.comments || 0) - (a.comments || 0);
    if (filter === 'liked') return (b.likes || 0) - (a.likes || 0);
    if (filter === 'read') return (b.views || 0) - (a.views || 0);
    if (filter === 'newest') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    if (filter === 'oldest') return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    return 0; // Keep original order for 'all' and 'unread'
  });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header with Search */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Articles</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">News & stories</span>
          </div>
        </div>
        {/* Search in header */}
        <div className="relative w-36">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-2 py-1.5 bg-cream border border-warm rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#E36B11]"
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Filter Tabs */}
        <div className="px-4 pt-4 pb-3 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[
            { key: 'all' as const, label: 'All', icon: null },
            { key: 'unread' as const, label: 'Unread', icon: null },
            { key: 'commented' as const, label: 'Top Commented', icon: MessageCircle },
            { key: 'liked' as const, label: 'Most Liked', icon: Heart },
            { key: 'newest' as const, label: 'Newest', icon: null },
            { key: 'oldest' as const, label: 'Oldest', icon: null },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all border ${
                filter === key 
                  ? 'bg-[#E36B11] text-white border-[#E36B11]' 
                  : 'bg-cream text-gray-700 hover:bg-[#E36B11]/10 border-warm'
              }`}
            >
              {Icon && <Icon className="w-4 h-4" />}
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </div>

        {/* Articles List */}
        <div className="px-4 pb-4 space-y-2">
        {loading ? (
          // Skeleton Loading
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-full flex gap-3 p-3 bg-cream border border-warm rounded-xl animate-pulse">
                {/* Thumbnail Skeleton */}
                <div className="w-24 flex-shrink-0 rounded-lg bg-skeleton" style={{ aspectRatio: '3/2' }} />
                {/* Content Skeleton */}
                <div className="flex-1 flex flex-col justify-center">
                  <div className="w-16 h-4 bg-skeleton rounded mb-2" />
                  <div className="w-full h-4 bg-skeleton rounded mb-1" />
                  <div className="w-3/4 h-4 bg-skeleton rounded mb-2" />
                  <div className="w-24 h-3 bg-skeleton-light rounded" />
                </div>
              </div>
            ))}
          </>
        ) : sortedArticles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery ? 'No articles found' : 'No articles yet'}
          </div>
        ) : (
          sortedArticles.map((article) => {
            const isRead = readArticles.has(article._id);
            return (
              <div
                key={article._id}
                className="w-full text-left flex gap-3 p-3 border rounded-xl hover:border-[#E36B11]/30 hover:shadow-sm transition-all group bg-cream border-warm"
              >
                {/* Thumbnail - square */}
                <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden cursor-pointer" onClick={() => handleArticleClick(article._id)}>
                  {article.coverImage ? (
                    isVideoUrl(article.coverImage) ? (
                      <video
                        src={article.coverImage}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                    ) : (
                      <img
                        src={article.coverImage}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  {article.trending && (
                    <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500 rounded text-[8px] font-bold text-white uppercase">
                      <Eye className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-center min-w-0 cursor-pointer" onClick={() => handleArticleClick(article._id)}>
                  {/* Category Badge */}
                  <span className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-[#E36B11]">
                    {CATEGORY_LABELS[article.category] || article.category}
                  </span>
                  
                  {/* Title */}
                  <h3 className="font-display text-base tracking-wide leading-tight mb-1 line-clamp-2 group-hover:text-[#E36B11] transition-colors uppercase text-gray-900">
                    {article.title}
                  </h3>

                  {/* Meta - Author & Date */}
                  <div className="text-[11px] text-gray-500">
                    {article.authorName && (
                      <span className="font-medium">{article.authorName}</span>
                    )}
                    {article.authorName && article.createdAt && <span> · </span>}
                    {article.createdAt && (
                      <span>{formatDate(article.createdAt)}</span>
                    )}
                  </div>
                  {/* Reactions on separate line */}
                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                    <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
                  </div>
                </div>

                {/* Coin Badge - Right side */}
                <div className="flex items-center flex-shrink-0">
                  <div className={`px-2 py-1 rounded-lg border-2 font-display text-sm flex items-center gap-1 ${
                    isRead 
                      ? 'border-green-500 text-green-600' 
                      : 'border-[#E36B11] text-[#E36B11]'
                  }`}>
                    {isRead && <Check className="w-3 h-3" />}
                    0.05
                  </div>
                </div>
              </div>
            );
          })
        )}
        
          {/* Load More Trigger */}
          {!loading && hasMore && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">Loading more...</span>
                </div>
              ) : (
                <div className="h-8" /> 
              )}
            </div>
          )}
          
          {/* End of list */}
          {!loading && !hasMore && articles.length > 0 && (
            <div className="text-center py-4 text-xs text-gray-400">
              No more articles
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
