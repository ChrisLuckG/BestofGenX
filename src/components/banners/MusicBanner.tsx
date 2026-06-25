"use client";

import { Users } from "lucide-react";

interface MusicBannerProps {
  month?: string; // e.g., "MAY", "JUNE" - defaults to current month
  songCount?: number;
  voteCount?: number;
  onClick?: () => void;
  className?: string;
}

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

const MONTH_TITLES: Record<string, string> = {
  "JANUARY": "JANUARY JAMS",
  "FEBRUARY": "FEBRUARY FEELS",
  "MARCH": "MARCH MELODIES",
  "APRIL": "APRIL ANTHEMS",
  "MAY": "MAY MELODIES",
  "JUNE": "JUNE JAMS",
  "JULY": "JULY JAMS",
  "AUGUST": "AUGUST ANTHEMS",
  "SEPTEMBER": "SEPTEMBER SOUNDS",
  "OCTOBER": "OCTOBER ORIGINALS",
  "NOVEMBER": "NOVEMBER NOTES",
  "DECEMBER": "DECEMBER DREAMS",
};

export default function MusicBanner({ 
  month, 
  songCount = 0, 
  voteCount = 0, 
  onClick,
  className = ""
}: MusicBannerProps) {
  // Default to current month
  const currentMonth = month || MONTH_NAMES[new Date().getMonth()];
  const title = MONTH_TITLES[currentMonth] || `${currentMonth} MELODIES`;

  return (
    <div 
      onClick={onClick}
      className={`relative w-full rounded-2xl overflow-hidden ${onClick ? 'cursor-pointer hover:scale-[1.01] transition-transform' : ''} ${className}`}
      style={{ aspectRatio: '1024/200' }}
    >
      {/* Background Image */}
      <img 
        src="/images/Hintergund/music.png" 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover"
      />
      
      {/* Text Overlay - positioned in the center-right area */}
      <div className="absolute inset-0 flex items-center justify-center pl-[35%] pr-[15%]">
        <div className="text-center">
          {/* Main Title */}
          <h2 
            className="font-display text-3xl md:text-4xl lg:text-5xl tracking-wider mb-2"
            style={{ 
              color: '#c8e6a0',
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
              fontStyle: 'italic'
            }}
          >
            {title}
          </h2>
          
          {/* Subtitle Badge */}
          <div 
            className="inline-block px-4 py-1 rounded-md text-xs md:text-sm font-bold tracking-wider mb-2"
            style={{ backgroundColor: '#9ae66e', color: '#1a1a1a' }}
          >
            MONTHLY SPOTIFY PLAYLIST
          </div>
          
          {/* Description */}
          <p 
            className="text-sm md:text-base mb-3"
            style={{ color: '#c8e6a0' }}
          >
            Our community picks of the month
          </p>
          
          {/* Stats Row */}
          <div className="flex items-center justify-center gap-4 text-sm">
            {/* Song Count */}
            <div className="flex items-center gap-2" style={{ color: '#c8e6a0' }}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/8/84/Spotify_icon.svg" alt="Spotify" className="w-5 h-5" />
              <span className="font-bold">{songCount} SONGS</span>
            </div>
            
            <span style={{ color: '#c8e6a0' }}>•</span>
            
            {/* Vote Count */}
            <div className="flex items-center gap-2" style={{ color: '#c8e6a0' }}>
              <Users className="w-5 h-5" />
              <span className="font-bold">{voteCount} VOTES</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
