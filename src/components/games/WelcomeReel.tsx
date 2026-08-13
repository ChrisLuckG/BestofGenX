"use client";

import { useEffect, useState, useRef, memo, useCallback } from "react";
import { Clock, Play, Share2, MoreHorizontal, MessageCircle, Check, Bookmark, Flag, ChevronLeft, ChevronRight, BookOpen, Music, Gamepad2, Trophy, Sparkles, Cross, Newspaper, Clapperboard, PartyPopper, Brain } from "lucide-react";
import PollCard from "@/components/PollCard";
import QuizPollCard from "@/components/QuizPoll";
import CardMoodReactions from "@/components/CardMoodReactions";
import CategoryBadge from "@/components/CategoryBadge";
import LazyImage from "@/components/LazyImage";
import { useAuth } from "@/context/AuthContext";
import { getAutoFillSlugs, getCategoryLabel as getSubCategoryLabel, TOP_AREA_EXCLUDED_SLUGS } from "@/lib/categories";
import { getFlagUrl as resolveFlagUrl } from "@/lib/countryFlags";

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
  featured?: boolean;
  layout?: 'featured' | 'trending' | 'standard';
  likes?: number;
  views?: number;
  commentsCount?: number;
  status?: 'draft' | 'published' | 'archived';
  contentType?: string;
  createdAt?: string;
  scheduledAt?: string;
  order?: number;  // Manual sort order (lower = higher); drives the Top Area order
  closesAt?: string;  // For voting/poll articles - when the poll closes
  // Styling options
  titleColor?: string;
  titleFont?: 'default' | 'display' | 'serif' | 'mono';
  subtitleColor?: string;
  contentColor?: string;
  // Person info (for timeline view)
  personName?: string;
  personBirthday?: string;  // DD.MM.YYYY format
  personDeathday?: string;  // DD.MM.YYYY format (for RIP)
  personCountry?: string;
  personCountryCode?: string;
}

// Feed order — must stay identical to the admin Post Manager sort:
// manual drag order (`order`, lower = higher) wins, then newest first by
// scheduledAt (falling back to createdAt).
const articleDate = (a: Article): number =>
  new Date(a.scheduledAt || a.createdAt || 0).getTime();

const compareArticles = (a: Article, b: Article): number => {
  const ao = a.order ?? 0, bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  return articleDate(b) - articleDate(a);
};

// Main category labels for frontend display
const MAIN_CATEGORY_LABELS: Record<string, string> = {
  'articles': 'ARTICLES',
  'arcade': 'ARCADE',
  'voting': 'VOTING',
  'shop': 'SHOP',
};

// Flag URL for an article - falls back to the country name for legacy
// articles that were saved without a personCountryCode.
const articleFlagUrl = (
  article: { personCountryCode?: string; personCountry?: string },
  size: string = '48x36'
): string => resolveFlagUrl(article.personCountryCode, article.personCountry, size);

// Helper to get frontend label from mainCategory
const getCategoryLabel = (mainCategory: string): string => {
  return MAIN_CATEGORY_LABELS[mainCategory] || 'ARTICLES';
};

// Format date as "August 10, 2026"
const formatArticleDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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
  // Use thumbnail position for thumbnails
  if (type === 'thumbnail' && article.thumbnailPosition) {
    return `${article.thumbnailPosition.x}% ${article.thumbnailPosition.y}%`;
  }
  // imagePosX/Y has priority (set by ImagePickerModal)
  if (article.imagePosX !== undefined || article.imagePosY !== undefined) {
    return `${article.imagePosX ?? 50}% ${article.imagePosY ?? 50}%`;
  }
  // Fallback to coverPosition
  if (article.coverPosition) {
    return `${article.coverPosition.x}% ${article.coverPosition.y}%`;
  }
  return article.imagePosition || 'center';
};

// Theme card styles for highlighted containers.
// Module scope on purpose - it is a pure function and the slider components below
// live outside the page component and need it.
const getCardThemeStyles = (themeName?: string) => {
  if (!themeName || themeName === 'cream') return { border: 'border-warm', hoverBorder: 'hover:border-[#E36B11]/30' };
  // All colored themes get white border for consistency
  return { border: 'border-2 border-white/80', hoverBorder: 'hover:border-white' };
};

// ── SLIDER ────────────────────────────────────────────────────────────────────
// SliderCard and SliderContainer MUST live at module scope.
//
// They used to be declared inside the WelcomeReel component body. That creates a
// brand new function identity on every render, and React treats a different
// function as a different component type: it unmounts the old subtree and mounts
// a fresh one. For a horizontally scrolled container that means the scroll
// offset resets to 0 - which is exactly the "slider jumps back while swiping"
// bug. WelcomeReel re-renders often (polling, reactions, coin animations), so it
// only worked when no re-render happened to land mid-gesture.
//
// Declared here, the component type is stable: re-renders update the children in
// place and the scroll container keeps its DOM node and its scroll position.

interface SliderCardProps {
  article: Article;
  theme?: string;
  onArticleClick: (articleId: string) => void;
  userId?: string;
  // Not optional: CardMoodReactions requires a concrete boolean.
  isLoggedIn: boolean;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
  reactionData?: { reactions?: Record<string, number>; userReaction?: string | null; rewarded?: boolean };
  onReactionChange?: (articleId: string, data: { reactions: Record<string, number>; userReaction: string | null; rewarded: boolean }) => void;
}

