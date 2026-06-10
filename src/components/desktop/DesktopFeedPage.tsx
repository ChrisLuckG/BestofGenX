"use client";

import { useState, useEffect } from "react";
import { Play, FileText, Vote, ShoppingBag, Tv, ChevronRight, Check, Heart, MessageCircle, Clock, Eye, Search } from "lucide-react";
import { FeedSkeleton } from "./DesktopSkeletons";
import { useAuth } from "@/context/AuthContext";

interface FeedItem {
  _id: string;
  type: 'article' | 'rankroll' | 'tv' | 'shop';
  title: string;
  subtitle?: string;
  image?: string;
  category?: string;
  authorName?: string;
  createdAt?: string;
  totalVotes?: number;
  itemCount?: number;
  price?: number;
  duration?: string;
  readTime?: number;
  views?: number;
  likes?: number;
  comments?: number;
}

const formatTimeAgo = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface DesktopFeedPageProps {
  onOpenArticle: (articleId: string) => void;
}

type FilterType = 'all' | 'unread' | 'top-commented' | 'most-liked';

export default function DesktopFeedPage({ onOpenArticle }: DesktopFeedPageProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readArticles, setReadArticles] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Load read articles ONLY from DB (no localStorage)
  useEffect(() => {
    if (user?.id) {
      fetch(`/api/user/read-article?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          const dbRead: string[] = data.readArticles || [];
          setReadArticles(dbRead);
        })
        .catch(() => {});
    } else {
      // Guest: no read tracking (they see all as unread)
      setReadArticles([]);
    }
  }, [user?.id]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/feed');
        const data = await res.json();
        if (data.success) {
          setItems(data.items || []);
        }
      } catch (e) {
        console.error('Failed to load feed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleItemClick = (item: FeedItem) => {
    // All feed items are articles (with different mainCategories)
    onOpenArticle(item._id);
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case 'article': return { label: 'ARTICLES', icon: FileText, color: 'text-[#D4873A]' };
      case 'rankroll': return { label: 'RANKROLL', icon: Vote, color: 'text-[#D4873A]' };
      case 'tv': return { label: 'TV', icon: Tv, color: 'text-[#D4873A]' };
      case 'shop': return { label: 'SHOP', icon: ShoppingBag, color: 'text-[#D4873A]' };
      default: return { label: type.toUpperCase(), icon: FileText, color: 'text-gray-500' };
    }
  };

  // Filter and sort items
  const filteredItems = items.filter((item) => {
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filter === 'unread' && readArticles.includes(item._id)) {
      return false;
    }
    return true;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (filter === 'top-commented') return (b.comments || 0) - (a.comments || 0);
    if (filter === 'most-liked') return (b.likes || 0) - (a.likes || 0);
    return 0;
  });

  // First item for Hero
  const heroItem = sortedItems[0];
  const listItems = sortedItems.slice(1);

  const filters: { key: FilterType; label: string; icon?: typeof Heart }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'top-commented', label: 'Top Commented', icon: MessageCircle },
    { key: 'most-liked', label: 'Most Liked', icon: Heart },
  ];

  return (
    <div className="h-full flex flex-col bg-[#FDFBF7] overflow-hidden">
      {/* Header with Search */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Play className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-tight">Feed</span>
            <span className="text-[10px] text-gray-500">Latest updates & content</span>
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
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Play className="w-10 h-10 text-[#D4873A]/30 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No feed items yet</p>
          </div>
        ) : (
          <>
            {/* Hero Item - always show first item */}
            {items[0] && (
              <button
                onClick={() => handleItemClick(items[0])}
                className="w-full relative rounded-2xl overflow-hidden aspect-[2.5/1] group text-left"
              >
                {items[0].image ? (
                  items[0].image.includes('.mp4') || items[0].image.includes('.webm') ? (
                    <video src={items[0].image} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" muted autoPlay loop playsInline />
                  ) : (
                    <img src={items[0].image} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  )
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#D4873A]/30 to-[#D4873A]/10" />
                )}
                {/* Gradient overlay - stronger at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
                
                {/* Coin reward badge - consistent with list items */}
                <div className="absolute top-3 right-3 z-10">
                  <span className={`px-2 py-1 text-xs font-bold rounded-lg flex items-center gap-1 ${readArticles.includes(items[0]._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
                    {readArticles.includes(items[0]._id) && <Check className="w-3 h-3" />}
                    0.05
                  </span>
                </div>
                
                {/* Content - positioned like article detail */}
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  {/* Type Badge */}
                  <span className="self-start px-2.5 py-1 bg-[#D4873A] text-white text-[10px] font-bold uppercase tracking-wider rounded mb-3">
                    {getTypeConfig(items[0].type).label}
                  </span>
                  
                  {/* Title */}
                  <h2 className="font-display text-2xl text-white leading-tight mb-2 uppercase">
                    {items[0].title}
                  </h2>
                  
                  {/* Subtitle */}
                  {items[0].subtitle && (
                    <p className="text-sm text-white/80 mb-3 line-clamp-1">{items[0].subtitle}</p>
                  )}
                  
                  {/* Author + Meta */}
                  <div className="flex items-center gap-3 text-white/70 text-xs">
                    <span>{items[0].authorName || 'BOGX Team'}</span>
                    {items[0].createdAt && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTimeAgo(items[0].createdAt)}</span>}
                    {items[0].views && <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{items[0].views} views</span>}
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
            {sortedItems.length === 0 && filter !== 'all' && (
              <div className="text-center py-6 bg-green-50 rounded-xl border border-green-200">
                <Check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-gray-700 text-sm font-medium">You're all caught up!</p>
                <p className="text-gray-400 text-xs mt-1">
                  {filter === 'unread' ? 'No unread items' : `No items with ${filter === 'top-commented' ? 'comments' : 'likes'}`}
                </p>
              </div>
            )}

            {/* Item List - show items after hero (skip first) */}
            <div className="space-y-3">
              {(filter === 'all' ? items.slice(1) : sortedItems).map((item) => {
                const config = getTypeConfig(item.type);
                const Icon = config.icon;
                const isRead = readArticles.includes(item._id);
                
                return (
                  <button
                    key={`${item.type}-${item._id}`}
                    onClick={() => handleItemClick(item)}
                    className={`w-full text-left p-4 border rounded-xl hover:border-[#D4873A]/30 hover:shadow-md transition-all group ${isRead ? 'bg-cream/50 border-warm/50' : 'bg-cream border-warm'}`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-skeleton">
                        {item.image ? (
                          item.image.includes('.mp4') || item.image.includes('.webm') ? (
                            <video src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" muted autoPlay loop playsInline />
                          ) : (
                            <img src={item.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          )
                        ) : (
                          <div className="w-full h-full bg-[#D4873A]/10 flex items-center justify-center">
                            <Icon className="w-8 h-8 text-[#D4873A]/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                            {config.label}
                          </span>
                          {item.createdAt && (
                            <span className="text-[10px] text-gray-400">· {formatTimeAgo(item.createdAt)}</span>
                          )}
                        </div>
                        <h4 className="font-display text-xl tracking-wide text-gray-900 group-hover:text-[#D4873A] transition-colors line-clamp-2 uppercase">{item.title}</h4>
                        {item.subtitle && <p className="text-sm text-gray-500 line-clamp-1">{item.subtitle}</p>}
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                          {item.totalVotes !== undefined && <span>{item.totalVotes} votes</span>}
                          {item.itemCount !== undefined && <span>{item.itemCount} items</span>}
                          {item.price !== undefined && <span className="font-semibold text-[#D4873A]">{item.price} P</span>}
                        </div>
                      </div>
                      {/* Coin Badge - Right side */}
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
