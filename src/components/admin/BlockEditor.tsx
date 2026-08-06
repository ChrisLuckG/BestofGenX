"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Film, Megaphone, Minus, Type, Trash2, GripVertical, ChevronUp, ChevronDown, Plus, X, Image as ImageIcon, Upload, Loader2, Headphones, Gamepad2, ShoppingBag, FileText, Tv, Sparkles, Music, Vote, LayoutGrid } from "lucide-react";

// List of available fonts (must match the CSS in globals.css)
const AVAILABLE_FONTS = [
  'sans-serif',
  'serif',
  'monospace',
  'arial',
  'georgia',
  'times-new-roman',
  'courier',
  'verdana',
  'tahoma',
  'trebuchet',
  'comic-sans',
  'impact',
  'inter',
  'roboto',
  'open-sans',
  'lato',
  'montserrat',
  'poppins',
  'playfair',
  'bebas-neue',
  'oswald',
  'lobster',
  'pacifico',
  'press-start',
];

const ReactQuill = dynamic(
  () => import("react-quill-new").then((mod: any) => {
    const Quill = mod.default?.Quill || mod.Quill;
    if (Quill) {
      try {
        // Register fonts and sizes
        const Font = Quill.import('formats/font') as any;
        Font.whitelist = AVAILABLE_FONTS;
        Quill.register(Font, true);

        const Size = Quill.import('formats/size') as any;
        Size.whitelist = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px', '60px', '72px'];
        Quill.register(Size, true);
      } catch (e) {
        console.warn('Failed to register Quill fonts:', e);
      }
    }
    return mod;
  }),
  {
    ssr: false,
    loading: () => <div className="h-32 bg-gray-100 rounded animate-pulse" />,
  }
) as any;

// Block types
type BlockType = "text" | "video" | "ad" | "divider" | "image" | "gallery" | "radio-cta" | "arcade-cta" | "shop-cta" | "articles-cta" | "tv-cta" | "rankroll-cta" | "music-banner";

// CTA HTML constants - SVG icons for Android/Desktop, emoji fallback class for iOS (handled in CSS/JS)
// iOS detection happens client-side in ArticlePage, swaps .cta-icon content
const RADIO_CTA_HTML = `<div class="cta-block radio-cta-banner" data-cta-type="radio" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#E36B11;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎧"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Listen on GenX Radio</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more timeless tracks on our radio.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#E36B11;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Radio →</span></div>`;

const ARCADE_CTA_HTML = `<div class="cta-block arcade-cta-banner" data-cta-type="arcade" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;border:1px solid rgba(139,92,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#8B5CF6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎮"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Play Trivia</div><div style="font-size:12px;color:#666;line-height:1.4;">Test your 80s/90s knowledge and win BOGX!</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#8B5CF6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Trivia →</span></div>`;

const SHOP_CTA_HTML = `<div class="cta-block shop-cta-banner" data-cta-type="shop" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(236,72,153,0.15),rgba(236,72,153,0.05));border-radius:16px;border:1px solid rgba(236,72,153,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#EC4899;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🛍️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Visit the Shop</div><div style="font-size:12px;color:#666;line-height:1.4;">Get exclusive GenX merch and collectibles.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#EC4899;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Shop →</span></div>`;

const ARTICLES_CTA_HTML = `<div class="cta-block articles-cta-banner" data-cta-type="articles" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border-radius:16px;border:1px solid rgba(34,197,94,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#22C55E;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📰"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">More Articles</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more stories from the GenX era.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#22C55E;color:white;border-radius:10px;font-weight:700;font-size:13px;">Browse Articles →</span></div>`;

const TV_CTA_HTML = `<div class="cta-block tv-cta-banner" data-cta-type="tv" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border-radius:16px;border:1px solid rgba(59,130,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#3B82F6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📺"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Watch GenX TV</div><div style="font-size:12px;color:#666;line-height:1.4;">Classic videos and nostalgic content.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#3B82F6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to TV →</span></div>`;

const RANKROLL_CTA_HTML = `<div class="cta-block rankroll-cta-banner" data-cta-type="rankroll" data-rankroll-id="" data-rankroll-title="" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#E36B11;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🗳️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M18 13h-.68l-2 2h1.91L19 17H5l1.78-2h2.05l-2-2H6l-3 3v4c0 1.1.89 2 1.99 2H19c1.1 0 2-.89 2-2v-4l-3-3zm-1-5.05l-4.95 4.95-3.54-3.54 4.95-4.95 3.54 3.54zm-4.24-5.66L6.39 8.66a.996.996 0 000 1.41l4.95 4.95c.39.39 1.02.39 1.41 0l6.36-6.36a.996.996 0 000-1.41l-4.95-4.95a.996.996 0 00-1.41 0z"/></svg></div><div><div class="rankroll-title" style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Vote Now!</div><div style="font-size:12px;color:#666;line-height:1.4;">Vote & rank your favorites</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#E36B11;color:white;border-radius:10px;font-weight:700;font-size:13px;">VOTE NOW</span></div>`;

