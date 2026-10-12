"use client";

import { X, Upload, ChevronUp, ChevronDown, Palette, Plus } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { resolveContainer } from "@/lib/containerFill";
import { useCategories, ensureCategory } from "@/hooks/useCategories";

const ImagePickerModal = dynamic(() => import("./ImagePickerModal"), { ssr: false });

// Available container themes
// cream = Original background color (no highlight)
// Others = Highlight colors for special sections
export const CONTAINER_THEMES = {
  // Original background - no styling
  cream: { bg: 'bg-[#F5F0E8]', border: 'border-[#E5DDD0]', label: 'Original (Cream)', color: '#F5F0E8' },
  // BOGX Orange - our brand color!
  bogx: { bg: 'bg-[#E36B11]', border: 'border-[#E5A55A]', label: 'BOGX Orange', color: '#E36B11' },
  // Highlight themes
  arcade: { bg: 'bg-purple-800', border: 'border-purple-500', label: 'Trivia', color: '#7c3aed' },
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
  type: 'MAIN' | '2H' | 'FIXED' | 'SLIDER' | 'VERTICAL' | 'SOCIAL' | 'VIDEO';
  articleId?: string | null;
  articleId2?: string | null;
  articles?: string[];
  bannerImage?: string;
  bannerLink?: string;
  showDateOverlay?: boolean; // Show TODAY/date overlay on banner
  autoFill?: 'latest' | 'history' | 'category';  // Auto-fill mode for SLIDER
  autoFillCategory?: string;  // Category filter for auto-fill
  autoFillLimit?: number;  // How many articles to show
  videoUrl?: string;  // YouTube/Twitch URL for VIDEO block
  videoTitle?: string;  // Title for VIDEO block
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

// One color + short plain-language explanation per block type. Used for the
// chip badge in BlockCard's header, the dot on the "+ MAIN / + 2H / ..."
// add-block buttons AND the tooltip on those buttons, so the explanation sits
// where you click instead of in a separate legend.
//
// Chips are deliberately LIGHT (bg-*-100 text-*-700) rather than saturated
// fills: every block sits on a white card inside a coloured container box, and
// saturated chips turned the editor into confetti. See the container box
// comment below for why that box keeps the theme colour.
const BLOCK_STYLES: Record<ContainerBlockType['type'], { chip: string; accent: string; desc: string }> = {
  MAIN: { chip: 'bg-[#E36B11]/10 text-[#E36B11]', accent: 'bg-[#E36B11]', desc: '1 big hero article' },
  '2H': { chip: 'bg-pink-100 text-pink-700', accent: 'bg-pink-500', desc: '2 articles side by side' },
  SOCIAL: { chip: 'bg-teal-100 text-teal-700', accent: 'bg-teal-500', desc: 'big article, social style' },
  FIXED: { chip: 'bg-green-100 text-green-700', accent: 'bg-green-500', desc: 'fixed banner image' },
  SLIDER: { chip: 'bg-cyan-100 text-cyan-700', accent: 'bg-cyan-500', desc: 'horizontal scroll, auto-fill by category' },
  VERTICAL: { chip: 'bg-indigo-100 text-indigo-700', accent: 'bg-indigo-500', desc: 'stacked list, auto-fill by category' },
  VIDEO: { chip: 'bg-red-100 text-red-700', accent: 'bg-red-500', desc: 'YouTube/Twitch embed' },
};

// Shared card shell every block type renders inside. Guarantees one header
// layout (type chip, extra slot, move up/down, remove) everywhere - previously
// each block type drew its own label and its own floating X over the artwork,
// at 7-8px, which is why no two blocks looked alike.
function BlockCard({
  type,
  index,
  bIdx,
  extra,
  onRemoveBlock,
  onMoveBlock,
  isFirst,
  isLast,
  onDragOver,
  onDrop,
  className = '',
  children,
}: {
  type: ContainerBlockType['type'];
  index: number;
  bIdx: number;
  extra?: React.ReactNode;
  onRemoveBlock: ContainerBlockProps['onRemoveBlock'];
  onMoveBlock?: ContainerBlockProps['onMoveBlock'];
  isFirst: boolean;
  isLast: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const style = BLOCK_STYLES[type];
  return (
    <div
      className={`relative bg-paper border border-gray-200 rounded-lg overflow-hidden group/block ${className}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${style.chip}`}>{type}</span>
          {extra}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onMoveBlock && (
            <>
              <button
                onClick={() => onMoveBlock(index, bIdx, 'up')}
                disabled={isFirst}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
                title="Move block up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onMoveBlock(index, bIdx, 'down')}
                disabled={isLast}
                className="text-gray-300 hover:text-gray-600 disabled:opacity-30"
                title="Move block down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={() => onRemoveBlock(index, bIdx)}
            className="text-gray-300 hover:text-red-500"
            title="Remove block"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

// Shared article thumbnail for MAIN / 2H / SOCIAL. Replaces three near-copies
// that each had their own empty-state and their own font sizes.
function ArticleThumb({
  article,
  placeholder,
  height = 'h-20',
}: {
  article: SimpleArticle | null | undefined;
  placeholder: string;
  height?: string;
}) {
  if (!article) {
    return (
      <div className={`${height} rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400`}>
        {placeholder}
      </div>
    );
  }
  return (
    <div className={`relative ${height} rounded overflow-hidden`}>
      {article.coverImage ? (
        <img
          src={article.coverImage}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `${(article as any).imagePosX ?? 50}% ${(article as any).imagePosY ?? 50}%` }}
          alt=""
        />
      ) : (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-xs text-gray-400">no image</div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute bottom-1 left-1.5 right-1.5 text-xs text-paper font-medium truncate">{article.title}</div>
    </div>
  );
}

// VERTICAL preview row: a SQUARE thumbnail beside the title, not a full-width
// banner. A banner is wrong here twice over - the live feed renders VERTICAL as a
// stacked list with a small thumbnail, and a full-width 56px strip makes
// object-cover crop a portrait down to a slice of forehead.
function ArticleRow({
  article,
  onRemove,
}: {
  article: SimpleArticle | null | undefined;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 p-1 group/item">
      <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
        {article?.coverImage ? (
          <img
            src={article.coverImage}
            className="w-full h-full object-cover"
            style={{ objectPosition: `${(article as any)?.imagePosX ?? 50}% ${(article as any)?.imagePosY ?? 50}%` }}
            alt=""
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[9px] text-gray-400">—</div>
        )}
      </div>
      <span className="flex-1 min-w-0 text-xs text-gray-700 truncate">{article?.title || 'Untitled'}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100"
          title="Remove from list"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// Sub-component for FIXED banner with image upload + AI generation
function FixedBannerBlock({ 
  block, 
  index, 
  bIdx, 
  onUpdateBlock, 
  onRemoveBlock,
  onMoveBlock,
  isFirst,
  isLast,
  articles,
  containerBlocks,
}: { 
  block: ContainerBlockType; 
  index: number; 
  bIdx: number; 
  onUpdateBlock: ContainerBlockProps['onUpdateBlock']; 
  onRemoveBlock: ContainerBlockProps['onRemoveBlock'];
  onMoveBlock?: ContainerBlockProps['onMoveBlock'];
  isFirst: boolean;
  isLast: boolean;
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
    <BlockCard
      type="FIXED"
      index={index}
      bIdx={bIdx}
      onRemoveBlock={onRemoveBlock}
      onMoveBlock={onMoveBlock}
      isFirst={isFirst}
      isLast={isLast}
    >
      {/* A banner can be a video, not only an image - kept from the previous
          version, the reference app only handles images here. */}
      <div className="relative h-20 rounded overflow-hidden bg-gray-50 border border-gray-200">
        {previewImg ? (
          previewImg.match(/\.(mp4|webm|mov)($|\?)/i) || previewImg.includes('/video/') ? (
            <video src={previewImg} className="absolute inset-0 w-full h-full object-cover" muted autoPlay loop playsInline />
          ) : (
            <img src={previewImg} className="absolute inset-0 w-full h-full object-cover" alt="" />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400">
            {latestArticle?.title ? `Auto: ${latestArticle.title}` : 'No banner image set'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1 px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-medium"
        >
          <Upload className="w-3 h-3" /> {previewImg ? 'Change image' : 'Set image'}
        </button>
        {previewImg && (
          <button
            onClick={() => onUpdateBlock(index, bIdx, { bannerImage: '' })}
            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs"
          >
            Clear
          </button>
        )}
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
    </BlockCard>
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
  // Merged static + dynamically created categories. Each ContainerBlock
  // subscribes on its own and refetches on 'categories-updated', so renaming
  // one container updates the auto-fill dropdowns in all the others.
  const categories = useCategories();

  // Support custom colors - if theme is 'custom' and customColor is set, use that
  const baseTheme = CONTAINER_THEMES[containerTheme] || CONTAINER_THEMES.cream;
  const theme = containerTheme === 'custom' && customColor
    ? { bg: '', border: '', label: 'Custom', color: customColor }
    : baseTheme;
  const useCustomStyle = containerTheme === 'custom' && customColor;

  return (
    // The whole container box keeps the THEME's bg/border colour, even for
    // 'cream' - it previews the section colour the live feed will render, so a
    // neutral grey box here would hide what you just picked. What used to make
    // this look like a flat brown mush was NOT this box: `bg-white` resolves to
    // #F5F0E8 in this project (tailwind.config.ts overrides `white` to cream for
    // the public app), so the cards INSIDE the cream box were cream too and all
    // contrast was gone. Everything in admin/ therefore uses `bg-paper` (real
    // #FFFFFF) - do not "fix" these back to bg-white.
    <>
    <div 
      className={`border-2 border-dashed rounded-xl p-4 ${useCustomStyle ? '' : `${theme.border} ${theme.bg}`}`}
      style={useCustomStyle ? { backgroundColor: customColor, borderColor: customColor } : undefined}
    >
      {/* Container header - name input flush left, every icon control grouped
          on the right instead of crowding in before the name. */}
      <div className="flex items-center gap-2 mb-3">
        {/* Renaming a container is how a new category is born: the name is
            slugified and becomes the container's auto-fill slug (see
            getAutoFillSlugs), so a matching Category row has to exist or the
            slug would auto-fill but be unassignable in the article dropdowns.
            Fires on BLUR, not on change - committing per keystroke would turn
            "EisHockey" into nine categories. */}
        <input
          type="text"
          value={containerName}
          onChange={(e) => onUpdateName(index, e.target.value)}
          onBlur={(e) => ensureCategory(e.target.value)}
          className="flex-1 min-w-0 bg-paper border border-gray-200 rounded px-2 py-1 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#E36B11]"
          placeholder="SECTION NAME"
        />

        <div className="flex items-center bg-paper border border-gray-200 rounded flex-shrink-0">
          <button
            onClick={() => onMoveUp?.(index)}
            disabled={isFirst}
            className="p-0.5 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
            title="Move container up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onMoveDown?.(index)}
            disabled={isLast}
            className="p-0.5 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
            title="Move container down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Theme picker */}
          <div className="relative">
            <button 
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="p-0.5 rounded hover:bg-gray-100"
              title="Change colour"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: theme.color }} />
            </button>
          {showThemePicker && (
            <div className="absolute top-full right-0 mt-1 bg-paper border border-gray-200 shadow-lg rounded-lg p-2.5 z-50 w-56">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Original</div>
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => { onUpdateTheme?.(index, 'cream'); setShowThemePicker(false); }}
                  className={`w-6 h-6 rounded border border-gray-300 ${containerTheme === 'cream' ? 'ring-2 ring-[#E36B11]' : ''}`}
                  style={{ backgroundColor: '#F5F0E8' }}
                  title="Original (Cream)"
                />
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Highlight</div>
              <div className="flex flex-wrap gap-1 mb-2">
                {Object.entries(CONTAINER_THEMES).slice(1, -1).map(([key, t]) => (
                  <button
                    key={key}
                    onClick={() => { onUpdateTheme?.(index, key as ContainerTheme); setShowThemePicker(false); }}
                    className={`w-5 h-5 rounded ${containerTheme === key ? 'ring-2 ring-[#E36B11] ring-offset-1 ring-offset-white' : 'hover:scale-110'} transition-transform`}
                    style={{ backgroundColor: t.color }}
                    title={t.label}
                  />
                ))}
              </div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Custom Color</div>
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

          <button
            onClick={() => onRemove(index)}
            className="p-0.5 rounded text-gray-400 hover:bg-red-50 hover:text-red-500"
            title="Delete container"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-2">
        {(() => {
          // Shared resolver — identical selection + waterfall dedup as the live feed
          const { perBlock } = resolveContainer(containerName, containerTheme, containerBlocks, articles, excludeIds || new Set(), isGlobalLatest, bannerCategories || new Set());
          return containerBlocks.map((block, bIdx) => {
          const resolved = perBlock[bIdx] || { type: block.type };
          const art1 = (resolved.main || resolved.left) as SimpleArticle | null | undefined;
          const art2 = resolved.right as SimpleArticle | null | undefined;

          const isFirstBlock = bIdx === 0;
          const isLastBlock = bIdx === containerBlocks.length - 1;
          const cat = block.autoFillCategory?.toLowerCase() || '';

          // Drop target only for the types that hold a single article reference.
          // FIXED has its own banner field, SLIDER/VERTICAL manage their own list.
          const dragProps = {
            onDragOver: (e: React.DragEvent) => e.preventDefault(),
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              e.stopPropagation();
              const articleId = e.dataTransfer.getData('articleId');
              if (!articleId) return;
              if (block.type === '2H') {
                if (!block.articleId) onUpdateBlock(index, bIdx, { articleId });
                else if (!block.articleId2) onUpdateBlock(index, bIdx, { articleId2: articleId });
              } else if (block.type !== 'FIXED') {
                onUpdateBlock(index, bIdx, { articleId });
              }
            },
          };

          if (block.type === 'MAIN' || block.type === 'SOCIAL') {
            return (
              <BlockCard
                key={bIdx}
                type={block.type}
                index={index}
                bIdx={bIdx}
                onRemoveBlock={onRemoveBlock}
                onMoveBlock={onMoveBlock}
                isFirst={isFirstBlock}
                isLast={isLastBlock}
                {...dragProps}
              >
                <ArticleThumb
                  article={art1}
                  placeholder="Drag an article here"
                  height={block.type === 'SOCIAL' ? 'h-[120px]' : 'h-[90px]'}
                />
              </BlockCard>
            );
          }

          if (block.type === '2H') {
            return (
              <BlockCard
                key={bIdx}
                type="2H"
                index={index}
                bIdx={bIdx}
                onRemoveBlock={onRemoveBlock}
                onMoveBlock={onMoveBlock}
                isFirst={isFirstBlock}
                isLast={isLastBlock}
                {...dragProps}
              >
                <div className="grid grid-cols-2 gap-1.5">
                  <ArticleThumb article={art1} placeholder="Drop 1" height="h-[70px]" />
                  <ArticleThumb article={art2} placeholder="Drop 2" height="h-[70px]" />
                </div>
              </BlockCard>
            );
          }

          if (block.type === 'FIXED') {
            return (
              <FixedBannerBlock
                key={bIdx}
                block={block}
                index={index}
                bIdx={bIdx}
                onUpdateBlock={onUpdateBlock}
                onRemoveBlock={onRemoveBlock}
                onMoveBlock={onMoveBlock}
                isFirst={isFirstBlock}
                isLast={isLastBlock}
                articles={articles}
                containerBlocks={containerBlocks}
              />
            );
          }

          if (block.type === 'SLIDER' || block.type === 'VERTICAL') {
            const isVertical = block.type === 'VERTICAL';
            const list = (resolved.vertical || []) as SimpleArticle[];

            // A category-filled list is not a drop target: the dropped article
            // would be replaced by the auto-fill on the next render.
            const listDrag = cat
              ? {}
              : {
                  onDragOver: (e: React.DragEvent) => e.preventDefault(),
                  onDrop: (e: React.DragEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const articleId = e.dataTransfer.getData('articleId');
                    if (!articleId) return;
                    const current = block.articles || [];
                    if (!current.includes(articleId)) {
                      onUpdateBlock(index, bIdx, { articles: [...current, articleId] });
                    }
                  },
                };

            return (
              <BlockCard
                key={bIdx}
                type={block.type}
                index={index}
                bIdx={bIdx}
                onRemoveBlock={onRemoveBlock}
                onMoveBlock={onMoveBlock}
                isFirst={isFirstBlock}
                isLast={isLastBlock}
                extra={
                  <div className="flex items-center gap-1.5 min-w-0">
                    <select
                      value={block.autoFillCategory || ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        onUpdateBlock(index, bIdx, {
                          autoFill: next ? 'category' : undefined,
                          autoFillCategory: next || undefined,
                          // Choosing a category replaces a manual VERTICAL list so
                          // the two cannot silently disagree.
                          articles: isVertical && next ? [] : block.articles,
                        });
                      }}
                      className="bg-paper border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700 max-w-[150px]"
                    >
                      <option value="">{isVertical ? 'Manual' : '-- Category --'}</option>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>{c.label}</option>
                      ))}
                    </select>
                    {(!isVertical || cat) && (
                      <select
                        value={block.autoFillLimit || (isVertical ? 3 : 10)}
                        onChange={(e) => onUpdateBlock(index, bIdx, { autoFillLimit: parseInt(e.target.value) })}
                        className="bg-paper border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-700 w-14"
                      >
                        {(isVertical ? [3, 5, 10] : [5, 10, 20]).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    )}
                    {cat && (
                      <span className="text-[10px] text-green-600 font-medium whitespace-nowrap">
                        auto · {list.length}
                      </span>
                    )}
                  </div>
                }
                {...listDrag}
              >
                {list.length > 0 ? (
                  isVertical ? (
                    // Stacked rows - square thumb + title, mirroring the live list.
                    <div className="space-y-1">
                      {list.map((art, i) => (
                        <ArticleRow
                          key={i}
                          article={art}
                          onRemove={
                            cat
                              ? undefined
                              : () =>
                                  onUpdateBlock(index, bIdx, {
                                    articles: (block.articles || []).filter((id) => id !== art?._id),
                                  })
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    // SLIDER: landscape cards, so a 16:9 crop is the right shape.
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {list.map((art, i) => (
                        <div key={i} className="w-28 flex-shrink-0">
                          <ArticleThumb article={art} placeholder="" height="h-16" />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="h-16 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                    {cat ? 'No articles in this category' : 'Drag articles here'}
                  </div>
                )}
              </BlockCard>
            );
          }

          if (block.type === 'VIDEO') {
            return (
              <BlockCard
                key={bIdx}
                type="VIDEO"
                index={index}
                bIdx={bIdx}
                onRemoveBlock={onRemoveBlock}
                onMoveBlock={onMoveBlock}
                isFirst={isFirstBlock}
                isLast={isLastBlock}
              >
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="YouTube/Twitch URL..."
                    value={block.videoUrl || ''}
                    onChange={(e) => onUpdateBlock(index, bIdx, { videoUrl: e.target.value })}
                    className="w-full bg-paper border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
                  />
                  <input
                    type="text"
                    placeholder="Title (e.g. 'LIVE: GenX Radio')"
                    value={block.videoTitle || ''}
                    onChange={(e) => onUpdateBlock(index, bIdx, { videoTitle: e.target.value })}
                    className="w-full bg-paper border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900"
                  />
                </div>
              </BlockCard>
            );
          }

          return null;
          });
        })()}
      </div>

    </div>

    {/* Add-block toolbar - OUTSIDE the colored container */}
    <div className="flex flex-col items-center gap-1 mt-2">
      <div className="flex flex-wrap justify-center gap-4">
        {(['MAIN', '2H', 'SOCIAL', 'FIXED', 'SLIDER', 'VERTICAL', 'VIDEO'] as const).map((t) => (
          <div key={t} className="relative group">
            <button
              onClick={() => onAddBlock(index, t)}
              className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${BLOCK_STYLES[t].accent}`} />
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </button>
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-nowrap">
              <div className="bg-gray-900 text-paper text-[9px] px-1.5 py-0.5 rounded shadow-lg">
                {BLOCK_STYLES[t].desc}
              </div>
              <div className="w-1.5 h-1.5 bg-gray-900 rotate-45 mx-auto -mt-0.5" />
            </div>
          </div>
        ))}
      </div>
      <button 
        onClick={() => onAddContainer?.()}
        className="flex items-center gap-1 text-[10px] text-gray-300 hover:text-[#E36B11]"
        title="Add a new section below"
      >
        <Plus className="w-3 h-3" />
        New Section
      </button>
    </div>
    </>
  );
}
