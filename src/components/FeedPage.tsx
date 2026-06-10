"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Gamepad2, FileText, Vote, Radio, Tv, ShoppingBag, ChevronRight, Play, TrendingUp, RefreshCw, Check } from "lucide-react";
import GenXLoader from "@/components/GenXLoader";
import { useAuth } from "@/context/AuthContext";

interface FeedItem {
  _id: string;
  type: 'article' | 'rankroll' | 'arcade' | 'radio' | 'tv' | 'shop';
  linkedContentId?: string; // ID of linked Poll, TVVideo, etc.
  title: string;
  subtitle?: string;
  description?: string;
  image?: string;
  createdAt: string;
  // Type-specific fields
  category?: string; // articles
  totalVotes?: number; // rankroll
  itemCount?: number; // rankroll
  duration?: string; // tv
  youtubeId?: string; // tv
  price?: number; // shop
  playlistId?: string; // radio
}

interface FeedPageProps {
  onOpenArticle?: (articleId: string) => void;
  onOpenRankroll?: (pollId: string) => void;
  onOpenArcade?: () => void;
  onOpenTV?: () => void;
  onOpenRadio?: () => void;
  onOpenShop?: () => void;
}

const typeConfig = {
  article: { icon: FileText, label: 'ARTICLE', color: 'text-blue-600', bg: 'bg-blue-100' },
  rankroll: { icon: Vote, label: 'RANKROLL', color: 'text-[#D4873A]', bg: 'bg-[#D4873A]/10' },
  arcade: { icon: Gamepad2, label: 'ARCADE', color: 'text-purple-600', bg: 'bg-purple-100' },
  radio: { icon: Radio, label: 'RADIO', color: 'text-green-600', bg: 'bg-green-100' },
  tv: { icon: Tv, label: 'TV', color: 'text-red-600', bg: 'bg-red-100' },
  shop: { icon: ShoppingBag, label: 'SHOP', color: 'text-amber-600', bg: 'bg-amber-100' },
};

export default function FeedPage({ 
  onOpenArticle, 
  onOpenRankroll, 
  onOpenArcade, 
  onOpenTV, 
  onOpenRadio, 
  onOpenShop 
}: FeedPageProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const isPulling = useRef(false);

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

  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
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
      setRefreshing(false);
      setPullDistance(0);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling.current || containerRef.current?.scrollTop !== 0) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.5, 80));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60) {
      loadFeed(true);
    } else {
      setPullDistance(0);
    }
    isPulling.current = false;
  };

  const handleItemClick = (item: FeedItem) => {
    switch (item.type) {
      case 'article':
        onOpenArticle?.(item._id);
        break;
      case 'rankroll':
        // Open the article (which contains the ranking poll)
        onOpenArticle?.(item._id);
        break;
      case 'arcade':
        onOpenArcade?.();
        break;
      case 'tv':
        if (item.youtubeId) {
          window.open(`https://www.youtube.com/watch?v=${item.youtubeId}`, '_blank');
        } else {
          onOpenTV?.();
        }
        break;
      case 'radio':
        if (item.playlistId) {
          window.open(`https://open.spotify.com/playlist/${item.playlistId}`, '_blank');
        } else {
          onOpenRadio?.();
        }
        break;
      case 'shop':
        onOpenShop?.();
        break;
    }
  };

  const formatDate = (dateStr: string) => {
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-cream">
        <GenXLoader size="md" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-cream overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#D4873A]" />
          <span className="font-display text-lg tracking-wider text-gray-900">Feed</span>
        </div>
      </div>

      {/* Feed Items with Pull-to-Refresh */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 relative" 
        style={{ scrollbarWidth: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {(pullDistance > 0 || refreshing) && (
          <div 
            className="absolute left-0 right-0 flex items-center justify-center transition-all"
            style={{ top: refreshing ? 8 : pullDistance - 40, height: 40 }}
          >
            <div className={`p-2 rounded-full bg-[#D4873A]/10 ${refreshing ? 'animate-spin' : ''}`}>
              <RefreshCw className={`w-5 h-5 text-[#D4873A] ${pullDistance > 60 ? 'scale-110' : ''} transition-transform`} />
            </div>
          </div>
        )}
        {items.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No feed items yet.</p>
            <p className="text-gray-400 text-xs mt-1">Check back soon for updates!</p>
          </div>
        ) : (
          items.map((item) => {
            const config = typeConfig[item.type];
            const Icon = config.icon;
            const isRead = readArticles.has(item._id);

            return (
              <button
                key={`${item.type}-${item._id}`}
                onClick={() => handleItemClick(item)}
                className={`w-full text-left border rounded-xl overflow-hidden hover:border-[#D4873A]/30 hover:shadow-sm transition-all group p-3 flex gap-3 ${
                  isRead ? 'bg-cream/50 border-warm/50' : 'bg-cream border-warm'
                }`}
              >
                {/* Thumbnail (compact) - always show for visual consistency */}
                <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-skeleton">
                  {item.image && !item.image.endsWith('.mp4') ? (
                    <img 
                      src={item.image} 
                      alt="" 
                      className={`w-full h-full object-cover ${isRead ? 'opacity-80' : ''}`}
                    />
                  ) : item.image?.endsWith('.mp4') ? (
                    <video 
                      src={item.image} 
                      className={`w-full h-full object-cover ${isRead ? 'opacity-80' : ''}`}
                      muted
                      playsInline
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${config.bg}`}>
                      <Icon className={`w-8 h-8 ${config.color} opacity-50`} />
                    </div>
                  )}
                  {item.type === 'tv' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  )}
                  {item.duration && (
                    <span className="absolute bottom-0.5 right-0.5 text-[9px] font-medium bg-black/70 text-white px-1 py-0.5 rounded">
                      {item.duration}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Type Badge + Time */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-bold ${config.color} ${config.bg} px-1.5 py-0.5 rounded`}>
                      <Icon className="w-2.5 h-2.5" />
                      {config.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display text-base tracking-wide text-gray-900 group-hover:text-[#D4873A] transition-colors line-clamp-2 uppercase">
                    {item.title}
                  </h3>

                  {/* Meta Info */}
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    {item.totalVotes !== undefined && <span>{item.totalVotes} votes</span>}
                    {item.itemCount !== undefined && <span>{item.itemCount} items</span>}
                    {item.price !== undefined && <span className="font-semibold text-[#D4873A]">{item.price} P</span>}
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
  );
}
