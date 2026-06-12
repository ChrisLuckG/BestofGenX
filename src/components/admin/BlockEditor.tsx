"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Film, Megaphone, Minus, Type, Trash2, GripVertical, ChevronUp, ChevronDown, Plus, X, Image as ImageIcon, Upload, Loader2, Headphones, Gamepad2, ShoppingBag, FileText, Tv, Sparkles } from "lucide-react";

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
type BlockType = "text" | "video" | "ad" | "divider" | "image" | "radio-cta" | "arcade-cta" | "shop-cta" | "articles-cta" | "tv-cta";

// CTA HTML constants - SVG icons for Android/Desktop, emoji fallback class for iOS (handled in CSS/JS)
// iOS detection happens client-side in ArticlePage, swaps .cta-icon content
const RADIO_CTA_HTML = `<div class="cta-block radio-cta-banner" data-cta-type="radio" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#D4873A;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎧"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Listen on GenX Radio</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more timeless tracks on our radio.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#D4873A;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Radio →</span></div>`;

const ARCADE_CTA_HTML = `<div class="cta-block arcade-cta-banner" data-cta-type="arcade" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border-radius:16px;border:1px solid rgba(139,92,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#8B5CF6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🎮"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Play Trivia</div><div style="font-size:12px;color:#666;line-height:1.4;">Test your 80s/90s knowledge and win BOGX!</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#8B5CF6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Trivia →</span></div>`;

const SHOP_CTA_HTML = `<div class="cta-block shop-cta-banner" data-cta-type="shop" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(236,72,153,0.15),rgba(236,72,153,0.05));border-radius:16px;border:1px solid rgba(236,72,153,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#EC4899;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🛍️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Visit the Shop</div><div style="font-size:12px;color:#666;line-height:1.4;">Get exclusive GenX merch and collectibles.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#EC4899;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to Shop →</span></div>`;

const ARTICLES_CTA_HTML = `<div class="cta-block articles-cta-banner" data-cta-type="articles" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(34,197,94,0.15),rgba(34,197,94,0.05));border-radius:16px;border:1px solid rgba(34,197,94,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#22C55E;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📰"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">More Articles</div><div style="font-size:12px;color:#666;line-height:1.4;">Discover more stories from the GenX era.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#22C55E;color:white;border-radius:10px;font-weight:700;font-size:13px;">Browse Articles →</span></div>`;

const TV_CTA_HTML = `<div class="cta-block tv-cta-banner" data-cta-type="tv" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(59,130,246,0.15),rgba(59,130,246,0.05));border-radius:16px;border:1px solid rgba(59,130,246,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#3B82F6;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="📺"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/></svg></div><div><div style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Watch GenX TV</div><div style="font-size:12px;color:#666;line-height:1.4;">Classic videos and nostalgic content.</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#3B82F6;color:white;border-radius:10px;font-weight:700;font-size:13px;">Go to TV →</span></div>`;

interface Block {
  id: string;
  type: BlockType;
  content: string; // For text: HTML, for video: embed URL, for image: URL
}

interface BlockEditorProps {
  value: string; // HTML content
  onChange: (html: string) => void;
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
      
      // CTA Blocks - detect by class (new format with cta-block or old format with *-cta-banner)
      const hasCTABlock = el.classList.contains("cta-block") || el.querySelector?.(".cta-block");
      const hasRadioCTA = el.classList.contains("radio-cta-banner") || el.querySelector?.(".radio-cta-banner");
      const hasTvCTA = el.classList.contains("tv-cta-banner") || el.querySelector?.(".tv-cta-banner");
      const hasArcadeCTA = el.classList.contains("arcade-cta-banner") || el.querySelector?.(".arcade-cta-banner");
      const hasShopCTA = el.classList.contains("shop-cta-banner") || el.querySelector?.(".shop-cta-banner");
      const hasArticlesCTA = el.classList.contains("articles-cta-banner") || el.querySelector?.(".articles-cta-banner");
      
      if (hasCTABlock || hasRadioCTA || hasTvCTA || hasArcadeCTA || hasShopCTA || hasArticlesCTA) {
        flushText();
        // Check data-cta-type first (new format), then fall back to class detection (old format)
        const ctaEl = el.classList.contains("cta-block") ? el : el.querySelector(".cta-block");
        const ctaType = ctaEl?.getAttribute("data-cta-type");
        
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
        }
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

export default function BlockEditor({ value, onChange }: BlockEditorProps) {
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
    
    if (!headlineText && !bodyText) return;
    
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
              <div className="h-1 bg-[#D4873A] rounded-full my-1" />
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
        Click <span className="font-semibold text-[#D4873A]">+</span> between blocks to add new content
      </p>

      {/* Video URL Modal */}
      {showVideoModal && (
        <Modal
          title="Insert Video"
          icon={<Film className="w-5 h-5 text-[#D4873A]" />}
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
              className="w-full px-3 py-2.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#D4873A]"
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
              className="px-6 py-2.5 bg-[#D4873A] hover:bg-[#c06a2a] text-white font-bold text-sm rounded-lg"
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
          icon={<ImageIcon className="w-5 h-5 text-[#D4873A]" />}
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
                className="w-full px-3 py-2.5 text-sm text-white bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-[#D4873A]"
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
              className="px-6 py-2.5 bg-[#D4873A] hover:bg-[#c06a2a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg"
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
}: {
  block: Block;
  onChange: (content: string) => void;
  quillModules: any;
}) {
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
      <div className="p-4 m-2 bg-[#D4873A]/5 border-2 border-dashed border-[#D4873A]/30 rounded-xl">
        <div className="text-[10px] text-[#D4873A] font-bold mb-2 flex items-center gap-1">
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
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#D4873A] focus:border-[#D4873A]"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Link URL</label>
            <input
              type="text"
              value={adData.link}
              onChange={(e) => updateAdData('link', e.target.value)}
              placeholder="https://..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#D4873A] focus:border-[#D4873A]"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 block mb-0.5">Title (optional)</label>
            <input
              type="text"
              value={adData.title}
              onChange={(e) => updateAdData('title', e.target.value)}
              placeholder="Ad title..."
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-[#D4873A] focus:border-[#D4873A]"
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
      <div className="p-3 m-2 bg-gradient-to-r from-[#D4873A]/15 to-[#D4873A]/5 border border-[#D4873A]/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-[#D4873A] rounded-full flex items-center justify-center">
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">Listen on GenX Radio</div>
              <div className="text-xs text-gray-600">Discover more timeless tracks on our radio.</div>
            </div>
          </div>
          <div className="px-4 py-2 bg-[#D4873A] text-white rounded-lg font-bold text-sm">
            Go to Radio →
          </div>
        </div>
        <div className="text-[9px] text-[#D4873A] mt-2 text-center font-medium">RADIO CTA BLOCK</div>
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
            ? "bg-[#D4873A] text-white"
            : "bg-transparent text-gray-400 hover:bg-[#D4873A] hover:text-white opacity-0 group-hover/add:opacity-100"
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
            <div className="w-8 h-8 flex items-center justify-center bg-[#D4873A]/10 text-[#D4873A] rounded">
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
