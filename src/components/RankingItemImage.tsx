"use client";

import { useState } from "react";

interface RankingItemImageProps {
  image?: string;
  videoUrl?: string; // Direct YouTube URL for inline playback
  rank: number;
  title?: string;
  size?: "default" | "large";
  disableVideo?: boolean; // If true, show thumbnail as static image (no play button, no video)
}

// Extract YouTube video ID from various URL formats
function getYoutubeVideoId(url?: string): string | null {
  if (!url) return null;
  // Thumbnail format: https://img.youtube.com/vi/<id>/hqdefault.jpg
  const thumbMatch = url.match(/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\//);
  if (thumbMatch) return thumbMatch[1];
  // Standard YouTube URL: https://www.youtube.com/watch?v=<id>
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  // Short URL: https://youtu.be/<id>
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  // Embed URL: https://www.youtube.com/embed/<id>
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

/**
 * Shared image+rank-number for ALL ranking displays.
 * Used by: DesktopRankrollPage (preview), DesktopRankingDetailPage (list), RankingPollCard (article).
 * Change the design HERE once and it applies everywhere.
 * 
 * If videoUrl is provided, clicking plays the video inline (like articles).
 * If only image has a YouTube thumbnail, it also plays inline.
 */
export default function RankingItemImage({ image, videoUrl, rank, title, size = "default", disableVideo = false }: RankingItemImageProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const sizeClasses = size === "large" ? "w-44 h-28" : "w-20 h-12";
  
  // Get video ID from videoUrl first, then from image thumbnail
  // If disableVideo is true, don't enable video playback (just show thumbnail as static image)
  const youtubeId = disableVideo ? null : (getYoutubeVideoId(videoUrl) || getYoutubeVideoId(image));

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (youtubeId) {
      setIsPlaying(true);
    }
  };

  // If playing, show embedded video
  if (isPlaying && youtubeId) {
    return (
      <div className={`relative ${sizeClasses} rounded-lg overflow-hidden flex-shrink-0 bg-black`}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
        {/* Rank Number overlay on video */}
        <div
          className={`absolute bottom-1 left-2 font-display font-bold leading-none pointer-events-none ${
            size === "large" ? "text-5xl" : "text-2xl"
          } ${rank === 1 ? "text-[#E36B11]" : "text-white"}`}
          style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
        >
          {rank.toString().padStart(2, "0")}
        </div>
      </div>
    );
  }

  // Thumbnail view with play button
  return (
    <div 
      className={`relative ${sizeClasses} rounded-lg overflow-hidden flex-shrink-0 bg-gray-200 ${youtubeId ? 'cursor-pointer' : ''}`}
      onClick={youtubeId ? handlePlayClick : undefined}
    >
      {image ? (
        <img src={image} alt={title || ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#E36B11]/20 to-[#E36B11]/5" />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
      {/* Rank Number inside image */}
      <div
        className={`absolute bottom-1 left-2 font-display font-bold leading-none ${
          size === "large" ? "text-5xl" : "text-2xl"
        } ${rank === 1 ? "text-[#E36B11]" : "text-white"}`}
        style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
      >
        {rank.toString().padStart(2, "0")}
      </div>
      {/* Play button overlay for YouTube videos */}
      {youtubeId && (
        <div className="absolute inset-0 flex items-center justify-center hover:bg-black/20 transition-colors">
          <div className={`rounded-full bg-red-600 flex items-center justify-center shadow-lg ${size === "large" ? "w-12 h-12" : "w-7 h-7"}`}>
            <svg viewBox="0 0 24 24" fill="white" className={size === "large" ? "w-6 h-6 ml-0.5" : "w-3.5 h-3.5 ml-0.5"}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
