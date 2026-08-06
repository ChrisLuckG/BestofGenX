"use client";

import { useEffect, useState } from "react";
import { Music, Headphones } from "lucide-react";
import BackButton from "@/components/BackButton";
import MusicSongList from "@/components/games/MusicSongList";

interface CommunitySoundPageProps {
  onBack?: () => void;
  onOpenRadio?: () => void;
  isDesktop?: boolean;
}

interface CommunityArticle {
  title: string;
  subtitle?: string;
  coverImage?: string;
}

export default function CommunitySoundPage({ onBack, onOpenRadio, isDesktop = false }: CommunitySoundPageProps) {
  const [article, setArticle] = useState<CommunityArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/articles?contentType=music-community&status=published&limit=1')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.articles?.[0]) {
          setArticle(data.articles[0]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const heroImg = article?.coverImage || '';
  const isVideo = /\.(mp4|webm|mov)($|\?)/i.test(heroImg) || heroImg.includes('/video/');

  return (
    <div className="w-full h-full min-h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header - consistent with other pages */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#E36B11]/5 to-transparent">
        <div className="flex items-center gap-3">
          {onBack && <BackButton onClick={onBack} />}
          <Music className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Community Sound</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Your songs. Our playlist.</span>
          </div>
        </div>
        {onOpenRadio && (
          <button
            onClick={onOpenRadio}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#E36B11]/10 text-[#E36B11] text-xs font-bold rounded-lg hover:bg-[#E36B11]/20 transition-colors"
          >
            <Headphones className="w-3.5 h-3.5" />
            Listen on Radio
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Hero banner */}
        {heroImg && (
          <div className={`relative w-full overflow-hidden bg-gray-800 ${isDesktop ? 'aspect-[3/1]' : 'aspect-[16/9]'}`}>
            {isVideo ? (
              <video src={heroImg} className="w-full h-full object-cover" muted autoPlay loop playsInline />
            ) : (
              <img src={heroImg} alt="Community Sound" className="w-full h-full object-cover" />
            )}
          </div>
        )}

        <div className="px-4 py-4 md:px-6">
          {article?.subtitle && (
            <p className="text-sm text-gray-600 mb-2">{article.subtitle}</p>
          )}

          {loading ? (
            <div className="mt-6 py-12 flex items-center justify-center text-gray-400 text-sm">
              Loading community picks...
            </div>
          ) : (
            <MusicSongList onOpenRadio={onOpenRadio} />
          )}
        </div>
      </div>
    </div>
  );
}
