"use client";

import { Clock, TrendingUp, Check, MessageCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { isVideoUrl } from "@/utils/media";
import CardMoodReactions from "@/components/CardMoodReactions";
import CategoryBadge from "@/components/CategoryBadge";

interface ArticleCardProps {
  article: {
    _id: string;
    title: string;
    subtitle?: string;
    coverImage?: string;
    category: string;
    authorName?: string;
    authorAvatar?: string;
    readTime?: number;
    trending?: boolean;
    commentCount?: number;
    reactions?: Record<string, number>;
    personCountry?: string;
    personCountryCode?: string;
  };
  onClick?: () => void;
  onShowLogin?: () => void;
  variant?: 'compact' | 'full';
  isRead?: boolean; // Pass from parent if available
}

const CATEGORY_LABELS: Record<string, string> = {
  'movies-tv': 'Movies & TV',
  'eastercorn': 'Eastercorn',
  'music': 'Music',
  'gaming': 'Gaming',
  'rewind': 'Rewind',
  'sports': 'Sports',
  'tech': 'Tech',
  'culture': 'Culture',
  'news': 'News',
  'lifestyle': 'Lifestyle',
  'rip': 'RIP',
};

export default function ArticleCard({ article, onClick, onShowLogin, variant = 'compact', isRead: isReadProp }: ArticleCardProps) {
  const { user, isLoggedIn } = useAuth();
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
    <div
      className={`w-full text-left flex gap-3 p-3 border rounded-xl hover:border-[#E36B11]/30 hover:shadow-sm transition-all group ${
        isRead ? 'bg-cream/50 border-warm/50' : 'bg-cream border-warm'
      }`}
    >
      {/* Thumbnail - Left side */}
      {article.coverImage && (
        <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden cursor-pointer" onClick={onClick}>
          {isVideoUrl(article.coverImage) ? (
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
      <div className="flex-1 flex flex-col justify-center min-w-0 cursor-pointer" onClick={onClick}>
        {/* Category Badge with integrated Flag */}
        <div className="mb-1">
          <CategoryBadge 
            category={article.category} 
            size="sm" 
            countryCode={article.personCountryCode}
            countryName={article.personCountry}
          />
        </div>
        
        {/* Title */}
        <h3 className="font-bold text-gray-900 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-[#E36B11] transition-colors">
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
          
          {/* Moods & Comments */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
            {article.commentCount !== undefined && article.commentCount > 0 && (
              <div className="flex items-center gap-0.5">
                <MessageCircle className="w-3 h-3" />
                <span>{article.commentCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Coin Badge - Right side */}
      <div className="flex items-center flex-shrink-0">
        <div className={`px-2 py-1 rounded-lg border-2 text-xs font-bold flex items-center gap-1 ${
          isRead 
            ? 'border-[#E36B11] text-[#E36B11] bg-[#E36B11]/10' 
            : 'border-gray-900 text-gray-900'
        }`}>
          {isRead && <Check className="w-3 h-3" />}
          0.05
        </div>
      </div>
    </div>
  );
}
