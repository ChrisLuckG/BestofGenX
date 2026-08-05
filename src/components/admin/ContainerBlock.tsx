"use client";

import { X, Upload, Loader2, GripVertical, ChevronUp, ChevronDown, Palette } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { resolveContainer } from "@/lib/containerFill";
import { CATEGORIES } from "@/lib/categories";

const ImagePickerModal = dynamic(() => import("./ImagePickerModal"), { ssr: false });

// Available container themes
// cream = Original background color (no highlight)
// Others = Highlight colors for special sections
export const CONTAINER_THEMES = {
  // Original background - no styling
  cream: { bg: 'bg-[#F5F0E8]', border: 'border-[#E5DDD0]', label: 'Original (Cream)', color: '#F5F0E8' },
  // BOGX Orange - our brand color!
  bogx: { bg: 'bg-[#D4873A]', border: 'border-[#E5A55A]', label: 'BOGX Orange', color: '#D4873A' },
  // Highlight themes
  arcade: { bg: 'bg-purple-800', border: 'border-purple-500', label: 'Arcade', color: '#7c3aed' },
  sports: { bg: 'bg-green-800', border: 'border-green-500', label: 'Sports', color: '#16a34a' },
  music: { bg: 'bg-orange-800', border: 'border-orange-500', label: 'Music', color: '#ea580c' },
  movies: { bg: 'bg-blue-800', border: 'border-blue-500', label: 'Movies', color: '#2563eb' },
  history: { bg: 'bg-amber-700', border: 'border-amber-500', label: 'History', color: '#d97706' },
  culture: { bg: 'bg-pink-800', border: 'border-pink-500', label: 'Culture', color: '#db2777' },
  gaming: { bg: 'bg-indigo-800', border: 'border-indigo-500', label: 'Gaming', color: '#6366f1' },
  retro: { bg: 'bg-teal-800', border: 'border-teal-500', label: 'Retro', color: '#14b8a6' },
  // Additional colors
  red: { bg: 'bg-red-700', border: 'border-red-500', label: 'Red', color: '#b91c1c' },
  rose: { bg: 'bg-rose-700', border: 'border-rose-500', label: 'Rose', color: '#be123c' },
  fuchsia: { bg: 'bg-fuchsia-700', border: 'border-fuchsia-500', label: 'Fuchsia', color: '#a21caf' },
  violet: { bg: 'bg-violet-700', border: 'border-violet-500', label: 'Violet', color: '#6d28d9' },
  sky: { bg: 'bg-sky-700', border: 'border-sky-500', label: 'Sky', color: '#0369a1' },
  cyan: { bg: 'bg-cyan-700', border: 'border-cyan-500', label: 'Cyan', color: '#0e7490' },
  emerald: { bg: 'bg-emerald-700', border: 'border-emerald-500', label: 'Emerald', color: '#047857' },
  lime: { bg: 'bg-lime-700', border: 'border-lime-500', label: 'Lime', color: '#4d7c0f' },
  yellow: { bg: 'bg-yellow-600', border: 'border-yellow-400', label: 'Yellow', color: '#ca8a04' },
  slate: { bg: 'bg-slate-700', border: 'border-slate-500', label: 'Slate', color: '#334155' },
  zinc: { bg: 'bg-zinc-800', border: 'border-zinc-600', label: 'Dark', color: '#27272a' },
  // Custom color placeholder - will be handled specially
  custom: { bg: '', border: '', label: 'Custom', color: '#888888' },
} as const;

export type ContainerTheme = keyof typeof CONTAINER_THEMES;

// Use generic type to avoid conflicts with ArticlesTab's ArticleData
interface SimpleArticle {
  _id?: string;
  title: string;
  coverImage?: string;
  category?: string;
  status?: string;
  createdAt?: string;
}

