"use client";

import { useEffect, useState, useRef, memo } from "react";
import { Clock, Play, Share2, MoreHorizontal, MessageCircle, Check, Bookmark, Flag, ChevronLeft, ChevronRight, BookOpen, Music, Gamepad2, Trophy, Sparkles, Cross, Newspaper, Clapperboard } from "lucide-react";
import PollCard from "@/components/PollCard";
import QuizPollCard from "@/components/QuizPoll";
import CardMoodReactions from "@/components/CardMoodReactions";
import CategoryBadge from "@/components/CategoryBadge";
import LazyImage from "@/components/LazyImage";
import { useAuth } from "@/context/AuthContext";

interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  thumbnailPosition?: { x: number; y: number };
  coverPosition?: { x: number; y: number };
  imageScale?: number;
  imagePosition?: 'top' | 'center' | 'bottom' | 'left' | 'right';
  imagePosX?: number;
  imagePosY?: number;
  mainCategory: string;  // Main category (articles, arcade, voting, shop)
  category: string;      // Sub category (music, culture, etc.)
  authorName?: string;
  authorAvatar?: string;
  readTime?: number;
  trending?: boolean;
  layout?: 'featured' | 'trending' | 'standard';
  likes?: number;
  views?: number;
  commentsCount?: number;
  status?: 'draft' | 'published' | 'archived';
  contentType?: string;
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
  if (!url) return false;
  // Check for video file extensions (anywhere in URL, not just at end)
  if (/\.(mp4|webm|mov)/i.test(url)) return true;
  // Check for Cloudinary video upload path
  if (url.includes('/video/upload/')) return true;
  return false;
};

