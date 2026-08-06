"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Tv, Search, Clock, Globe, Film, ChevronLeft, ChevronRight } from "lucide-react";
import CountryFlag from "@/components/CountryFlag";
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
            <div className="relative rounded-lg overflow-hidden bg-gray-200 shadow-md">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Play icon on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                <Play className="w-10 h-10 text-white drop-shadow-lg" />
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


export default function TVPage() {
  const [videos, setVideos] = useState<TVVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'de' | 'en'>('all');

  const openVideo = (video: TVVideo) => {
    // Open directly on YouTube
    const url = video.youtubeId 
      ? `https://www.youtube.com/watch?v=${video.youtubeId}`
      : video.youtubeUrl;
    if (url) {
      window.open(url, '_blank');
    }
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

  if (loading) {
    return (
      <div className="h-full min-h-full bg-cream">
        <TVSkeleton />
      </div>
    );
  }

  return (
    <div className="h-full min-h-full bg-cream overflow-y-auto">
      {/* Header with Search & Language Filter */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Tv className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none uppercase">TV</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Movies, shows & more</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-1 max-w-md">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-cream border border-warm rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E36B11]"
            />
          </div>
          
          {/* Language Filter with Flags */}
          <div className="flex items-center gap-1 bg-cream border border-warm rounded-lg p-1">
            <button
              onClick={() => setLanguageFilter('all')}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                languageFilter === 'all' ? 'bg-[#E36B11] text-white' : 'text-gray-600 hover:bg-[#E36B11]/10'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setLanguageFilter('de')}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                languageFilter === 'de' ? 'bg-[#E36B11] text-white' : 'text-gray-600 hover:bg-[#E36B11]/10'
              }`}
            >
              <CountryFlag flag="DE" className="w-4 h-3 rounded-sm" />
            </button>
            <button
              onClick={() => setLanguageFilter('en')}
              className={`px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                languageFilter === 'en' ? 'bg-[#E36B11] text-white' : 'text-gray-600 hover:bg-[#E36B11]/10'
              }`}
            >
              <CountryFlag flag="GB" className="w-4 h-3 rounded-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Featured Video - Hero Card (Position 1) */}
        {(() => {
          const featuredVideo = videos.find(v => v.featuredPosition === 1);
          if (!featuredVideo) return null;
          return (
            <div 
              onClick={() => openVideo(featuredVideo)}
              className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-2xl"
            >
              <img
                src={featuredVideo.thumbnail}
                alt={featuredVideo.title}
                className="w-full aspect-video object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              
              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                {/* Badges row */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-[#E36B11] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Main Feature
                  </span>
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    {featuredVideo.category}
                  </span>
                </div>
                
                {/* Title */}
                <h2 className="text-white font-display text-2xl uppercase tracking-wide mb-2">
                  {featuredVideo.title}
                </h2>
                
                {/* Description */}
                {featuredVideo.description && (
                  <p className="text-white/70 text-sm line-clamp-2 mb-3 max-w-lg">
                    {featuredVideo.description}
                  </p>
                )}
                
                {/* Meta info */}
                <div className="flex items-center gap-4 text-white/80 text-xs">
                  {featuredVideo.duration && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {featuredVideo.duration}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    {featuredVideo.language === 'de' ? 'German' : 'English'}
                  </span>
                </div>
              </div>
              
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 bg-[#E36B11]/90 rounded-full flex items-center justify-center shadow-xl transform transition-all duration-300 group-hover:scale-110 group-hover:bg-[#E36B11]">
                  <Play className="w-10 h-10 text-white fill-current ml-1" />
                </div>
              </div>
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
    </div>
  );
}
