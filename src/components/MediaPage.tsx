"use client";

import { Clapperboard, Headphones, Tv } from "lucide-react";
import PosterBanner from "./PosterBanner";

interface MediaPageProps {
  onOpenRadio: () => void;
  onOpenTV: (videoId?: string) => void;
}

export default function MediaPage({ onOpenRadio, onOpenTV }: MediaPageProps) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-cream">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-warm bg-cream">
        <div className="flex items-center gap-3">
          <Clapperboard className="w-5 h-5 text-[#E36B11]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">MEDIA</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">Radio &amp; TV, no ads, no algorithm</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-4 gap-4">

        <PosterBanner
          color="#15803D"
          media={{ type: 'video', src: '/videos/community-sound-bg.mp4' }}
          badge={{ icon: Headphones, label: 'Radio' }}
          title="COMMUNITY "
          accent="SOUND"
          tagline="Your songs. Our playlist."
          info="Picked by GenX, not by an algorithm."
          cta="LISTEN"
          onClick={onOpenRadio}
        />

        <PosterBanner
          color="#E36B11"
          media={{ type: 'image', src: '/images/categories/movies.png' }}
          badge={{ icon: Tv, label: 'TV' }}
          title="GENX "
          accent="TV"
          tagline="Videos from our generation."
          info="Music, movies, moments. No ads in between."
          cta="WATCH"
          onClick={() => onOpenTV()}
        />

      </div>
    </div>
  );
}