interface ContainerBlockType {
  type: 'MAIN' | '2H' | 'FIXED' | 'SLIDER' | 'VERTICAL' | 'SOCIAL';
  articleId?: string | null;
  articleId2?: string | null;
  articles?: string[];
  bannerImage?: string;
  bannerLink?: string;
  showDateOverlay?: boolean; // Show TODAY/date overlay on banner
  autoFill?: 'latest' | 'history' | 'category';  // Auto-fill mode for SLIDER
  autoFillCategory?: string;  // Category filter for auto-fill
  autoFillLimit?: number;  // How many articles to show
}

interface ContainerBlockProps {
  index: number;
  containerName: string;
  containerBlocks: ContainerBlockType[];
  containerTheme?: ContainerTheme;
  customColor?: string; // Custom hex color when theme is 'custom'
  articles: SimpleArticle[];
  onUpdateName: (index: number, name: string) => void;
  onUpdateTheme?: (index: number, theme: ContainerTheme, customColor?: string) => void;
  onRemove: (index: number) => void;
  onAddBlock: (index: number, blockType: ContainerBlockType['type']) => void;
  onRemoveBlock: (index: number, blockIndex: number) => void;
  onUpdateBlock: (index: number, blockIndex: number, updates: Partial<ContainerBlockType>) => void;
  onMoveBlock?: (index: number, blockIndex: number, direction: 'up' | 'down') => void;
  onAddContainer?: () => void;  // Add new container after this one
  onMoveUp?: (index: number) => void;  // Move container up
  onMoveDown?: (index: number) => void;  // Move container down
  isFirst?: boolean;
  isLast?: boolean;
  excludeIds?: Set<string>;  // Article IDs consumed by preceding containers (waterfall dedup)
  isGlobalLatest?: boolean;  // Top container = global newest (any category)
  bannerCategories?: Set<string>;  // Date-based banner categories excluded from Top Area
}

// Sub-component for FIXED banner with image upload + AI generation
function FixedBannerBlock({ 
  block, 
  index, 
  bIdx, 
  onUpdateBlock, 
  onRemoveBlock,
  articles,
  containerBlocks,
}: { 
  block: ContainerBlockType; 
  index: number; 
  bIdx: number; 
  onUpdateBlock: ContainerBlockProps['onUpdateBlock']; 
  onRemoveBlock: ContainerBlockProps['onRemoveBlock'];
  articles: SimpleArticle[];
  containerBlocks: ContainerBlockType[];
}) {
  const [showPicker, setShowPicker] = useState(false);

  // Find latest article from category for fallback label
  const sliderBlock = containerBlocks.find(b => (b.type === 'SLIDER' || b.type === 'VERTICAL') && b.autoFillCategory);
  const autoCategory = sliderBlock?.autoFillCategory?.toLowerCase() || '';
  const latestArticle = autoCategory
    ? [...articles]
        .filter(a => a.status === 'published' && a.category?.toLowerCase() === autoCategory)
        .sort((a, b) => new Date((b as any).createdAt || 0).getTime() - new Date((a as any).createdAt || 0).getTime())[0]
    : undefined;

  // Banner image: always use the dedicated bannerImage field, never the article's coverImage
  const previewImg = block.bannerImage || '';

  return (
    <>
      <div className="relative h-[80px] rounded-lg overflow-hidden border border-green-500/30 group">
        {previewImg ? (
          previewImg.match(/\.(mp4|webm|mov)($|\?)/i) || previewImg.includes('/video/') ? (
            <video src={previewImg} className="absolute inset-0 w-full h-full object-cover opacity-80" muted autoPlay loop playsInline />
          ) : (
            <img src={previewImg} className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
          )
        ) : (
          <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center">
            <span className="text-[8px] text-green-400/60">No banner image set</span>
          </div>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
          <span className="text-[7px] font-bold text-green-400 bg-black/60 px-1.5 py-0.5 rounded">FIXED BANNER</span>
          <span className="text-[7px] text-white/60 bg-black/40 px-1 rounded text-center">
            {previewImg ? 'Custom image' : (latestArticle?.title?.slice(0, 30) || 'Auto: neuester Artikel')}
          </span>
        </div>
        {/* Image picker button */}
        <button
          onClick={() => setShowPicker(true)}
          className="absolute bottom-1 left-1 flex items-center gap-1 px-1.5 py-0.5 bg-green-600/90 hover:bg-green-600 text-white rounded text-[7px] font-bold"
        >
          <Upload className="w-2.5 h-2.5" />
          {previewImg ? 'Change' : 'Set Image'}
        </button>
        {/* Remove banner image */}
        {previewImg && (
          <button
            onClick={() => onUpdateBlock(index, bIdx, { bannerImage: '' })}
            className="absolute bottom-1 left-14 flex items-center gap-1 px-1.5 py-0.5 bg-gray-600/90 hover:bg-gray-600 text-white rounded text-[7px] font-bold"
          >
            <X className="w-2.5 h-2.5" />
            Clear
          </button>
        )}
        <button 
          onClick={() => onRemoveBlock(index, bIdx)} 
          className="absolute top-1 right-1 text-white hover:text-red-300 bg-red-500/80 hover:bg-red-500 rounded p-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {showPicker && typeof window !== 'undefined' && createPortal(
        <ImagePickerModal
          isOpen={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(url: string) => {
            onUpdateBlock(index, bIdx, { bannerImage: url });
            setShowPicker(false);
          }}
          currentImage={previewImg}
          searchTerm={autoCategory || 'banner'}
          showAiGenerate={true}
          aiPromptContext={`Fixed banner image for a ${autoCategory || 'content'} section`}
        />,
        document.body
      )}
    </>
  );
}

