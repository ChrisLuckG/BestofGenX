"use client";

interface RankingItemImageProps {
  image?: string;
  rank: number;
  title?: string;
  size?: "default" | "large";
}

// YouTube thumbnails are stored as https://img.youtube.com/vi/<id>/hqdefault.jpg
function getYoutubeVideoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\//);
  return match ? match[1] : null;
}

/**
 * Shared image+rank-number for ALL ranking displays.
 * Used by: DesktopRankrollPage (preview), DesktopRankingDetailPage (list), RankingPollCard (article).
 * Change the design HERE once and it applies everywhere.
 */
export default function RankingItemImage({ image, rank, title, size = "default" }: RankingItemImageProps) {
  const sizeClasses = size === "large" ? "w-44 h-28" : "w-20 h-12";
  const youtubeId = getYoutubeVideoId(image);

  const content = (
    <div className={`relative ${sizeClasses} rounded-lg overflow-hidden flex-shrink-0 bg-gray-200`}>
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
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`rounded-full bg-black/60 flex items-center justify-center ${size === "large" ? "w-10 h-10" : "w-6 h-6"}`}>
            <svg viewBox="0 0 24 24" fill="white" className={size === "large" ? "w-5 h-5" : "w-3 h-3"}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );

  if (youtubeId) {
    return (
      <a
        href={`https://www.youtube.com/watch?v=${youtubeId}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="block"
      >
        {content}
      </a>
    );
  }

  return content;
}
