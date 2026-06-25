"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, Clock, Eye, Share2, TrendingUp, Facebook, Linkedin, MessageCircle, Mail, Link2, Check } from "lucide-react";
import EmojiReactions from "./EmojiReactions";
import CategoryBadge from "./CategoryBadge";
import { useBackButton } from "@/hooks/useBackButton";
import ArticleSkeleton from "./ArticleSkeleton";
import QuizPollCard from "./QuizPoll";
import PollCard from "./PollCard";
import RankingPollCard from "./RankingPollCard";
import CommentSection from "./CommentSection";
import { useAuth } from "@/context/AuthContext";
import { isVideoUrl } from "@/utils/media";
import MusicSongList from './games/MusicSongList';

interface Article {
  _id: string;
  title: string;
  subtitle?: string;
  content: string;
  coverImage?: string;
  thumbnailPosition?: { x: number; y: number };
  coverPosition?: { x: number; y: number };
  imagePosX?: number;
  imagePosY?: number;
  mainCategory?: string;
  category: string;
  authorName?: string;
  authorAvatar?: string;
  readTime?: number;
  views: number;
  likes: number;
  trending?: boolean;
  publishedAt?: string;
  createdAt?: string;
  closesAt?: string;  // For voting/poll articles - when the poll closes
  commentsEnabled?: boolean;
  // Content type for special articles
  contentType?: 'article' | 'rankroll' | 'tv' | 'radio' | 'arcade' | 'shop' | 'music-community';
  linkedContentId?: string;
  // Styling options
  titleColor?: string;
  titleFont?: 'default' | 'display' | 'serif' | 'mono';
  subtitleColor?: string;
  contentColor?: string;
}

interface ArticlePageProps {
  articleId: string;
  onBack: () => void;
  onShowLogin?: () => void;
  onOpenAuthor?: (authorName: string) => void;
  onOpenArticle?: (articleId: string) => void;
  onCoinAnimation?: (amount: number) => void;
  onOpenRadio?: () => void;
  isDesktop?: boolean;
  readArticles?: Set<string>;
}

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
};

const MAIN_CATEGORY_LABELS: Record<string, string> = {
  'articles': 'Articles',
  'shop': 'Shop',
  'arcade': 'Arcade',
  'voting': 'Voting',
};

/**
 * Process raw article HTML from Quill editor:
 * - Wrap embedded videos (iframe) in responsive 16:9 container
 * - Replace ad-slot markers with styled in-article ad placeholders
 * - Normalize empty paragraphs into proper spacing
 */