// Helper to get object-position from article
const getImagePosition = (article: Article, type: 'cover' | 'thumbnail' = 'cover'): string => {
  // Use new position fields first
  if (type === 'thumbnail' && article.thumbnailPosition) {
    return `${article.thumbnailPosition.x}% ${article.thumbnailPosition.y}%`;
  }
  if (article.coverPosition) {
    return `${article.coverPosition.x}% ${article.coverPosition.y}%`;
  }
  // Fallback to legacy fields
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

const EMPTY_SET = new Set<string>();

function LandingPageInner({ onOpenArticle, readArticles = EMPTY_SET, isDesktop = false, onShowLogin }: LandingPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [templateItems, setTemplateItems] = useState<{
    size: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12, 
    articleId: string | null, 
    articleId2?: string | null, 
    sliderArticles?: string[], 
    sliderTitle?: string, 
    verticalArticles?: string[], 
    verticalTitle?: string, 
    adData?: {image: string, link: string, title: string},
    // Container fields (size 12)
    containerName?: string,
    containerTheme?: string,
    containerBlocks?: {
      type: 'MAIN' | '2H' | 'FIXED' | 'SLIDER' | 'VERTICAL' | 'SOCIAL';
      articleId?: string | null;
      articleId2?: string | null;
      articles?: string[];
      bannerImage?: string;
      bannerLink?: string;
      showDateOverlay?: boolean;
      autoFill?: 'latest' | 'history' | 'category';
      autoFillCategory?: string;
      autoFillLimit?: number;
    }[]
  }[]>([]);
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
          // Log container blocks specifically
          templateData.template.forEach((item: any, i: number) => {
            if (item.size === 12) {
              console.log(`Container ${i}:`, item.containerName, 'blocks:', item.containerBlocks);
            }
          });
          setTemplateItems(templateData.template);
        } else {
          console.log('No template found in DB - using auto-generated fallback');
          // FALLBACK: auto-generate feed from published articles so feed is never empty
          const published = (articlesData.articles || []).filter((a: Article) => a.status !== 'draft');
          if (published.length > 0) {
            const fallback: typeof templateItems = [
              // First article as featured
              { size: 3, articleId: published[0]._id },
            ];
            // Pairs of half cards for next articles
            for (let i = 1; i < Math.min(published.length, 7); i += 2) {
              fallback.push({ 
                size: 10, 
                articleId: published[i]._id, 
                articleId2: published[i + 1]?._id || null 
              });
            }
            // Rest as vertical list
            const rest = published.slice(7, 20).map((a: Article) => a._id);
            if (rest.length > 0) {
              fallback.push({ size: 9, articleId: null, verticalArticles: rest });
            }
            setTemplateItems(fallback);
          }
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
            <div className="absolute right-0 top-8 bg-white border border-warm rounded-none shadow-xl py-1.5 z-50 min-w-[160px]">
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

  // Theme card styles for highlighted containers
  const getCardThemeStyles = (themeName?: string) => {
    if (!themeName || themeName === 'cream') return { border: 'border-warm', hoverBorder: 'hover:border-[#D4873A]/30' };
    // All colored themes get white border for consistency
    return { border: 'border-2 border-white/80', hoverBorder: 'hover:border-white' };
  };

  // Article Card Components
  const MainBox = ({ article, theme }: { article: Article; theme?: string }) => {
    const cardTheme = getCardThemeStyles(theme);
    return (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className={`w-full h-[280px] md:h-[350px] lg:h-[400px] rounded-none overflow-hidden group text-left relative border ${cardTheme.border} hover:shadow-lg ${cardTheme.hoverBorder} transition-all duration-200`}
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
        <CategoryBadge category={article.mainCategory} size="md" />
      </div>
      
      {/* Read badge - only show green check when read */}
      {readArticles.has(article._id) && (
        <div className="absolute top-3 right-3 z-20">
          <span className="w-4 h-4 border border-emerald-600 bg-emerald-600/30 rounded-none flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" />
          </span>
        </div>
      )}
      
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
  };

  // MainSocial - Like MainBox but with social header (avatar, name, likes) like HalfCard
  const MainSocial = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full rounded-none overflow-hidden bg-cream border border-warm text-left shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 group"
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
          <CategoryBadge category={article.mainCategory} size="md" />
        </div>
        {/* Title ON the image - only on desktop */}
        {isDesktop && (
          <h2 className="absolute bottom-3 left-3 right-3 font-display text-[26px] lg:text-3xl tracking-wide text-white group-hover:text-[#D4873A] leading-tight line-clamp-2 drop-shadow-lg transition-colors z-10">
            {article.title}
          </h2>
        )}
        {/* Read badge - only show green check when read */}
        {readArticles.has(article._id) && (
          <div className="absolute top-3 right-3 z-20">
            <span className="w-4 h-4 border border-emerald-600 bg-emerald-600/30 rounded-none flex items-center justify-center">
              <Check className="w-2.5 h-2.5 text-white" />
            </span>
          </div>
        )}
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
      className="w-full h-[180px] rounded-none overflow-hidden group text-left relative border border-white/10"
    >
      {/* Full background image/video */}
      {article.coverImage && (
        isVideo(article.coverImage) ? (
          <video src={article.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
        ) : (
          <LazyImage src={article.coverImage} alt={article.title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
        )
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      
      {/* Category badge - top left */}
      <div className="absolute top-2 left-2 z-20">
        <CategoryBadge category={article.mainCategory} size="sm" />
      </div>
      
      {/* Read badge - only show green check when read */}
      {readArticles.has(article._id) && (
        <div className="absolute top-2 right-2 z-20">
          <span className="w-3.5 h-3.5 border border-emerald-600 bg-emerald-600/30 rounded-none flex items-center justify-center">
            <Check className="w-2 h-2 text-white" />
          </span>
        </div>
      )}
      
      {/* Content - bottom */}
      <div className="absolute bottom-2 left-2 right-2 z-10">
        <h3 className="font-display text-[18px] lg:text-xl tracking-wide text-white leading-tight mb-1 line-clamp-2">{article.title}</h3>
        <div className="flex items-center justify-end gap-1 text-[10px] text-white/70">
          {/* Moods & Comments inline */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
      className="w-full h-[180px] rounded-none overflow-hidden group text-left relative border border-warm hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200"
    >
      {/* Full background image/video */}
      {article.coverImage && (
        isVideo(article.coverImage) ? (
          <video src={article.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
        ) : (
          <LazyImage src={article.coverImage} alt={article.title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
        )
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      
      {/* Category badge - top left */}
      <div className="absolute top-2 left-2 z-20">
        <CategoryBadge category={article.mainCategory} size="sm" />
      </div>
      
      {/* Read badge - only show green check when read */}
      {readArticles.has(article._id) && (
        <div className="absolute top-2 right-2 z-20">
          <span className="w-3.5 h-3.5 border border-emerald-600 bg-emerald-600/30 rounded-none flex items-center justify-center">
            <Check className="w-2 h-2 text-white" />
          </span>
        </div>
      )}
      
      {/* Content - fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <h3 className="font-display text-[19px] lg:text-xl tracking-wide text-white group-hover:text-[#D4873A] leading-tight mb-1 line-clamp-2 transition-colors">{article.title}</h3>
        <div className="flex items-center justify-between gap-2 text-[10px] text-white/70">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{article.authorName}</span>
                      </div>
          {/* Likes & Comments inline */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
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

  // Slider Card - Vertical card with square image (same size as other cards)
  const SliderCard = ({ article, theme }: { article: Article; theme?: string }) => {
    const cardTheme = getCardThemeStyles(theme);
    const hasColorTheme = theme && theme !== 'cream';
    const bgClass = hasColorTheme ? 'bg-white/20 backdrop-blur-sm' : 'bg-cream';
    return (
    <div
      className={`flex-shrink-0 w-40 rounded-none overflow-hidden ${bgClass} border ${cardTheme.border} text-left shadow-md hover:shadow-lg ${cardTheme.hoverBorder} transition-all duration-200 relative group cursor-pointer`}
    >
      {/* Read badge - only show green check when read */}
      {readArticles.has(article._id) && (
        <div className="absolute top-1 right-1 z-20">
          <span className="w-3.5 h-3.5 border border-emerald-600 bg-emerald-600/30 rounded-none flex items-center justify-center">
            <Check className="w-2 h-2 text-white" />
          </span>
        </div>
      )}
      {/* Image/Video - shorter aspect ratio */}
      {article.coverImage && (
        <div className="w-full aspect-[4/3] overflow-hidden relative" onClick={() => onOpenArticle?.(article._id)}>
          {isVideo(article.coverImage) ? (
            <video src={article.coverImage} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
          ) : (
            <LazyImage src={article.coverImage} alt={article.title} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
          )}
        </div>
      )}
      {/* Content - below image */}
      <div className="p-1.5">
        <h3 onClick={() => onOpenArticle?.(article._id)} className={`font-display text-[20px] tracking-wide leading-tight line-clamp-2 transition-colors ${hasColorTheme ? 'text-white group-hover:text-gray-900' : 'text-white group-hover:text-gray-900'}`}>{article.title}</h3>
        {/* Likes & Comments */}
        <div className={`flex items-center gap-2 mt-1 text-[8px] ${hasColorTheme ? 'text-gray-700' : 'text-gray-500'}`} onClick={(e) => e.stopPropagation()}>
          <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} size="xs" />
          <span className="flex items-center gap-0.5">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {article.commentsCount || 0}
          </span>
        </div>
      </div>
    </div>
  );
  };

  // Horizontal Slider Container with navigation arrows
  const SliderContainer = ({ articleIds, title, theme }: { articleIds: string[], title?: string, theme?: string }) => {
    const sliderArticles = articleIds.map(id => getArticleById(id)).filter(Boolean) as Article[];
    if (sliderArticles.length === 0) return null;
    const hasColorTheme = theme && theme !== 'cream';
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [activePage, setActivePage] = useState(0);
    const visibleCards = 2.5;
    const totalPages = Math.ceil(sliderArticles.length / visibleCards);
    
    const checkScroll = () => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        const maxScroll = scrollWidth - clientWidth;
        if (maxScroll > 0) {
          const page = Math.round((scrollLeft / maxScroll) * (totalPages - 1));
          setActivePage(page);
        }
      }
    };
    
    const scroll = (direction: 'left' | 'right') => {
      if (scrollRef.current) {
        const scrollAmount = 280;
        scrollRef.current.scrollBy({
          left: direction === 'left' ? -scrollAmount : scrollAmount,
          behavior: 'smooth'
        });
      }
    };
    
    return (
      <div className={`w-full rounded-none py-2 ${hasColorTheme ? 'bg-transparent' : 'bg-cream border border-warm shadow-sm'}`}>
        {/* Slider with Arrows */}
        <div className="relative group/slider">
          {/* Left Arrow */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-12 rounded-none bg-black/60 hover:bg-black/80 text-white shadow-lg flex items-center justify-center transition-all backdrop-blur-sm border border-white/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          
          {/* Right Arrow */}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-12 rounded-none bg-black/60 hover:bg-black/80 text-white shadow-lg flex items-center justify-center transition-all backdrop-blur-sm border border-white/10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          
          {/* Scrollable Content - starts at left edge, scrolls to right */}
          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-2 overflow-x-auto scrollbar-hide" 
            style={{ scrollbarWidth: 'none' }}
          >
            {sliderArticles.map((article, idx) => (
              <SliderCard key={idx} article={article} theme={theme} />
            ))}
          </div>
        </div>
        
        {/* Dots - below slider */}
        <div className="flex items-center justify-center mt-2">
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <div 
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === activePage ? 'bg-white' : 'bg-white/40'}`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Half Card - 50% width, like "FROM THE COMMUNITY" social post style
  const HalfCard = ({ article, theme }: { article: Article; theme?: string }) => {
    const cardTheme = getCardThemeStyles(theme);
    const hasColorTheme = theme && theme !== 'cream';
    const bgClass = hasColorTheme ? 'bg-white/20 backdrop-blur-sm' : 'bg-cream';
    return (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className={`w-full rounded-none overflow-hidden ${bgClass} border ${cardTheme.border} text-left shadow-md hover:shadow-lg ${cardTheme.hoverBorder} transition-all duration-200 group`}
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
          {/* Read badge - only show green check when read */}
          {readArticles.has(article._id) && (
            <div className="absolute top-2 right-2 z-20">
              <span className="w-3.5 h-3.5 border border-emerald-600 bg-emerald-600/30 rounded-none flex items-center justify-center">
                <Check className="w-2 h-2 text-white" />
              </span>
            </div>
          )}
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
  };

  // Fixed Banner - Full width image only, no overlay, no text - for recurring content like Monthly Music
  const FixedBanner = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full rounded-none overflow-hidden shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 block bg-cream border border-warm p-2"
    >
      {article.coverImage && (
        isVideo(article.coverImage) ? (
          <video 
            src={article.coverImage} 
            className="w-full h-auto" 
            muted 
            autoPlay 
            loop 
            playsInline
          />
        ) : (
          <img 
            src={article.coverImage} 
            alt={article.title} 
            className="w-full h-auto" 
          />
        )
      )}
    </button>
  );

  // Full Width Banner - Like "TRENDING ARTICLES" section - horizontal card with image left, text right
  const FullWidthBanner = ({ article }: { article: Article }) => (
    <button
      onClick={() => onOpenArticle?.(article._id)}
      className="w-full flex items-center gap-3 p-2 bg-cream border border-warm rounded-none text-left shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 relative group"
    >
      {/* Read badge - only show green check when read */}
      {readArticles.has(article._id) && (
        <div className="absolute top-1.5 right-1.5 z-20">
          <span className="w-3.5 h-3.5 border border-emerald-600 bg-emerald-600/30 rounded-none flex items-center justify-center">
            <Check className="w-2 h-2 text-white" />
          </span>
        </div>
      )}
      {/* Thumbnail - bigger */}
      {article.coverImage && (
        <div className="w-20 h-20 rounded-none overflow-hidden flex-shrink-0 border border-warm bg-gray-200">
          {isVideo(article.coverImage) ? (
            <video 
              src={article.coverImage} 
              className="w-full h-full object-cover" 
              style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} 
              muted 
              autoPlay 
              loop 
              playsInline
              preload="metadata"
              poster=""
              onError={(e) => console.log('Video error:', article.coverImage, e)}
            />
          ) : (
            <LazyImage src={article.coverImage} alt={article.title} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
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
        <div className="flex items-center gap-3 text-[10px] text-gray-500" onClick={(e) => e.stopPropagation()}>
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

  // Simple article getter - just return the assigned article
  const getFeaturedArticle = (id: string | null): Article | undefined => {
    if (!id) return undefined;
    return articles.find(a => a._id === id);
  };

  // Placeholder for unpublished/draft articles
  const UnpublishedPlaceholder = () => (
    <div className="w-full h-32 rounded-none border-2 border-dashed border-gray-300 bg-cream flex flex-col items-center justify-center text-gray-600">
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
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-[#D4873A]" />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Feed</span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">Latest updates & content</span>
            </div>
          </div>
        </div>
        
        {/* Skeleton Cards Grid */}
        <div className="flex-1 overflow-hidden px-2 pt-3">
          <div className="grid grid-cols-6 gap-2">
            {/* Large Card Skeleton */}
            <div className="col-span-6 rounded-none bg-skeleton-light overflow-hidden">
              <div className="aspect-[16/9] bg-gradient-to-r from-skeleton-light via-skeleton to-skeleton-light animate-shimmer" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-skeleton rounded-none w-3/4 animate-pulse" />
                <div className="h-3 bg-skeleton rounded-none w-1/2 animate-pulse" />
              </div>
            </div>
            
            {/* Two Half Cards Skeleton */}
            {[1, 2].map((i) => (
              <div key={i} className="col-span-3 rounded-none bg-skeleton-light overflow-hidden">
                <div className="flex items-center gap-2 p-3">
                  <div className="w-9 h-9 rounded-full bg-skeleton animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-skeleton rounded-none w-20 animate-pulse" />
                    <div className="h-2 bg-skeleton rounded-none w-12 animate-pulse" />
                  </div>
                </div>
                <div className="aspect-[4/3] bg-gradient-to-r from-skeleton-light via-skeleton to-skeleton-light animate-shimmer" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-skeleton rounded-none w-full animate-pulse" />
                  <div className="h-3 bg-skeleton rounded-none w-2/3 animate-pulse" />
                </div>
              </div>
            ))}
            
            {/* Full Width Banner Skeleton */}
            <div className="col-span-6 flex items-center gap-3 p-3 rounded-none bg-skeleton-light">
              <div className="w-20 h-20 rounded-none bg-gradient-to-r from-skeleton-light via-skeleton to-skeleton-light animate-shimmer flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-skeleton rounded-none w-3/4 animate-pulse" />
                <div className="h-3 bg-skeleton rounded-none w-1/2 animate-pulse" />
                <div className="h-2 bg-skeleton rounded-none w-1/4 animate-pulse" />
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
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Play className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Feed</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Latest updates & content</span>
          </div>
        </div>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* DYNAMIC GRID TEMPLATE - 6 column grid for flexibility */}
        <div className="grid grid-cols-6 gap-1.5 px-2 pb-4 pt-3">
            {templateItems
              .filter(item => {
                // Container (size 12) - always show if has blocks
                if (item.size === 12) return (item.containerBlocks || []).length > 0;
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
                // Size 12 = Container (just a carrier with title)
                if (item.size === 12) {
                  const blocks = item.containerBlocks || [];
                  // Frontend theme styles - SAME as Admin (ContainerBlock.tsx)
                  const themeStyles: Record<string, { bg: string; border: string; titleColor: string }> = {
                    cream: { bg: 'bg-[#F5F0E8]', border: 'border-[#E5DDD0]', titleColor: 'text-[#D4873A]' },
                    bogx: { bg: 'bg-[#D4873A]', border: 'border-[#E5A55A]', titleColor: 'text-white' },
                    arcade: { bg: 'bg-purple-800', border: 'border-purple-500', titleColor: 'text-white' },
                    sports: { bg: 'bg-green-800', border: 'border-green-500', titleColor: 'text-white' },
                    music: { bg: 'bg-orange-800', border: 'border-orange-500', titleColor: 'text-white' },
                    movies: { bg: 'bg-blue-800', border: 'border-blue-500', titleColor: 'text-white' },
                    history: { bg: 'bg-amber-700', border: 'border-amber-500', titleColor: 'text-white' },
                    culture: { bg: 'bg-pink-800', border: 'border-pink-500', titleColor: 'text-white' },
                    gaming: { bg: 'bg-indigo-800', border: 'border-indigo-500', titleColor: 'text-white' },
                    retro: { bg: 'bg-teal-800', border: 'border-teal-500', titleColor: 'text-white' },
                  };
                  const theme = themeStyles[item.containerTheme || 'cream'] || themeStyles.cream;
                  const hasTheme = item.containerTheme && item.containerTheme !== 'cream';
                  
                  return (
                    <div key={index} className="col-span-6">
                      {/* Container Title — always outside the colored box */}
                      {item.containerName && (() => {
                        const n = item.containerName.toLowerCase();
                        const Icon = n.includes('history') ? BookOpen
                          : n.includes('music') ? Music
                          : n.includes('arcade') || n.includes('gaming') ? Gamepad2
                          : n.includes('sport') ? Trophy
                          : n.includes('lifestyle') || n.includes('culture') ? Sparkles
                          : n.includes('rip') || n.includes('memorial') ? Cross
                          : n.includes('movie') || n.includes('cinema') ? Clapperboard
                          : Newspaper;
                        const accentColor = n.includes('history') ? '#92400e'
                          : n.includes('music') ? '#c2410c'
                          : n.includes('arcade') || n.includes('gaming') ? '#7c3aed'
                          : n.includes('sport') ? '#15803d'
                          : n.includes('lifestyle') || n.includes('culture') ? '#db2777'
                          : n.includes('rip') || n.includes('memorial') ? '#4b5563'
                          : n.includes('movie') || n.includes('cinema') ? '#1d4ed8'
                          : '#374151';
                        return (
                          <div className="flex items-center gap-2 mb-1.5 pl-2" style={{ borderLeft: `3px solid ${accentColor}` }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: accentColor }} />
                            <span className="font-display text-sm font-bold uppercase tracking-widest text-[#2D1F14]">{item.containerName}</span>
                          </div>
                        );
                      })()}
                      {/* Colored container box */}
                      <div className={`${hasTheme ? `${theme.bg} ${theme.border} border rounded-lg p-2` : ''}`}>
                      {/* Container Blocks */}
                      <div className="flex flex-col gap-2">
                      {blocks.map((block, blockIdx) => {
                        const containerTheme = item.containerTheme;
                        if (block.type === 'MAIN') {
                          const mainArticle = block.articleId ? getArticleById(block.articleId) : null;
                          if (!mainArticle) return null;
                          return <div key={blockIdx}><MainBox article={mainArticle} theme={containerTheme} /></div>;
                        }
                        if (block.type === '2H') {
                          const leftArticle = block.articleId ? getArticleById(block.articleId) : null;
                          const rightArticle = block.articleId2 ? getArticleById(block.articleId2) : null;
                          if (!leftArticle && !rightArticle) return null;
                          return (
                            <div key={blockIdx} className="grid grid-cols-2 gap-1.5">
                              {leftArticle && <HalfCard article={leftArticle} theme={containerTheme} />}
                              {rightArticle && <HalfCard article={rightArticle} theme={containerTheme} />}
                            </div>
                          );
                        }
                        if (block.type === 'FIXED') {
                          // Find latest article from this container's category
                          const isMusicContainer = containerTheme === 'music'
                            || item.containerName?.toLowerCase().includes('music')
                            || item.containerName?.toLowerCase().includes('muci');
                          let fixedArticle: Article | undefined;
                          let autoCategory = '';
                          if (isMusicContainer) {
                            autoCategory = 'music';
                            fixedArticle = articles.find(a => a.contentType === 'music-community')
                              || articles.find(a => a.category === 'music' && a.status === 'published');
                          } else {
                            const sliderBlock = item.containerBlocks?.find(b => (b.type === 'SLIDER' || b.type === 'VERTICAL') && b.autoFillCategory);
                            autoCategory = sliderBlock?.autoFillCategory?.toLowerCase() || containerTheme || '';
                            if (!autoCategory) return null;
                            fixedArticle = articles
                              .filter(a => a.status === 'published' && (a.category?.toLowerCase() === autoCategory || a.mainCategory?.toLowerCase() === autoCategory))
                              .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
                          }
                          if (!fixedArticle) return null;
                          // Prefer the dedicated banner image stored on the block — never use the article's own coverImage for the banner
                          const fixedImg = (block as any).bannerImage || '';
                          return (
                            <button
                              key={blockIdx}
                              type="button"
                              onClick={() => onOpenArticle?.(fixedArticle._id)}
                              className="block w-full rounded-none overflow-hidden bg-[#F5F0E8] border border-[#E5DDD0] p-1 shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all cursor-pointer"
                            >
                              <div className="relative w-full aspect-[2/1] md:aspect-[2.5/1] lg:aspect-[2.7/1] overflow-hidden bg-gray-800">
                                {fixedImg ? (
                                  fixedImg.match(/\.(mp4|webm|mov)($|\?)/i) || fixedImg.includes('/video/') ? (
                                    <video src={fixedImg} className="w-full h-full object-cover" muted autoPlay loop playsInline style={{ objectPosition: `${(fixedArticle as any).imagePosX ?? 50}% ${(fixedArticle as any).imagePosY ?? 50}%` }} />
                                  ) : (
                                    <img src={fixedImg} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${(fixedArticle as any).imagePosX ?? 50}% ${(fixedArticle as any).imagePosY ?? 50}%` }} />
                                  )
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-r from-gray-800 to-gray-700" />
                                )}
                                {(autoCategory === 'history' || autoCategory === 'arcade' || autoCategory === 'gaming') && (() => {
                                  const dateStr = fixedArticle.createdAt
                                    ? new Date(fixedArticle.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                  return (
                                    <div className="absolute bottom-0 left-0 right-0 flex items-stretch bg-black/55 backdrop-blur-sm">
                                      {/* Date block left - amber accent */}
                                      <div className="flex flex-row items-center justify-center gap-1.5 px-4 py-3 border-r border-white/20 bg-[#D4873A]/20 whitespace-nowrap">
                                        <span className="text-[#D4873A] text-sm font-bold uppercase tracking-widest leading-none">{dateStr.split(' ')[0]}</span>
                                        <span className="text-white font-black text-2xl leading-none">{dateStr.split(' ')[1]}</span>
                                      </div>
                                      {/* Title + subtitle right */}
                                      <div className="flex flex-col justify-center px-4 py-3 min-w-0 gap-0.5 text-left flex-1">
                                        <div className="text-white font-bold text-base leading-tight line-clamp-1">{fixedArticle.title}</div>
                                        {fixedArticle.subtitle && <div className="text-white/65 text-xs leading-tight line-clamp-1 pl-0">{fixedArticle.subtitle}</div>}
                                      </div>
                                      {/* Read More button - desktop only */}
                                      <div className="hidden md:flex items-center px-4 py-3 flex-shrink-0">
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 border border-[#D4873A]/60 text-[#D4873A] text-xs font-bold uppercase tracking-wider rounded hover:bg-[#D4873A]/20 transition-colors whitespace-nowrap">
                                          Read More →
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </button>
                          );
                        }
                        if (block.type === 'SLIDER') {
                          // Auto-fill by category
                          if (block.autoFill === 'category' && block.autoFillCategory) {
                            const limit = block.autoFillLimit || 10;
                            const cat = block.autoFillCategory.toLowerCase();
                            
                            // Filter by category OR mainCategory and sort by date (newest first)
                            // For history: check if container has a FIXED banner block - if so, exclude today's article
                            const containerHasFixedBanner = item.containerBlocks?.some(b => b.type === 'FIXED');
                            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
                            
                            const autoArticles = [...articles]
                              .filter(a => {
                                if (a.status !== 'published') return false;
                                const artCat = a.category?.toLowerCase() || '';
                                const artMain = a.mainCategory?.toLowerCase() || '';
                                if (!( artCat === cat || artMain === cat || artCat.includes(cat) || artMain.includes(cat))) return false;
                                // If container has a banner (showing today's article), exclude today's articles from slider
                                // Banner always shows the latest; slider shows older articles
                                if (containerHasFixedBanner && (cat === 'history' || cat === 'gaming')) {
                                  const created = new Date(a.createdAt || 0);
                                  if (created >= todayStart) return false;
                                }
                                return true;
                              })
                              .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
                              .slice(0, limit);
                            
                            console.log(`SLIDER auto-fill: category=${cat}, found ${autoArticles.length} articles`);
                            
                            if (autoArticles.length === 0) return null;
                            return <div key={blockIdx}><SliderContainer articleIds={autoArticles.map(a => a._id)} theme={containerTheme} /></div>;
                          }
                          // Manual: use specified article IDs
                          return <div key={blockIdx}><SliderContainer articleIds={block.articles || []} theme={containerTheme} /></div>;
                        }
                        if (block.type === 'VERTICAL') {
                          console.log('VERTICAL block found:', block);
                          // Auto-fill by category or manual articles
                          const cat = block.autoFillCategory?.toLowerCase() || '';
                          let vertArticles: Article[] = [];
                          
                          if (cat) {
                            // Auto-fill: get latest articles from category
                            vertArticles = articles
                              .filter(a => a.category?.toLowerCase() === cat && a.status === 'published' && a.coverImage)
                              .slice(0, block.autoFillLimit || 5);
                          } else {
                            // Manual: use specified article IDs
                            vertArticles = (block.articles || []).map(id => getArticleById(id)).filter(Boolean) as Article[];
                          }
                          
                          if (vertArticles.length === 0) return null;
                          
                          // Category label for "See more" link
                          const categoryLabels: Record<string, string> = {
                            'history': 'History', 'movies-tv': 'Movies & TV', 'music': 'Music',
                            'gaming': 'Gaming', 'rewind': 'Rewind', 'sports': 'Sports',
                            'tech': 'Tech', 'culture': 'Culture', 'news': 'News', 'lifestyle': 'Lifestyle',
                            'rip': 'RIP'
                          };
                          
                          return (
                            <div key={blockIdx} className="space-y-1.5">
                              {vertArticles.slice(0, 5).map((art, i) => <FullWidthBanner key={i} article={art} />)}
                              {cat && (
                                <button 
                                  onClick={() => window.dispatchEvent(new Event('openArticles'))}
                                  className="block w-full text-center py-2 text-[#D4873A] text-xs font-bold uppercase tracking-wider hover:underline"
                                >
                                  See more {categoryLabels[cat] || cat} →
                                </button>
                              )}
                            </div>
                          );
                        }
                        if (block.type === 'SOCIAL') {
                          const socialArticle = block.articleId ? getArticleById(block.articleId) : null;
                          if (!socialArticle) return null;
                          return <div key={blockIdx}><MainSocial article={socialArticle} /></div>;
                        }
                        return null;
                      })}
                      </div>
                      </div>
                    </div>
                  );
                }

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
                
                // Size 9 = Vertical (stacked articles container) - uses FullWidthBanner component
                if (item.size === 9) {
                  const vertArticles = (item.verticalArticles || []).map(id => getArticleById(id)).filter(Boolean) as Article[];
                  if (vertArticles.length === 0) return null;
                  return (
                    <div key={index} className="col-span-6 space-y-2">
                      {/* Title */}
                      <span className="text-xs font-bold text-[#D4873A] uppercase tracking-wider">More Articles</span>
                      {vertArticles.map((art, i) => (
                        <FullWidthBanner key={i} article={art} />
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
                      className="col-span-6 block rounded-none overflow-hidden border border-warm"
                    >
                      <img src={item.adData.image} alt={item.adData.title || 'Ad'} className="w-full h-20 object-cover" />
                    </a>
                  );
                }
                
                // Size 6 = Slider (horizontal scroll container)
                if (item.size === 6) {
                  return <div key={index} className="col-span-6"><SliderContainer articleIds={item.sliderArticles || []} title={item.sliderTitle} /></div>;
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
                
                // Size mapping: 11=FixedBanner(6cols), 7=MainSocial(6cols), 5=Half(3cols), 4=Full(6cols), 2=Med(4cols), 1=Small(2cols)
                if (item.size === 11) return <div key={index} className="col-span-6"><FixedBanner article={article} /></div>;
                if (item.size === 7) return <div key={index} className="col-span-6"><MainSocial article={article} /></div>;
                if (item.size === 5) return <div key={index} className="col-span-3"><HalfCard article={article} /></div>;
                if (item.size === 4) return <div key={index} className="col-span-6"><FullWidthBanner article={article} /></div>;
                if (item.size === 2) return <div key={index} className="col-span-4"><MediumBox article={article} /></div>;
                return <div key={index} className="col-span-2"><SmallBox article={article} /></div>;
              })}
          </div>
          
          {/* Mobile Footer - only show on mobile, desktop has its own footer */}
          <footer className="lg:hidden px-4 py-8 mt-6 border-t border-warm">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <a href="/about" className="hover:opacity-60 transition-opacity">
                <img src="/images/genxlogo1.png" alt="Best of GenX" className="h-6 opacity-40" />
              </a>
            </div>
            
            {/* Links */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-gray-500 mb-4">
              <a href="/impressum" className="hover:text-[#D4873A] transition-colors">Impressum</a>
              <a href="/datenschutz" className="hover:text-[#D4873A] transition-colors">Datenschutz</a>
              <a href="/agb" className="hover:text-[#D4873A] transition-colors">AGB</a>
              <a href="/kontakt" className="hover:text-[#D4873A] transition-colors">Kontakt</a>
            </div>
            
            {/* Social Links */}
            <div className="flex justify-center gap-3 mb-4">
              <a href="https://instagram.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://facebook.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="mailto:contact@bestofgenx.com" className="w-8 h-8 rounded-full bg-[#D4873A]/10 flex items-center justify-center text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </a>
            </div>
            
            {/* Copyright */}
            <p className="text-center text-[10px] text-gray-400">
              © {new Date().getFullYear()} Best of GenX. All rights reserved.
            </p>
            <p className="text-center text-[9px] text-gray-300 mt-1 flex items-center justify-center gap-1">
              Made with <svg className="w-2.5 h-2.5 text-[#D4873A]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> for Generation X
            </p>
          </footer>
        
              </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-full shadow-xl">
            {toast.icon === 'check' && <Check className="w-4 h-4 text-emerald-600" />}
            {toast.icon === 'bookmark' && <Bookmark className="w-4 h-4 text-[#D4873A]" />}
            {toast.icon === 'flag' && <Flag className="w-4 h-4 text-yellow-400" />}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent re-renders from parent countdown updates
const LandingPage = memo(LandingPageInner);
export default LandingPage;
