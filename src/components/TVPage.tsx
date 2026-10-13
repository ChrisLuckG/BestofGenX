"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Play, Tv, Search, Clock, Globe, Film, ChevronLeft, ChevronRight, X, ExternalLink } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
import BackButton from "@/components/BackButton";
import { TVSkeleton } from "@/components/desktop/DesktopSkeletons";

interface TVVideo {
  _id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  youtubeId: string;
  thumbnail: string;
  category: string;
  duration: string;
  language: 'de' | 'en';
  featured: boolean;
  featuredPosition?: number;
}

// Category Row with horizontal scroll and arrows
function CategoryRow({ category, videos, showSeparator, onVideoClick }: {
  category: string;
  videos: TVVideo[];
  showSeparator: boolean;
  onVideoClick: (video: TVVideo) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      // Calculate scroll progress (0-1)
      const maxScroll = scrollWidth - clientWidth;
      setScrollProgress(maxScroll > 0 ? scrollLeft / maxScroll : 0);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      return () => el.removeEventListener('scroll', checkScroll);
    }
  }, [videos]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div>
      {/* Category Separator */}
      {showSeparator && (
        <div className="flex items-center gap-3 mb-4 mt-2">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#E36B11]/30 to-transparent" />
        </div>
      )}
      
      {/* Category Header */}
      <div className="flex items-center gap-2 mb-3">
        <Film className="w-4 h-4 text-[#E36B11]" />
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{category}</h3>
        <span className="text-xs text-gray-400">({videos.length})</span>
      </div>
      
      {/* Videos Row with Arrows - Desktop only */}
      <div className="relative group/row">
        {/* Left Arrow - Desktop only, rounded-lg instead of rounded-full */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-14 rounded-xl bg-black/60 hover:bg-black/80 text-white shadow-lg items-center justify-center transition-all backdrop-blur-sm border border-white/10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        
        {/* Right Arrow - Desktop only, rounded-lg instead of rounded-full */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-14 rounded-xl bg-black/60 hover:bg-black/80 text-white shadow-lg items-center justify-center transition-all backdrop-blur-sm border border-white/10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        
        <div 
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 px-1" 
          style={{ scrollbarWidth: 'none' }}
        >
        {videos.map(video => (
          <div
            key={video._id}
            onClick={() => onVideoClick(video)}
            className="flex-shrink-0 w-40 cursor-pointer group"
          >
            <div className="fx-crt relative rounded-lg overflow-hidden bg-gray-200 shadow-md">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
              />

              {/* Play icon - subtle */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
              </div>
              {/* Duration badge */}
              {video.duration && (
                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                  {video.duration}
                </span>
              )}
              {/* Language flag */}
              <span className="absolute top-1 right-1">
                <CountryFlag flag={video.language === 'de' ? 'DE' : 'GB'} className="w-5 h-4 rounded-sm shadow-sm" />
              </span>
            </div>
            {/* Title OUTSIDE/below the video */}
            <h4 className="mt-1.5 font-display text-gray-900 text-sm uppercase tracking-wide line-clamp-2 leading-tight group-hover:text-[#E36B11] transition-colors">
              {video.title}
            </h4>
          </div>
        ))}
        </div>
        
        {/* Mobile scroll indicator - progress bar */}
        {videos.length > 2 && (
          <div className="md:hidden mt-2 flex justify-center">
            <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#E36B11] rounded-full transition-all duration-150"
                style={{ width: `${Math.max(20, scrollProgress * 100)}%`, marginLeft: `${scrollProgress * (100 - Math.max(20, scrollProgress * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


interface TVPageProps {
  /** Mobile: back to the Media hub. */
  onBack?: () => void;
  /** Open the player on this video once the list has loaded (Media hub teaser). */
  initialVideoId?: string | null;
}

export default function TVPage({ onBack, initialVideoId }: TVPageProps = {}) {
  const [videos, setVideos] = useState<TVVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'de' | 'en'>('all');
  const [playingVideo, setPlayingVideo] = useState<TVVideo | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);

  const openVideo = (video: TVVideo) => {
    // Open in internal player modal
    setPlayingVideo(video);
  };

  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [videosRes, categoriesRes] = await Promise.all([
          fetch('/api/tv'),
          fetch('/api/tv/categories'),
        ]);
        const [videosData, categoriesData] = await Promise.all([
          videosRes.json(),
          categoriesRes.json(),
        ]);
        if (videosData.success) setVideos(videosData.videos);
        if (categoriesData.success) {
          setCategoryOrder(categoriesData.categories.map((c: any) => c.name));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!initialVideoId) return;
    const video = videos.find(v => v._id === initialVideoId);
    if (video) setPlayingVideo(video);
  }, [initialVideoId, videos]);

  const filteredVideos = videos.filter(v => {
    const matchesSearch = !searchQuery || v.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLanguage = languageFilter === 'all' || v.language === languageFilter;
    return matchesSearch && matchesLanguage;
  });
  
  // Get categories in order from DB, only show categories that have videos
  const categoriesWithVideos = categoryOrder.filter(cat => 
    filteredVideos.some(v => v.category === cat)
  );
  // Add any categories from videos that aren't in the order list
  const extraCategories = Array.from(new Set(filteredVideos.map(v => v.category)))
    .filter(cat => !categoryOrder.includes(cat));
  const categories = [...categoriesWithVideos, ...extraCategories];
  
  const getVideosByCategory = (category: string) => 
    filteredVideos.filter(v => v.category === category);

  return (
    <div className="h-full min-h-full bg-cream overflow-y-auto">
      {/* Header - always visible */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="flex items-center gap-3">
          {onBack && <BackButton onClick={onBack} />}
          <Tv className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">TV</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Movies, shows & more</span>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="px-2 py-4">
          <TVSkeleton />
        </div>
      ) : (
      <div className="px-2 py-4 space-y-6">
        {/* Featured Videos - Hero Carousel (Position 1, 2, 3) */}
        {(() => {
          const featuredVideos = videos
            .filter(v => v.featuredPosition && v.featuredPosition >= 1 && v.featuredPosition <= 3)
            .sort((a, b) => (a.featuredPosition || 0) - (b.featuredPosition || 0));
          if (featuredVideos.length === 0) return null;
          
          const currentVideo = featuredVideos[heroIndex % featuredVideos.length];
          
          const activeIdx = heroIndex % featuredVideos.length;

          return (
            <div 
              onClick={() => openVideo(currentVideo)}
              className="fx-crt relative rounded-2xl overflow-hidden cursor-pointer group shadow-2xl"
            >
              {/* Backdrop stack: every slide is mounted and cross-fades, so switching
                  never flashes a blank frame while the next thumbnail loads. */}
              <div className="relative w-full aspect-video bg-black">
                {featuredVideos.map((v, idx) => (
                  <img
                    key={v._id}
                    src={v.thumbnail}
                    alt={idx === activeIdx ? v.title : ''}
                    aria-hidden={idx !== activeIdx}
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                      idx === activeIdx ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))}
              </div>

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-5 pr-5 md:pr-52">
                {/* Badges row */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#E36B11] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Main Feature
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {currentVideo.category}
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-white font-display text-2xl uppercase tracking-wide mb-2 line-clamp-2">
                  {currentVideo.title}
                </h2>

                {/* Description */}
                {currentVideo.description && (
                  <p className="text-white/70 text-sm line-clamp-2 mb-3 max-w-lg">
                    {currentVideo.description}
                  </p>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-4 text-white/80 text-xs">
                  {currentVideo.duration && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {currentVideo.duration}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    {currentVideo.language === 'de' ? 'German' : 'English'}
                  </span>
                </div>
              </div>

              {/* Play button overlay - subtle */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center shadow-xl transform transition-all duration-300 group-hover:scale-110">
                  <Play className="w-8 h-8 text-white fill-white ml-1" />
                </div>
              </div>

              {/* Thumbnail selector - sits ON the hero, bottom right */}
              {featuredVideos.length > 1 && (
                <div className="absolute bottom-4 right-4 flex gap-2">
                  {featuredVideos.map((v, idx) => (
                    <button
                      key={v._id}
                      onMouseEnter={() => setHeroIndex(idx)}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Already showing this slide? Then the click means "play it".
                        if (idx === activeIdx) openVideo(v);
                        else setHeroIndex(idx);
                      }}
                      title={v.title}
                      className={`relative w-24 aspect-video rounded-md overflow-hidden transition-all duration-300 ${
                        idx === activeIdx
                          ? 'ring-2 ring-[#E36B11] scale-105 opacity-100'
                          : 'ring-1 ring-white/30 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={v.thumbnail} alt="" className="w-full h-full object-cover" />
                      {idx !== activeIdx && <div className="absolute inset-0 bg-black/40" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Navigation Arrows */}
              {featuredVideos.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setHeroIndex(prev => (prev - 1 + featuredVideos.length) % featuredVideos.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setHeroIndex(prev => (prev + 1) % featuredVideos.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>
          );
        })()}

        {/* Category Sections */}
        {categories.map((category, idx) => {
          const categoryVideos = getVideosByCategory(category);
          if (categoryVideos.length === 0) return null;

          return (
            <CategoryRow 
              key={category}
              category={category}
              videos={categoryVideos}
              showSeparator={idx > 0}
              onVideoClick={openVideo}
            />
          );
        })}

        {/* Empty State */}
        {videos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Tv className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium">No videos yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}
      </div>
      )}

      {/* Video Player Modal - portal escapes the page's stacking contexts */}
      {playingVideo && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4"
          onClick={() => setPlayingVideo(null)}
        >
          <div 
            className="relative w-full max-w-5xl bg-black rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setPlayingVideo(null)}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* YouTube Embed */}
            <div className="aspect-video">
              <iframe
                src={`https://www.youtube.com/embed/${playingVideo.youtubeId}?autoplay=1&rel=0`}
                title={playingVideo.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            
            {/* Video Info */}
            <div className="p-4 bg-gray-900">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="text-white font-display text-lg tracking-wide">{playingVideo.title}</h3>
                  {playingVideo.description && (
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{playingVideo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    {playingVideo.category && (
                      <span className="text-[#E36B11] text-xs font-display">{playingVideo.category}</span>
                    )}
                    {playingVideo.duration && (
                      <span className="text-gray-500 text-xs flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {playingVideo.duration}
                      </span>
                    )}
                    <span className="text-gray-500 text-xs flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {playingVideo.language === 'de' ? 'German' : 'English'}
                    </span>
                  </div>
                </div>
                <a
                  href={`https://www.youtube.com/watch?v=${playingVideo.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  YouTube
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
