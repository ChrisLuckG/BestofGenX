"use client";

import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import ShineSweep from "./ShineSweep";

/**
 * Poster-style banner shared by Trivia and Media: big title anchored bottom-left,
 * one live/info line, explicit CTA pill bottom-right.
 *
 * `lineArt` artwork (cream drawings) is multiplied onto the brand colour so the
 * lines stay visible without turning half the card into a pale block. Photos and
 * videos must NOT be multiplied - they would just go muddy - so they are laid in
 * at reduced opacity instead.
 */
export default function PosterBanner({ color, media, badge, topRight, title, accent, tagline, info, cta = 'PLAY', onClick, minHeight }: {
  color: string;
  media: { type: 'image' | 'video'; src: string; lineArt?: boolean };
  badge: { icon: LucideIcon; label: string };
  topRight?: ReactNode;
  title: string;
  accent?: string;
  tagline: string;
  info: string;
  cta?: string;
  onClick: () => void;
  minHeight?: number;
}) {
  const BadgeIcon = badge.icon;
  const mediaClass = `absolute inset-0 w-full h-full object-cover object-right${media.lineArt ? ' mix-blend-multiply opacity-70' : ''}`;
  return (
    <button
      onClick={onClick}
      className="hover-shine flex-1 relative overflow-hidden rounded-xl shadow-md text-left transition-transform active:scale-[0.98]"
      style={{ backgroundColor: color, minHeight: minHeight ?? 160 }}
    >
      {media.type === 'video'
        ? <video src={media.src} className={mediaClass} muted autoPlay loop playsInline />
        : <img src={media.src} alt="" className={mediaClass} />}
      {/* No colour overlay on purpose - the artwork carries the banner. The text
          shadow below is what keeps the title readable over it. */}
      {/* Rare, soft glint - each banner on its own random clock */}
      <ShineSweep intensity={0.16} minDelayMs={7000} maxDelayMs={15000} firstDelayMs={1500} firstJitterMs={3000} />

      <div className="absolute top-3 left-4 sm:top-4 sm:left-6 inline-flex items-center gap-1 text-white text-[9px] sm:text-[11px] font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-sm uppercase tracking-wider" style={{ backgroundColor: color }}>
        <BadgeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
        {badge.label}
      </div>
      {topRight && <div className="absolute top-3 right-3 sm:top-4 sm:right-4">{topRight}</div>}

      <div className="absolute left-4 right-4 bottom-4 sm:left-6 sm:right-6 sm:bottom-6">
        <div className="min-w-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}>
          <h3 className="font-display text-[44px] sm:text-[56px] leading-[0.9] tracking-wide text-white">
            {title}{accent && <span style={{ color }}>{accent}</span>}
          </h3>
          <p className="text-white text-[13px] sm:text-[16px] font-semibold mt-1.5 sm:mt-2">{tagline}</p>
          <p className="text-white/80 text-[11px] sm:text-[13px] mt-0.5 sm:mt-1">{info}</p>
          {/* CTA sits under the copy, translucent in the brand colour - a plain
              translucent fill would read grey over the artwork, so it keeps the
              colour plus a light border and backdrop blur */}
          <span
            className="mt-2.5 sm:mt-3.5 inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 sm:px-5 sm:py-2 font-display text-[15px] sm:text-[17px] tracking-wide text-white border border-white/30 backdrop-blur-sm"
            style={{ backgroundColor: `${color}b3` }}
          >
            {cta} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
        </div>
      </div>
    </button>
  );
}