export default function ContainerBlock({
  index,
  containerName,
  containerBlocks,
  containerTheme = 'cream',
  articles,
  onUpdateName,
  onUpdateTheme,
  onRemove,
  onAddBlock,
  onRemoveBlock,
  onUpdateBlock,
  onMoveBlock,
  onAddContainer,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  excludeIds,
  isGlobalLatest,
  bannerCategories,
  customColor,
}: ContainerBlockProps) {
  const [showThemePicker, setShowThemePicker] = useState(false);

  // Support custom colors - if theme is 'custom' and customColor is set, use that
  const baseTheme = CONTAINER_THEMES[containerTheme] || CONTAINER_THEMES.cream;
  const theme = containerTheme === 'custom' && customColor
    ? { bg: '', border: '', label: 'Custom', color: customColor }
    : baseTheme;
  const useCustomStyle = containerTheme === 'custom' && customColor;

  return (
    <div 
      className={`col-span-6 border-2 border-dashed rounded-lg p-2 ${useCustomStyle ? '' : `${theme.border} ${theme.bg}`}`}
      style={useCustomStyle ? { backgroundColor: customColor, borderColor: customColor } : undefined}
    >
      {/* Container Header */}
      <div className="flex items-center gap-1 mb-2">
        {/* Move buttons */}
        <div className="flex flex-col gap-0.5">
          <button 
            onClick={() => onMoveUp?.(index)} 
            disabled={isFirst}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-3 h-3" />
          </button>
          <button 
            onClick={() => onMoveDown?.(index)} 
            disabled={isLast}
            className="text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        
        {/* Theme picker */}
        <div className="relative">
          <button 
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="p-1 rounded hover:bg-white/10"
            title="Change theme"
          >
            <Palette className="w-3 h-3" style={{ color: theme.color }} />
          </button>
          {showThemePicker && (
            <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg p-2.5 z-50 w-56">
              <div className="text-[8px] text-gray-500 uppercase mb-1">Original</div>
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => { onUpdateTheme?.(index, 'cream'); setShowThemePicker(false); }}
                  className={`w-6 h-6 rounded border border-gray-600 ${containerTheme === 'cream' ? 'ring-2 ring-white' : ''}`}
                  style={{ backgroundColor: '#F5F0E8' }}
                  title="Original (Cream)"
                />
              </div>
              <div className="text-[8px] text-gray-500 uppercase mb-1">Highlight</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(CONTAINER_THEMES).slice(1, -1).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => { onUpdateTheme?.(index, key as ContainerTheme); setShowThemePicker(false); }}
                    className={`w-5 h-5 rounded ${containerTheme === key ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : 'hover:scale-110'} transition-transform`}
                    style={{ backgroundColor: t.color }}
                    title={t.label}
                  />
                ))}
              </div>
              <div className="text-[8px] text-gray-500 uppercase mb-1">Custom Color</div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  defaultValue={customColor || theme.color}
                  onChange={(e) => {
                    const color = e.target.value;
                    // Check if it matches an existing theme
                    const match = Object.entries(CONTAINER_THEMES).find(([key, t]) => key !== 'custom' && t.color.toLowerCase() === color.toLowerCase());
                    if (match) {
                      onUpdateTheme?.(index, match[0] as ContainerTheme);
                    } else {
                      // Use custom color
                      onUpdateTheme?.(index, 'custom', color);
                    }
                    setShowThemePicker(false);
                  }}
                  className="w-8 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Pick custom color"
                />
                <span className="text-[9px] text-gray-400">Pick any color</span>
              </div>
            </div>
          )}
        </div>
        
        <input
          type="text"
          value={containerName}
          onChange={(e) => onUpdateName(index, e.target.value)}
          className={`flex-1 bg-transparent px-1 py-0.5 text-[10px] font-bold border-b focus:outline-none uppercase tracking-wider ${containerTheme === 'cream' ? 'text-[#D4873A] border-[#D4873A]/30' : 'text-white border-white/30'}`}
          placeholder="SECTION NAME"
        />
        <button 
          onClick={() => onRemove(index)} 
          className="text-red-400 hover:text-red-300"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Blocks */}
      <div className="space-y-1">
        {(() => {
          // Shared resolver — identical selection + waterfall dedup as the live feed
          const { perBlock } = resolveContainer(containerName, containerTheme, containerBlocks, articles, excludeIds || new Set(), isGlobalLatest, bannerCategories || new Set());
          return containerBlocks.map((block, bIdx) => {
          const resolved = perBlock[bIdx] || { type: block.type };
          const art1 = (resolved.main || resolved.left) as SimpleArticle | null | undefined;
          const art2 = resolved.right as SimpleArticle | null | undefined;

          return (
            <div 
              key={bIdx} 
              className="relative rounded overflow-hidden group/block"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const articleId = e.dataTransfer.getData('articleId');
                if (!articleId) return;
                
                if (block.type === '2H') {
                  if (!block.articleId) {
                    onUpdateBlock(index, bIdx, { articleId });
                  } else if (!block.articleId2) {
                    onUpdateBlock(index, bIdx, { articleId2: articleId });
                  }
                } else if (block.type !== 'FIXED') {
                  onUpdateBlock(index, bIdx, { articleId });
                }
              }}
            >
              {/* MAIN Block */}
              {block.type === 'MAIN' && (
                <div className="relative h-[90px] rounded-lg overflow-hidden">
                  {art1?.coverImage ? (
                    <>
                      <img src={art1.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${(art1 as any).imagePosX ?? 50}% ${(art1 as any).imagePosY ?? 50}%` }} alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-1 left-1 right-6">
                        <span className="text-[7px] font-bold text-[#D4873A] bg-black/50 px-1 rounded">MAIN</span>
                        <div className="text-[8px] text-white font-bold mt-0.5 line-clamp-2">{art1.title}</div>
                      </div>
                    </>
                  ) : art1 ? (
                    <div className="flex flex-col items-center justify-center h-full bg-[#D4873A]/20 p-1">
                      <span className="text-[7px] font-bold text-[#D4873A] bg-black/40 px-1 rounded">MAIN · no image</span>
                      <div className="text-[8px] text-white font-bold mt-0.5 line-clamp-2 text-center">{art1.title}</div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-[#D4873A]/10 border border-dashed border-[#D4873A]/30">
                      <div className="text-center">
                        <span className="text-[8px] text-[#D4873A] font-bold">MAIN</span>
                        <div className="text-[7px] text-gray-400">Drop article</div>
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={() => onRemoveBlock(index, bIdx)} 
                    className="absolute top-1 right-1 text-white/70 hover:text-white bg-black/30 rounded p-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {/* 2H Block */}
              {block.type === '2H' && (
                <div className="relative grid grid-cols-2 gap-1 h-[70px]">
                  <div className="relative rounded-lg overflow-hidden">
                    {art1?.coverImage ? (
                      <>
                        <img src={art1.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${(art1 as any).imagePosX ?? 50}% ${(art1 as any).imagePosY ?? 50}%` }} alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-0.5 left-0.5 right-0.5 text-[6px] text-white font-bold truncate">{art1.title}</div>
                      </>
                    ) : art1 ? (
                      <div className="flex items-center justify-center h-full bg-pink-500/20 p-0.5 text-[6px] text-white font-bold text-center line-clamp-3">{art1.title}</div>
                    ) : (
                      <div className="flex items-center justify-center h-full bg-pink-500/10 border border-dashed border-pink-500/30 text-[7px] text-gray-400">Drop 1</div>
                    )}
                  </div>
                  <div className="relative rounded-lg overflow-hidden">
                    {art2?.coverImage ? (
                      <>
                        <img src={art2.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${(art2 as any).imagePosX ?? 50}% ${(art2 as any).imagePosY ?? 50}%` }} alt="" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-0.5 left-0.5 right-0.5 text-[6px] text-white font-bold truncate">{art2.title}</div>
                      </>
                    ) : art2 ? (
                      <div className="flex items-center justify-center h-full bg-pink-500/20 p-0.5 text-[6px] text-white font-bold text-center line-clamp-3">{art2.title}</div>
                    ) : (
                      <div className="flex items-center justify-center h-full bg-pink-500/10 border border-dashed border-pink-500/30 text-[7px] text-gray-400">Drop 2</div>
                    )}
                  </div>
                  <button 
                    onClick={() => onRemoveBlock(index, bIdx)} 
                    className="absolute top-1 right-1 text-white/70 hover:text-white bg-black/30 rounded p-0.5 z-10"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {/* SOCIAL Block */}
              {block.type === 'SOCIAL' && (
                <div className="relative h-[120px] rounded-lg overflow-hidden">
                  {art1?.coverImage ? (
                    <>
                      <img src={art1.coverImage} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: `${(art1 as any).imagePosX ?? 50}% ${(art1 as any).imagePosY ?? 50}%` }} alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute bottom-1 left-1 right-6">
                        <span className="text-[7px] font-bold text-teal-400 bg-black/50 px-1 rounded">SOCIAL</span>
                        <div className="text-[8px] text-white font-bold mt-0.5 line-clamp-2">{art1.title}</div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-teal-500/10 border border-dashed border-teal-500/30">
                      <div className="text-center">
                        <span className="text-[8px] text-teal-400 font-bold">SOCIAL</span>
                        <div className="text-[7px] text-gray-400">Drop article</div>
                      </div>
                    </div>
                  )}
                  <button 
                    onClick={() => onRemoveBlock(index, bIdx)} 
                    className="absolute top-1 right-1 text-white/70 hover:text-white bg-black/30 rounded p-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {/* FIXED Block - with image upload */}
              {block.type === 'FIXED' && (
                <FixedBannerBlock
                  block={block}
                  index={index}
                  bIdx={bIdx}
                  onUpdateBlock={onUpdateBlock}
                  onRemoveBlock={onRemoveBlock}
                  articles={articles}
                  containerBlocks={containerBlocks}
                />
              )}

              {/* Block move buttons - appear on hover */}
              {onMoveBlock && (
                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity z-20 px-0.5">
                  <button
                    type="button"
                    onClick={() => onMoveBlock(index, bIdx, 'up')}
                    disabled={bIdx === 0}
                    className="bg-black/60 hover:bg-black/80 rounded p-0.5 disabled:opacity-20"
                  >
                    <ChevronUp className="w-2.5 h-2.5 text-white" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveBlock(index, bIdx, 'down')}
                    disabled={bIdx === containerBlocks.length - 1}
                    className="bg-black/60 hover:bg-black/80 rounded p-0.5 disabled:opacity-20"
                  >
                    <ChevronDown className="w-2.5 h-2.5 text-white" />
                  </button>
                </div>
              )}

              {/* SLIDER Block - with category selection */}
              {block.type === 'SLIDER' && (() => {
                // Use shared resolver result (respects cross-container waterfall dedup)
                const cat = block.autoFillCategory?.toLowerCase() || '';
                const previewArticles = ((resolved.vertical || []) as SimpleArticle[]).slice(0, 5);
                
                return (
                  <div className="relative rounded-lg overflow-hidden bg-gray-800 border border-cyan-500 p-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-cyan-400 font-bold">SLIDER</span>
                        <button 
                          onClick={() => onRemoveBlock(index, bIdx)} 
                          className="text-red-400 hover:text-red-300 bg-red-500/20 rounded p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] text-gray-400">Kategorie:</span>
                        <select
                          value={block.autoFillCategory || ''}
                          onChange={(e) => {
                            const cat = e.target.value;
                            onUpdateBlock(index, bIdx, { 
                              autoFill: cat ? 'category' : undefined,
                              autoFillCategory: cat || undefined
                            });
                          }}
                          className="bg-gray-700 text-[9px] text-white px-2 py-1 rounded border border-cyan-500/50 flex-1"
                        >
                          <option value="">-- Wähle Kategorie --</option>
                          {CATEGORIES.map(cat => (
                            <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                          ))}
                        </select>
                        <select
                          value={block.autoFillLimit || 10}
                          onChange={(e) => onUpdateBlock(index, bIdx, { autoFillLimit: parseInt(e.target.value) })}
                          className="bg-gray-700 text-[9px] text-white px-1 py-1 rounded border border-cyan-500/50 w-12"
                        >
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="20">20</option>
                        </select>
                      </div>
                      {block.autoFillCategory && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-green-400 font-bold">✓ AUTO: {block.autoFillCategory.toUpperCase()}</span>
                            <span className="text-[7px] text-cyan-300">({previewArticles.length > 0 ? `${previewArticles.length}+ Artikel` : 'Keine Artikel'})</span>
                          </div>
                          {/* Preview thumbnails - real articles from category */}
                          {previewArticles.length > 0 && (
                            <div className="flex gap-1 mt-1 overflow-hidden">
                              {previewArticles.map((art, i) => (
                                <div key={i} className="w-8 h-8 rounded overflow-hidden flex-shrink-0 border border-cyan-500/30">
                                  <img src={art.coverImage} className="w-full h-full object-cover" alt="" />
                                </div>
                              ))}
                              {(block.autoFillLimit || 10) > 5 && (
                                <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                  <span className="text-[7px] text-cyan-400">+{(block.autoFillLimit || 10) - 5}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* VERTICAL Block - shows list of articles with auto-fill option */}
              {block.type === 'VERTICAL' && (() => {
                const cat = block.autoFillCategory?.toLowerCase() || '';
                // Use shared resolver result (respects cross-container waterfall dedup)
                const vertArticles = (resolved.vertical || []) as SimpleArticle[];
                
                return (
                  <div 
                    className="relative rounded-lg overflow-hidden bg-indigo-500/10 border border-indigo-500/30 p-2 transition-all"
                    onDragOver={(e) => {
                      if (cat) return; // No drag when auto-fill is active
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-500/20');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-500/20');
                    }}
                    onDrop={(e) => {
                      if (cat) return; // No drag when auto-fill is active
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-500/20');
                      const articleId = e.dataTransfer.getData('articleId');
                      if (articleId) {
                        const currentArticles = block.articles || [];
                        if (!currentArticles.includes(articleId)) {
                          onUpdateBlock(index, bIdx, { articles: [...currentArticles, articleId] });
                        }
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] text-indigo-400 font-bold">VERTICAL ({vertArticles.length})</span>
                      <button 
                        onClick={() => onRemoveBlock(index, bIdx)} 
                        className="text-red-400 hover:text-red-300 bg-red-500/20 rounded p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    
                    {/* Auto-fill category selector */}
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[7px] text-gray-400">Auto:</span>
                      <select
                        value={block.autoFillCategory || ''}
                        onChange={(e) => {
                          const newCat = e.target.value;
                          onUpdateBlock(index, bIdx, { 
                            autoFillCategory: newCat || undefined,
                            articles: newCat ? [] : block.articles // Clear manual if auto
                          });
                        }}
                        className="bg-gray-700 text-[8px] text-white px-1 py-0.5 rounded border border-indigo-500/50 flex-1"
                      >
                        <option value="">Manuell</option>
                        {CATEGORIES.map(cat => (
                          <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                        ))}
                      </select>
                      {cat && (
                        <select
                          value={block.autoFillLimit || 3}
                          onChange={(e) => onUpdateBlock(index, bIdx, { autoFillLimit: parseInt(e.target.value) })}
                          className="bg-gray-700 text-[8px] text-white px-1 py-0.5 rounded border border-indigo-500/50 w-10"
                        >
                          <option value="3">3</option>
                          <option value="5">5</option>
                          <option value="10">10</option>
                        </select>
                      )}
                    </div>
                    
                    {vertArticles.length > 0 ? (
                      <div className="space-y-1">
                        {vertArticles.slice(0, 3).map((art, i) => (
                          <div key={i} className="flex items-center gap-1 bg-gray-700/50 rounded p-0.5">
                            {art?.coverImage && (
                              <img src={art.coverImage} className="w-6 h-6 rounded object-cover" alt="" />
                            )}
                            <span className="text-[7px] text-white truncate flex-1">{art?.title}</span>
                            {!cat && (
                              <button 
                                onClick={() => {
                                  const newArticles = (block.articles || []).filter(id => id !== art?._id);
                                  onUpdateBlock(index, bIdx, { articles: newArticles });
                                }}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {vertArticles.length > 3 && (
                          <div className="text-[7px] text-indigo-300 text-center">+{vertArticles.length - 3} mehr</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[7px] text-gray-400 text-center py-2 border border-dashed border-indigo-500/30 rounded">
                        {cat ? 'Keine Artikel in Kategorie' : 'Artikel hierher ziehen'}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          );
          });
        })()}
      </div>

      {/* Add Block Buttons */}
      <div className="flex flex-wrap items-center gap-1 mt-2 pt-1 border-t border-amber-500/20">
        <button onClick={() => onAddBlock(index, 'MAIN')} className="px-1 py-0 bg-[#D4873A]/30 text-black rounded lowercase text-[6px] hover:bg-[#D4873A]/50">+MAIN</button>
        <button onClick={() => onAddBlock(index, '2H')} className="px-1 py-0 bg-pink-500/30 text-black rounded lowercase text-[6px] hover:bg-pink-500/50">+2H</button>
        <button onClick={() => onAddBlock(index, 'SOCIAL')} className="px-1 py-0 bg-teal-500/30 text-black rounded lowercase text-[6px] hover:bg-teal-500/50">+SOCIAL</button>
        <button onClick={() => onAddBlock(index, 'FIXED')} className="px-1 py-0 bg-green-500/30 text-black rounded lowercase text-[6px] hover:bg-green-500/50">+FIXED</button>
        <button onClick={() => onAddBlock(index, 'SLIDER')} className="px-1 py-0 bg-cyan-500/30 text-black rounded lowercase text-[6px] hover:bg-cyan-500/50">+SLIDER</button>
        <button onClick={() => onAddBlock(index, 'VERTICAL')} className="px-1 py-0 bg-indigo-500/30 text-black rounded lowercase text-[6px] hover:bg-indigo-500/50">+VERT</button>
        {/* Add new Container button */}
        <button 
          onClick={() => onAddContainer?.()}
          className="px-1 py-0 bg-amber-500/30 text-black rounded lowercase text-[6px] hover:bg-amber-500/50 border border-amber-500/50"
        >
          +CONTAINER
        </button>
      </div>
    </div>
  );
}
