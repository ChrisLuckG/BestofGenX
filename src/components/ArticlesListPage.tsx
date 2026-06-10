"use client";

import { useState, useEffect } from "react";
import { Search, FileText, Check, MessageCircle, Heart, Eye } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  category: string;
  authorName?: string;
  readTime: number;
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
  'sports': 'Sports',
  'tech': 'Tech',
  'culture': 'Culture',
  'news': 'News',
  'lifestyle': 'Lifestyle',
};

interface ArticlesListPageProps {
  onOpenArticle: (articleId: string) => void;
}

export default function ArticlesListPage({ onOpenArticle }: ArticlesListPageProps) {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'commented' | 'liked' | 'read' | 'newest' | 'oldest'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());

  // Load articles
  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch('/api/articles?status=published&mainCategory=articles&limit=100');
        const data = await res.json();
        if (data.success) {
          setArticles(data.articles);
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchArticles();
  }, []);

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
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#D4873A]" />
          <span className="font-display text-lg tracking-wider text-gray-900">Articles</span>
        </div>
        {/* Search in header */}
        <div className="relative w-36">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-8 pr-2 py-1.5 bg-cream border border-warm rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#D4873A]"
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Hero Article - Featured/Latest */}
        {!loading && sortedArticles.length > 0 && (
          <div 
            className="relative mx-3 mt-3 rounded-2xl overflow-hidden cursor-pointer"
            onClick={() => handleArticleClick(sortedArticles[0]._id)}
          >
            <div className="aspect-[16/9] bg-gray-200">
              {sortedArticles[0].coverImage ? (
                (sortedArticles[0].coverImage.includes('.mp4') || sortedArticles[0].coverImage.includes('.webm')) ? (
                  <video 
                    src={sortedArticles[0].coverImage} 
                    className="w-full h-full object-cover"
                    muted
                    autoPlay
                    loop
                    playsInline
                  />
                ) : (
                  <img 
                    src={sortedArticles[0].coverImage} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#D4873A] to-[#B5672A] flex items-center justify-center">
                  <FileText className="w-16 h-16 text-white/30" />
                </div>
              )}
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 bg-[#D4873A] text-white text-[10px] font-bold uppercase rounded">
                  {CATEGORY_LABELS[sortedArticles[0].category] || sortedArticles[0].category}
                </span>
                {sortedArticles[0].trending && (
                  <span className="px-2 py-0.5 bg-white/20 text-white text-[10px] font-bold uppercase rounded">
                    Trending
                  </span>
                )}
              </div>
              <h2 className="font-display text-[26px] tracking-wide text-white leading-tight mb-1 uppercase">
                {sortedArticles[0].title}
              </h2>
              {sortedArticles[0].subtitle && (
                <p className="text-sm text-white/80 line-clamp-2">{sortedArticles[0].subtitle}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-white/60 text-xs">
                {sortedArticles[0].authorName && <span>{sortedArticles[0].authorName}</span>}
                <span>{sortedArticles[0].readTime} min read</span>
                {sortedArticles[0].views && (
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {sortedArticles[0].views}</span>
                )}
              </div>
            </div>
            {/* Coin reward badge - consistent with list items */}
            <div className="absolute top-3 right-3">
              <span className={`px-2 py-1 text-xs font-bold rounded-lg flex items-center gap-1 ${readArticles.has(sortedArticles[0]._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
                {readArticles.has(sortedArticles[0]._id) && <Check className="w-3 h-3" />}
                0.05
              </span>
            </div>
          </div>
        )}
        
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
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === key 
                  ? 'bg-[#D4873A] text-white' 
                  : 'bg-cream border border-warm text-gray-600 hover:bg-[#D4873A]/10'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {label}
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
                <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-skeleton" />
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
          sortedArticles.slice(1).map((article) => {
            const isRead = readArticles.has(article._id);
            return (
              <button
                key={article._id}
                onClick={() => handleArticleClick(article._id)}
                className="w-full text-left flex gap-3 p-3 border rounded-xl hover:border-[#D4873A]/30 hover:shadow-sm transition-all group bg-cream border-warm"
              >
                {/* Thumbnail */}
                <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                  {article.coverImage ? (
                    (article.coverImage.includes('.mp4') || article.coverImage.includes('.webm') || article.coverImage.includes('.mov') || article.coverImage.includes('video')) ? (
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
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  {/* Category Badge */}
                  <span className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-[#D4873A]">
                    {CATEGORY_LABELS[article.category] || article.category}
                  </span>
                  
                  {/* Title */}
                  <h3 className="font-display text-base tracking-wide leading-tight mb-1 line-clamp-2 group-hover:text-[#D4873A] transition-colors uppercase text-gray-900">
                    {article.title}
                  </h3>

                  {/* Meta - Author & Date */}
                  <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    {article.authorName && (
                      <span className="font-medium">{article.authorName}</span>
                    )}
                    {article.authorName && article.createdAt && <span>·</span>}
                    {article.createdAt && (
                      <span>{formatDate(article.createdAt)}</span>
                    )}
                  </div>
                </div>

                {/* Coin Badge - Right side */}
                <div className="flex items-center flex-shrink-0">
                  <div className={`px-2 py-1 rounded-lg border-2 font-display text-sm flex items-center gap-1 ${
                    isRead 
                      ? 'border-green-500 text-green-600' 
                      : 'border-[#D4873A] text-[#D4873A]'
                  }`}>
                    {isRead && <Check className="w-3 h-3" />}
                    0.05
                  </div>
                </div>
              </button>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