// Music Banner - dynamic monthly playlist banner (data fetched at render time)
const MUSIC_BANNER_HTML = `<div class="music-banner-block" data-block-type="music-banner" style="position:relative;width:100%;border-radius:16px;overflow:hidden;margin:24px 0;cursor:pointer;aspect-ratio:1024/200;"><img src="/images/Hintergund/music.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" /><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding-left:35%;padding-right:15%;"><div style="text-align:center;"><h2 style="font-family:var(--font-display),Bebas Neue,sans-serif;font-size:clamp(24px,4vw,48px);color:#c8e6a0;text-shadow:2px 2px 4px rgba(0,0,0,0.5);font-style:italic;margin:0 0 8px 0;letter-spacing:0.05em;" data-dynamic="month-title">MONTHLY MELODIES</h2><div style="display:inline-block;padding:4px 16px;border-radius:6px;background:#9ae66e;color:#1a1a1a;font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:8px;">MONTHLY SPOTIFY PLAYLIST</div><p style="color:#c8e6a0;font-size:14px;margin:0 0 12px 0;">Our community picks of the month</p><div style="display:flex;align-items:center;justify-content:center;gap:16px;font-size:13px;color:#c8e6a0;"><span style="display:flex;align-items:center;gap:6px;"><img src="https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg" alt="" style="width:18px;height:18px;" /><strong data-dynamic="song-count">0 SONGS</strong></span><span>•</span><span style="display:flex;align-items:center;gap:6px;">👥 <strong data-dynamic="vote-count">0 VOTES</strong></span></div></div></div></div>`;

interface Block {
  id: string;
  type: BlockType;
  content: string; // For text: HTML, for video: embed URL, for image: URL
}

interface BlockEditorProps {
  value: string; // HTML content
  onChange: (html: string) => void;
  articleContext?: {
    title?: string;
    subCategory?: string; // e.g. "History" for auto-generated history articles
    tags?: string[];
  };
}

const generateId = () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

// Parse HTML content into blocks
function parseHtmlToBlocks(html: string): Block[] {
  if (!html || html.trim() === "") {
    return [{ id: generateId(), type: "text", content: "<p><br></p>" }];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement;
  if (!root) return [{ id: generateId(), type: "text", content: html }];

  const blocks: Block[] = [];
  let textBuffer: string[] = [];

  const flushText = () => {
    if (textBuffer.length > 0) {
      const content = textBuffer.join("").trim();
      if (content) {
        blocks.push({ id: generateId(), type: "text", content });
      }
      textBuffer = [];
    }
  };

  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      
      // Video iframe
      if (el.tagName === "IFRAME" || el.querySelector?.("iframe")) {
        flushText();
        const iframe = el.tagName === "IFRAME" ? el : el.querySelector("iframe");
        const src = iframe?.getAttribute("src") || "";
        if (src) {
          blocks.push({ id: generateId(), type: "video", content: src });
        }
        return;
      }
      
      // Ad slot
      if (el.classList.contains("ad-slot-marker") || el.getAttribute("data-ad-slot")) {
        flushText();
        blocks.push({ id: generateId(), type: "ad", content: el.getAttribute("data-ad-slot") || "banner" });
        return;
      }
      
      // Divider
      if (el.classList.contains("article-divider") || el.tagName === "HR") {
        flushText();
        blocks.push({ id: generateId(), type: "divider", content: "" });
        return;
      }
      
      // Music Banner Block
      const hasMusicBanner = el.classList.contains("music-banner-block") || el.querySelector?.(".music-banner-block");
      if (hasMusicBanner) {
        flushText();
        blocks.push({ id: generateId(), type: "music-banner", content: MUSIC_BANNER_HTML });
        return;
      }
      
      // CTA Blocks - detect by class (new format with cta-block or old format with *-cta-banner)
      const hasCTABlock = el.classList.contains("cta-block") || el.querySelector?.(".cta-block");
      const hasRadioCTA = el.classList.contains("radio-cta-banner") || el.querySelector?.(".radio-cta-banner");
      const hasTvCTA = el.classList.contains("tv-cta-banner") || el.querySelector?.(".tv-cta-banner");
      const hasArcadeCTA = el.classList.contains("arcade-cta-banner") || el.querySelector?.(".arcade-cta-banner");
      const hasShopCTA = el.classList.contains("shop-cta-banner") || el.querySelector?.(".shop-cta-banner");
      const hasArticlesCTA = el.classList.contains("articles-cta-banner") || el.querySelector?.(".articles-cta-banner");
      const hasRankrollCTA = el.classList.contains("rankroll-cta-banner") || el.querySelector?.(".rankroll-cta-banner");
      
      if (hasCTABlock || hasRadioCTA || hasTvCTA || hasArcadeCTA || hasShopCTA || hasArticlesCTA || hasRankrollCTA) {
        flushText();
        // Check data-cta-type first (new format), then fall back to class detection (old format)
        const ctaEl = el.classList.contains("cta-block") ? el : el.querySelector(".cta-block");
        const ctaType = ctaEl?.getAttribute("data-cta-type");
        const rankrollId = ctaEl?.getAttribute("data-rankroll-id") || "";
        
        if (ctaType === "radio" || hasRadioCTA) {
          blocks.push({ id: generateId(), type: "radio-cta", content: RADIO_CTA_HTML });
        } else if (ctaType === "tv" || hasTvCTA) {
          blocks.push({ id: generateId(), type: "tv-cta", content: TV_CTA_HTML });
        } else if (ctaType === "arcade" || hasArcadeCTA) {
          blocks.push({ id: generateId(), type: "arcade-cta", content: ARCADE_CTA_HTML });
        } else if (ctaType === "shop" || hasShopCTA) {
          blocks.push({ id: generateId(), type: "shop-cta", content: SHOP_CTA_HTML });
        } else if (ctaType === "articles" || hasArticlesCTA) {
          blocks.push({ id: generateId(), type: "articles-cta", content: ARTICLES_CTA_HTML });
        } else if (ctaType === "rankroll" || hasRankrollCTA) {
          // Preserve the rankroll ID in the content
          const content = RANKROLL_CTA_HTML.replace('data-rankroll-id=""', `data-rankroll-id="${rankrollId}"`);
          blocks.push({ id: generateId(), type: "rankroll-cta", content });
        }
        return;
      }
      
      // Gallery Slider Block
      if (el.classList.contains("gallery-slider-block")) {
        flushText();
        const imagesStr = el.getAttribute("data-images") || "[]";
        blocks.push({ id: generateId(), type: "gallery", content: imagesStr });
        return;
      }

      // Image (standalone)
      if (el.tagName === "IMG") {
        flushText();
        blocks.push({ id: generateId(), type: "image", content: el.getAttribute("src") || "" });
        return;
      }
      
      // H2 starts a new block - flush previous text first
      if (el.tagName === "H2") {
        flushText();
        textBuffer.push(el.outerHTML);
        return;
      }
      
      // Regular HTML - add to text buffer
      textBuffer.push(el.outerHTML);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text.trim()) {
        textBuffer.push(`<p>${text}</p>`);
      }
    }
  });

  flushText();

  if (blocks.length === 0) {
    blocks.push({ id: generateId(), type: "text", content: "<p><br></p>" });
  }

  return blocks;
}

