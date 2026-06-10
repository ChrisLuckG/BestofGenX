"use client";

import { useEffect, useState, useRef } from "react";
import { Clock, Play, Share2, MoreHorizontal, MessageCircle, Check, Bookmark, Flag } from "lucide-react";
import PollCard from "@/components/PollCard";
import QuizPollCard from "@/components/QuizPoll";
import CardMoodReactions from "@/components/CardMoodReactions";
import { useAuth } from "@/context/AuthContext";

interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  imageScale?: number;
  imagePosition?: 'top' | 'center' | 'bottom' | 'left' | 'right';
  imagePosX?: number;
  imagePosY?: number;
  mainCategory: string;  // Main category (articles, arcade, voting, shop)
  category: string;      // Sub category (music, culture, etc.)
  authorName?: string;
  authorAvatar?: string;
  readTime: number;
  trending?: boolean;
  layout?: 'featured' | 'trending' | 'standard';
  likes?: number;
  views?: number;
  commentsCount?: number;
  status?: 'draft' | 'published' | 'archived';
  createdAt?: string;
  closesAt?: string;  // For voting/poll articles - when the poll closes
  // Styling options
  titleColor?: string;
  titleFont?: 'default' | 'display' | 'serif' | 'mono';
  subtitleColor?: string;
  contentColor?: string;
}

// Main category labels for frontend display
const MAIN_CATEGORY_LABELS: Record<string, string> = {
  'articles': 'ARTICLES',
  'arcade': 'ARCADE',
  'voting': 'VOTING',
  'shop': 'SHOP',
};

// Helper to get frontend label from mainCategory
const getCategoryLabel = (mainCategory: string): string => {
  return MAIN_CATEGORY_LABELS[mainCategory] || 'ARTICLES';
};

// Helper to check if URL is a video
const isVideo = (url?: string): boolean => {
  return url?.includes('.mp4') || false;
};

// Helper to get object-position from article
const getImagePosition = (article: Article): string => {
  if (article.imagePosX !== undefined || article.imagePosY !== undefined) {
    return `${article.imagePosX ?? 50}% ${article.imagePosY ?? 50}%`;
  }
  return article.imagePosition || 'center';
};

// Helper to format relative time (e.g., "5m ago", "2h ago", "3d ago")
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
};

interface LandingPageProps {
  onOpenArticle?: (articleId: string) => void;
  readArticles?: Set<string>;
  isDesktop?: boolean;
  onShowLogin?: () => void;
}

