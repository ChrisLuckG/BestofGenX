"use client";

interface RankingItemImageProps {
  image?: string;
  rank: number;
  title?: string;
  size?: "default" | "large";
}

/**
 * Shared image+rank-number for ALL ranking displays.
 * Used by: DesktopRankrollPage (preview), DesktopRankingDetailPage (list), RankingPollCard (article).
 * Change the design HERE once and it applies everywhere.
 */
export default function RankingItemImage({ image, rank, title, size = "default" }: RankingItemImageProps) {
  const sizeClasses = size === "large" ? "w-44 h-28" : "w-20 h-12";
  
  return (
    <div className={`relative ${sizeClasses} rounded-lg overflow-hidden flex-shrink-0 bg-gray-200`}>
      {image ? (
        <img src={image} alt={title || ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#D4873A]/20 to-[#D4873A]/5" />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
      {/* Rank Number inside image */}
      <div
        className={`absolute bottom-1 left-2 font-display font-bold leading-none ${
          size === "large" ? "text-5xl" : "text-2xl"
        } ${rank === 1 ? "text-[#D4873A]" : "text-white"}`}
        style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
      >
        {rank.toString().padStart(2, "0")}
      </div>
    </div>
  );
}