function processArticleHtml(raw: string): string {
  let html = raw;

  // 1. Replace ad-slot markers with styled ad container
  html = html.replace(
    /<p[^>]*data-ad-slot="banner"[^>]*>.*?<\/p>/gi,
    `<div class="article-ad-slot my-8 py-6 px-4 bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl text-center">
      <div class="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium mb-2">Advertisement</div>
      <div class="min-h-[90px] flex items-center justify-center text-gray-300 text-sm" data-ad-placeholder="true">Ad will appear here</div>
    </div>`
  );

  // 2. Unwrap any existing video-embed wrappers to re-wrap consistently
  html = html.replace(
    /<div[^>]*class="[^"]*video-embed[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    '$1'
  );

  // 3. Wrap iframes (YouTube/Vimeo) in a card-style container with source attribution
  // Matches BOTH <iframe ...></iframe> AND <iframe ... /> (self-closing)
  html = html.replace(
    /<iframe([^>]*?)(?:\s*\/>|>\s*<\/iframe>)/gi,
    (_match, attrs) => {
      let cleanAttrs = String(attrs);
      // Extract src URL for source attribution
      const srcMatch = String(attrs).match(/src="([^"]+)"/i);
      const embedUrl = srcMatch?.[1] || '';
      // Convert embed URL back to watchable URL + detect source
      let watchUrl = embedUrl;
      let sourceName = 'Source';
      let sourceIcon = '🔗';
      const ytMatch = embedUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
      const vmMatch = embedUrl.match(/player\.vimeo\.com\/video\/(\d+)/);
      if (ytMatch) {
        watchUrl = `https://www.youtube.com/watch?v=${ytMatch[1]}`;
        sourceName = 'Watch on YouTube';
        sourceIcon = '▶';
      } else if (vmMatch) {
        watchUrl = `https://vimeo.com/${vmMatch[1]}`;
        sourceName = 'Watch on Vimeo';
        sourceIcon = '▶';
      }
      // Remove width/height/style from iframe
      cleanAttrs = cleanAttrs.replace(/\s(width|height)="[^"]*"/gi, '');
      cleanAttrs = cleanAttrs.replace(/style="[^"]*"/gi, '');
      return `<div class="article-video-card my-6 rounded-xl overflow-hidden" style="background:#1A1A1A;border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 20px rgba(0,0,0,0.3);">
        <div style="position:relative;">
          <iframe${cleanAttrs} width="720" height="405" style="width:100%;aspect-ratio:16/9;height:auto;border:0;display:block;" frameborder="0" allowfullscreen></iframe>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:rgba(0,0,0,0.3);">
          <a href="${watchUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:6px;color:#D4873A;text-decoration:none;font-size:11px;font-weight:500;">
            <span style="font-size:14px;">${sourceIcon}</span><span>${sourceName}</span>
          </a>
          <button onclick="navigator.clipboard.writeText('${watchUrl}');this.innerText='✓';setTimeout(()=>{this.innerText='Copy'},1500);" style="background:rgba(212,135,58,0.15);border:none;color:#D4873A;padding:4px 8px;border-radius:4px;font-size:10px;font-weight:600;cursor:pointer;font-family:inherit;">Copy</button>
        </div>
      </div>`;
    }
  );

  // 4. Wrap standalone images - full width, no max-width restriction
  html = html.replace(
    /<img([^>]*?)\/?>/gi,
    (_match, attrs) => {
      let cleanAttrs = String(attrs);
      // Strip inline style to use our own
      cleanAttrs = cleanAttrs.replace(/style="[^"]*"/gi, '');
      return `<div class="article-image-card my-4 rounded-xl overflow-hidden" style="width:100%;">
        <img${cleanAttrs} style="width:100%;height:auto;display:block;border-radius:12px;" />
      </div>`;
    }
  );

  // 5. Force explicit styling on headings (prose classes can be overridden) - use Bebas Neue font
  html = html.replace(/<h1([^>]*)>/gi, '<h1$1 style="font-family:var(--font-display),Bebas Neue,sans-serif;font-size:28px;font-weight:bold;line-height:1.2;margin:32px 0 16px 0;color:#111827;text-transform:uppercase;letter-spacing:0.02em;">');
  html = html.replace(/<h2([^>]*)>/gi, '<h2$1 style="font-family:var(--font-display),Bebas Neue,sans-serif;font-size:24px;font-weight:bold;line-height:1.3;margin:28px 0 14px 0;color:#111827;text-transform:uppercase;letter-spacing:0.02em;">');
  html = html.replace(/<h3([^>]*)>/gi, '<h3$1 style="font-family:var(--font-display),Bebas Neue,sans-serif;font-size:20px;font-weight:600;line-height:1.4;margin:24px 0 12px 0;color:#111827;text-transform:uppercase;letter-spacing:0.02em;">');

  // 6. Normalize empty paragraphs to spacing
  html = html.replace(/<p[^>]*><br\s*\/?><\/p>/gi, '<div style="height:1em;"></div>');
  html = html.replace(/<p[^>]*>\s*<\/p>/gi, '<div style="height:1em;"></div>');

  // 7. Style song-highlight blocks for monthly playlist articles
  html = html.replace(
    /<div class="song-highlight">/gi,
    `<div class="song-highlight" style="background:linear-gradient(135deg,#FDF6EE 0%,#FEF9F3 100%);border:2px solid #D4873A;border-radius:12px;padding:16px 20px;margin:16px 0 24px 0;box-shadow:0 4px 12px rgba(212,135,58,0.15);">`
  );

  // 8. Style spotify-play button
  html = html.replace(
    /<a([^>]*?)class="spotify-play"([^>]*)>/gi,
    `<a$1class="spotify-play"$2 style="display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:8px 16px;background:#1DB954;color:white;border-radius:20px;font-size:13px;font-weight:600;text-decoration:none;">`
  );

  // 9. Style ad-card blocks
  html = html.replace(
    /<div class="ad-card"([^>]*)>/gi,
    `<div class="ad-card"$1 style="position:relative;margin:24px 0;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">`
  );
  html = html.replace(
    /<div class="ad-label">/gi,
    `<div class="ad-label" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.6);color:white;font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:0.5px;">`
  );
  html = html.replace(
    /<div class="ad-title">/gi,
    `<div class="ad-title" style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.8));color:white;font-size:14px;font-weight:600;padding:24px 12px 12px;">`
  );
  html = html.replace(
    /(<div class="ad-card"[^>]*>[\s\S]*?<a[^>]*>[\s\S]*?<img)/gi,
    (match) => match.replace(/<img/gi, '<img style="width:100%;height:auto;display:block;"')
  );

  return html;
}

