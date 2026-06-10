"use client";

import { Play, Heart, MessageCircle, Share2, Music2 } from "lucide-react";

interface VideoCardProps {
  title: string;
  sport: string;
  youtubeId?: string;
  thumbnailUrl?: string;
}

export default function VideoCard({ title, sport, youtubeId, thumbnailUrl }: VideoCardProps) {
  const handlePlayClick = () => {
    if (youtubeId) {
      window.open(`https://www.youtube.com/watch?v=${youtubeId}`, '_blank');
    }
  };

  const handleShare = async () => {
    const url = youtubeId ? `https://www.youtube.com/watch?v=${youtubeId}` : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (e) {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(url);
      alert('Link copied!');
    }
  };

  // YouTube Thumbnail URL - nutze maxresdefault für beste Qualität
  const thumbnail = thumbnailUrl || (youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : null);

  return (
    <div className="w-full h-full bg-gradient-to-b from-sport-card to-sport-bg flex flex-col relative">
      {/* Video area */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {thumbnail ? (
          <>
            {/* Thumbnail Image */}
            <img
              src={thumbnail}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/30" />
            {/* Play button */}
            <button
              onClick={handlePlayClick}
              className="relative w-20 h-20 rounded-full bg-sport/90 flex items-center justify-center cursor-pointer hover:scale-110 hover:bg-sport transition-all shadow-lg z-10"
            >
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            </button>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-sport/20 to-black/40" />
            <div className="w-20 h-20 rounded-full bg-cream/20 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            </div>
          </>
        )}

        {/* Sport badge */}
        <div className="absolute top-4 left-4 px-3 py-1 bg-sport/80 rounded-full text-xs font-bold z-10">
          {sport}
        </div>
      </div>

      {/* Video info */}
      <div className="absolute bottom-20 left-4 right-16">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-gray-600 text-sm mt-1">@sporttock_official</p>
        
        {/* Music ticker */}
        <div className="flex items-center gap-2 mt-3">
          <Music2 className="w-4 h-4" />
          <p className="text-xs text-gray-300 truncate">Original Sound - SportTock</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="absolute right-3 bottom-24 flex flex-col gap-5">
        <button className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <span className="text-xs">24.5K</span>
        </button>
        
        <button className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <span className="text-xs">1.2K</span>
        </button>
        
        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <span className="text-xs">Share</span>
        </button>
      </div>
    </div>
  );
}
