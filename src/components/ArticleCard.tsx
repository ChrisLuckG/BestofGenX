"use client";

import { Clock, TrendingUp, Check, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

// Mood images for reactions display
const MOOD_IMAGES: Record<string, string> = {
  goth: '/images/moods/goth.png',
  grunge: '/images/moods/grunge.png',
  skater: '/images/moods/skater.png',
  newwave: '/images/moods/newwave.png',
  rockstar: '/images/moods/rockstar.png',
};

interface ArticleCardProps {
  article: {
    _id: string;
    title: string;
    subtitle?: string;
    coverImage?: string;
    category: string;
    authorName?: string;
    authorAvatar?: string;
    readTime: number;
    trending?: boolean;
    commentCount?: number;
    reactions?: Record<string, number>;
  };
  onClick?: () => void;
  variant?: 'compact' | 'full';
  isRead?: boolean; // Pass from parent if available
}

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

export default function ArticleCard({ article, onClick, variant = 'compact', isRead: isReadProp }: ArticleCardProps) {
  const { user } = useAuth();
  const [isRead, setIsRead] = useState(isReadProp ?? false);

  // Load read status from DB if not passed as prop
  useEffect(() => {
    if (isReadProp !== undefined) {
      setIsRead(isReadProp);
      return;
    }
    
    if (user?.id) {
      fetch(`/api/user/read-article?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          const dbRead: string[] = data.readArticles || [];
          setIsRead(dbRead.includes(article._id));
        })
        .catch(() => {});
    }
  }, [article._id, user?.id, isReadProp]);

  // Small Full Template - horizontal list item style
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex gap-3 p-3 border rounded-xl hover:border-[#D4873A]/30 hover:shadow-sm transition-all group ${
        isRead ? 'bg-cream/50 border-warm/50' : 'bg-cream border-warm'
      }`}
    >
      {/* Thumbnail - Left side */}
      {article.coverImage && (
        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
          {article.coverImage.includes('.mp4') ? (
            <video
              src={article.coverImage}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isRead ? 'opacity-80' : ''}`}
              muted
              autoPlay
              loop
              playsInline
            />
          ) : (
            <img
              src={article.coverImage}
              alt={article.title}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isRead ? 'opacity-80' : ''}`}
            />
          )}
          {article.trending && (
            <div className="absolute top-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500 rounded text-[8px] font-bold text-white uppercase">
              <TrendingUp className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
      )}

      {/* Content - Middle */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        {/* Category Badge */}
        <div className="mb-1">
          <span className="px-2 py-0.5 bg-[#D4873A] rounded text-[9px] font-semibold text-white uppercase tracking-wider">
            {CATEGORY_LABELS[article.category] || article.category}
          </span>
        </div>
        
        {/* Title */}
        <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-[#D4873A] transition-colors">
          {article.title}
        </h3>
        
        {/* Subtitle - only in full variant */}
        {article.subtitle && variant === 'full' && (
          <p className="text-gray-500 text-xs mb-1 line-clamp-1">
            {article.subtitle}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-2 text-[10px] text-gray-600">
          {article.authorName && (
            <>
              <span className="font-medium text-gray-500">{article.authorName}</span>
              <span>·</span>
            </>
          )}
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{article.readTime} min</span>
          </div>
          
          {/* Moods & Comments */}
          {(article.reactions || article.commentCount) && (
            <>
              <span>·</span>
              <div className="flex items-center gap-2">
                {/* Top Moods */}
                {article.reactions && Object.keys(article.reactions).length > 0 && (
                  <div className="flex items-center gap-0.5">
                    <span className="flex -space-x-1">
                      {Object.entries(article.reactions)
                        .filter(([, count]) => count > 0)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([id]) => (
                          MOOD_IMAGES[id] && <img key={id} src={MOOD_IMAGES[id]} alt="" className="w-4 h-4" />
                        ))}
                    </span>
                    <span className="font-medium">{Object.values(article.reactions).reduce((a, b) => a + b, 0)}</span>
                  </div>
                )}
                {/* Comments */}
                {article.commentCount !== undefined && article.commentCount > 0 && (
                  <div className="flex items-center gap-0.5">
                    <MessageCircle className="w-3 h-3" />
                    <span>{article.commentCount}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Coin Badge - Right side */}
      <div className="flex items-center flex-shrink-0">
        <div className={`px-2 py-1 rounded-lg border-2 text-xs font-bold flex items-center gap-1 ${
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
}
