"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowLeft, Clock, Eye, Share2, TrendingUp, Facebook, Linkedin, MessageCircle, Mail, Link2, Check, FileText, Music, Gamepad2, Trophy, Tv, ShoppingBag, Vote } from "lucide-react";
import EmojiReactions from "./EmojiReactions";
import CardMoodReactions from "./CardMoodReactions";
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
import { getFlagUrl } from "@/lib/countryFlags";
import { VIDEO_REWARD } from "@/config/rewards";

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
  commentsCount?: number;
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
  // Country info
  personCountry?: string;
  personCountryCode?: string;
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
  'eastercorn': 'Eastercorn',
};

const MAIN_CATEGORY_LABELS: Record<string, string> = {
  'articles': 'Articles',
  'shop': 'Shop',
  'arcade': 'Arcade',
  'voting': 'Voting',
};

const MAIN_CATEGORY_ICONS: Record<string, typeof FileText> = {
  'articles': FileText,
  'shop': ShoppingBag,
  'arcade': Gamepad2,
  'voting': Vote,
};

const MAIN_CATEGORY_SUBTITLES: Record<string, string> = {
  'articles': 'Stories & insights',
  'shop': 'GenX merchandise',
  'arcade': 'Challenge yourself',
  'voting': 'Have your say',
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

  // 3. Turn an <iframe> into a click-to-play thumbnail card (avoids a double play button).
  // Shows a "0.02 BOGX" badge and marks as "WATCHED" after clicking.
  const buildVideoCard = (attrs: string): string => {
    const embedUrl = String(attrs).match(/src="([^"]+)"/i)?.[1] || '';
    const ytMatch = embedUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    const vmMatch = embedUrl.match(/player\.vimeo\.com\/video\/(\d+)/);

    const thumbnailUrl = ytMatch
      ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`
      : vmMatch
        ? `https://vumbnail.com/${vmMatch[1]}.jpg`
        : '';

    const videoId = ytMatch ? ytMatch[1] : (vmMatch ? vmMatch[1] : '');
    const embedSrc = ytMatch
      ? `https://www.youtube.com/embed/${videoId}?autoplay=1`
      : vmMatch
        ? `https://player.vimeo.com/video/${videoId}?autoplay=1`
        : '';

    // Reward badge and watched badge share identical geometry (position, padding,
    // radius, font size) so they read as the same chip in two states.
    // The coin keeps data-keep-size: step 4 below rewrites every other <img> to
    // width:100%, which is what previously blew this icon up to full width.
    const rewardBadge = `<div class="video-reward-badge" style="position:absolute;top:8px;right:8px;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.75);padding:3px 8px;border-radius:10px;font-size:10px;font-weight:600;color:#FFD700;z-index:2;"><img src="/images/bogxcoin.png" data-keep-size alt="" style="width:11px;height:11px;max-width:11px;display:block;flex-shrink:0;"/>+0,02</div>`;
    const watchedOverlay = `<div class="video-watched-overlay" style="display:none;position:absolute;top:8px;right:8px;background:rgba(34,197,94,0.9);padding:3px 8px;border-radius:10px;font-size:10px;font-weight:600;color:white;text-transform:uppercase;letter-spacing:0.3px;z-index:2;">✓ Watched</div>`;

    // The onclick handler: hide badge, show watched label, then swap to iframe
    const onClickHandler = `(function(el){var card=el.closest('.article-video-card');var badge=card.querySelector('.video-reward-badge');var watched=card.querySelector('.video-watched-overlay');if(badge)badge.style.display='none';if(watched)watched.style.display='block';setTimeout(function(){el.outerHTML='<iframe src=\\'${embedSrc}\\' style=\\'width:380px;height:214px;border:0;display:block;\\' frameborder=\\'0\\' allow=\\'autoplay; encrypted-media\\' allowfullscreen></iframe>';},150);})(this)`;

    return `<div class="article-video-card" data-video-id="${videoId}" style="width:380px;max-width:380px;border-radius:6px;overflow:hidden;margin-top:-10px;"><div style="position:relative;width:380px;height:214px;cursor:pointer;" onclick="${onClickHandler}"><img src="${thumbnailUrl}" data-keep-size alt="" style="width:380px;height:214px;object-fit:cover;display:block;" />${rewardBadge}${watchedOverlay}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"><div style="width:52px;height:52px;border-radius:50%;background:rgba(212,135,58,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);"><span style="color:white;font-size:22px;margin-left:3px;">▶</span></div></div></div></div>`;
  };

  const floatVideo = (card: string, index: number): string => {
    const isLeft = index % 2 === 0;
    const marginStyle = isLeft ? 'margin:0 20px 16px 0' : 'margin:0 0 16px 20px';
    return card.replace(
      'style="width:380px;',
      `style="float:${isLeft ? 'left' : 'right'};${marginStyle};width:380px;`
    );
  };

  // 3b. Move each video to the top of the section it was written for.
  //
  // Videos are authored at the END of their section, which visually attaches them
  // to the NEXT heading. The previous fix for that collected every iframe into one
  // flat list and handed them out per heading by index — but the intro section has
  // no heading, so an intro video shifted every following video into the wrong
  // section. Splitting on headings keeps each video inside its own section.
  const iframeRe = /<iframe([^>]*?)(?:\s*\/>|>\s*<\/iframe>)/gi;
  const takeVideos = (chunk: string): { body: string; cards: string[] } => {
    const cards: string[] = [];
    const body = chunk.replace(iframeRe, (_m, attrs) => {
      cards.push(buildVideoCard(String(attrs)));
      return '';
    });
    return { body, cards };
  };

  // split() with a capturing group yields [intro, heading, body, heading, body, ...]
  const parts = html.split(/(<h[23][^>]*>[\s\S]*?<\/h[23]>)/gi);
  const rebuilt: string[] = [];
  let placedVideos = 0;

  // Intro (no heading): its video floats alongside the opening paragraphs.
  const intro = takeVideos(parts[0] || '');
  if (intro.cards.length) {
    rebuilt.push(floatVideo(intro.cards[0], placedVideos));
    placedVideos++;
  }
  rebuilt.push(intro.body);
  rebuilt.push(...intro.cards.slice(1));

  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i];
    const { body, cards } = takeVideos(parts[i + 1] || '');

    // Separator before every heading except the first.
    if (i > 1) {
      rebuilt.push('<div style="clear:both;"></div><hr style="border:none;border-top:1px solid #E8E4DC;margin:32px 0 24px 0;" />');
    }
    rebuilt.push(heading);

    if (cards.length) {
      rebuilt.push(floatVideo(cards[0], placedVideos));
      placedVideos++;
    }
    rebuilt.push(body);
    // More than one video in a section: keep the extras after the text.
    rebuilt.push(...cards.slice(1));
  }

  html = rebuilt.join('');
  
  // 3c. Add clearfix at end and responsive styles
  html += `<div style="clear:both;"></div>
  <style>
    @media(max-width:767px){
      .article-video-card{float:none!important;width:100%!important;margin:16px 0!important;}
    }
  </style>`;

  // 4. Wrap standalone images - full width, no max-width restriction.
  // Images carrying data-keep-size are skipped: they belong to UI chrome we built
  // ourselves above (video thumbnails, the BOGX coin in the reward badge) and
  // already have deliberate dimensions. Without this guard the rewrite strips
  // their inline style and blows them up to width:100%.
  html = html.replace(
    /<img([^>]*?)\/?>/gi,
    (match, attrs) => {
      if (/data-keep-size/i.test(String(attrs))) return match;
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

  // 6. Style paragraphs with proper spacing and normalize empty ones
  // Add margin-bottom to all paragraphs for proper spacing between them
  html = html.replace(/<p([^>]*)>/gi, '<p$1 style="margin-bottom:1em;line-height:1.7;">');
  // Remove duplicate style attributes if paragraph already had style
  html = html.replace(/style="([^"]*)" style="/gi, 'style="$1 ');
  // Normalize empty paragraphs to spacing
  html = html.replace(/<p[^>]*><br\s*\/?><\/p>/gi, '<div style="height:1em;"></div>');
  html = html.replace(/<p[^>]*>\s*<\/p>/gi, '<div style="height:1em;"></div>');

  // 7. Style song-highlight blocks for monthly playlist articles
  html = html.replace(
    /<div class="song-highlight">/gi,
    `<div class="song-highlight" style="background:linear-gradient(135deg,#FDF6EE 0%,#FEF9F3 100%);border:2px solid #E36B11;border-radius:12px;padding:16px 20px;margin:16px 0 24px 0;box-shadow:0 4px 12px rgba(212,135,58,0.15);">`
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
  const proseRef = useRef<HTMLDivElement>(null);
  // Videos already reported in this session, so one click can't fire twice
  const watchedVideosRef = useRef<Set<string>>(new Set());
  
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
            // Notify leaderboard/rankings to refresh instantly
            window.dispatchEvent(new CustomEvent('bogx-updated'));
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
      } else if (target.closest('.rankroll-cta-banner')) {
        e.preventDefault();
        e.stopPropagation();
        const ctaEl = target.closest('.rankroll-cta-banner') as HTMLElement;
        const rankrollId = ctaEl?.getAttribute('data-rankroll-id');
        if (rankrollId) {
          // Navigate to the rankroll page with this poll
          window.dispatchEvent(new CustomEvent('openRankroll', { detail: { pollId: rankrollId } }));
        } else {
          // Fallback: just open rankroll page
          window.dispatchEvent(new Event('openRankroll'));
        }
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

  // Use ref-based innerHTML injection to prevent iframe flickering on re-renders.
  // dangerouslySetInnerHTML destroys/recreates the DOM (and iframes) on every render;
  // this only updates when processedHtml actually changes.
  useEffect(() => {
    if (proseRef.current && proseRef.current.innerHTML !== processedHtml) {
      proseRef.current.innerHTML = processedHtml;
    }
  }, [processedHtml]);

  // Mark already-watched videos on load: hide the reward badge, show "Watched" label.
  useEffect(() => {
    const el = proseRef.current;
    if (!el || !user?.id) return;

    const cards = el.querySelectorAll('.article-video-card[data-video-id]');
    if (!cards.length) return;

    const videoIds = Array.from(cards).map((c: any) => c.dataset.videoId).filter(Boolean);
    if (!videoIds.length) return;

    fetch(`/api/articles/watch-video?userId=${user.id}&videoIds=${videoIds.join(',')}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success) return;
        const watchedSet = new Set(data.watchedIds || []);
        cards.forEach((card: any) => {
          const vid = card.dataset.videoId;
          if (watchedSet.has(vid)) {
            watchedVideosRef.current.add(vid);
            const badge = card.querySelector('.video-reward-badge') as HTMLElement | null;
            const watched = card.querySelector('.video-watched-overlay') as HTMLElement | null;
            if (badge) badge.style.display = 'none';
            if (watched) watched.style.display = 'block';
          }
        });
      })
      .catch(() => {});
  }, [processedHtml, user?.id]);

  // Reward BOGX for watching an embedded video. The video cards are raw HTML with an
  // inline onclick that swaps the thumbnail for an iframe, so we listen on the container
  // in the CAPTURE phase - by the time the inline handler ran, the clicked node is
  // already detached and closest() would find nothing.
  useEffect(() => {
    const el = proseRef.current;
    if (!el || !article?._id) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement | null;
      const card = target?.closest?.('.article-video-card') as HTMLElement | null;
      const videoId = card?.dataset.videoId;
      if (!videoId) return;
      // Already handled in this session - the server is idempotent anyway,
      // this just avoids a pointless request and a 0-coin animation.
      if (watchedVideosRef.current.has(videoId)) return;
      watchedVideosRef.current.add(videoId);

      // Guest user: handle locally with localStorage
      if (!isLoggedIn || !user?.id) {
        const guestWatchedKey = `bogx_guest_watched_${videoId}`;
        if (!localStorage.getItem(guestWatchedKey)) {
          localStorage.setItem(guestWatchedKey, '1');
          const guestCoins = parseFloat(localStorage.getItem('bogx_guest_coins') || '0');
          localStorage.setItem('bogx_guest_coins', String(Math.round((guestCoins + VIDEO_REWARD) * 100) / 100));
          onCoinAnimation?.(VIDEO_REWARD);
        }
        return;
      }

      // Play the coin animation NOW rather than when the POST answers. Reaching
      // this line already means the reward is due: the video is not in the
      // watched set, which was seeded from the server on load. Waiting for the
      // round trip made the reward feel detached from the click.
      onCoinAnimation?.(VIDEO_REWARD);
      // Notify leaderboard/rankings to refresh instantly
      window.dispatchEvent(new CustomEvent('bogx-updated'));

      fetch('/api/articles/watch-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, articleId: article._id, userId: user.id }),
      })
        .then(res => res.json())
        .then(data => {
          // Reward already animated above. Only release the local claim if the
          // server did NOT pay out and it was not a duplicate, so a retry can
          // still earn it.
          if (!data.success) watchedVideosRef.current.delete(videoId);
        })
        .catch(() => {
          watchedVideosRef.current.delete(videoId);
        });
    };

    el.addEventListener('click', handleClick, true);
    return () => el.removeEventListener('click', handleClick, true);
  }, [processedHtml, isLoggedIn, user?.id, article?._id, onCoinAnimation]);

  // Gallery Slider: carousel arrows + lightbox
  useEffect(() => {
    const el = proseRef.current;
    if (!el) return;
    const galleries = el.querySelectorAll('.gallery-slider-block');
    if (!galleries.length) return;

    // Inject WebKit scrollbar-hiding CSS once
    const styleId = 'gsl-no-scrollbar';
    if (!document.getElementById(styleId)) {
      const s = document.createElement('style');
      s.id = styleId;
      s.textContent = '.gsl-track::-webkit-scrollbar{display:none}.gallery-slider-block img[data-gallery-index]{height:240px!important;width:auto!important;flex-shrink:0!important;object-fit:cover!important;border-radius:12px!important;display:block!important;cursor:pointer!important;}';
      document.head.appendChild(s);
    }

    // ── Lightbox ──────────────────────────────────────────────────────────────
    const lb = document.createElement('div');
    lb.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.95);align-items:center;justify-content:center;';
    lb.innerHTML = `
      <button id="lb-close" style="position:absolute;top:16px;right:20px;background:none;border:none;color:white;font-size:28px;cursor:pointer;line-height:1;opacity:0.8;">✕</button>
      <button id="lb-prev" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;color:white;font-size:40px;cursor:pointer;padding:6px 14px;border-radius:8px;line-height:1;">&#8249;</button>
      <img id="lb-img" style="max-width:92vw;max-height:88vh;border-radius:10px;object-fit:contain;cursor:default;box-shadow:0 8px 40px rgba(0,0,0,0.6);" />
      <button id="lb-next" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.15);border:none;color:white;font-size:40px;cursor:pointer;padding:6px 14px;border-radius:8px;line-height:1;">&#8250;</button>
      <div id="lb-counter" style="position:absolute;bottom:16px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.55);font-size:13px;letter-spacing:0.06em;"></div>
    `;
    document.body.appendChild(lb);

    let lbImgs: string[] = [];
    let lbIdx = 0;

    const lbShow = (images: string[], i: number) => {
      lbImgs = images; lbIdx = i;
      (lb.querySelector('#lb-img') as HTMLImageElement).src = images[i];
      (lb.querySelector('#lb-counter') as HTMLDivElement).textContent = `${i + 1} / ${images.length}`;
      (lb.querySelector('#lb-prev') as HTMLButtonElement).style.display = images.length > 1 ? '' : 'none';
      (lb.querySelector('#lb-next') as HTMLButtonElement).style.display = images.length > 1 ? '' : 'none';
      lb.style.display = 'flex';
    };
    const lbHide = () => { lb.style.display = 'none'; };

    lb.querySelector('#lb-close')!.addEventListener('click', lbHide);
    lb.querySelector('#lb-prev')!.addEventListener('click', (e) => { e.stopPropagation(); lbShow(lbImgs, (lbIdx - 1 + lbImgs.length) % lbImgs.length); });
    lb.querySelector('#lb-next')!.addEventListener('click', (e) => { e.stopPropagation(); lbShow(lbImgs, (lbIdx + 1) % lbImgs.length); });
    lb.querySelector('#lb-img')!.addEventListener('click', (e) => e.stopPropagation());
    lb.addEventListener('click', lbHide);

    const onKey = (e: KeyboardEvent) => {
      if (lb.style.display === 'none') return;
      if (e.key === 'Escape') lbHide();
      if (e.key === 'ArrowLeft') lbShow(lbImgs, (lbIdx - 1 + lbImgs.length) % lbImgs.length);
      if (e.key === 'ArrowRight') lbShow(lbImgs, (lbIdx + 1) % lbImgs.length);
    };
    document.addEventListener('keydown', onKey);

    // ── Per-gallery carousel init ─────────────────────────────────────────────
    galleries.forEach((gallery) => {
      let galleryImages: string[] = [];
      try { galleryImages = JSON.parse(gallery.getAttribute('data-images') || '[]'); } catch {}
      if (!galleryImages.length) return;

      // Lightbox on image click
      gallery.querySelectorAll('img[data-gallery-index]').forEach((img, i) => {
        img.addEventListener('click', () => lbShow(galleryImages, i));
      });

      // Carousel arrows
      const track = gallery.querySelector('.gsl-track') as HTMLElement | null;
      const prevBtn = gallery.querySelector('.gsl-prev') as HTMLButtonElement | null;
      const nextBtn = gallery.querySelector('.gsl-next') as HTMLButtonElement | null;
      if (!track) return;

      const SCROLL_BY = 248; // slide width (220) + gap (8) + a bit

      const updateArrows = () => {
        const atStart = track.scrollLeft <= 4;
        const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
        const hasOverflow = track.scrollWidth > track.clientWidth + 8;
        if (prevBtn) prevBtn.style.display = hasOverflow && !atStart ? 'flex' : 'none';
        if (nextBtn) nextBtn.style.display = hasOverflow && !atEnd ? 'flex' : 'none';
      };

      // Check after layout settles
      setTimeout(updateArrows, 200);
      track.addEventListener('scroll', updateArrows, { passive: true });

      prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); track.scrollBy({ left: -SCROLL_BY, behavior: 'smooth' }); });
      nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); track.scrollBy({ left: SCROLL_BY, behavior: 'smooth' }); });
    });

    return () => {
      document.removeEventListener('keydown', onKey);
      lb.remove();
    };
  }, [processedHtml]);

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
        <button onClick={onBack} className="text-[#E36B11] underline">Go back</button>
      </div>
    );
  }

  const mainCategory = article.mainCategory || 'articles';
  const HeaderIcon = MAIN_CATEGORY_ICONS[mainCategory] || FileText;

  return (
    <div ref={containerRef} className="h-full bg-black text-gray-900 overflow-y-auto overflow-x-hidden relative">
      {/* Desktop Header - same style as Feed/Articles/Arcade */}
      {isDesktop && (
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent bg-cream">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="p-2 hover:bg-[#E36B11]/10 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-900" />
            </button>
            <HeaderIcon className="w-5 h-5 text-[#E36B11]" />
            <div>
              <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">
                {MAIN_CATEGORY_LABELS[mainCategory] || 'Articles'}
              </span>
              <span className="text-[10px] text-gray-500 -mt-0.5 block">
                {MAIN_CATEGORY_SUBTITLES[mainCategory] || 'Stories & insights'}
              </span>
            </div>
          </div>
          <button 
            onClick={handleShare} 
            className="p-2 hover:bg-[#E36B11]/10 rounded-lg transition-colors"
          >
            <Share2 className="w-5 h-5 text-gray-700" />
          </button>
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
              style={{ objectPosition: `${article.imagePosX ?? article.coverPosition?.x ?? 50}% ${article.imagePosY ?? article.coverPosition?.y ?? 50}%` }}
              muted autoPlay loop playsInline
            />
          ) : (
            <img
              src={article.coverImage}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover z-0"
              style={{ objectPosition: `${article.imagePosX ?? article.coverPosition?.x ?? 50}% ${article.imagePosY ?? article.coverPosition?.y ?? 50}%` }}
            />
          )
        )}
        
        {/* Gradient Overlay - only bottom 25% darkens for title readability, top stays clean */}
        <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black via-black/60 to-transparent z-[1]" />


        {/* Desktop: Country Flag on image - top right */}
        {isDesktop && getFlagUrl(article.personCountryCode, article.personCountry) && (
          <div className="absolute top-4 right-4 z-20">
            <img 
              src={getFlagUrl(article.personCountryCode, article.personCountry)}
              alt={article.personCountry || ''}
              title={article.personCountry}
              className="w-12 h-9 object-cover rounded shadow-lg"
            />
          </div>
        )}

        {/* Title & Meta - Bottom of Hero */}
        <div className={`absolute bottom-0 left-0 right-0 z-10 ${isDesktop ? 'p-6' : 'p-4'}`}>
          {/* Category Badge with integrated Flag + Trending Badge */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <CategoryBadge 
              category={article.category} 
              size="lg" 
            />
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
                <span className="text-[#E36B11] uppercase tracking-wider text-[10px] font-semibold">Ends in</span>
                <Clock className="w-3.5 h-3.5 text-[#E36B11]" />
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

          {/* Title only in hero */}
          <div className="flex items-end gap-3">
            <h1 
              className="text-4xl font-display leading-tight drop-shadow-lg"
              style={{ color: article.titleColor || '#ffffff' }}
            >
              {article.title}
            </h1>
            {article.category === 'rip' && (
              <span className="text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] flex-shrink-0 mb-1" style={{ fontFamily: 'Georgia,serif', fontSize: '2rem', lineHeight: 1 }}>✝</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Below Hero: Meta + Subtitle ── */}
      <div className={`bg-cream ${isDesktop ? 'px-8 pt-5 pb-2' : 'px-5 pt-4 pb-2'}`}>
        {/* Author · Date · Views */}
        <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap mb-3">
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
                    background: 'linear-gradient(135deg,#E36B11 0%,#a86b2b 100%)',
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
                  className="flex items-center gap-2 font-medium hover:text-[#E36B11] transition-colors"
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

      {/* Article Content - relative z-10 to scroll over fixed image on mobile */}
      <div className="px-5 pt-4 pb-8 bg-cream overflow-hidden relative z-10">

        {/* Subtitle — below hero, above article body */}
        {article.subtitle && (
          <p
            className={`font-serif italic leading-snug mb-5 ${isDesktop ? 'text-2xl' : 'text-xl'} border-l-4 border-[#E36B11] pl-4`}
            style={{ color: article.subtitleColor || '#E36B11' }}
          >
            {article.subtitle}
          </p>
        )}

        <div 
          className="article-prose prose prose-base max-w-none font-sans-lv
            prose-headings:font-display prose-headings:mt-10 prose-headings:mb-4 prose-headings:tracking-normal prose-headings:font-bold
            prose-h1:text-[28px] prose-h1:leading-tight
            prose-h2:text-[22px] prose-h2:leading-snug
            prose-h3:text-[18px] prose-h3:leading-snug
            prose-p:leading-[1.75] prose-p:mb-5 prose-p:text-[16px]
            prose-a:text-[#E36B11] prose-a:underline prose-a:decoration-[#E36B11]/40 hover:prose-a:decoration-[#E36B11] prose-a:underline-offset-2
            prose-strong:font-bold prose-strong:text-gray-900 prose-em:italic
            prose-li:mb-2 prose-li:text-[16px] prose-li:leading-[1.7]
            prose-ul:my-5 prose-ol:my-5
            prose-blockquote:border-l-4 prose-blockquote:border-[#E36B11] prose-blockquote:not-italic prose-blockquote:pl-5 prose-blockquote:py-1 prose-blockquote:text-gray-700 prose-blockquote:font-medium prose-blockquote:my-6
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
          ref={proseRef}
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
            onCoinAnimation={onCoinAnimation}
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
                  className="w-full flex items-center gap-3 p-2 bg-cream border border-warm rounded-lg text-left shadow-md hover:shadow-lg hover:border-[#E36B11]/30 transition-all duration-200 group"
                >
                  {/* Thumbnail */}
                  {relatedArticle.coverImage && (
                    <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 border border-warm">
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
                    <h4 className="font-display text-base text-gray-900 group-hover:text-[#E36B11] leading-tight line-clamp-2 transition-colors">
                      {relatedArticle.title}
                    </h4>
                    {/* Meta: Date, Reactions, Comments */}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-500" onClick={(e) => e.stopPropagation()}>
                      {/* Date */}
                      <span>
                        {relatedArticle.publishedAt 
                          ? new Date(relatedArticle.publishedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                          : relatedArticle.createdAt 
                            ? new Date(relatedArticle.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                            : ''
                        }
                      </span>
                      {/* Reactions */}
                      <CardMoodReactions 
                        articleId={relatedArticle._id} 
                        userId={user?.id} 
                        isLoggedIn={isLoggedIn} 
                        onShowLogin={onShowLogin}
                        size="xs" 
                      />
                      {/* Comments */}
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="w-3 h-3" />
                        {relatedArticle.commentsCount || 0}
                      </span>
                    </div>
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
        <span className="text-[10px] text-[#E36B11] uppercase tracking-wider font-semibold">Share</span>
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
                className="flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 bg-[#E36B11]/10 hover:bg-[#E36B11]/20 text-[#E36B11]"
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
            className={`flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 ${copied ? 'bg-green-100 text-green-600' : 'bg-[#E36B11]/10 hover:bg-[#E36B11]/20 text-[#E36B11]'}`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          </button>
          
          {/* Native share (mobile) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleNativeShare}
              title="More sharing options"
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all hover:scale-110 bg-[#E36B11]/10 hover:bg-[#E36B11]/20 text-[#E36B11]"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