// Serialize blocks back to HTML
function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "text":
          return block.content;
        case "video":
          return `<div class="video-embed" style="position:relative;width:100%;aspect-ratio:16/9;margin:24px 0;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.15);background:#000;"><iframe class="ql-video" frameborder="0" allowfullscreen="true" src="${block.content}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"></iframe></div>`;
        case "ad":
          try {
            const adData = JSON.parse(block.content);
            if (adData.image) {
              return `<div class="ad-card" data-ad-content='${block.content}'>
                <a href="${adData.link || '#'}" target="_blank" rel="noopener sponsored">
                  <div class="ad-label">Advertisement</div>
                  <img src="${adData.image}" alt="${adData.title || 'Advertisement'}" />
                  ${adData.title ? `<div class="ad-title">${adData.title}</div>` : ''}
                </a>
              </div>`;
            }
          } catch { /* fallback */ }
          return `<p data-ad-slot="${block.content}" class="ad-slot-marker">[ AD ]</p>`;
        case "divider":
          return `<hr class="article-divider" />`;
        case "image":
          return `<img src="${block.content}" style="width:100%;border-radius:8px;margin:16px 0;" />`;
        case "radio-cta":
          return RADIO_CTA_HTML;
        case "tv-cta":
          return TV_CTA_HTML;
        case "arcade-cta":
          return ARCADE_CTA_HTML;
        case "shop-cta":
          return SHOP_CTA_HTML;
        case "articles-cta":
          return ARTICLES_CTA_HTML;
        case "rankroll-cta":
          return block.content || RANKROLL_CTA_HTML;
        case "gallery": {
          let imgs: string[] = [];
          try { imgs = JSON.parse(block.content || '[]'); } catch { imgs = []; }
          if (imgs.length === 0) return '';
          const slides = imgs.map((url, i) =>
            `<img src="${url}" data-gallery-index="${i}" style="height:240px;width:auto;flex-shrink:0;object-fit:cover;border-radius:12px;cursor:pointer;display:block;" alt="Photo ${i + 1}" />`
          ).join('');
          const arrowBase = `position:absolute;top:50%;transform:translateY(-50%);z-index:10;width:38px;height:38px;background:rgba(10,10,10,0.65);border:none;color:white;border-radius:50%;cursor:pointer;font-size:22px;display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);padding:0;line-height:1;`;
          return `<div class="gallery-slider-block" data-images='${JSON.stringify(imgs)}' style="position:relative;margin:28px 0;">` +
            `<button class="gsl-prev" style="${arrowBase}left:10px;">&#8249;</button>` +
            `<div class="gsl-track" style="display:flex;align-items:center;gap:8px;overflow-x:auto;scroll-behavior:smooth;padding:14px;scrollbar-width:none;-ms-overflow-style:none;">${slides}</div>` +
            `<button class="gsl-next" style="${arrowBase}right:10px;">&#8250;</button>` +
            `<div style="text-align:right;font-size:11px;color:#999;padding:4px 14px 8px;">📸 ${imgs.length} photo${imgs.length !== 1 ? 's' : ''} · click to enlarge</div>` +
            `</div>`;
        }
        case "music-banner":
          return MUSIC_BANNER_HTML;
        default:
          return "";
      }
    })
    .join("\n");
}

// Convert YouTube/Vimeo URL to embed URL
function toEmbedUrl(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  if (url.includes("/embed/") || url.includes("player.vimeo.com")) return url;
  return null;
}

// Available rankings for dropdown
interface AvailableRanking {
  _id: string;
  title: string;
}