const SliderCard = ({
  article,
  theme,
  onArticleClick,
  userId,
  isLoggedIn,
  onShowLogin,
  onCoinAnimation,
  reactionData,
  onReactionChange,
}: SliderCardProps) => {
  const cardTheme = getCardThemeStyles(theme);
  const hasColorTheme = theme && theme !== 'cream';
  const bgClass = hasColorTheme ? 'bg-white/20 backdrop-blur-sm' : 'bg-cream';
  return (
    <div
      onClick={() => onArticleClick(article._id)}
      className={`flex-shrink-0 w-40 rounded-none overflow-hidden ${bgClass} border ${cardTheme.border} text-left shadow-md hover:shadow-lg ${cardTheme.hoverBorder} transition-all duration-200 relative group cursor-pointer touch-manipulation`}
    >
      {/* Image/Video - shorter aspect ratio */}
      {article.coverImage && (
        <div className="w-full aspect-[4/3] overflow-hidden relative">
          {isVideo(article.coverImage) ? (
            <video src={article.coverImage} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
          ) : (
            <LazyImage src={article.coverImage} alt={article.title} className="w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
          )}
          {article.category === 'rip' && (
            <div className="absolute bottom-1 right-1.5 z-20 text-white text-xl leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" style={{fontFamily:'Georgia,serif'}}>✝</div>
          )}
        </div>
      )}
      {/* Content - below image */}
      <div className="p-1.5">
        <h3 className={`font-display text-[20px] tracking-wide leading-tight line-clamp-2 transition-colors ${hasColorTheme ? 'text-white group-hover:text-gray-900' : 'text-gray-900 group-hover:text-[#E36B11]'}`}>{article.title}</h3>
        {/* Likes & Comments */}
        <div className={`flex items-center gap-2 mt-1 text-[8px] ${hasColorTheme ? 'text-gray-700' : 'text-gray-500'}`} onClick={(e) => e.stopPropagation()}>
          <CardMoodReactions articleId={article._id} userId={userId} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} onCoinAnimation={onCoinAnimation} size="xs" useExternalData initialReactions={reactionData?.reactions} initialUserReaction={reactionData?.userReaction} initialRewarded={reactionData?.rewarded} onReactionChange={onReactionChange} />
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

interface SliderContainerProps {
  articles: Article[];
  title?: string;
  theme?: string;
  onArticleClick: (articleId: string) => void;
  userId?: string;
  isLoggedIn: boolean;
  onShowLogin?: () => void;
  onCoinAnimation?: (amount: number) => void;
  reactionsMap: Record<string, { reactions?: Record<string, number>; userReaction?: string | null; rewarded?: boolean }>;
  onReactionChange?: (articleId: string, data: { reactions: Record<string, number>; userReaction: string | null; rewarded: boolean }) => void;
}

const SliderContainer = ({
  articles,
  title,
  theme,
  onArticleClick,
  userId,
  isLoggedIn,
  onShowLogin,
  onCoinAnimation,
  reactionsMap,
  onReactionChange,
}: SliderContainerProps) => {
  const hasColorTheme = theme && theme !== 'cream';

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activePage, setActivePage] = useState(0);
  const visibleCards = 2.5;
  const totalPages = Math.ceil(articles.length / visibleCards);

  // Arrow visibility and the dot indicator are derived from scroll position.
  // Guarded with functional comparison so a plain swipe does not fire three
  // setState calls per scroll event - that caused visible flicker.
  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    const nextLeft = scrollLeft > 0;
    const nextRight = scrollLeft < maxScroll - 10;
    setCanScrollLeft(prev => (prev === nextLeft ? prev : nextLeft));
    setCanScrollRight(prev => (prev === nextRight ? prev : nextRight));

    if (maxScroll > 0 && totalPages > 1) {
      const page = Math.round((scrollLeft / maxScroll) * (totalPages - 1));
      setActivePage(prev => (prev === page ? prev : page));
    }
  };

  // Arrow visibility depends on measured widths, so it has to be evaluated once
  // after mount as well - otherwise the right arrow shows even when everything
  // already fits on screen.
  useEffect(() => {
    checkScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 280;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (articles.length === 0) return null;

  return (
    <div className={`w-full rounded-none py-2 ${hasColorTheme ? 'bg-transparent' : 'bg-cream border border-warm shadow-sm'}`}>
      {/* Slider with Arrows */}
      <div className="relative group/slider">
        {/* Left Arrow - hidden on touch devices, swiping is the interaction there */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-12 rounded-none bg-black/60 hover:bg-black/80 text-white shadow-lg items-center justify-center transition-all backdrop-blur-sm border border-white/10"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right Arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-12 rounded-none bg-black/60 hover:bg-black/80 text-white shadow-lg items-center justify-center transition-all backdrop-blur-sm border border-white/10"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Scrollable Content - starts at left edge, scrolls to right.
            touchAction MUST allow pan-y as well. With 'pan-x' alone the browser
            permits only horizontal panning for touches that start in here, so a
            vertical drag over the slider does not scroll the page behind it - it
            is swallowed until the user flings hard enough for the gesture to be
            re-interpreted. That is the "stiff vertical scrolling over the
            sliders" bug. Listing both axes keeps horizontal panning on this
            element (it is the only horizontally scrollable one) while vertical
            drags chain up to the feed scroller.
            overscrollBehaviorX 'contain' only affects the X axis and still stops
            a horizontal swipe from bubbling out once an end is reached. */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-2 overflow-x-auto scrollbar-hide"
          style={{
            scrollbarWidth: 'none',
            touchAction: 'pan-x pan-y',
            overscrollBehaviorX: 'contain',
          }}
        >
          {articles.map((article) => (
            <SliderCard
              key={article._id}
              article={article}
              theme={theme}
              onArticleClick={onArticleClick}
              userId={userId}
              isLoggedIn={isLoggedIn}
              onShowLogin={onShowLogin}
              onCoinAnimation={onCoinAnimation}
              reactionData={reactionsMap[article._id]}
              onReactionChange={onReactionChange}
            />
          ))}
        </div>
      </div>

      {/* Dots - below slider */}
      {totalPages > 1 && (
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
      )}
    </div>
  );
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
  onOpenStaticPage?: (slug: string) => void;
  onOpenCommunitySound?: () => void;
  onCoinAnimation?: (amount: number) => void;
}

const EMPTY_SET = new Set<string>();

function LandingPageInner({ onOpenArticle, readArticles = EMPTY_SET, isDesktop = false, onShowLogin, onOpenStaticPage, onOpenCommunitySound, onCoinAnimation }: LandingPageProps) {
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
    customColor?: string, // Custom hex color when containerTheme is 'custom'
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
  const [loadingArticleId, setLoadingArticleId] = useState<string | null>(null);
  // Batched mood-reaction data, keyed by articleId. Fetched ONCE for all loaded
  // articles instead of each card firing its own request (was causing an N+1
  // request storm / ERR_INSUFFICIENT_RESOURCES with 100 articles on screen).
  // Initialize from localStorage cache for instant display
  const [reactionsMap, setReactionsMap] = useState<Record<string, { reactions: Record<string, number>; userReaction: string | null; rewarded?: boolean }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('reactions-cache');
        if (cached) return JSON.parse(cached);
      } catch { /* ignore */ }
    }
    return {};
  });

  // Save reactionsMap to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(reactionsMap).length > 0) {
      try {
        localStorage.setItem('reactions-cache', JSON.stringify(reactionsMap));
      } catch { /* ignore */ }
    }
  }, [reactionsMap]);

  // Callback for CardMoodReactions to update the batched map after a click.
  // Without this, the parent keeps serving stale initial data and any remount
  // of the card throws away the new count AND the local rewarded flag.
  const handleReactionChange = useCallback((
    articleId: string,
    data: { reactions: Record<string, number>; userReaction: string | null; rewarded: boolean }
  ) => {
    setReactionsMap(prev => ({
      ...prev,
      [articleId]: data,
    }));
  }, []);

  const showToast = (message: string, icon: 'check' | 'bookmark' | 'flag' = 'check') => {
    setToast({ message, icon });
    setTimeout(() => setToast(null), 2000);
  };

  // Handle article click with loading state
  const handleArticleClick = (articleId: string) => {
    if (loadingArticleId) return; // Prevent double-clicks
    setLoadingArticleId(articleId);
    onOpenArticle?.(articleId);
    // Reset after a timeout in case navigation doesn't happen
    setTimeout(() => setLoadingArticleId(null), 3000);
  };

  // Reusable fetch function for initial load
  const fetchData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    try {
      // Fetch articles, polls and template in parallel.
      //
      // The limit must cover ALL published articles, not just the newest page.
      // The template's category containers (RIP, Music, Sport, ...) pick their
      // articles out of this one list, so anything outside the window is
      // invisible in the feed no matter what the container is configured to show.
      // With limit=100 out of 163 articles, 7 of 10 RIP articles never arrived
      // and the RIP slider showed 3 items.
      // The listing endpoint omits `content`/`coverImage` and sends a small
      // thumbnail URL instead, so the whole set is ~220 KB.
      // NOTE: this loads everything in one request. Once the archive grows into
      // the thousands, category containers should fetch their own slice instead.
      const [articlesRes, pollsRes, templateRes] = await Promise.all([
        fetch('/api/articles?status=published&limit=500'),
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
        setTemplateItems(templateData.template);
      }
      // No fallback — empty feed surfaces that the template needs to be configured
    } catch (e) {
      console.error('Failed to fetch data:', e);
    } finally {
      if (!isRefresh) setIsLoading(false);
    }
  }, []);

  // Fetch articles, polls and template from database
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Batch-fetch mood reactions for all loaded articles in ONE request instead
  // of letting each card fetch its own (was causing an N+1 request storm /
  // ERR_INSUFFICIENT_RESOURCES with ~100 articles rendered at once). Re-runs
  // when the article list changes or once the logged-in user becomes known,
  // so "your reaction" highlighting is correct after login too.
  useEffect(() => {
    if (articles.length === 0) return;
    const ids = articles.map(a => a._id).join(',');
    if (!ids) return;
    fetch(`/api/articles/react?articleIds=${ids}&userId=${user?.id || ''}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.byArticle) setReactionsMap(data.byArticle);
      })
      .catch(() => {});
  }, [articles, user?.id]);

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
            onCoinAnimation={onCoinAnimation}
            size="sm" 
            useExternalData
            initialReactions={reactionsMap[article._id]?.reactions}
            initialUserReaction={reactionsMap[article._id]?.userReaction}
            initialRewarded={reactionsMap[article._id]?.rewarded}
            onReactionChange={handleReactionChange}
          />
        <button onClick={handleComment} className="flex items-center gap-1.5 hover:text-[#E36B11] transition-colors">
          <MessageCircle className={iconSize} />
          <span className={`${textSize} font-medium`}>{article.commentsCount || 0}</span>
        </button>
        <button onClick={handleShare} className="ml-auto hover:text-[#E36B11] transition-colors">
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
              <button onClick={handleOpenArticle} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#E36B11]/5 flex items-center gap-3">
                <svg className="w-4 h-4 text-[#E36B11]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                Read Article
              </button>
              <button onClick={handleSave} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#E36B11]/5 flex items-center gap-3">
                <svg className="w-4 h-4 text-[#E36B11]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                Save
              </button>
              <button onClick={handleShare} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#E36B11]/5 flex items-center gap-3">
                <Share2 className="w-4 h-4 text-[#E36B11]" />
                Share
              </button>
              <button onClick={handleCopy} className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-[#E36B11]/5 flex items-center gap-3">
                <svg className="w-4 h-4 text-[#E36B11]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
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

  // Loading overlay for cards
  const LoadingOverlay = ({ articleId }: { articleId: string }) => {
    if (loadingArticleId !== articleId) return null;
    return (
      <div className="absolute inset-0 z-50 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
        <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  };

  // Shared props for the module-scope SliderContainer (see the note next to its
  // definition on why it must not be declared inside this component).
  const sliderProps = {
    onArticleClick: handleArticleClick,
    userId: user?.id,
    isLoggedIn,
    onShowLogin,
    onCoinAnimation,
    reactionsMap,
    onReactionChange: handleReactionChange,
  };

  // Article Card Components
  const MainBox = ({ article, theme }: { article: Article; theme?: string }) => {
    const cardTheme = getCardThemeStyles(theme);
    return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleArticleClick(article._id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpenArticle?.(article._id)}
      className={`w-full h-[280px] md:h-[350px] lg:h-[400px] rounded-none overflow-hidden group text-left relative border ${cardTheme.border} hover:shadow-lg ${cardTheme.hoverBorder} transition-all duration-200 cursor-pointer ${loadingArticleId === article._id ? 'pointer-events-none' : ''}`}
      style={{
        backgroundImage: article.coverImage ? `url(${article.coverImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: getImagePosition(article),
      }}
    >
      {/* Loading overlay */}
      <LoadingOverlay articleId={article._id} />
      
      {/* Gradient overlay - only at bottom for text readability */}
      <div className={`absolute inset-0 bg-gradient-to-t ${article.category === 'rip' ? 'from-white/80 via-white/20 to-transparent' : 'from-black via-black/30 to-transparent'}`} />
      
      {/* Category badge - top left */}
      <div className="absolute top-3 left-3 z-20">
        <CategoryBadge 
          category={article.category || article.mainCategory} 
          size="md" 
        />
      </div>
      
      {/* Flag - top right */}
      {articleFlagUrl(article) && (
        <div className="absolute top-3 right-3 z-20">
          <img 
            src={articleFlagUrl(article, '48x36')}
            alt={article.personCountry || ''}
            title={article.personCountry}
            className="w-10 h-[30px] object-cover rounded shadow-lg"
          />
        </div>
      )}
      
      {article.category === 'rip' && (
        <div className="absolute bottom-16 right-4 z-20 text-white text-3xl leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" style={{fontFamily:'Georgia,serif'}}>✝</div>
      )}
      {/* Content - fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-4">
        {/* Date above title (birthday) */}
        {formatArticleDate(article.createdAt) && (
          <div className="text-[14px] text-white/90 mb-1.5 font-semibold">{formatArticleDate(article.createdAt)}</div>
        )}
        {/* Title */}
        <div className="flex items-start gap-2">
          <h2 className={`font-display text-[28px] lg:text-[32px] tracking-wide ${article.category === 'rip' ? 'text-gray-900' : 'text-white'} group-hover:text-[#E36B11] leading-tight mb-1.5 line-clamp-2 transition-colors flex-1`}>{article.title}</h2>
        </div>
        <div className="flex items-center justify-between gap-2 text-[11px] text-white/70">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0 border border-white/30">
              {article.authorAvatar ? (
                <img src={article.authorAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#E36B11] flex items-center justify-center text-white text-[8px] font-bold">
                  {(article.authorName || 'A')[0].toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate">{article.authorName}</span>
          </div>
          {/* Mood Reactions & Comments inline */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} onCoinAnimation={onCoinAnimation} size="sm" useExternalData initialReactions={reactionsMap[article._id]?.reactions} initialUserReaction={reactionsMap[article._id]?.userReaction} initialRewarded={reactionsMap[article._id]?.rewarded} onReactionChange={handleReactionChange} />
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
    </div>
  );
  };

  // MainSocial - Like MainBox but with social header (avatar, name, likes) like HalfCard
  const MainSocial = ({ article }: { article: Article }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleArticleClick(article._id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpenArticle?.(article._id)}
      className={`w-full rounded-none overflow-hidden bg-cream border border-warm text-left shadow-md hover:shadow-lg hover:border-[#E36B11]/30 transition-all duration-200 group cursor-pointer relative ${loadingArticleId === article._id ? 'pointer-events-none' : ''}`}
    >
      <LoadingOverlay articleId={article._id} />
      {/* Social Header: Avatar + Name + Time + Menu */}
      <div className="flex items-center gap-2 p-3 border-b border-warm/50">
        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-warm">
          {article.authorAvatar ? (
            <img src={article.authorAvatar} alt={article.authorName || 'Author'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#E36B11]/20 flex items-center justify-center text-[#E36B11] font-bold text-sm">
              {(article.authorName || 'A')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-gray-900 truncate">{article.authorName || 'Author'}</div>
          <div className="text-[11px] text-gray-500">{article.createdAt ? new Date(article.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</div>
        </div>
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
        {/* Dark gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        {/* Category badge - top left */}
        <div className="absolute top-3 left-3 z-20">
          <CategoryBadge 
            category={article.category || article.mainCategory} 
            size="md" 
          />
        </div>
        {/* Flag - top right */}
        {articleFlagUrl(article) && (
          <div className="absolute top-3 right-3 z-20">
            <img 
              src={articleFlagUrl(article, '40x30')}
              alt={article.personCountry || ''}
              title={article.personCountry}
              className="w-9 h-[27px] object-cover rounded shadow-lg"
            />
          </div>
        )}
        {/* Title at bottom with read badge */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <h2 className="font-display text-[22px] lg:text-[26px] tracking-wide text-white group-hover:text-[#E36B11] leading-tight line-clamp-2 drop-shadow-lg transition-colors">
            {article.title}
          </h2>
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
    </div>
  );

  const SmallBox = ({ article }: { article: Article }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleArticleClick(article._id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpenArticle?.(article._id)}
      className={`w-full h-[180px] rounded-none overflow-hidden group text-left relative border border-white/10 cursor-pointer ${loadingArticleId === article._id ? 'pointer-events-none' : ''}`}
    >
      <LoadingOverlay articleId={article._id} />
      {/* Full background image/video */}
      {article.coverImage && (
        isVideo(article.coverImage) ? (
          <video src={article.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
        ) : (
          <LazyImage src={article.coverImage} alt={article.title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
        )
      )}
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${article.category === 'rip' ? 'from-white/80 via-white/20 to-transparent' : 'from-black via-black/40 to-transparent'}`} />
      
      {/* Category badge - top left */}
      <div className="absolute top-2 left-2 z-20">
        <CategoryBadge 
          category={article.category || article.mainCategory} 
          size="sm" 
        />
      </div>
      
      {/* Flag - top right */}
      {articleFlagUrl(article) && (
        <div className="absolute top-2 right-2 z-20">
          <img 
            src={articleFlagUrl(article, '32x24')}
            alt={article.personCountry || ''}
            title={article.personCountry}
            className="w-7 h-5 object-cover rounded-sm shadow-lg"
          />
        </div>
      )}
      
      {article.category === 'rip' && (
        <div className="absolute bottom-8 right-2 z-20 text-white text-2xl leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" style={{fontFamily:'Georgia,serif'}}>✝</div>
      )}
      {/* Content - bottom: Title with read badge */}
      <div className="absolute bottom-2 left-2 right-2 z-10">
        <div className="flex items-start gap-1.5">
          <h3 className={`font-display text-[18px] lg:text-xl tracking-wide ${article.category === 'rip' ? 'text-gray-900' : 'text-white'} leading-tight mb-1 line-clamp-2 flex-1`}>{article.title}</h3>
        </div>
        <div className="flex items-center justify-end gap-1 text-[10px] text-white/70">
          {/* Moods & Comments inline */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} onCoinAnimation={onCoinAnimation} size="xs" useExternalData initialReactions={reactionsMap[article._id]?.reactions} initialUserReaction={reactionsMap[article._id]?.userReaction} initialRewarded={reactionsMap[article._id]?.rewarded} onReactionChange={handleReactionChange} />
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{article.commentsCount || 0}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const MediumBox = ({ article }: { article: Article }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleArticleClick(article._id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpenArticle?.(article._id)}
      className={`w-full h-[180px] rounded-none overflow-hidden group text-left relative border border-warm hover:shadow-lg hover:border-[#E36B11]/30 transition-all duration-200 cursor-pointer ${loadingArticleId === article._id ? 'pointer-events-none' : ''}`}
    >
      <LoadingOverlay articleId={article._id} />
      {/* Full background image/video */}
      {article.coverImage && (
        isVideo(article.coverImage) ? (
          <video src={article.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} muted autoPlay loop playsInline />
        ) : (
          <LazyImage src={article.coverImage} alt={article.title} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: getImagePosition(article), transform: `scale(${(article.imageScale || 100) / 100})` }} />
        )
      )}
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${article.category === 'rip' ? 'from-white/80 via-white/20 to-transparent' : 'from-black via-black/50 to-transparent'}`} />
      
      {/* Category badge - top left */}
      <div className="absolute top-2 left-2 z-20">
        <CategoryBadge 
          category={article.category || article.mainCategory} 
          size="sm" 
        />
      </div>
      
      {/* Flag - top right */}
      {articleFlagUrl(article) && (
        <div className="absolute top-2 right-2 z-20">
          <img 
            src={articleFlagUrl(article, '32x24')}
            alt={article.personCountry || ''}
            title={article.personCountry}
            className="w-7 h-5 object-cover rounded-sm shadow-lg"
          />
        </div>
      )}
      
      {article.category === 'rip' && (
        <div className="absolute bottom-10 right-3 z-20 text-white text-2xl leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]" style={{fontFamily:'Georgia,serif'}}>✝</div>
      )}
      {/* Content - fixed at bottom: Title with read badge */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
        <div className="flex items-start gap-1.5">
          <h3 className={`font-display text-[19px] lg:text-xl tracking-wide ${article.category === 'rip' ? 'text-gray-900' : 'text-white'} group-hover:text-[#E36B11] leading-tight mb-1 line-clamp-2 transition-colors flex-1`}>{article.title}</h3>
        </div>
        <div className="flex items-center justify-between gap-2 text-[10px] text-white/70">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{article.authorName}</span>
                      </div>
          {/* Likes & Comments inline */}
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} onCoinAnimation={onCoinAnimation} size="xs" useExternalData initialReactions={reactionsMap[article._id]?.reactions} initialUserReaction={reactionsMap[article._id]?.userReaction} initialRewarded={reactionsMap[article._id]?.rewarded} onReactionChange={handleReactionChange} />
            <span className="flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="font-medium">{article.commentsCount || 0}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const HalfCard = ({ article, theme }: { article: Article; theme?: string }) => {
    const cardTheme = getCardThemeStyles(theme);
    const hasColorTheme = theme && theme !== 'cream';
    const bgClass = hasColorTheme ? 'bg-white/20 backdrop-blur-sm' : 'bg-cream';
    return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleArticleClick(article._id)}
      onKeyDown={(e) => e.key === 'Enter' && onOpenArticle?.(article._id)}
      className={`w-full rounded-none overflow-hidden ${bgClass} border ${cardTheme.border} text-left shadow-md hover:shadow-lg ${cardTheme.hoverBorder} transition-all duration-200 group cursor-pointer relative touch-manipulation ${loadingArticleId === article._id ? 'pointer-events-none' : ''}`}
    >
      <LoadingOverlay articleId={article._id} />
      {/* Header: Avatar + Name + Time + Menu */}
      <div className="flex items-center gap-2 p-3 pb-2 md:border-b md:border-warm/50">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-full overflow-hidden flex-shrink-0 border border-warm">
          {article.authorAvatar ? (
            <img src={article.authorAvatar} alt={article.authorName || 'Author'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#E36B11]/20 flex items-center justify-center text-[#E36B11] font-bold text-xs md:text-sm">
              {(article.authorName || 'A')[0].toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] md:text-[14px] font-bold text-gray-900 truncate">{article.authorName || 'Author'}</div>
          <div className="text-[10px] md:text-[11px] text-gray-500">{article.createdAt ? new Date(article.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</div>
        </div>
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
          {isDesktop && <div className={`absolute inset-0 bg-gradient-to-t ${article.category === 'rip' ? 'from-white/80 via-white/20 to-transparent' : 'from-black/70 via-black/20 to-transparent'}`} />}
          {/* Category badge - top left */}
          <div className="absolute top-2 left-2 z-20">
            <CategoryBadge 
              category={article.category || article.mainCategory} 
              size="sm" 
            />
          </div>
          {/* Flag - top right */}
          {articleFlagUrl(article) && (
            <div className="absolute top-2 right-2 z-20">
              <img 
                src={articleFlagUrl(article, '32x24')}
                alt={article.personCountry || ''}
                title={article.personCountry}
                className="w-7 h-5 object-cover rounded-sm shadow-lg"
              />
            </div>
          )}
          {/* Date + Title ON the image - only on desktop */}
          {isDesktop && (
            <div className="absolute bottom-2 left-2 right-2 z-10">
              {formatArticleDate(article.createdAt) && (
                <div className="text-[13px] text-white/90 mb-1 font-semibold drop-shadow-lg">{formatArticleDate(article.createdAt)}</div>
              )}
              <h3 className={`font-display text-lg lg:text-3xl tracking-wide ${article.category === 'rip' ? 'text-gray-900' : 'text-white'} group-hover:text-[#E36B11] leading-tight line-clamp-3 drop-shadow-lg transition-colors`}>
                {article.title}
              </h3>
            </div>
          )}
        </div>
      )}
      
      {/* Content - title below image on mobile, subtitle on desktop */}
      <div className="p-3 pt-2.5">
        {!isDesktop && formatArticleDate(article.createdAt) && (
          <div className="text-[12px] text-gray-500 mb-0.5 font-medium">{formatArticleDate(article.createdAt)}</div>
        )}
        {!isDesktop && <h3 className="font-display text-[19px] tracking-wide text-gray-900 leading-snug line-clamp-2 mb-1">{article.title}</h3>}
        {isDesktop && article.subtitle && <p className="text-[15px] text-gray-900 leading-snug line-clamp-2 mb-1">{article.subtitle}</p>}
      </div>
      
      {/* Footer: Likes, Comments, Share */}
      <div className="px-3 pb-3">
        <CardActions article={article} size="small" />
      </div>
    </div>
  );
  };

  // Fixed Banner - Full width image only, no overlay, no text - for recurring content like Monthly Music
  const FixedBanner = ({ article }: { article: Article }) => (
    <button
      onClick={() => handleArticleClick(article._id)}
      className="w-full rounded-none overflow-hidden shadow-md hover:shadow-lg hover:border-[#E36B11]/30 transition-all duration-200 block bg-cream border border-warm p-2"
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
    <div
      role="button"
      tabIndex={0}
      onClick={() => handleArticleClick(article._id)}
      className={`w-full flex items-center gap-3 p-2 bg-cream border border-warm rounded-none text-left shadow-md hover:shadow-lg hover:border-[#E36B11]/30 transition-all duration-200 relative group cursor-pointer touch-manipulation ${loadingArticleId === article._id ? 'pointer-events-none' : ''}`}
    >
      <LoadingOverlay articleId={article._id} />
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
      {/* Content - vertically centered */}
      <div className="flex-1 min-w-0 flex flex-col justify-center h-20">
        <div className="flex items-center gap-2 mb-0.5">
          {/* Flag FIRST, then category */}
          {articleFlagUrl(article) && (
            <span className="flex items-center" title={article.personCountry}>
              <img 
                src={articleFlagUrl(article, '20x15')}
                alt={article.personCountry || ''}
                className="w-5 h-[15px] object-cover border border-gray-300 rounded-sm"
              />
            </span>
          )}
          <span className="text-[#E36B11] text-[10px] font-bold uppercase">{article.category ? getSubCategoryLabel(article.category) : getCategoryLabel(article.mainCategory)}</span>
          <span className="text-gray-500 text-[10px]">• {article.createdAt ? new Date(article.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''}</span>
        </div>
        <h3 className={`font-display tracking-wide text-gray-900 group-hover:text-[#E36B11] leading-tight line-clamp-1 transition-colors ${isDesktop ? 'text-[20px]' : 'text-[20px]'}`}>{article.title}</h3>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5" onClick={(e) => e.stopPropagation()}>
          <CardMoodReactions articleId={article._id} userId={user?.id} isLoggedIn={isLoggedIn} onShowLogin={onShowLogin} onCoinAnimation={onCoinAnimation} size="xs" useExternalData initialReactions={reactionsMap[article._id]?.reactions} initialUserReaction={reactionsMap[article._id]?.userReaction} initialRewarded={reactionsMap[article._id]?.rewarded} onReactionChange={handleReactionChange} />
          <span className="flex items-center gap-0.5">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {article.commentsCount || 0}
          </span>
        </div>
      </div>
    </div>
  );

  // Get article by ID helper
  const getArticleById = (id: string | null): Article | undefined => {
    if (!id) return undefined;
    return articles.find(a => a._id === id);
  };

  const getAutoFillCategories = getAutoFillSlugs;

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
  
  // Timeline/List view toggle
  const [viewMode, setViewMode] = useState<'feed' | 'timeline'>('feed');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'alive' | 'rip'>('all');
  
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
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
          <div className="flex items-center gap-3">
            <Play className="w-5 h-5 text-[#E36B11]" />
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
            <div className="w-2 h-2 bg-[#E36B11] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-[#E36B11] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-[#E36B11] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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

  // Running set of articles already shown — accumulates as containers render top→bottom.
  // Waterfall = each article lives in exactly one place, never duplicated across containers.
  // Only size:12 containers render now, so there are no legacy global-top slots to pre-exclude.
  const usedArticleIds = new Set<string>();

  // The first container is the global "latest" zone: its MAIN/SOCIAL + 2H pull the
  // globally newest articles (any category). Older ones cascade into category containers.
  let firstContainerSeen = false;

  // A FIXED block defines a self-contained "banner area" (e.g. Arcade, History,
  // Community Sound). Its content lives ONLY in that box (banner + slider) and must
  // NOT auto-flow into the Top Area (MAIN/2H of the first container) — unless an editor
  // explicitly stars an article (featured), in which case it joins the Top Area pool and
  // sorts chronologically like everything else.
  //
  // Only the dedicated banner AREAS are excluded from the Top Area:
  // - Date-based areas (Arcade → gaming/tech, History → history): the WHOLE category
  //   belongs to the box, so the entire category is excluded from the Top Area.
  // - Music is special: the FIXED banner is the permanent Community-Sound feature, so
  //   only that one music-community article is excluded — regular music articles still flow.
  // Every other category keeps the normal waterfall (newest flows up into the Top Area
  // AND also shows in its own banner — this duplication is intended).
  const DATE_BASED_AREAS = new Set(['gaming', 'history']);
  // History / Arcade are always excluded, even if their container has no FIXED banner yet.
  const bannerCategories = new Set<string>(TOP_AREA_EXCLUDED_SLUGS);
  const bannerArticleIds = new Set<string>();
  templateItems
    .filter(item => item.size === 12 && (item.containerBlocks || []).length > 0)
    .forEach(item => {
      (item.containerBlocks || []).forEach(block => {
        if (block.type !== 'FIXED') return;
        const cats = getAutoFillCategories(item.containerName, item.containerTheme);
        if (cats.length === 0) return;
        const autoCategory = cats[0];
        if (autoCategory === 'music') {
          // Only the dedicated Community-Sound feature is excluded. If it doesn't exist,
          // do NOT fall back to excluding a regular music article — those flow normally.
          const communityArticle = articles.find(a => a.contentType === 'music-community' && a.status === 'published');
          if (communityArticle) bannerArticleIds.add(communityArticle._id);
        } else if (DATE_BASED_AREAS.has(autoCategory)) {
          cats.forEach(c => bannerCategories.add(c.toLowerCase()));
        } else {
          // Other banners (Eastercorn, Sport, TV/Cinema, Lifestyle) use a dedicated
          // 'banner-page' general page — exclude that page from the feed (banner-only).
          const pageArticle = articles.find(a => a.contentType === 'banner-page' && a.status === 'published' && cats.includes(a.category?.toLowerCase() || ''));
          if (pageArticle) bannerArticleIds.add(pageArticle._id);
        }
      });
    });

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header - exactly like Rankings */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Play className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">{viewMode === 'feed' ? 'Feed' : 'Timeline'}</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">{viewMode === 'feed' ? 'Latest updates & content' : 'Browse by birth year'}</span>
          </div>
        </div>
        {/* View Mode Toggle */}
        <button
          onClick={() => setViewMode(viewMode === 'feed' ? 'timeline' : 'feed')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E36B11]/30 bg-white/80 text-[#E36B11] hover:bg-[#E36B11] hover:text-white hover:border-[#E36B11] shadow-sm hover:shadow transition-all text-xs font-semibold"
        >
          {viewMode === 'feed' ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Timeline
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              Feed
            </>
          )}
        </button>
      </div>
      
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* TIMELINE VIEW - grouped by birth year */}
        {viewMode === 'timeline' && (() => {
          // Extract birth year from personBirthday (DD.MM.YYYY format)
          // Only return GenX years (1965-1980)
          const getBirthYear = (birthday?: string): number | null => {
            if (!birthday) return null;
            const parts = birthday.split('.');
            if (parts.length === 3) {
              const year = parseInt(parts[2], 10);
              // Only GenX: 1965-1980
              if (!isNaN(year) && year >= 1965 && year <= 1980) return year;
            }
            return null;
          };
          
          // Check if person is deceased
          const isDeceased = (a: Article) => !!(a.personDeathday || a.category === 'rip');
          
          // Get articles with birth years, apply filter, sorted by year
          const articlesWithYear = articles
            .filter(a => {
              if (a.status !== 'published' || !getBirthYear(a.personBirthday)) return false;
              if (timelineFilter === 'alive') return !isDeceased(a);
              if (timelineFilter === 'rip') return isDeceased(a);
              return true;
            })
            .map(a => ({ ...a, birthYear: getBirthYear(a.personBirthday)!, deceased: isDeceased(a) }))
            .sort((a, b) => a.birthYear - b.birthYear);
          
          // Group by year
          const byYear: Record<number, typeof articlesWithYear> = {};
          articlesWithYear.forEach(a => {
            if (!byYear[a.birthYear]) byYear[a.birthYear] = [];
            byYear[a.birthYear].push(a);
          });
          
          const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
          
          // Count totals for filter badges
          const allCount = articles.filter(a => a.status === 'published' && getBirthYear(a.personBirthday)).length;
          const aliveCount = articles.filter(a => a.status === 'published' && getBirthYear(a.personBirthday) && !isDeceased(a)).length;
          const ripCount = articles.filter(a => a.status === 'published' && getBirthYear(a.personBirthday) && isDeceased(a)).length;
          
          return (
            <div className="px-3 pb-4 pt-2">
              {/* Filter Buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setTimelineFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    timelineFilter === 'all' ? 'bg-[#E36B11] text-white' : 'bg-warm text-gray-600 hover:bg-[#E36B11]/20'
                  }`}
                >
                  All ({allCount})
                </button>
                <button
                  onClick={() => setTimelineFilter('alive')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    timelineFilter === 'alive' ? 'bg-green-600 text-white' : 'bg-warm text-gray-600 hover:bg-green-100'
                  }`}
                >
                  Alive ({aliveCount})
                </button>
                <button
                  onClick={() => setTimelineFilter('rip')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    timelineFilter === 'rip' ? 'bg-gray-700 text-white' : 'bg-warm text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  † RIP ({ripCount})
                </button>
              </div>
              
              {years.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No articles found for this filter.</p>
                </div>
              ) : (
                years.map(year => (
                  <div key={year} className="mb-4">
                    {/* Year Header */}
                    <div className="sticky top-0 z-10 bg-cream py-2 border-b-2 border-[#E36B11] mb-2">
                      <span className="font-display text-2xl font-bold text-[#E36B11]">{year}</span>
                      <span className="ml-2 text-xs text-gray-500">({byYear[year].length} {byYear[year].length === 1 ? 'person' : 'people'})</span>
                    </div>
                    {/* People in this year */}
                    <div className="space-y-1">
                      {byYear[year].map(article => (
                        <button
                          key={article._id}
                          onClick={() => handleArticleClick(article._id)}
                          className="w-full flex items-center gap-3 p-2 border border-warm rounded hover:border-[#E36B11]/50 hover:bg-[#E36B11]/5 transition-all text-left group"
                        >
                          {/* Thumbnail */}
                          <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 border border-warm">
                            {article.coverImage ? (
                              <img src={article.coverImage} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">?</div>
                            )}
                          </div>
                          {/* Name */}
                          <div className="flex-1 min-w-0">
                            <div className={`font-medium truncate group-hover:text-[#E36B11] transition-colors ${article.deceased ? 'text-gray-600' : 'text-gray-900'}`}>
                              {article.personName || article.title}
                              {article.deceased && <span className="ml-1 text-gray-400">†</span>}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {article.personBirthday}
                              {article.personDeathday && ` – † ${article.personDeathday}`}
                              {article.personCountry && ` • ${article.personCountry}`}
                            </div>
                          </div>
                          {/* Country Flag */}
                          {articleFlagUrl(article) && (
                            <img 
                              src={articleFlagUrl(article, '24x18')}
                              alt=""
                              className="w-6 h-4 object-cover rounded-sm flex-shrink-0"
                            />
                          )}
                          {/* Category Badge */}
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#E36B11]/10 text-[#E36B11] flex-shrink-0">
                            {article.category}
                          </span>
                          {/* Arrow */}
                          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#E36B11] flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          );
        })()}
        
        {/* FEED VIEW - normal grid template */}
        {viewMode === 'feed' && (
        <div className="grid grid-cols-6 gap-1.5 px-2 pb-4 pt-3">
            {templateItems
              .filter(item => {
                // Only Container (size 12) is supported — matches admin editor exactly.
                // Legacy items (size 1-10) are ignored so they can't create phantom cards.
                return item.size === 12 && (item.containerBlocks || []).length > 0;
              })
              .map((item, index) => {
                // Size 12 = Container (just a carrier with title)
                if (item.size === 12) {
                  const blocks = item.containerBlocks || [];
                  // Top container pulls globally newest (any category); others use their category
                  const isTop = !firstContainerSeen;
                  firstContainerSeen = true;
                  const containerCats = getAutoFillCategories(item.containerName, item.containerTheme);
                  // NOTE: Do NOT filter by usedArticleIds here - that's done live in each block
                  // because usedArticleIds is mutated during rendering of earlier blocks
                  const containerPool = (isTop
                    ? articles.filter(a => a.status === 'published' && a.contentType !== 'rankroll' && a.contentType !== 'music-community' && a.contentType !== 'banner-page' && (a.featured || (!bannerCategories.has(a.category?.toLowerCase() || '') && !bannerArticleIds.has(a._id))))
                    : articles.filter(a => a.status === 'published' && a.contentType !== 'rankroll' && a.contentType !== 'music-community' && a.contentType !== 'banner-page' && containerCats.includes(a.category?.toLowerCase() || ''))
                  ).sort(compareArticles);
                  // Frontend theme styles - SAME as Admin (ContainerBlock.tsx)
                  const themeStyles: Record<string, { bg: string; border: string; titleColor: string }> = {
                    cream: { bg: 'bg-[#F5F0E8]', border: 'border-[#E5DDD0]', titleColor: 'text-[#E36B11]' },
                    bogx: { bg: 'bg-[#E36B11]', border: 'border-[#E5A55A]', titleColor: 'text-[#F5F0E8]' },
                    arcade: { bg: 'bg-purple-800', border: 'border-purple-500', titleColor: 'text-[#F5F0E8]' },
                    sports: { bg: 'bg-green-800', border: 'border-green-500', titleColor: 'text-[#F5F0E8]' },
                    music: { bg: 'bg-orange-800', border: 'border-orange-500', titleColor: 'text-[#F5F0E8]' },
                    movies: { bg: 'bg-blue-800', border: 'border-blue-500', titleColor: 'text-[#F5F0E8]' },
                    history: { bg: 'bg-amber-700', border: 'border-amber-500', titleColor: 'text-[#F5F0E8]' },
                    culture: { bg: 'bg-pink-800', border: 'border-pink-500', titleColor: 'text-[#F5F0E8]' },
                    gaming: { bg: 'bg-indigo-800', border: 'border-indigo-500', titleColor: 'text-[#F5F0E8]' },
                    retro: { bg: 'bg-teal-800', border: 'border-teal-500', titleColor: 'text-[#F5F0E8]' },
                  };
                  const isCustomTheme = item.containerTheme === 'custom' && item.customColor;
                  const theme = isCustomTheme 
                    ? { bg: '', border: '', titleColor: 'text-[#F5F0E8]' }
                    : (themeStyles[item.containerTheme || 'cream'] || themeStyles.cream);
                  const hasTheme = (item.containerTheme && item.containerTheme !== 'cream') || isCustomTheme;
                  
                  return (
                    <div key={index} className="col-span-6">
                      {/* Container Title — always outside the colored box */}
                      {item.containerName && (() => {
                        const n = item.containerName.toLowerCase();
                        const Icon = n.includes('birthday') || n.includes('happy') ? PartyPopper
                          : n.includes('history') ? BookOpen
                          : n.includes('music') ? Music
                          : n.includes('arcade') || n.includes('gaming') || n.includes('trivia') ? Brain
                          : n.includes('sport') ? Trophy
                          : n.includes('lifestyle') || n.includes('culture') ? Sparkles
                          : n.includes('rip') || n.includes('memorial') ? Cross
                          : n.includes('movie') || n.includes('cinema') || n.includes('tv') || n.includes('film') ? Clapperboard
                          : Newspaper;
                        const accentColor = n.includes('birthday') || n.includes('happy') ? '#F4B400'
                          : n.includes('history') ? '#E36B11'
                          : n.includes('music') ? '#6db94c'
                          : n.includes('arcade') || n.includes('gaming') || n.includes('trivia') ? '#7C3AED'
                          : n.includes('sport') ? '#E53935'
                          : n.includes('eastercorn') ? '#000000'
                          : n.includes('lifestyle') || n.includes('culture') ? '#EC4899'
                          : n.includes('rip') || n.includes('memorial') ? '#6B7280'
                          : n.includes('movie') || n.includes('cinema') || n.includes('tv') || n.includes('film') ? '#F97316'
                          : '#374151';
                        return (
                          <div className="flex items-center gap-2.5 mb-2 pl-3 py-1.5" style={{ borderLeft: `4px solid ${accentColor}` }}>
                            <Icon className="w-5 h-5" style={{ color: accentColor }} />
                            <span className="font-display text-lg tracking-wider" style={{ color: accentColor }}>{item.containerName}</span>
                          </div>
                        );
                      })()}
                      {/* Colored container box */}
                      <div 
                        className={`${hasTheme ? `${isCustomTheme ? '' : `${theme.bg} ${theme.border}`} border rounded-lg p-2` : ''}`}
                        style={isCustomTheme ? { backgroundColor: item.customColor, borderColor: item.customColor } : undefined}
                      >
                      {/* Container Blocks */}
                      <div className="flex flex-col gap-2">
                      {blocks.map((block, blockIdx) => {
                        const containerTheme = item.containerTheme;
                        if (block.type === 'MAIN') {
                          // WATERFALL: newest from the (category-filtered) pool wins
                          let mainArticle: Article | null = containerPool.find(a => !usedArticleIds.has(a._id)) || null;
                          // Pinned article is only a fallback, and only if its category fits this container
                          if (!mainArticle && block.articleId && !usedArticleIds.has(block.articleId)) {
                            const pinned = getArticleById(block.articleId);
                            if (pinned && (isTop || containerCats.length === 0 || containerCats.includes(pinned.category?.toLowerCase() || ''))) {
                              mainArticle = pinned;
                            }
                          }
                          if (!mainArticle) return null;
                          usedArticleIds.add(mainArticle._id);
                          return <div key={blockIdx}><MainBox article={mainArticle} theme={containerTheme} /></div>;
                        }
                        if (block.type === '2H') {
                          let leftArticle: Article | null = null;
                          let rightArticle: Article | null = null;
                          
                          // Helper to check if pinned article matches container category
                          const categoryMatches = (art: Article | undefined) => 
                            !!art && (isTop || containerCats.length === 0 || containerCats.includes(art.category?.toLowerCase() || ''));
                          
                          // WATERFALL: auto-fill is primary — newest from pool
                          const pool = containerPool.filter(a => !usedArticleIds.has(a._id));
                          leftArticle = pool[0] || null;
                          rightArticle = pool[1] || null;
                          
                          // Pinned IDs only as fallback, and only if their category fits this container
                          if (!leftArticle && block.articleId && !usedArticleIds.has(block.articleId)) {
                            const pinned = getArticleById(block.articleId);
                            if (categoryMatches(pinned)) leftArticle = pinned!;
                          }
                          if (!rightArticle && block.articleId2 && !usedArticleIds.has(block.articleId2)) {
                            const pinned = getArticleById(block.articleId2);
                            if (categoryMatches(pinned)) rightArticle = pinned!;
                          }
                          if (leftArticle) usedArticleIds.add(leftArticle._id);
                          if (rightArticle) usedArticleIds.add(rightArticle._id);
                          if (!leftArticle && !rightArticle) return null;
                          return (
                            <div key={blockIdx} className="grid grid-cols-2 gap-1.5">
                              {leftArticle && <HalfCard article={leftArticle} theme={containerTheme} />}
                              {rightArticle && <HalfCard article={rightArticle} theme={containerTheme} />}
                            </div>
                          );
                        }
                        if (block.type === 'FIXED') {
                          const cats = getAutoFillCategories(item.containerName, item.containerTheme);
                          if (cats.length === 0) return null;
                          const autoCategory = cats[0];
                          let fixedArticle: Article | undefined;
                          if (autoCategory === 'music') {
                            fixedArticle = articles.find(a => a.contentType === 'music-community' && a.status === 'published')
                              || articles.filter(a => a.category === 'music' && a.status === 'published')
                                .sort(compareArticles)[0];
                          } else if (DATE_BASED_AREAS.has(autoCategory)) {
                            // Arcade / History: always the newest article of the category
                            fixedArticle = articles
                              .filter(a => a.status === 'published' && cats.includes(a.category?.toLowerCase() || ''))
                              .sort(compareArticles)[0];
                          } else {
                            // Other banners (Eastercorn, Sport, TV/Cinema, Lifestyle, RIP): prefer the
                            // dedicated 'banner-page' general page; fall back to the newest article.
                            // For RIP: use banner-page so clicking opens a memorial landing page, not the newest obituary.
                            fixedArticle = articles.find(a => a.contentType === 'banner-page' && a.status === 'published' && cats.includes(a.category?.toLowerCase() || ''))
                              || articles
                                .filter(a => a.status === 'published' && a.contentType !== 'banner-page' && cats.includes(a.category?.toLowerCase() || ''))
                                .sort(compareArticles)[0];
                          }
                          // Prefer the dedicated banner image stored on the block. For the
                          // Community-Sound feature, fall back to the article's coverImage
                          // (the permanent music banner picture) when no block image is set.
                          const bannerLink = (block as any).bannerLink || '';
                          const fixedImg = (block as any).bannerImage || ((autoCategory === 'music' || fixedArticle?.contentType === 'banner-page') ? (fixedArticle?.coverImage || '') : '');
                          // Render the banner if we have EITHER a backing article OR a dedicated
                          // banner image (e.g. an Eastercorn banner with a picture but no article yet).
                          if (!fixedArticle && !fixedImg) return null;
                          return (
                            <button
                              key={blockIdx}
                              type="button"
                              onClick={() => {
                                if (autoCategory === 'music' && onOpenCommunitySound) { onOpenCommunitySound(); return; }
                                if (fixedArticle) { onOpenArticle?.(fixedArticle._id); return; }
                                if (bannerLink) {
                                  if (/^https?:\/\//.test(bannerLink)) window.open(bannerLink, '_blank');
                                  else onOpenStaticPage?.(bannerLink.replace(/^\//, ''));
                                }
                              }}
                              className={`block w-full rounded-none overflow-hidden shadow-md hover:shadow-lg transition-all cursor-pointer ${autoCategory === 'music' ? 'border-4 border-[#6db94c]' : 'bg-[#F5F0E8] p-1 border border-[#E5DDD0] hover:border-[#E36B11]/30'}`}
                            >
                              <div className="relative w-full aspect-[2/1] md:aspect-[2.5/1] lg:aspect-[2.7/1] overflow-hidden bg-gray-800">
                                {fixedImg ? (
                                  fixedImg.match(/\.(mp4|webm|mov)($|\?)/i) || fixedImg.includes('/video/') ? (
                                    <video src={fixedImg} className="w-full h-full object-cover" muted autoPlay loop playsInline style={{ objectPosition: `${(fixedArticle as any)?.imagePosX ?? 50}% ${(fixedArticle as any)?.imagePosY ?? 50}%` }} />
                                  ) : (
                                    <img src={fixedImg} alt="" className="w-full h-full object-cover" style={{ objectPosition: `${(fixedArticle as any)?.imagePosX ?? 50}% ${(fixedArticle as any)?.imagePosY ?? 50}%` }} />
                                  )
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-r from-gray-800 to-gray-700" />
                                )}
                                {fixedArticle && (autoCategory === 'history' || autoCategory === 'arcade' || autoCategory === 'gaming') && (() => {
                                  const dateStr = fixedArticle.createdAt
                                    ? new Date(fixedArticle.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                    : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                  // Use cream color for arcade/gaming, orange for history
                                  const isArcade = autoCategory === 'arcade' || autoCategory === 'gaming';
                                  const accentColor = isArcade ? '#F5F0E8' : '#E36B11';
                                  const bgTint = isArcade ? 'rgba(107, 33, 168, 0.3)' : `${accentColor}20`;
                                  return (
                                    <div className="absolute bottom-0 left-0 right-0 flex items-stretch bg-black/55 backdrop-blur-sm">
                                      {/* Date block left - category accent color */}
                                      <div className="flex flex-row items-center justify-center gap-1.5 px-4 py-3 border-r border-white/20 whitespace-nowrap" style={{ backgroundColor: bgTint }}>
                                        <span className="text-sm font-bold uppercase tracking-widest leading-none" style={{ color: accentColor }}>{dateStr.split(' ')[0]}</span>
                                        <span className="font-black text-2xl leading-none" style={{ color: accentColor }}>{dateStr.split(' ')[1]}</span>
                                      </div>
                                      {/* Title + subtitle right */}
                                      <div className="flex flex-col justify-center px-4 py-3 min-w-0 gap-0.5 text-left flex-1">
                                        <div className="text-[#F5F0E8] font-bold text-base leading-tight line-clamp-1">{fixedArticle.title}</div>
                                        {fixedArticle.subtitle && <div className="text-[#F5F0E8]/65 text-xs leading-tight line-clamp-1 pl-0">{fixedArticle.subtitle}</div>}
                                      </div>
                                      {/* Read More button - desktop only */}
                                      <div className="hidden md:flex items-center px-4 py-3 flex-shrink-0">
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 border text-xs font-bold uppercase tracking-wider rounded transition-colors whitespace-nowrap" style={{ borderColor: `${accentColor}99`, color: accentColor }}>
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
                            // WATERFALL: exclude articles already used by MAIN/2H/FIXED blocks
                            const autoArticles = [...articles]
                              .filter(a => {
                                if (a.status !== 'published') return false;
                                if (a.contentType === 'music-community' || a.contentType === 'rankroll' || a.contentType === 'banner-page') return false;
                                // Waterfall: skip articles already used in this container
                                if (usedArticleIds.has(a._id)) return false;
                                const artCat = a.category?.toLowerCase() || '';
                                const artMain = a.mainCategory?.toLowerCase() || '';
                                if (!( artCat === cat || artMain === cat || artCat.includes(cat) || artMain.includes(cat))) return false;
                                return true;
                              })
                              .sort(compareArticles)
                              .slice(0, limit);
                            
                            // Mark slider articles as used for waterfall
                            autoArticles.forEach(a => usedArticleIds.add(a._id));
                            
                            console.log(`SLIDER auto-fill: category=${cat}, found ${autoArticles.length} articles (excluding ${usedArticleIds.size} used)`);
                            
                            if (autoArticles.length === 0) return null;
                            return <div key={blockIdx}><SliderContainer articles={autoArticles} theme={containerTheme} {...sliderProps} /></div>;
                          }
                          // Manual: use specified article IDs (also filter out used ones)
                          const manualIds = (block.articles || []).filter(id => !usedArticleIds.has(id));
                          manualIds.forEach(id => usedArticleIds.add(id));
                          const manualArticles = manualIds.map(id => getArticleById(id)).filter(Boolean) as Article[];
                          return <div key={blockIdx}><SliderContainer articles={manualArticles} theme={containerTheme} {...sliderProps} /></div>;
                        }
                        if (block.type === 'VERTICAL') {
                          console.log('VERTICAL block found:', block);
                          // Auto-fill by category or manual articles
                          const cat = block.autoFillCategory?.toLowerCase() || '';
                          let vertArticles: Article[] = [];
                          
                          if (cat) {
                            // Auto-fill: get latest articles from category (newest first), skip already-used
                            vertArticles = articles
                              .filter(a => a.category?.toLowerCase() === cat && a.status === 'published' && a.contentType !== 'rankroll' && a.contentType !== 'music-community' && a.contentType !== 'banner-page' && a.coverImage && !usedArticleIds.has(a._id))
                              .sort(compareArticles)
                              .slice(0, block.autoFillLimit || 3);
                          } else {
                            // Manual: use specified article IDs
                            vertArticles = (block.articles || []).map(id => getArticleById(id)).filter(Boolean) as Article[];
                          }
                          
                          if (vertArticles.length === 0) return null;
                          vertArticles.forEach(a => usedArticleIds.add(a._id));
                          
                          // Category label for "See more" link
                          const categoryLabels: Record<string, string> = {
                            'history': 'History', 'movies-tv': 'Movies & TV', 'music': 'Music',
                            'gaming': 'Gaming', 'rewind': 'Rewind', 'sports': 'Sports',
                            'tech': 'Tech', 'culture': 'Culture', 'news': 'News', 'lifestyle': 'Lifestyle',
                            'rip': 'RIP', 'eastercorn': 'Eastercorn'
                          };
                          const catColor: Record<string, string> = {
                            'music': '#22C55E', 'sports': '#E53935', 'history': '#E36B11',
                            'movies-tv': '#F97316', 'gaming': '#7C3AED', 'lifestyle': '#EC4899',
                            'culture': '#EC4899', 'rip': '#6B7280', 'eastercorn': '#1E3A8A',
                          };
                          const seeMoreColor = catColor[cat] || '#E36B11';
                          
                          return (
                            <div key={blockIdx} className="space-y-1.5">
                              {vertArticles.slice(0, 3).map((art, i) => <FullWidthBanner key={i} article={art} />)}
                              {cat && (
                                <div className="pt-2 pb-4 mb-2 border-b border-warm">
                                  <button 
                                    onClick={() => window.dispatchEvent(new CustomEvent('openArticles', { detail: { category: cat } }))}
                                    className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs text-gray-400 uppercase tracking-wider hover:text-gray-600"
                                  >
                                    {cat === 'music' && <Music className="w-3.5 h-3.5" />}
                                    {cat === 'movies-tv' && <Clapperboard className="w-3.5 h-3.5" />}
                                    {cat === 'gaming' && <Gamepad2 className="w-3.5 h-3.5" />}
                                    {cat === 'sports' && <Trophy className="w-3.5 h-3.5" />}
                                    {cat === 'history' && <BookOpen className="w-3.5 h-3.5" />}
                                    {cat === 'lifestyle' && <Sparkles className="w-3.5 h-3.5" />}
                                    {cat === 'culture' && <Sparkles className="w-3.5 h-3.5" />}
                                    {cat === 'rip' && <Cross className="w-3.5 h-3.5" />}
                                    {cat === 'eastercorn' && <Newspaper className="w-3.5 h-3.5" />}
                                    See more {categoryLabels[cat] || cat}
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        }
                        if (block.type === 'SOCIAL') {
                          // Auto-fill primary: newest from pool waterfalls to the top, pinned as fallback
                          let socialArticle: Article | null = containerPool.find(a => !usedArticleIds.has(a._id)) || null;
                          if (!socialArticle && block.articleId && !usedArticleIds.has(block.articleId)) socialArticle = getArticleById(block.articleId) ?? null;
                          if (!socialArticle) return null;
                          usedArticleIds.add(socialArticle._id);
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
                      <span className="text-xs font-bold text-[#E36B11] uppercase tracking-wider">More Articles</span>
                      {vertArticles.slice(0, 3).map((art, i) => (
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
                  const sliderItems = (item.sliderArticles || []).map(id => getArticleById(id)).filter(Boolean) as Article[];
                  return <div key={index} className="col-span-6"><SliderContainer articles={sliderItems} title={item.sliderTitle} {...sliderProps} /></div>;
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
        )}
          
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
              <button onClick={() => onOpenStaticPage?.('impressum')} className="hover:text-[#E36B11] transition-colors">Impressum</button>
              <button onClick={() => onOpenStaticPage?.('datenschutz')} className="hover:text-[#E36B11] transition-colors">Datenschutz</button>
              <button onClick={() => onOpenStaticPage?.('agb')} className="hover:text-[#E36B11] transition-colors">AGB</button>
              <button onClick={() => onOpenStaticPage?.('kontakt')} className="hover:text-[#E36B11] transition-colors">Kontakt</button>
            </div>
            
            {/* Social Links */}
            <div className="flex justify-center gap-3 mb-4">
              <a href="https://instagram.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-[#E36B11] hover:bg-[#E36B11]/20 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="https://facebook.com/bestofgenx" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-[#E36B11] hover:bg-[#E36B11]/20 transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="mailto:contact@bestofgenx.com" className="w-8 h-8 rounded-full bg-[#E36B11]/10 flex items-center justify-center text-[#E36B11] hover:bg-[#E36B11]/20 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
              </a>
            </div>
            
            {/* Copyright */}
            <p className="text-center text-[10px] text-gray-400">
              © {new Date().getFullYear()} Best of GenX. All rights reserved.
            </p>
            <p className="text-center text-[9px] text-gray-300 mt-1 flex items-center justify-center gap-1">
              Made with <svg className="w-2.5 h-2.5 text-[#E36B11]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> for Generation X
            </p>
          </footer>
        
              </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-full shadow-xl">
            {toast.icon === 'check' && <Check className="w-4 h-4 text-emerald-600" />}
            {toast.icon === 'bookmark' && <Bookmark className="w-4 h-4 text-[#E36B11]" />}
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