export default function LandingPage({ onOpenArticle, readArticles = new Set(), isDesktop = false, onShowLogin }: LandingPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [templateItems, setTemplateItems] = useState<{size: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10, articleId: string | null, articleId2?: string | null, sliderArticles?: string[], verticalArticles?: string[], adData?: {image: string, link: string, title: string}}[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; icon: 'check' | 'bookmark' | 'flag' } | null>(null);

  const showToast = (message: string, icon: 'check' | 'bookmark' | 'flag' = 'check') => {
    setToast({ message, icon });
    setTimeout(() => setToast(null), 2000);
  };

  // Fetch articles, polls and template from database
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch articles, polls and template in parallel
        const [articlesRes, pollsRes, templateRes] = await Promise.all([
          fetch('/api/articles?status=published&limit=100'),
          fetch('/api/polls?status=active'),
          fetch('/api/template')
        ]);
        
        const articlesData = await articlesRes.json();
        const pollsData = await pollsRes.json();
        const templateData = await templateRes.json();
        
        if (articlesData.success && articlesData.articles?.length > 0) {
          setArticles(articlesData.articles);
        }
        
        if (pollsData.success && pollsData.polls?.length > 0) {
          setPolls(pollsData.polls);
        }
        
        if (templateData.success && templateData.template?.length > 0) {
          console.log('Loaded template from DB:', templateData.template);
          setTemplateItems(templateData.template);
        } else {
          console.log('No template found in DB:', templateData);
        }
      } catch (e) {
        console.error('Failed to fetch data:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Card Actions Component - handles like, comment, share independently
  const CardActions = ({ article, size = 'normal' }: { article: Article; size?: 'small' | 'normal' }) => {
    const iconSize = size === 'small' ? 'w-4 h-4' : 'w-5 h-5';
    const textSize = size === 'small' ? 'text-[11px]' : 'text-[13px]';
    
    const copyToClipboard = async (text: string) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        return true;
      } catch {
        return false;
      }
    };

    const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const url = `${window.location.origin}/article/${article._id}`;
      
      // Try native share first (mobile)
      if (navigator.share) {
        try {
          await navigator.share({ title: article.title, url });
          return; // Success - don't show alert
        } catch (err: unknown) {
          // User cancelled or share failed - fall through to copy
          if (err instanceof Error && err.name === 'AbortError') {
            return; // User cancelled, don't do anything
          }
        }
      }
      
      // Fallback to copy
      const copied = await copyToClipboard(url);
      if (copied) showToast('Link copied!', 'check');
    };

    const handleLike = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Open article to like (or implement inline like)
      onOpenArticle?.(article._id);
    };

    const handleComment = (e: React.MouseEvent) => {
      e.stopPropagation();
      // Open article to comment section
      onOpenArticle?.(article._id);
    };

    return (
      <div className="flex items-center gap-4 text-gray-500">
        <CardMoodReactions 
            articleId={article._id} 
            userId={user?.id} 
            isLoggedIn={isLoggedIn} 
            onShowLogin={onShowLogin}
            size="sm" 
          />
        <button onClick={handleComment} className="flex items-center gap-1.5 hover:text-[#D4873A] transition-colors">
          <MessageCircle className={iconSize} />
          <span className={`${textSize} font-medium`}>{article.commentsCount || 0}</span>
        </button>
        <button onClick={handleShare} className="ml-auto hover:text-[#D4873A] transition-colors">
          <Share2 className={iconSize} />
        </button>
      </div>
    );
  };

  // Card Menu Component - handles more options
  const CardMenu = ({ article }: { article: Article }) => {
    const [open, setOpen] = useState(false);
    
    const copyToClipboard = async (text: string) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.left = '-9999px';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
        }
        return true;
      } catch {
        return false;
      }
    };
    
    const handleMenuClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(!open);
    };

    const handleShare = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      const url = `${window.location.origin}/article/${article._id}`;
      
      if (navigator.share) {
        try {
          await navigator.share({ title: article.title, url });
          return;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
        }
      }
      
      const copied = await copyToClipboard(url);
      if (copied) showToast('Link copied!', 'check');
    };

    const handleCopy = async (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      const url = `${window.location.origin}/article/${article._id}`;
      const copied = await copyToClipboard(url);
      if (copied) showToast('Link copied!', 'check');
    };

    const handleSave = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      showToast('Saved to reading list!', 'bookmark');
    };

    const handleReport = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      showToast('Thanks for reporting', 'flag');
    };

    const handleOpenArticle = (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen(false);
      onOpenArticle?.(article._id);
    };

    return (
      <div className="relative">
        <button onClick={handleMenuClick} className="text-gray-600 hover:text-gray-900 p-1">
          <MoreHorizontal className="w-5 h-5" />
        </button>
        {open && (
          <>
            {/* Backdrop to close menu */}
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
            <div className="absolute right-0 top-8 bg-white border border-warm rounded-xl shadow-xl py-1.5 z-50 min-w-[160px]">
              <button onClick={handleOpenArticle} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#D4873A]/5 flex items-center gap-3">
                <svg className="w-4 h-4 text-[#D4873A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Read Article
              </button>
              <button onClick={handleSave} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#D4873A]/5 flex items-center gap-3">
                <svg className="w-4 h-4 text-[#D4873A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                Save
              </button>
              <button onClick={handleShare} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#D4873A]/5 flex items-center gap-3">
                <Share2 className="w-4 h-4 text-[#D4873A]" />
                Share
              </button>
              <button onClick={handleCopy} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#D4873A]/5 flex items-center gap-3">
                <svg className="w-4 h-4 text-[#D4873A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Copy Link
              </button>
              <div className="border-t border-warm my-1" />
              <button onClick={handleReport} className="w-full px-4 py-2.5 text-left text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 flex items-center gap-3">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                Report
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  // Article Card Components
  const MainBox = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full h-[280px] md:h-[350px] lg:h-[400px] rounded-2xl overflow-hidden group text-left relative border border-white/10 hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200"
      style={{
        backgroundImage: article.coverImage ? `url(${article.coverImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: getImagePosition(article),
      }}
    >
      {/* Gradient overlay - only at bottom for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      
      {/* Category badge */}
      <div className="absolute top-3 left-3 z-20">
        <span className="px-3 py-1.5 bg-[#D4873A] text-white text-[10px] font-bold uppercase tracking-wider rounded">
          {getCategoryLabel(article.mainCategory)}
        </span>
      </div>
      
      {/* Coin reward badge - gray when unread, green when read */}
      <div className="absolute top-3 right-3 z-20">
        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(article._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
          0.05{readArticles.has(article._id) && <Check className="w-2.5 h-2.5" />}
        </span>
      </div>
      
      {/* Content - fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
        <h2 className="font-display text-[28px] lg:text-[32px] tracking-wide text-white group-hover:text-[#D4873A] leading-tight mb-1.5 line-clamp-2 transition-colors">{article.title}</h2>
        <div className="flex items-center justify-between gap-2 text-[11px] text-white/70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-white/30">
              {article.authorAvatar ? (
                <img src={article.authorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#D4873A] flex items-center justify-center text-white text-[8px] font-bold">
                  {(article.authorName || 'A')[0].toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate">{article.authorName}</span>
            {isDesktop && <span className="flex items-center gap-1 flex-shrink-0"><Clock className="w-3 h-3" />{article.readTime} min</span>}
          </div>
          {/* Mood Reactions & Comments inline */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="sm" />
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{article.commentsCount || 0}</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const url = `${window.location.origin}/article/${article._id}`;
                if (navigator.share) {
                  navigator.share({ title: article.title, url });
                } else {
                  navigator.clipboard.writeText(url);
                  showToast('Link copied!', 'check');
                }
              }}
              className="flex items-center"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </button>
  );

  // MainSocial - Like MainBox but with social header (avatar, name, likes) like HalfCard
  const MainSocial = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full rounded-xl overflow-hidden bg-cream border border-warm text-left shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 group"
    >
      {/* Social Header: Avatar + Name + Time + Menu */}
      <div className="flex items-center gap-2 p-3 border-b border-warm/50">
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-warm">
          {article.authorAvatar ? (
            <img src={article.authorAvatar} alt={article.authorName || 'Author'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#D4873A]/20 flex items-center justify-center text-[#D4873A] font-bold text-sm">
              {(article.authorName || 'A')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-gray-900 truncate">{article.authorName || 'Author'}</div>
          <div className="text-[11px] text-gray-500">{article.createdAt ? new Date(article.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</div>
        </div>
        <CardMenu article={article} />
      </div>
      
      {/* Large Image/Video - Full width, fixed height with cover + Title overlay */}
      <div className="w-full h-[200px] md:h-[280px] lg:h-[320px] relative overflow-hidden">
        {article.coverImage ? (
          isVideo(article.coverImage) ? (
            <video 
              src={article.coverImage} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: getImagePosition(article) }}
              muted autoPlay loop playsInline
            />
          ) : (
            <img 
              src={article.coverImage} 
              alt={article.title} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: getImagePosition(article) }}
            />
          )
        ) : (
          <div className="w-full h-full bg-gray-200" />
        )}
        {/* Dark gradient for text readability - only on desktop */}
        {isDesktop && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />}
        {/* Category badge - top left on mobile, bottom left on desktop */}
        <div className={`absolute ${isDesktop ? 'bottom-14 md:bottom-16' : 'top-3'} left-3 z-20 flex items-center gap-2`}>
          <span className="px-2 py-1 bg-[#D4873A] text-white text-[10px] font-bold uppercase tracking-wider rounded">
            {getCategoryLabel(article.mainCategory)}
          </span>
          {isDesktop && (
            <span className="px-2 py-1 bg-black/60 text-white text-[10px] font-medium rounded flex items-center gap-1">
              <Clock className="w-3 h-3" />{article.readTime} min
            </span>
          )}
        </div>
        {/* Title ON the image - only on desktop */}
        {isDesktop && (
          <h2 className="absolute bottom-3 left-3 right-3 font-display text-[26px] lg:text-3xl tracking-wide text-white group-hover:text-[#D4873A] leading-tight line-clamp-2 drop-shadow-lg transition-colors z-10">
            {article.title}
          </h2>
        )}
        {/* Coin reward badge - gray when unread, green when read */}
        <div className="absolute top-3 right-3 z-20">
          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(article._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
            0.05{readArticles.has(article._id) && <Check className="w-2.5 h-2.5" />}
          </span>
        </div>
      </div>
      
      {/* Content - title below image on mobile, subtitle on desktop */}
      <div className="p-3 border-t border-warm/50">
        {!isDesktop && <h3 className="font-display text-[26px] lg:text-3xl tracking-wide text-gray-900 leading-tight mb-1 line-clamp-2">{article.title}</h3>}
        {isDesktop && article.subtitle && <p className="text-gray-900 text-[15px] mb-1 line-clamp-2">{article.subtitle}</p>}
      </div>
      
      {/* Footer: Likes, Comments, Share */}
      <div className="px-3 pb-3 pt-2 border-t border-warm/50">
        <CardActions article={article} />
      </div>
    </button>
  );

  const SmallBox = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full h-[180px] rounded-xl overflow-hidden group text-left relative border border-white/10"
    >
      {/* Full background image/video */}
      {article.coverImage && (
        isVideo(article.coverImage) ? (
          <video src={article.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
        ) : (
          <img src={article.coverImage} alt={article.title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
        )
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      
      {/* Category badge - top left */}
      <div className="absolute top-2 left-2 z-20">
        <span className="px-2 py-0.5 bg-[#D4873A] text-white text-[8px] font-bold uppercase rounded">
          {getCategoryLabel(article.mainCategory)}
        </span>
      </div>
      
      {/* Coin reward badge - gray when unread, green when read */}
      <div className="absolute top-2 right-2 z-20">
        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(article._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
          0.05{readArticles.has(article._id) && <Check className="w-2 h-2" />}
        </span>
      </div>
      
      {/* Content - bottom */}
      <div className="absolute bottom-2 left-2 right-2 z-10">
        <h3 className="font-display text-[18px] lg:text-xl tracking-wide text-white leading-tight mb-1 line-clamp-2">{article.title}</h3>
        <div className="flex items-center justify-between gap-1 text-[10px] text-white/70">
          {isDesktop && <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />{article.readTime} min
          </span>}
          {/* Moods & Comments inline */}
          <div className="flex items-center gap-2">
            <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{article.commentsCount || 0}</span>
            </span>
          </div>
        </div>
      </div>
    </button>
  );

  const MediumBox = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full h-[180px] rounded-xl overflow-hidden group text-left relative border border-warm hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200"
    >
      {/* Full background image/video */}
      {article.coverImage && (
        isVideo(article.coverImage) ? (
          <video src={article.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
        ) : (
          <img src={article.coverImage} alt={article.title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
        )
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      
      {/* Category badge - top left */}
      <div className="absolute top-2 left-2 z-20">
        <span className="px-2 py-1 bg-[#D4873A] text-white text-[8px] font-bold uppercase rounded">
          {getCategoryLabel(article.mainCategory)}
        </span>
      </div>
      
      {/* Coin reward badge - gray when unread, green when read */}
      <div className="absolute top-2 right-2 z-20">
        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(article._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
          0.05{readArticles.has(article._id) && <Check className="w-2 h-2" />}
        </span>
      </div>
      
      {/* Content - fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <h3 className="font-display text-[19px] lg:text-xl tracking-wide text-white group-hover:text-[#D4873A] leading-tight mb-1 line-clamp-2 transition-colors">{article.title}</h3>
        <div className="flex items-center justify-between gap-2 text-[10px] text-white/70">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{article.authorName}</span>
            {isDesktop && <span className="flex items-center gap-1 flex-shrink-0"><Clock className="w-3 h-3" />{article.readTime} min</span>}
          </div>
          {/* Likes & Comments inline */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{article.commentsCount || 0}</span>
            </span>
          </div>
        </div>
      </div>
    </button>
  );

  // Slider Card - Small card for horizontal slider
  const SliderCard = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="flex-shrink-0 w-32 rounded-xl overflow-hidden bg-cream border border-warm text-left shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 relative group"
    >
      {/* Coin reward badge - gray when unread, green when read */}
      <div className="absolute top-1 right-1 z-20">
        <span className={`px-1 py-0.5 text-[7px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(article._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
          0.05{readArticles.has(article._id) && <Check className="w-2 h-2" />}
        </span>
      </div>
      {/* Image/Video */}
      {article.coverImage && (
        <div className="w-full h-20 overflow-hidden">
          {isVideo(article.coverImage) ? (
            <video src={article.coverImage} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
          ) : (
            <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
          )}
        </div>
      )}
      {/* Content */}
      <div className="p-1.5">
        <h3 className="font-display text-[16px] tracking-wide text-gray-900 group-hover:text-[#D4873A] leading-tight line-clamp-2 transition-colors">{article.title}</h3>
        {/* Likes & Comments */}
        <div className="flex items-center gap-2 mt-1 text-[8px] text-gray-500">
          <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
          <span className="flex items-center gap-0.5">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {article.commentsCount || 0}
          </span>
        </div>
      </div>
    </button>
  );

  // Horizontal Slider Container
  const SliderContainer = ({ articleIds }: { articleIds: string[] }) => {
    const sliderArticles = articleIds.map(id => getArticleById(id)).filter(Boolean) as Article[];
    if (sliderArticles.length === 0) return null;
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const [activePage, setActivePage] = useState(0);
    const visibleCards = 2.5; // ~2.5 cards visible at once
    const totalPages = Math.ceil(sliderArticles.length / visibleCards);
    
    const handleScroll = () => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        const maxScroll = scrollWidth - clientWidth;
        if (maxScroll > 0) {
          const page = Math.round((scrollLeft / maxScroll) * (totalPages - 1));
          setActivePage(page);
        }
      }
    };
    
    return (
      <div className="w-full bg-cream rounded-xl border border-warm shadow-sm p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-[#D4873A] uppercase tracking-wider">More Articles</span>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <div 
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === activePage ? 'bg-[#D4873A]' : 'bg-[#D4873A]/30'}`}
              />
            ))}
          </div>
        </div>
        
        {/* Slider */}
        <div 
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-2 overflow-x-auto scrollbar-hide" 
          style={{ scrollbarWidth: 'none' }}
        >
          {sliderArticles.map((article, idx) => (
            <SliderCard key={idx} article={article} />
          ))}
        </div>
      </div>
    );
  };

  // Half Card - 50% width, like "FROM THE COMMUNITY" social post style
  const HalfCard = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full rounded-xl overflow-hidden bg-cream border border-warm text-left shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 group"
    >
      {/* Header: Avatar + Name + Time + Menu */}
      <div className="flex items-center gap-2 p-3 pb-2 md:border-b md:border-warm/50">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden flex-shrink-0 border border-warm">
          {article.authorAvatar ? (
            <img src={article.authorAvatar} alt={article.authorName || 'Author'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#D4873A]/20 flex items-center justify-center text-[#D4873A] font-bold text-xs md:text-sm">
              {(article.authorName || 'A')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] md:text-[14px] font-bold text-gray-900 truncate">{article.authorName || 'Author'}</div>
          <div className="text-[10px] md:text-[11px] text-gray-500">{article.createdAt ? new Date(article.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</div>
        </div>
        <CardMenu article={article} />
      </div>
      
      {/* Image/Video with Title Overlay */}
      {article.coverImage && (
        <div className="w-full aspect-[4/3] overflow-hidden relative">
          {isVideo(article.coverImage) ? (
            <video 
              src={article.coverImage} 
              className="w-full h-full object-cover"
              style={{
                objectPosition: getImagePosition(article),
                transform: `scale(${(article.imageScale || 100) / 100})`,
              }}
              muted
              autoPlay
              loop
              playsInline
            />
          ) : (
            <img 
              src={article.coverImage} 
              alt={article.title} 
              className="w-full h-full object-cover"
              style={{
                objectPosition: getImagePosition(article),
                transform: `scale(${(article.imageScale || 100) / 100})`,
              }}
            />
          )}
          {/* Dark gradient for text readability - only on desktop */}
          {isDesktop && <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />}
          {/* Title ON the image - only on desktop */}
          {isDesktop && (
            <h3 className="absolute bottom-2 left-2 right-2 font-display text-lg lg:text-3xl tracking-wide text-white group-hover:text-[#D4873A] leading-tight line-clamp-3 drop-shadow-lg transition-colors">
              {article.title}
            </h3>
          )}
          {/* Coin reward badge - gray when unread, green when read */}
          <div className="absolute top-2 right-2 z-20">
            <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(article._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
              0.05{readArticles.has(article._id) && <Check className="w-2 h-2" />}
            </span>
          </div>
        </div>
      )}
      
      {/* Content - title below image on mobile, subtitle on desktop */}
      <div className="p-3 pt-2.5">
        {!isDesktop && <h3 className="font-display text-[19px] tracking-wide text-gray-900 leading-snug line-clamp-2 mb-1">{article.title}</h3>}
        {isDesktop && article.subtitle && <p className="text-[15px] text-gray-900 leading-snug line-clamp-2 mb-1">{article.subtitle}</p>}
      </div>
      
      {/* Footer: Likes, Comments, Share */}
      <div className="px-3 pb-3">
        <CardActions article={article} size="small" />
      </div>
    </button>
  );

  // Full Width Banner - Like "TRENDING ARTICLES" section - horizontal card with image left, text right
  const FullWidthBanner = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full flex items-center gap-3 p-2 bg-cream border border-warm rounded-lg text-left shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 relative group"
    >
      {/* Coin reward badge - gray when unread, green when read */}
      <div className="absolute top-1.5 right-1.5 z-20">
        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(article._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
          0.05{readArticles.has(article._id) && <Check className="w-2 h-2" />}
        </span>
      </div>
      {/* Thumbnail - bigger */}
      {article.coverImage && (
        <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0 border border-warm">
          {isVideo(article.coverImage) ? (
            <video src={article.coverImage} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
          ) : (
            <img src={article.coverImage} alt={article.title} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
          )}
        </div>
      )}
      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between h-20">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[#D4873A] text-[10px] font-bold uppercase">{getCategoryLabel(article.mainCategory)}</span>
            <span className="text-gray-500 text-[10px]">• {article.createdAt ? new Date(article.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</span>
          </div>
          <h3 className={`font-display tracking-wide text-gray-900 group-hover:text-[#D4873A] leading-tight line-clamp-1 transition-colors ${isDesktop ? 'text-[20px]' : 'text-[20px]'}`}>{article.title}</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
          <span className="flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {article.commentsCount || 0}
          </span>
        </div>
      </div>
    </button>
  );

  // Get article by ID helper
  const getArticleById = (id: string | null): Article | undefined => {
    if (!id) return undefined;
    return articles.find(a => a._id === id);
  };

  // Smart article getter for FeaturedCard - if assigned article is read, show next unread
  const getFeaturedArticle = (id: string | null): Article | undefined => {
    if (!id) return undefined;
    const assignedArticle = articles.find(a => a._id === id);
    
    // If assigned article exists and is NOT read, show it
    if (assignedArticle && !readArticles.has(assignedArticle._id)) {
      return assignedArticle;
    }
    
    // If assigned article is read, find next unread article from the list
    // Prioritize articles not already in the template
    const templateArticleIds = new Set(
      templateItems
        .filter(item => item.articleId)
        .map(item => item.articleId)
    );
    
    // Find first unread article that's not already prominently displayed
    const nextUnread = articles.find(a => 
      a.status === 'published' && 
      !readArticles.has(a._id) && 
      !templateArticleIds.has(a._id)
    );
    
    if (nextUnread) return nextUnread;
    
    // If all articles are read or in template, just show the assigned one
    return assignedArticle;
  };

  // Placeholder for unpublished/draft articles
  const UnpublishedPlaceholder = () => (
    <div className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 bg-cream flex flex-col items-center justify-center text-gray-600">
      <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span className="text-xs font-semibold uppercase tracking-wider">Unpublished</span>
      <span className="text-[10px]">Coming Soon</span>
    </div>
  );

  // Categories: Feed = mix of all, others filter by mainCategory
  const categories = ['Feed', 'Articles', 'Arcade', 'Voting', 'Shop'];
  const [activeCategory, setActiveCategory] = useState('Feed');
  
  // Map tab names to mainCategory values
  const categoryMap: Record<string, string | null> = {
    'Feed': null,         // Show all (mix)
    'Articles': 'articles',
    'Arcade': 'arcade',
    'Voting': 'voting',
    'Shop': 'shop',
  };

  // Loading state - Skeleton Cards
  if (isLoading) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
        {/* Header - exactly like Rankings */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-cream">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-[#D4873A]" />
            <span className="font-display text-lg tracking-wider text-gray-900">Feed</span>
          </div>
        </div>
        
        {/* Skeleton Cards Grid */}
        <div className="flex-1 overflow-hidden px-2 pt-3">
          <div className="grid grid-cols-6 gap-2">
            {/* Large Card Skeleton */}
            <div className="col-span-6 rounded-xl bg-skeleton-light overflow-hidden">
              <div className="aspect-[16/9] bg-gradient-to-r from-skeleton-light via-skeleton to-skeleton-light animate-shimmer" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-skeleton rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-skeleton rounded w-1/2 animate-pulse" />
              </div>
            </div>
            
            {/* Two Half Cards Skeleton */}
            {[1, 2].map((i) => (
              <div key={i} className="col-span-3 rounded-xl bg-skeleton-light overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <div className="w-9 h-9 rounded-full bg-skeleton animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-skeleton rounded w-20 animate-pulse" />
                    <div className="h-2 bg-skeleton rounded w-12 animate-pulse" />
                  </div>
                </div>
                <div className="aspect-[4/3] bg-gradient-to-r from-skeleton-light via-skeleton to-skeleton-light animate-shimmer" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-skeleton rounded w-full animate-pulse" />
                  <div className="h-3 bg-skeleton rounded w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
            
            {/* Full Width Banner Skeleton */}
            <div className="col-span-6 flex items-center gap-3 p-3 rounded-xl bg-skeleton-light">
              <div className="w-20 h-20 rounded-lg bg-gradient-to-r from-skeleton-light via-skeleton to-skeleton-light animate-shimmer flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-skeleton rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-skeleton rounded w-1/2 animate-pulse" />
                <div className="h-2 bg-skeleton rounded w-1/4 animate-pulse" />
              </div>
            </div>
          </div>
          
          {/* Loading indicator at bottom */}
          <div className="flex items-center justify-center gap-2 py-6">
            <div className="w-2 h-2 bg-[#D4873A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#D4873A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#D4873A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        
        <style jsx>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .animate-shimmer {
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header - exactly like Rankings */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-[#D4873A]" />
          <span className="font-display text-lg tracking-wider text-gray-900">Feed</span>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* DYNAMIC GRID TEMPLATE - 6 column grid for flexibility */}
        <div className="grid grid-cols-6 gap-1.5 px-2 pb-4 pt-3">
            {templateItems
              .filter(item => {
                // Multi-article containers don't need articleId check
                if (item.size === 6 || item.size === 9) return true;
                // 2 Halfer needs at least one article
                if (item.size === 10) return item.articleId || item.articleId2;
                // Ad container needs adData
                if (item.size === 8) return item.adData?.image;
                // Single article containers need articleId
                if (!item.articleId) return false;
                return true;
              })
              .map((item, index) => {
                // Size 10 = 2 Halfer (two half cards side by side)
                if (item.size === 10) {
                  const leftArticle = getArticleById(item.articleId);
                  const rightArticle = getArticleById(item.articleId2 || null);
                  if (!leftArticle && !rightArticle) return null;
                  return (
                    <div key={index} className="col-span-6 grid grid-cols-2 gap-1.5">
                      {leftArticle && <HalfCard article={leftArticle} />}
                      {rightArticle && <HalfCard article={rightArticle} />}
                    </div>
                  );
                }
                
                // Size 9 = Vertical (stacked articles container)
                if (item.size === 9) {
                  const vertArticles = (item.verticalArticles || []).map(id => getArticleById(id)).filter(Boolean) as Article[];
                  if (vertArticles.length === 0) return null;
                  return (
                    <div key={index} className="col-span-6 space-y-2">
                      {vertArticles.map((art, i) => (
                        <button
                          key={i}
                          onClick={() => onOpenArticle?.(art._id)}
                          className="w-full flex items-center gap-3 p-2.5 bg-cream border border-warm rounded-xl hover:border-[#D4873A]/30 hover:shadow-md transition-all text-left relative group"
                        >
                          {/* Coin reward badge - gray when unread, green when read */}
                          <div className="absolute top-2 right-2 z-20">
                            <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded flex items-center gap-0.5 ${readArticles.has(art._id) ? 'bg-green-500 text-white' : 'bg-gray-800/70 text-white'}`}>
                              0.05{readArticles.has(art._id) && <Check className="w-2 h-2" />}
                            </span>
                          </div>
                          {/* Thumbnail */}
                          {art.coverImage && (
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-warm">
                              <img src={art.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" style={{ objectPosition: getImagePosition(art), transform: `scale(${(art.imageScale || 100) / 100})` }} />
                            </div>
                          )}
                          {/* Content */}
                          <div className="flex-1 min-w-0 pr-8">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[#D4873A] text-[10px] font-bold uppercase">{getCategoryLabel(art.mainCategory)}</span>
                              <span className="text-gray-500 text-[10px]">• {art.createdAt ? new Date(art.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</span>
                            </div>
                            <h3 className="font-display text-[16px] tracking-wide text-gray-900 group-hover:text-[#D4873A] leading-tight line-clamp-2 mb-0.5 transition-colors">{art.title}</h3>
                            <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
                              <CardMoodReactions articleId={art._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
                              <span className="flex items-center gap-0.5">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                {art.commentsCount || 0}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                }
                
                // Size 8 = Ad banner
                if (item.size === 8 && item.adData?.image) {
                  return (
                    <a 
                      key={index} 
                      href={item.adData.link || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="col-span-6 block rounded-xl overflow-hidden border border-warm"
                    >
                      <img src={item.adData.image} alt={item.adData.title || 'Ad'} className="w-full h-20 object-cover" />
                    </a>
                  );
                }
                
                // Size 6 = Slider (horizontal scroll container)
                if (item.size === 6) {
                  return <div key={index} className="col-span-6"><SliderContainer articleIds={item.sliderArticles || []} /></div>;
                }
                
                // Size 3 = FeaturedCard (MainBox) - use smart getter that shows unread articles
                if (item.size === 3) {
                  const featuredArticle = getFeaturedArticle(item.articleId);
                  if (!featuredArticle || featuredArticle.status === 'draft') return null;
                  return <div key={index} className="col-span-6"><MainBox article={featuredArticle} /></div>;
                }
                
                const article = getArticleById(item.articleId);
                
                // Skip if article not found or is draft (don't show in frontend)
                if (!article || article.status === 'draft') {
                  return null;
                }
                
                // Size mapping: 7=MainSocial(6cols), 5=Half(3cols), 4=Full(6cols), 2=Med(4cols), 1=Small(2cols)
                if (item.size === 7) return <div key={index} className="col-span-6"><MainSocial article={article} /></div>;
                if (item.size === 5) return <div key={index} className="col-span-3"><HalfCard article={article} /></div>;
                if (item.size === 4) return <div key={index} className="col-span-6"><FullWidthBanner article={article} /></div>;
                if (item.size === 2) return <div key={index} className="col-span-4"><MediumBox article={article} /></div>;
                return <div key={index} className="col-span-2"><SmallBox article={article} /></div>;
              })}
          </div>
        
        {/* Footer - visible at bottom of feed */}
        <footer className="mt-8 pb-8 px-4">
          {/* Logo - clickable to About page */}
          <div className="flex justify-center mb-6">
            <a href="/about" className="hover:opacity-60 transition-opacity">
              <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-8 opacity-40" />
            </a>
          </div>
          
          {/* Links */}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-600 mb-6">
            <a href="/impressum" className="hover:text-gray-600 transition-colors">Impressum</a>
            <a href="/datenschutz" className="hover:text-gray-600 transition-colors">Datenschutz</a>
            <a href="/agb" className="hover:text-gray-600 transition-colors">AGB</a>
            <a href="/karriere" className="hover:text-gray-600 transition-colors">Karriere</a>
            <a href="/kontakt" className="hover:text-gray-600 transition-colors">Kontakt</a>
            <a href="/presse" className="hover:text-gray-600 transition-colors">Presse</a>
          </div>
          
          {/* Social Links */}
          <div className="flex justify-center gap-4 mb-6">
            <a href="https://instagram.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
            <a href="https://linkedin.com/company/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://facebook.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="mailto:contact@bestofgenx.com" className="w-10 h-10 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            </a>
          </div>
          
          {/* Copyright */}
          <p className="text-center text-xs text-gray-300">
            © {new Date().getFullYear()} Best of GenX. All rights reserved.
          </p>
          
          {/* Made with love */}
          <p className="text-center text-[10px] text-gray-300 mt-2">
            Made with ❤️ for Generation X
          </p>
        </footer>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-full shadow-xl">
            {toast.icon === 'check' && <Check className="w-4 h-4 text-green-400" />}
            {toast.icon === 'bookmark' && <Bookmark className="w-4 h-4 text-[#D4873A]" />}
            {toast.icon === 'flag' && <Flag className="w-4 h-4 text-yellow-400" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