export default function BlockEditor({ value, onChange, articleContext }: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => parseHtmlToBlocks(value));
  const [addMenuIndex, setAddMenuIndex] = useState<number | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState("");
  const [videoUrlError, setVideoUrlError] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState<{ index: number } | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showImageModal, setShowImageModal] = useState<{ index: number } | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [rewritingBlockId, setRewritingBlockId] = useState<string | null>(null);
  const lastEmittedHtml = useRef<string>(blocksToHtml(blocks));
  const initializedRef = useRef(false);
  const [availableRankings, setAvailableRankings] = useState<AvailableRanking[]>([]);
  
  // Load available rankings for dropdown
  useEffect(() => {
    fetch('/api/polls?type=ranking&status=active')
      .then(res => res.json())
      .then(data => {
        if (data.polls) {
          setAvailableRankings(data.polls.map((p: any) => ({ _id: p._id, title: p.title })));
        }
      })
      .catch(err => console.error('Failed to load rankings:', err));
  }, []);

  // Strip whitespace for comparison (handles HTML normalization differences)
  const normalizeForCompare = (html: string) => html.replace(/\s+/g, '').trim();

  // Sync blocks → HTML when blocks change internally
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return; // Skip first render to avoid initial emit
    }
    const html = blocksToHtml(blocks);
    if (html !== lastEmittedHtml.current) {
      lastEmittedHtml.current = html;
      onChange(html);
    }
  }, [blocks, onChange]);

  // Re-parse only when external value is GENUINELY different (e.g. AI generation)
  useEffect(() => {
    if (!value) return;
    const normalizedValue = normalizeForCompare(value);
    const normalizedEmitted = normalizeForCompare(lastEmittedHtml.current);
    // Only re-parse if content is semantically different (not just whitespace/normalization)
    if (normalizedValue === normalizedEmitted) return;
    lastEmittedHtml.current = value;
    setBlocks(parseHtmlToBlocks(value));
  }, [value]);

  const updateBlock = (id: string, content: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)));
  };

  const deleteBlock = (id: string) => {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (next.length === 0) {
        return [{ id: generateId(), type: "text", content: "<p><br></p>" }];
      }
      return next;
    });
  };

  const moveBlock = (id: string, direction: "up" | "down") => {
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const rewriteBlock = async (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block || block.type !== 'text') return;
    
    // Get context from all blocks
    const allContent = blocks
      .filter(b => b.type === 'text')
      .map(b => b.content.replace(/<[^>]*>/g, '').trim())
      .join('\n\n');
    
    // Detect structure: headlines, paragraphs, etc.
    const htmlContent = block.content;
    const hasHeadline = /<h[1-3][^>]*>/.test(htmlContent);
    
    // Extract headline and body separately if present
    let headlineText = '';
    let bodyText = '';
    
    if (hasHeadline) {
      const headlineMatch = htmlContent.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
      headlineText = headlineMatch ? headlineMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      // Get everything after the headline
      const afterHeadline = htmlContent.replace(/<h[1-3][^>]*>.*?<\/h[1-3]>/i, '');
      bodyText = afterHeadline.replace(/<[^>]*>/g, '').trim();
    } else {
      bodyText = htmlContent.replace(/<[^>]*>/g, '').trim();
    }
    
    // Check if block is empty - for History articles, generate new fact
    const isEmpty = !headlineText && !bodyText;
    const isHistoryArticle = articleContext?.subCategory?.toLowerCase() === 'history';
    
    if (isEmpty && !isHistoryArticle) return; // Only allow empty block AI for history articles
    
    setRewritingBlockId(blockId);
    
    try {
      const res = await fetch('/api/admin/rewrite-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentText: bodyText,
          headlineText: headlineText,
          hasHeadline: hasHeadline,
          fullContext: allContent,
          generateNew: isEmpty && isHistoryArticle,
          articleTitle: articleContext?.title,
          articleTags: articleContext?.tags,
        }),
      });
      
      const data = await res.json();
      if (data.success && data.rewrittenText) {
        let newContent = '';
        if (hasHeadline && data.rewrittenHeadline) {
          // Reconstruct with headline
          newContent = `<h2>${data.rewrittenHeadline}</h2><p>${data.rewrittenText}</p>`;
        } else if (hasHeadline) {
          // Keep original headline, new body
          newContent = `<h2>${headlineText}</h2><p>${data.rewrittenText}</p>`;
        } else if (data.rewrittenHeadline) {
          // New fact with headline (generated)
          newContent = `<h2>${data.rewrittenHeadline}</h2><p>${data.rewrittenText}</p>`;
        } else {
          // Just paragraph
          newContent = `<p>${data.rewrittenText}</p>`;
        }
        updateBlock(blockId, newContent);
      }
    } catch (e) {
      console.error('Failed to rewrite block:', e);
    } finally {
      setRewritingBlockId(null);
    }
  };

  const addBlock = (afterIndex: number, type: BlockType, content = "") => {
    // Determine content based on block type
    let blockContent = content;
    if (type === "text") blockContent = "<p><br></p>";
    else if (type === "radio-cta") blockContent = RADIO_CTA_HTML;
    else if (type === "arcade-cta") blockContent = ARCADE_CTA_HTML;
    else if (type === "shop-cta") blockContent = SHOP_CTA_HTML;
    else if (type === "articles-cta") blockContent = ARTICLES_CTA_HTML;
    else if (type === "tv-cta") blockContent = TV_CTA_HTML;
    else if (type === "rankroll-cta") blockContent = RANKROLL_CTA_HTML;
    else if (type === "gallery") blockContent = "[]";
    else if (type === "music-banner") blockContent = MUSIC_BANNER_HTML;
    
    const newBlock: Block = {
      id: generateId(),
      type,
      content: blockContent,
    };
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, newBlock);
      return next;
    });
    setAddMenuIndex(null);
  };

  const handleAddVideo = () => {
    const embedUrl = toEmbedUrl(videoUrlInput.trim());
    if (!embedUrl) {
      setVideoUrlError("Not a valid YouTube or Vimeo URL");
      return;
    }
    if (showVideoModal) {
      addBlock(showVideoModal.index, "video", embedUrl);
    }
    setShowVideoModal(null);
    setVideoUrlInput("");
    setVideoUrlError(null);
  };

  const handleAddImage = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (showImageModal) {
      addBlock(showImageModal.index, "image", url);
    }
    setShowImageModal(null);
    setImageUrlInput("");
  };

  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !showImageModal) return;
    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        addBlock(showImageModal.index, "image", data.url);
        setShowImageModal(null);
        setImageUrlInput("");
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setIsUploadingImage(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = '';
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      setBlocks((prev) => {
        const next = [...prev];
        const [removed] = next.splice(draggedIndex, 1);
        next.splice(dragOverIndex, 0, removed);
        return next;
      });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const quillModules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      [{ font: AVAILABLE_FONTS }],
      [{ size: ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px', '60px', '72px'] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ align: [] }],
      ["blockquote", "link"],
      ["clean"],
    ],
  };

  return (
    <div className="block-editor">
      <label className="block text-xs text-gray-400 mb-2">Content (Block Editor)</label>
      
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-3 space-y-1">
        {/* Add button at the very top */}
        <AddBlockButton onClick={() => setAddMenuIndex(-1)} isOpen={addMenuIndex === -1} />
        {addMenuIndex === -1 && (
          <AddBlockMenu
            onAdd={(type) => {
              if (type === "video") {
                setShowVideoModal({ index: -1 });
                setAddMenuIndex(null);
              } else if (type === "image") {
                setShowImageModal({ index: -1 });
                setAddMenuIndex(null);
              } else {
                addBlock(-1, type);
              }
            }}
            onClose={() => setAddMenuIndex(null)}
          />
        )}

        {blocks.map((block, index) => (
          <div key={block.id}>
            {/* Drop indicator */}
            {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
              <div className="h-1 bg-[#E36B11] rounded-full my-1" />
            )}
            
            <div
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`group relative bg-white border rounded-lg transition-all ${
                draggedIndex === index ? "opacity-40" : ""
              } border-gray-200 hover:border-gray-300`}
            >
              {/* Block Controls - inline toolbar at top */}
              <div className="flex items-center justify-between px-2 py-1 bg-gray-100 border-b border-gray-200 rounded-t-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "up")}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                    title="Move up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(block.id, "down")}
                    disabled={index === blocks.length - 1}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
                    title="Move down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <div
                    className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-700"
                    title="Drag to reorder"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Re-AI button - only for text blocks */}
                  {block.type === 'text' && (
                    <button
                      type="button"
                      onClick={() => rewriteBlock(block.id)}
                      disabled={rewritingBlockId === block.id}
                      className="p-1.5 bg-purple-100 hover:bg-purple-500 text-purple-600 hover:text-white rounded transition-all disabled:opacity-50"
                      title="Rewrite with AI"
                    >
                      {rewritingBlockId === block.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => deleteBlock(block.id)}
                    className="p-1.5 bg-red-100 hover:bg-red-500 text-red-600 hover:text-white rounded transition-all"
                    title="Delete block"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Block Content */}
              <BlockContent
                block={block}
                onChange={(content) => updateBlock(block.id, content)}
                quillModules={quillModules}
                availableRankings={availableRankings}
              />
            </div>

            {/* Add button below block */}
            <AddBlockButton
              onClick={() => setAddMenuIndex(addMenuIndex === index ? null : index)}
              isOpen={addMenuIndex === index}
            />
            {addMenuIndex === index && (
              <AddBlockMenu
                onAdd={(type) => {
                  if (type === "video") {
                    setShowVideoModal({ index });
                    setAddMenuIndex(null);
                  } else if (type === "image") {
                    setShowImageModal({ index });
                    setAddMenuIndex(null);
                  } else {
                    addBlock(index, type);
                  }
                }}
                onClose={() => setAddMenuIndex(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500 mt-2 leading-relaxed">
        <span className="font-semibold">Hover</span> over a block to see controls ·{" "}
        <span className="font-semibold">Drag</span> the handle to reorder ·{" "}
        Click <span className="font-semibold text-[#E36B11]">+</span> between blocks to add new content
      </p>

      {/* Video URL Modal */}
      {showVideoModal && (
        <Modal
          title="Insert Video"
          icon={<Film className="w-5 h-5 text-[#E36B11]" />}
          onClose={() => { setShowVideoModal(null); setVideoUrlInput(""); setVideoUrlError(null); }}
        >
          <div className="p-4">
            <label className="block text-xs text-gray-400 mb-2">Paste YouTube or Vimeo URL</label>
            <input
              type="url"
              value={videoUrlInput}
              onChange={(e) => { setVideoUrlInput(e.target.value); setVideoUrlError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddVideo(); } }}
              placeholder="https://www.youtube.com/watch?v=..."
              autoFocus
              className="w-full px-3 py-2.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#E36B11]"
            />
            {videoUrlError && (
              <div className="text-xs text-red-400 mt-2">{videoUrlError}</div>
            )}
            <div className="text-[11px] text-gray-500 mt-2">
              Supported: youtube.com, youtu.be, vimeo.com
            </div>
          </div>
          <div className="flex justify-center gap-4 p-4 border-t border-gray-700 bg-gray-900">
            <button
              type="button"
              onClick={() => { setShowVideoModal(null); setVideoUrlInput(""); setVideoUrlError(null); }}
              className="px-6 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-medium text-sm rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddVideo}
              className="px-6 py-2.5 bg-[#E36B11] hover:bg-[#c06a2a] text-white font-bold text-sm rounded-lg"
            >
              Insert
            </button>
          </div>
        </Modal>
      )}

      {/* Image URL Modal */}
      {showImageModal && (
        <Modal
          title="Insert Image"
          icon={<ImageIcon className="w-5 h-5 text-[#E36B11]" />}
          onClose={() => { setShowImageModal(null); setImageUrlInput(""); }}
        >
          <div className="p-4 space-y-4">
            {/* Upload from device */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Upload from device</label>
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*,video/mp4"
                onChange={handleImageFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageFileInputRef.current?.click()}
                disabled={isUploadingImage}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm rounded-lg transition-colors"
              >
                {isUploadingImage ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                ) : (
                  <><Upload className="w-4 h-4" /> Choose file (image/video)</>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="flex-1 h-px bg-gray-700" />
              <span>OR</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            {/* Paste URL */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Paste image URL</label>
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddImage(); } }}
                placeholder="https://example.com/image.jpg"
                className="w-full px-3 py-2.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#E36B11]"
              />
            </div>
          </div>
          <div className="flex justify-center gap-4 p-4 border-t border-gray-700 bg-gray-900">
            <button
              type="button"
              onClick={() => { setShowImageModal(null); setImageUrlInput(""); }}
              disabled={isUploadingImage}
              className="px-6 py-2.5 bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white font-medium text-sm rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddImage}
              disabled={isUploadingImage || !imageUrlInput.trim()}
              className="px-6 py-2.5 bg-[#E36B11] hover:bg-[#c06a2a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg"
            >
              Insert URL
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============ Sub-components ============ */

function BlockContent({
  block,
  onChange,
  quillModules,
  availableRankings,
}: {
  block: Block;
  onChange: (content: string) => void;
  quillModules: any;
  availableRankings: AvailableRanking[];
}) {
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const [showGalleryAdd, setShowGalleryAdd] = useState(false);
  const galleryFileRef = useRef<HTMLInputElement>(null);

  if (block.type === "gallery") {
    let images: string[] = [];
    try { images = JSON.parse(block.content || '[]'); } catch { images = []; }

    const addImage = (url: string) => {
      onChange(JSON.stringify([...images, url]));
      setGalleryUrlInput('');
      setShowGalleryAdd(false);
    };

    const removeImage = (i: number) => {
      onChange(JSON.stringify(images.filter((_, idx) => idx !== i)));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setGalleryUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success && data.url) addImage(data.url);
      } catch { /* ignore */ } finally {
        setGalleryUploading(false);
        if (galleryFileRef.current) galleryFileRef.current.value = '';
      }
    };

    return (
      <div className="p-3">
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <LayoutGrid className="w-4 h-4 text-[#E36B11]" />
          <span className="font-medium text-gray-700">Gallery Slider</span>
          <span className="text-gray-400">({images.length} image{images.length !== 1 ? 's' : ''})</span>
        </div>

        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-thin">
            {images.map((url, i) => (
              <div key={i} className="relative flex-shrink-0 group/gimg">
                <img src={url} alt="" className="h-20 w-auto rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover/gimg:opacity-100 transition-opacity shadow"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showGalleryAdd ? (
          <div className="border border-dashed border-[#E36B11]/40 rounded-lg p-3 space-y-2 bg-[#E36B11]/5">
            <input
              ref={galleryFileRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => galleryFileRef.current?.click()}
              disabled={galleryUploading}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {galleryUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</> : <><Upload className="w-3.5 h-3.5" />Upload from device</>}
            </button>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <div className="flex-1 h-px bg-gray-300" /><span>OR</span><div className="flex-1 h-px bg-gray-300" />
            </div>
            <div className="flex gap-1">
              <input
                type="url"
                value={galleryUrlInput}
                onChange={(e) => setGalleryUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (galleryUrlInput.trim()) addImage(galleryUrlInput.trim()); } }}
                placeholder="Paste image URL…"
                className="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-[#E36B11]"
              />
              <button
                type="button"
                onClick={() => { if (galleryUrlInput.trim()) addImage(galleryUrlInput.trim()); }}
                disabled={!galleryUrlInput.trim()}
                className="px-3 py-1.5 bg-[#E36B11] hover:bg-[#c06a2a] disabled:opacity-40 text-white text-xs font-bold rounded-lg"
              >Add</button>
            </div>
            <button type="button" onClick={() => setShowGalleryAdd(false)} className="w-full text-[10px] text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowGalleryAdd(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#E36B11]/10 hover:bg-[#E36B11]/20 text-[#E36B11] rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add photo to gallery
          </button>
        )}
        {images.length === 0 && !showGalleryAdd && (
          <div className="text-[10px] text-gray-400 mt-1">Empty gallery — add photos above. They'll appear as a scrollable strip in the article.</div>
        )}
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <div className="block-text-wrapper">
        <ReactQuill
          theme="snow"
          value={block.content}
          onChange={(content: string, _delta: any, source: string) => {
            // Only propagate user-initiated changes, not Quill's API normalizations
            if (source === 'user') {
              onChange(content);
            }
          }}
          modules={quillModules}
          className="[&_.ql-editor]:min-h-[60px] [&_.ql-editor]:text-gray-900 [&_.ql-container]:border-none [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-gray-200 [&_.ql-toolbar]:bg-gray-50"
        />
      </div>
    );
  }

  if (block.type === "video") {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
          <Film className="w-4 h-4" />
          <span className="font-medium">Video Embed</span>
        </div>
        <div className="aspect-video bg-black rounded overflow-hidden">
          <iframe
            src={block.content}
            className="w-full h-full"
            frameBorder="0"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        <input
          type="url"
          value={block.content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-2 px-2 py-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded"
          placeholder="Embed URL"
        />
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
          <ImageIcon className="w-4 h-4" />
          <span className="font-medium">Image</span>
        </div>
        <img src={block.content} alt="" className="w-full rounded" />
        <input
          type="url"
          value={block.content}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-2 px-2 py-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded"
          placeholder="Image URL"
        />
      </div>
    );
  }

  if (block.type === "ad") {
    // Parse ad content (JSON: {image, link, title} or legacy string)
    let adData = { image: '', link: '', title: '' };
    try {
      if (block.content && block.content.startsWith('{')) {
        adData = JSON.parse(block.content);
      }
    } catch { /* legacy format */ }

    const updateAdData = (field: string, value: string) => {
      const newData = { ...adData, [field]: value };
      onChange(JSON.stringify(newData));
    };

    return (
      <div className="p-4 m-2 bg-[#E36B11]/5 border-2 border-dashed border-[#E36B11]/30 rounded-xl">
        <div className="text-[10px] text-[#E36B11] font-bold mb-2 flex items-center gap-1">
          <Megaphone className="w-3 h-3" />
          ADVERTISEMENT
        </div>
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Image URL</label>
            <input
              type="text"
              value={adData.image}
              onChange={(e) => updateAdData('image', e.target.value)}
              placeholder="https://..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#E36B11] focus:border-[#E36B11]"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Link URL</label>
            <input
              type="text"
              value={adData.link}
              onChange={(e) => updateAdData('link', e.target.value)}
              placeholder="https://..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#E36B11] focus:border-[#E36B11]"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Title (optional)</label>
            <input
              type="text"
              value={adData.title}
              onChange={(e) => updateAdData('title', e.target.value)}
              placeholder="Ad title..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#E36B11] focus:border-[#E36B11]"
            />
          </div>
          {adData.image && (
            <div className="mt-2 rounded-lg overflow-hidden border border-gray-200">
              <img src={adData.image} alt="Ad preview" className="w-full h-24 object-cover" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (block.type === "divider") {
    return (
      <div className="px-3 py-4">
        <hr className="border-t-2 border-gray-300" />
      </div>
    );
  }

  if (block.type === "radio-cta") {
    return (
      <div className="p-3 m-2 bg-gradient-to-r from-[#E36B11]/15 to-[#E36B11]/5 border border-[#E36B11]/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#E36B11] rounded-full flex items-center justify-center">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Listen on GenX Radio</div>
              <div className="text-xs text-gray-600">Discover more timeless tracks on our radio.</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-[#E36B11] text-white rounded-lg font-bold text-sm">
            Go to Radio →
          </div>
        </div>
        <div className="text-[9px] text-[#E36B11] mt-2 text-center font-medium">RADIO CTA BLOCK</div>
      </div>
    );
  }

  if (block.type === "arcade-cta") {
    return (
      <div className="p-3 m-2 bg-gradient-to-r from-purple-500/15 to-purple-500/5 border border-purple-500/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-purple-500 rounded-full flex items-center justify-center">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Play QuizBattle</div>
              <div className="text-xs text-gray-600">Test your 80s/90s knowledge and win points!</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-purple-500 text-white rounded-lg font-bold text-sm">
            Go to Arcade →
          </div>
        </div>
        <div className="text-[9px] text-purple-500 mt-2 text-center font-medium">ARCADE CTA BLOCK</div>
      </div>
    );
  }

  if (block.type === "shop-cta") {
    return (
      <div className="p-3 m-2 bg-gradient-to-r from-pink-500/15 to-pink-500/5 border border-pink-500/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-pink-500 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Visit the Shop</div>
              <div className="text-xs text-gray-600">Get exclusive GenX merch and collectibles.</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-pink-500 text-white rounded-lg font-bold text-sm">
            Go to Shop →
          </div>
        </div>
        <div className="text-[9px] text-pink-500 mt-2 text-center font-medium">SHOP CTA BLOCK</div>
      </div>
    );
  }

  if (block.type === "articles-cta") {
    return (
      <div className="p-3 m-2 bg-gradient-to-r from-green-500/15 to-green-500/5 border border-green-500/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-green-500 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">More Articles</div>
              <div className="text-xs text-gray-600">Discover more stories from the GenX era.</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold text-sm">
            Browse Articles →
          </div>
        </div>
        <div className="text-[9px] text-green-500 mt-2 text-center font-medium">ARTICLES CTA BLOCK</div>
      </div>
    );
  }

  if (block.type === "tv-cta") {
    return (
      <div className="p-3 m-2 bg-gradient-to-r from-blue-500/15 to-blue-500/5 border border-blue-500/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-500 rounded-full flex items-center justify-center">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Watch GenX TV</div>
              <div className="text-xs text-gray-600">Classic videos and nostalgic content.</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold text-sm">
            Go to TV →
          </div>
        </div>
        <div className="text-[9px] text-blue-500 mt-2 text-center font-medium">TV CTA BLOCK</div>
      </div>
    );
  }

  if (block.type === "rankroll-cta") {
    // Extract rankroll ID from content
    const rankrollIdMatch = block.content.match(/data-rankroll-id="([^"]*)"/);
    const rankrollId = rankrollIdMatch?.[1] || "";
    const selectedRanking = availableRankings.find(r => r._id === rankrollId);
    return (
      <div className="p-3 m-2 bg-gradient-to-r from-[#E36B11]/15 to-[#E36B11]/5 border border-[#E36B11]/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#E36B11] rounded-full flex items-center justify-center">
              <Vote className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">{selectedRanking?.title || 'Vote Now!'}</div>
              <div className="text-xs text-gray-600">Vote & rank your favorites</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-[#E36B11] text-white rounded-lg font-bold text-sm">
            VOTE NOW
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div className="text-[9px] text-[#E36B11] font-medium">RANKROLL CTA BLOCK</div>
          <select
            value={rankrollId}
            onChange={(e) => {
              const selectedId = e.target.value;
              const selectedRanking = availableRankings.find(r => r._id === selectedId);
              const title = selectedRanking?.title || 'Vote Now!';
              let newContent = block.content
                .replace(/data-rankroll-id="[^"]*"/, `data-rankroll-id="${selectedId}"`)
                .replace(/data-rankroll-title="[^"]*"/, `data-rankroll-title="${title}"`)
                .replace(/<div class="rankroll-title"[^>]*>[^<]*<\/div>/, `<div class="rankroll-title" style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">${title}</div>`);
              onChange(newContent);
            }}
            className="text-[10px] px-2 py-1 bg-gray-100 border border-gray-300 rounded w-56 text-gray-700"
          >
            <option value="">-- Ranking auswählen --</option>
            {availableRankings.map((ranking) => (
              <option key={ranking._id} value={ranking._id}>
                {ranking.title}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (block.type === "music-banner") {
    return (
      <div className="p-3 m-2 rounded-xl overflow-hidden" style={{ background: '#1a1a1a' }}>
        <div className="relative" style={{ aspectRatio: '1024/200' }}>
          <img 
            src="/images/Hintergund/music.png" 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover rounded-lg"
          />
          <div className="absolute inset-0 flex items-center justify-center" style={{ paddingLeft: '35%', paddingRight: '15%' }}>
            <div className="text-center">
              <h2 className="font-display text-2xl italic mb-1" style={{ color: '#c8e6a0', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                MONTHLY MELODIES
              </h2>
              <div className="inline-block px-3 py-1 rounded text-[10px] font-bold mb-1" style={{ background: '#9ae66e', color: '#1a1a1a' }}>
                MONTHLY SPOTIFY PLAYLIST
              </div>
              <p className="text-xs mb-2" style={{ color: '#c8e6a0' }}>Our community picks of the month</p>
              <div className="flex items-center justify-center gap-3 text-[10px]" style={{ color: '#c8e6a0' }}>
                <span className="flex items-center gap-1">
                  <Music className="w-3 h-3" /> <strong>0 SONGS</strong>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  👥 <strong>0 VOTES</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-[9px] mt-2 text-center font-medium" style={{ color: '#9ae66e' }}>MUSIC BANNER BLOCK (Dynamic data at render)</div>
      </div>
    );
  }

  return null;
}

function AddBlockButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <div className="flex items-center justify-center py-1 group/add">
      <button
        type="button"
        onClick={onClick}
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
          isOpen
            ? "bg-[#E36B11] text-white"
            : "bg-transparent text-gray-400 hover:bg-[#E36B11] hover:text-white opacity-0 group-hover/add:opacity-100"
        }`}
      >
        <Plus className="w-3 h-3" />
        Add Block
      </button>
    </div>
  );
}

function AddBlockMenu({
  onAdd,
  onClose,
}: {
  onAdd: (type: BlockType) => void;
  onClose: () => void;
}) {
  const options: { type: BlockType; label: string; icon: any; description: string }[] = [
    { type: "text", label: "Text", icon: Type, description: "Paragraph with formatting" },
    { type: "video", label: "Video", icon: Film, description: "YouTube or Vimeo embed" },
    { type: "image", label: "Image", icon: ImageIcon, description: "Image from URL" },
    { type: "divider", label: "Divider", icon: Minus, description: "Horizontal line" },
    { type: "ad", label: "Ad Slot", icon: Megaphone, description: "Advertisement placeholder" },
    { type: "radio-cta", label: "Radio CTA", icon: Headphones, description: "GenX Radio call-to-action" },
    { type: "arcade-cta", label: "Arcade CTA", icon: Gamepad2, description: "QuizBattle call-to-action" },
    { type: "shop-cta", label: "Shop CTA", icon: ShoppingBag, description: "Shop call-to-action" },
    { type: "articles-cta", label: "Articles CTA", icon: FileText, description: "More articles call-to-action" },
    { type: "tv-cta", label: "TV CTA", icon: Tv, description: "GenX TV call-to-action" },
    { type: "rankroll-cta", label: "Rankroll CTA", icon: Vote, description: "Link to a Rankroll voting" },
    { type: "music-banner", label: "Music Banner", icon: Music, description: "Monthly Spotify playlist banner" },
    { type: "gallery", label: "Gallery Slider", icon: LayoutGrid, description: "Photo strip — click to enlarge" },
  ];

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-lg p-2 my-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
      {options.map((opt) => {
        const Icon = opt.icon;
        return (
          <button
            key={opt.type}
            type="button"
            onClick={() => onAdd(opt.type)}
            className="flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 rounded transition-colors"
          >
            <div className="w-8 h-8 flex items-center justify-center bg-[#E36B11]/10 text-[#E36B11] rounded">
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900">{opt.label}</div>
              <div className="text-[10px] text-gray-500 truncate">{opt.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Modal({
  title,
  icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900">
          <span className="text-sm font-bold text-white flex items-center gap-2">
            {icon}
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