export default function ArticlePage({ articleId, onBack, onShowLogin, onOpenAuthor, onOpenArticle, onCoinAnimation, onOpenRadio, isDesktop = false, readArticles = new Set() }: ArticlePageProps) {
  const { user, isLoggedIn } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [linkedPoll, setLinkedPoll] = useState<any | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Countdown timer for linked poll OR article closesAt (for voting articles)
  useEffect(() => {
    // Poll can have endsAt OR closesAt depending on type
    const endDate = linkedPoll?.endsAt || linkedPoll?.closesAt || article?.closesAt;
    if (!endDate) {
      setCountdown(null);
      return;
    }
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(endDate).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setCountdown(null);
        return;
      }
      
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [linkedPoll?.endsAt, linkedPoll?.closesAt, article?.closesAt]);

  // Intercept system/browser back button to close article instead of leaving page
  useBackButton(true, onBack);

  // Scroll to top when article opens
  useEffect(() => {
    // Scroll EVERYTHING to top
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    // Scroll this component's container
    containerRef.current?.scrollTo(0, 0);
    // Scroll parent content container
    const scrollableParent = document.querySelector('[data-content-scroll]');
    if (scrollableParent) {
      scrollableParent.scrollTop = 0;
    }
  }, [articleId]);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        // Pass userId to ensure unique view tracking (no double-counting)
        const userIdParam = user?.id ? `&userId=${user.id}` : '';
        const res = await fetch(`/api/articles/${articleId}?view=true${userIdParam}`);
        const data = await res.json();
        if (data.success) {
          setArticle(data.article);
          setLikeCount(data.article.likes || 0);
          
          // Trigger coin animation based on API response (pointsAwarded > 0 means first read)
          if (user?.id && data.pointsAwarded > 0) {
            console.log('Triggering coin animation for logged in user:', data.pointsAwarded);
            onCoinAnimation?.(data.pointsAwarded); // Already in BOGX
          } else if (!user?.id) {
            // Guest user: reward locally via localStorage
            const GUEST_REWARD = 0.05; // Same as DEFAULT_CURRENCY_CONFIG.readArticle
            const guestRead: string[] = JSON.parse(localStorage.getItem('bogx_guest_read') || '[]');
            if (!guestRead.includes(articleId)) {
              guestRead.push(articleId);
              localStorage.setItem('bogx_guest_read', JSON.stringify(guestRead));
              const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
              localStorage.setItem('bogx_guest_coins', String(Math.round((guestCoins + GUEST_REWARD) * 100) / 100));
              onCoinAnimation?.(GUEST_REWARD);
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch article:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchArticle();
    
    // Fetch linked poll for this article
    const fetchLinkedPoll = async () => {
      try {
        // First check if article has linkedContentId (for rankroll articles)
        const articleRes = await fetch(`/api/articles/${articleId}`);
        const articleData = await articleRes.json();
        
        if (articleData.success && articleData.article?.linkedContentId && articleData.article?.contentType === 'rankroll') {
          // Fetch the linked poll directly
          console.log('Fetching linked poll:', articleData.article.linkedContentId);
          const pollRes = await fetch(`/api/polls/${articleData.article.linkedContentId}`);
          const pollData = await pollRes.json();
          console.log('Poll data:', pollData);
          if (pollData.success && pollData.poll) {
            setLinkedPoll(pollData.poll);
            return;
          }
        }
        
        // Fallback: check for polls linked to this article
        const res = await fetch(`/api/polls?articleId=${articleId}`);
        const data = await res.json();
        if (data.success && data.polls?.length > 0) {
          setLinkedPoll(data.polls[0]);
        }
      } catch (e) {
        console.error('Failed to fetch linked poll:', e);
      }
    };
    fetchLinkedPoll();

    // Check if user has liked this article
    if (user?.id) {
      fetch(`/api/articles/${articleId}/like?userId=${user.id}`)
        .then(r => r.json())
        .then(data => { if (data.success) setLiked(data.liked); })
        .catch(() => {});
    }
  }, [articleId, user?.id]);

  // Fetch related articles (same category, unread, excluding current)
  useEffect(() => {
    const category = article?.category || article?.mainCategory;
    if (!category) return;
    
    const fetchRelated = async () => {
      try {
        const res = await fetch(`/api/articles?category=${category}&limit=10&status=published`);
        const data = await res.json();
        console.log('Related articles fetch:', { category, success: data.success, count: data.articles?.length });
        if (data.success && data.articles) {
          // Filter: exclude current article, prefer unread but show read if needed
          const unread = data.articles
            .filter((a: Article) => a._id !== articleId && !readArticles.has(a._id));
          const read = data.articles
            .filter((a: Article) => a._id !== articleId && readArticles.has(a._id));
          
          // Prefer unread, but fill with read articles if not enough
          const combined = [...unread, ...read].slice(0, 4);
          setRelatedArticles(combined);
        }
      } catch (e) {
        console.error('Failed to fetch related articles:', e);
      }
    };
    fetchRelated();
  }, [article?.category, article?.mainCategory, articleId, readArticles]);

  // Handle clicks on CTA banners to navigate to different sections
  useEffect(() => {
    const handleCtaClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('.radio-cta-banner')) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event('openRadio'));
      } else if (target.closest('.arcade-cta-banner')) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event('openArcade'));
      } else if (target.closest('.shop-cta-banner')) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event('openShop'));
      } else if (target.closest('.articles-cta-banner')) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event('openArticles'));
      } else if (target.closest('.tv-cta-banner')) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new Event('openTV'));
      }
    };
    document.addEventListener('click', handleCtaClick);
    return () => document.removeEventListener('click', handleCtaClick);
  }, []);

  // iOS detection: replace SVG icons with emojis for better compatibility
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      const ctaIcons = document.querySelectorAll('.cta-icon');
      ctaIcons.forEach((icon) => {
        const emoji = icon.getAttribute('data-emoji');
        if (emoji) {
          icon.innerHTML = `<span style="font-size:22px;">${emoji}</span>`;
        }
      });
    }
  }, [article]);

  const processedHtml = useMemo(() => processArticleHtml(article?.content || ''), [article?.content]);

  const handleLike = async () => {
    if (!isLoggedIn || !user?.id) {
      onShowLogin?.();
      return;
    }
    // Optimistic update
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      const res = await fetch(`/api/articles/${articleId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.success) {
        setLiked(data.liked);
        setLikeCount(data.likes);
      } else {
        // Revert on error
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    } catch (e) {
      console.error('Failed to toggle like:', e);
      setLiked(prevLiked);
      setLikeCount(prevCount);
    }
  };

  const handleShare = async () => {
    if (navigator.share && article) {
      try {
        await navigator.share({
          title: article.title,
          text: article.subtitle || article.title,
          url: window.location.href,
        });
      } catch (e) {
        console.log('Share cancelled');
      }
    }
  };

  if (loading) {
    return <ArticleSkeleton />;
  }

  if (!article) {
    return (
      <div className="h-full bg-cream flex flex-col items-center justify-center text-gray-900">
        <p className="text-xl mb-4">Article not found</p>
        <button onClick={onBack} className="text-[#D4873A] underline">Go back</button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full bg-black text-gray-900 overflow-y-auto overflow-x-hidden relative">
      {/* Desktop Header - Clean header bar without buttons (buttons moved to image) */}
      {isDesktop && (
        <div className="sticky top-0 left-0 right-0 z-50 bg-cream border-b border-warm px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={onBack} 
                className="p-2 hover:bg-[#D4873A]/10 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-900" />
              </button>
              <div>
                <h1 className="font-display text-lg text-gray-900 uppercase tracking-wider">
                  {article.mainCategory ? (MAIN_CATEGORY_LABELS[article.mainCategory] || article.mainCategory) : 'Articles'}
                </h1>
                <p className="text-xs text-gray-500">{CATEGORY_LABELS[article.category] || article.category}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Top Bar - Back, Share - stays visible while scrolling. -mb collapses its layout space so the hero starts flush at the top. */}
      {!isDesktop && (
        <div className="sticky top-0 left-0 right-0 z-50 flex items-center justify-between p-3 pointer-events-none -mb-[68px]">
          <button 
            onClick={onBack} 
            className="pointer-events-auto p-2.5 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors border border-white/20 shadow-lg"
          >
            <ArrowLeft className="w-6 h-6 drop-shadow-md" />
          </button>
          <button 
            onClick={handleShare} 
            className="pointer-events-auto p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors border border-white/20 shadow-lg"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Hero Section - Cover Image/Video with Title Overlay */}
      <div
        className={`relative w-full ${isDesktop ? (article.contentType === 'music-community' ? 'aspect-[3/1]' : 'aspect-[21/9]') : ''}`}
        style={!isDesktop ? { minHeight: '300px' } : undefined}
      >
        {/* Cover Image/Video */}
        {article.coverImage && (
          isVideoUrl(article.coverImage) ? (
            <video
              src={article.coverImage}
              className="absolute inset-0 w-full h-full object-cover z-0"
              style={{ objectPosition: `${article.coverPosition?.x ?? article.imagePosX ?? 50}% ${article.coverPosition?.y ?? article.imagePosY ?? 50}%` }}
              muted autoPlay loop playsInline
            />
          ) : (
            <img
              src={article.coverImage}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover z-0"
              style={{ objectPosition: `${article.coverPosition?.x ?? article.imagePosX ?? 50}% ${article.coverPosition?.y ?? article.imagePosY ?? 50}%` }}
            />
          )
        )}
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/30 z-[1]" />

        {/* Mobile: Category Badge pinned just below the back button - fixed regardless of headline length */}
        {!isDesktop && (
          <div className="absolute top-16 left-4 z-20">
            <CategoryBadge category={article.category} size="lg" />
          </div>
        )}

        {/* Desktop: Share Button on image - top right */}
        {isDesktop && (
          <div className="absolute top-4 right-4 z-20">
            <button 
              onClick={handleShare} 
              className="p-2 bg-white/90 hover:bg-white rounded-lg text-gray-700 transition-colors shadow-md"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Title & Meta - Bottom of Hero */}
        <div className={`absolute bottom-0 left-0 right-0 z-10 ${isDesktop ? 'p-6' : 'p-4'}`}>
          {/* Category Badge + Read Time + Trending Badge */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {isDesktop && <CategoryBadge category={article.category} size="lg" />}
            {/* Countdown Timer Badge - if poll has endsAt */}
            {countdown && (
              <span
                className="inline-flex items-center gap-3 px-4 py-1.5 text-[11px] font-bold rounded-lg"
                style={{
                  background: 'rgba(30,30,30,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span className="text-[#D4873A] uppercase tracking-wider text-[10px] font-semibold">Ends in</span>
                <Clock className="w-3.5 h-3.5 text-[#D4873A]" />
                <span className="font-display tracking-wider text-[13px]">
                  {countdown.days > 0 
                    ? `${countdown.days}D ${String(countdown.hours).padStart(2, '0')}H ${String(countdown.minutes).padStart(2, '0')}M ${String(countdown.seconds).padStart(2, '0')}S`
                    : `${String(countdown.hours).padStart(2, '0')}H ${String(countdown.minutes).padStart(2, '0')}M ${String(countdown.seconds).padStart(2, '0')}S`
                  }
                </span>
              </span>
            )}
            {article.trending && (
              <span
                className="inline-flex items-center gap-1 px-3 py-1 text-[10px] uppercase font-bold rounded-full"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffb84d',
                  backdropFilter: 'blur(8px)',
                  letterSpacing: '0.15em',
                }}
              >
                <TrendingUp className="w-3 h-3" />
                Trending
              </span>
            )}
          </div>

          {/* Title */}
          <h1 
            className="text-4xl font-display leading-tight mb-2 drop-shadow-lg"
            style={{ color: article.titleColor || '#ffffff' }}
          >
            {article.title}
          </h1>

          {/* Subtitle */}
          {article.subtitle && (
            <p 
              className="text-lg font-display mb-4 drop-shadow-md"
              style={{ color: article.subtitleColor || 'rgba(255,255,255,0.85)' }}
            >
              {article.subtitle}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-white/60">
            {article.authorName && (() => {
              const initials = article.authorName
                .split(' ')
                .map((n) => n[0]?.toUpperCase())
                .filter(Boolean)
                .slice(0, 2)
                .join('');
              const avatarEl = article.authorAvatar ? (
                <img
                  src={article.authorAvatar}
                  alt={article.authorName}
                  className="w-6 h-6 rounded-full object-cover"
                  style={{ border: '1.5px solid rgba(212,135,58,0.6)' }}
                />
              ) : (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg,#D4873A 0%,#a86b2b 100%)',
                    border: '1.5px solid rgba(212,135,58,0.6)',
                  }}
                >
                  {initials || '?'}
                </div>
              );
              return onOpenAuthor ? (
                <button
                  type="button"
                  onClick={() => onOpenAuthor(article.authorName!)}
                  className="flex items-center gap-2 font-medium hover:text-[#D4873A] transition-colors"
                >
                  {avatarEl}
                  <span className="hover:underline underline-offset-2">{article.authorName}</span>
                </button>
              ) : (
                <span className="flex items-center gap-2 font-medium">
                  {avatarEl}
                  {article.authorName}
                </span>
              );
            })()}
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{article.createdAt ? new Date(article.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{article.views} views</span>
            </div>
          </div>
        </div>
      </div>

      {/* Article Content - relative z-10 to scroll over fixed image on mobile */}
      <div className="px-5 pt-4 pb-8 bg-cream overflow-hidden relative z-10">
        <div 
          className="article-prose prose prose-base max-w-none font-sans-lv
            prose-headings:font-display prose-headings:mt-10 prose-headings:mb-4 prose-headings:tracking-normal prose-headings:font-bold
            prose-h1:text-[28px] prose-h1:leading-tight
            prose-h2:text-[22px] prose-h2:leading-snug
            prose-h3:text-[18px] prose-h3:leading-snug
            prose-p:leading-[1.75] prose-p:mb-5 prose-p:text-[16px]
            prose-a:text-[#D4873A] prose-a:underline prose-a:decoration-[#D4873A]/40 hover:prose-a:decoration-[#D4873A] prose-a:underline-offset-2
            prose-strong:font-bold prose-strong:text-gray-900 prose-em:italic
            prose-li:mb-2 prose-li:text-[16px] prose-li:leading-[1.7]
            prose-ul:my-5 prose-ol:my-5
            prose-blockquote:border-l-4 prose-blockquote:border-[#D4873A] prose-blockquote:not-italic prose-blockquote:pl-5 prose-blockquote:py-1 prose-blockquote:text-gray-700 prose-blockquote:font-medium prose-blockquote:my-6
            prose-img:rounded-xl prose-img:my-7 prose-img:shadow-md prose-img:max-w-full prose-img:w-full
            [&_img[style*='width']]:w-auto [&_img[style*='width']]:my-0 [&_img[style*='width']]:rounded-none [&_img[style*='width']]:shadow-none
            prose-hr:my-12 prose-hr:border-t-2 prose-hr:border-gray-200
            [&_u]:underline [&_s]:line-through
            [&_.ql-align-center]:text-center [&_.ql-align-right]:text-right [&_.ql-align-justify]:text-justify
            [&_*]:max-w-full [&_*]:break-words"
          style={{ 
            color: article.contentColor || '#1f2937',
            '--tw-prose-body': article.contentColor || '#1f2937',
            '--tw-prose-headings': article.contentColor || '#111827',
            fontFamily: 'var(--font-sans-lv), "DM Sans", system-ui, sans-serif',
          } as React.CSSProperties}
          dangerouslySetInnerHTML={{ 
            __html: processedHtml
          }}
        />

        {/* Music Community Song List - only for music-community articles */}
        {article.contentType === 'music-community' && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <MusicSongList onOpenRadio={onOpenRadio} />
          </div>
        )}

        {/* Emoji Reactions - at end of article */}
        <div className="mt-8 mb-6 flex flex-col items-center">
          <p className="text-sm text-gray-500 mb-3">How did this article make you feel?</p>
          <EmojiReactions
            articleId={article._id}
            userId={user?.id}
            isLoggedIn={isLoggedIn}
            onShowLogin={onShowLogin}
            showAll
          />
        </div>

        {/* Linked Poll/Quiz/Ranking */}
        {linkedPoll && (
          <div className="mt-8 not-prose">
            {linkedPoll.type === 'quiz' ? (
              <QuizPollCard poll={linkedPoll} />
            ) : linkedPoll.type === 'ranking' ? (
              <RankingPollCard 
                poll={linkedPoll} 
                onCoinAnimation={(amount) => onCoinAnimation?.(amount)}
                onShowLogin={onShowLogin}
                isDesktop={isDesktop}
              />
            ) : (
              <PollCard poll={linkedPoll} />
            )}
          </div>
        )}
        
        {/* Share Buttons - after poll */}
        <ShareButtons title={article.title} />

        {/* Comment Section - only if comments are enabled */}
        {article.commentsEnabled !== false && (
          <div className="not-prose">
            <CommentSection articleId={articleId} onShowLogin={onShowLogin} />
          </div>
        )}

        {/* Related Articles - same category, unread */}
        {relatedArticles.length > 0 && onOpenArticle && (
          <div className="mt-10 not-prose">
            <h3 className="font-display text-xl text-gray-900 uppercase tracking-wider mb-4">
              More in {CATEGORY_LABELS[article.category] || CATEGORY_LABELS[article.mainCategory || ''] || article.category || 'Articles'}
            </h3>
            <div className="space-y-3">
              {relatedArticles.map((relatedArticle) => (
                <button
                  key={relatedArticle._id}
                  onClick={() => onOpenArticle(relatedArticle._id)}
                  className="w-full flex items-center gap-3 p-2 bg-cream border border-warm rounded-lg text-left shadow-md hover:shadow-lg hover:border-[#D4873A]/30 transition-all duration-200 group"
                >
                  {/* Thumbnail */}
                  {relatedArticle.coverImage && (
                    <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0 border border-warm">
                      <img 
                        src={relatedArticle.coverImage} 
                        alt={relatedArticle.title} 
                        className="w-full h-full object-cover"
                        style={{ objectPosition: `${relatedArticle.thumbnailPosition?.x ?? 50}% ${relatedArticle.thumbnailPosition?.y ?? 50}%` }}
                      />
                    </div>
                  )}
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <CategoryBadge category={relatedArticle.category} size="sm" className="mb-1" />
                    <h4 className="font-display text-lg text-gray-900 group-hover:text-[#D4873A] leading-tight line-clamp-2 transition-colors">
                      {relatedArticle.title}
                    </h4>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Padding for safe area */}
      <div className="h-8 bg-cream" />
    </div>
  );
}

/* ============ Share Buttons Component ============ */

function ShareButtons({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(window.location.href);
    }
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const shareLinks = [
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    },
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      url: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    },
    {
      name: 'Email',
      icon: Mail,
      url: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%20${encodedUrl}`,
    },
  ];

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (e) {
        // User cancelled or share failed
      }
    }
  };

  return (
    <div className="not-prose mt-6 mb-6">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-[#D4873A] uppercase tracking-wider font-semibold">Share</span>
        <div className="flex gap-1.5">
        {shareLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`Share on ${link.name}`}
                className="flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 bg-[#D4873A]/10 hover:bg-[#D4873A]/20 text-[#D4873A]"
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            );
          })}
          
          {/* Copy link */}
          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy link"
            className={`flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 ${copied ? 'bg-green-100 text-green-600' : 'bg-[#D4873A]/10 hover:bg-[#D4873A]/20 text-[#D4873A]'}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
          
          {/* Native share (mobile) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleNativeShare}
              title="More sharing options"
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 bg-[#D4873A]/10 hover:bg-[#D4873A]/20 text-[#D4873A]"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
