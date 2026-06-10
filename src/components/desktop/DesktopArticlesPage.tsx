"use client";

import { useState, useEffect } from "react";
import { FileText, Search, ChevronRight, Check, Heart, MessageCircle, Eye, Clock } from "lucide-react";
import { FeedSkeleton } from "./DesktopSkeletons";
import InlineMoods from "@/components/InlineMoods";
import { useAuth } from "@/context/AuthContext";

interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  category: string;
  authorName?: string;
  authorAvatar?: string;
  readTime: number;
  trending?: boolean;
  views?: number;
  likes?: number;
  comments?: number;
  createdAt?: string;
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
};

interface DesktopArticlesPageProps {
  onOpenArticle: (articleId: string) => void;
}

type FilterType = 'all' | 'unread' | 'top-commented' | 'most-liked' | 'newest' | 'oldest';

export default function DesktopArticlesPage({ onOpenArticle }: DesktopArticlesPageProps) {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());

  // Load articles
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/articles?status=published&mainCategory=articles');
        const data = await res.json();
        if (data.success) {
          setArticles(data.articles || []);
        }
      } catch (e) {
        console.error('Failed to load articles:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
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
    <div className="h-full flex flex-col bg-[#FDFBF7] overflow-hidden">
      {/* Header with Search */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-tight">Articles</span>
            <span className="text-[10px] text-gray-500">News & stories from the GenX world</span>
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
            {/* Hero Article - always show first article */}
            {articles[0] && (
              <button
                onClick={() => handleArticleClick(articles[0]._id)}
                className="w-full relative rounded-2xl overflow-hidden aspect-[2.5/1] group text-left"
              >
                {articles[0].coverImage ? (
                  articles[0].coverImage.includes('.mp4') || articles[0].coverImage.includes('.webm') ? (
                    <video src={articles[0].coverImage} className="absolute inset-0 w-full h-full object-cover" muted autoPlay loop playsInline />
                  ) : (
                    <img src={articles[0].coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#D4873A]/30 to-[#D4873A]/10" />
                )}
                {/* Gradient overlay - stronger at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                
                {/* Coin reward badge - consistent with list items */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={`px-2 py-1 text-xs font-bold rounded-lg flex items-center gap-1 ${readArticles?.has(articles[0]._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
                    {readArticles?.has(articles[0]._id) && <Check className="w-3 h-3" />}
                    0.05
                  </span>
                </div>
                
                {/* Content - positioned like article detail */}
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  {/* Category Badge */}
                  <span className="self-start px-2.5 py-1 bg-[#D4873A] text-white text-[10px] font-bold uppercase tracking-wider rounded mb-3">
                    {CATEGORY_LABELS[articles[0].category] || articles[0].category}
                  </span>
                  
                  {/* Title */}
                  <h2 className="font-display text-2xl md:text-3xl text-white leading-tight mb-2 uppercase">
                    {articles[0].title}
                  </h2>
                  
                  {/* Subtitle */}
                  {articles[0].subtitle && (
                    <p className="text-sm text-white/80 mb-3 line-clamp-1">{articles[0].subtitle}</p>
                  )}
                  
                  {/* Author + Meta */}
                  <div className="flex items-center gap-3 text-white/70 text-xs">
                    <span>{articles[0].authorName || 'BOGX Team'}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(articles[0].createdAt)}</span>
                    {articles[0].views && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{articles[0].views} views</span>}
                  </div>
                </div>
              </button>
            )}

            {/* Filter Chips - always visible */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {filters.map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                      filter === f.key
                        ? 'bg-[#D4873A] text-white'
                        : 'bg-cream border border-warm text-gray-600 hover:bg-[#D4873A]/10'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {f.label}
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

            {/* Article List - show articles after hero (skip first) */}
            <div className="space-y-3">
              {(filter === 'all' ? articles.slice(1) : sortedArticles).map((article) => {
                const isRead = readArticles.has(article._id);
                return (
                  <button
                    key={article._id}
                    onClick={() => handleArticleClick(article._id)}
                    className="w-full text-left p-4 border rounded-xl hover:border-[#D4873A]/50 hover:shadow-lg transition-all duration-200 group bg-cream border-warm"
                  >
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-skeleton">
                        {article.coverImage ? (
                          article.coverImage.includes('.mp4') || article.coverImage.includes('.webm') ? (
                            <video src={article.coverImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" muted autoPlay loop playsInline />
                          ) : (
                            <img src={article.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          )
                        ) : (
                          <div className="w-full h-full bg-[#D4873A]/10 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-[#D4873A]/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4873A]">
                          {CATEGORY_LABELS[article.category] || article.category}
                        </span>
                        <h4 className="font-display text-xl tracking-wide text-gray-900 group-hover:text-[#D4873A] transition-colors line-clamp-2 uppercase">{article.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <span>{article.authorName || 'BOGX Team'} · {formatDate(article.createdAt)}</span>
                          <InlineMoods count={article.likes || 0} size="xs" />
                        </div>
                      </div>
                      {/* Coin Badge - Right side like mobile */}
                      <div className={`px-2 py-1 rounded-lg border-2 font-display text-sm flex items-center gap-1 flex-shrink-0 ${
                        isRead ? 'border-green-500 text-green-600' : 'border-[#D4873A] text-[#D4873A]'
                      }`}>
                        {isRead && <Check className="w-3 h-3" />}
                        0.05
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
