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
export default function PosterBanner({ color, grayscale = false, transparent = false, accentColor, media, badge, topRight, title, accent, tagline, info, cta = 'PLAY', onClick, minHeight }: {
  color: string;
  /** Artwork without its colours (the Solo Trivia banner is deliberately colourless) */
  grayscale?: boolean;
  /** No background: the page shows through and the copy turns dark (Solo Trivia - the artwork is a transparent PNG) */
  transparent?: boolean;
  /** Colour of the accent word in the title when transparent (default: the brand orange) */
  accentColor?: string;
  media: { type: 'image' | 'video'; src: string; lineArt?: boolean };
  badge: { icon: LucideIcon; label: string };
  topRight?: ReactNode;
  title: string;
  accent?: string;
  tagline: string;
  info: string;
  cta?: string;
  onClick: () => void;
  minHeight?: number | string;
}) {
  const BadgeIcon = badge.icon;
  const mediaClass = `absolute inset-0 w-full h-full object-cover object-right${grayscale ? " grayscale" : ""}${media.lineArt ? ' mix-blend-multiply opacity-70' : ''}`;
  return (
    <button
      onClick={onClick}
      className={`hover-shine group flex-1 relative overflow-hidden rounded-xl ${transparent ? "" : "shadow-md"} text-left transition-all duration-300 active:scale-[0.98] ${transparent ? "hover:bg-[#1F1F1F]" : ""}`}
      style={{ ...(transparent ? {} : { backgroundColor: color }), minHeight: minHeight ?? 160 }}
    >
      {media.type === 'video'
        ? <video src={media.src} className={mediaClass} muted autoPlay loop playsInline />
        : <img src={media.src} alt="" className={mediaClass} />}
      {/* No colour overlay on purpose - the artwork carries the banner. The text
          shadow below is what keeps the title readable over it. */}
      {/* Rare, soft glint - each banner on its own random clock */}
      <ShineSweep intensity={0.16} minDelayMs={7000} maxDelayMs={15000} firstDelayMs={1500} firstJitterMs={3000} />

      <div className={`absolute top-3 left-4 sm:top-4 sm:left-6 inline-flex items-center gap-1 text-white text-[9px] sm:text-[11px] font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-sm uppercase tracking-wider${transparent ? " bg-[#1F1F1F] transition-colors duration-300 group-hover:bg-[var(--cta)]" : ""}`} style={transparent ? ({ "--cta": accentColor || "#E36B11" } as React.CSSProperties) : { backgroundColor: color }}>
        <BadgeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
        {badge.label}
      </div>
      {topRight && <div className="absolute top-3 right-3 sm:top-4 sm:right-4">{topRight}</div>}

      <div className="absolute left-4 right-4 bottom-4 sm:left-6 sm:right-6 sm:bottom-6">
        <div className="min-w-0" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.45)' }}>
          <h3 style={transparent ? { WebkitTextStroke: '3px currentColor', paintOrder: 'stroke fill' } : undefined} className={`font-display ${transparent ? "text-[72px] sm:text-[104px]" : "text-[44px] sm:text-[56px]"} leading-[0.9] tracking-wide ${transparent ? "text-gray-900 transition-colors duration-300 group-hover:text-white" : "text-white"}`}>
            {title}{accent && <span style={{ color: transparent ? (accentColor || "#E36B11") : color }}>{accent}</span>}
          </h3>
          <p className={`text-[13px] sm:text-[16px] font-semibold mt-1.5 sm:mt-2 ${transparent ? "text-gray-900 transition-colors duration-300 group-hover:text-white" : "text-white"}`}>{tagline}</p>
          <p className={`text-[11px] sm:text-[13px] mt-0.5 sm:mt-1 ${transparent ? "text-gray-600 transition-colors duration-300 group-hover:text-white/80" : "text-white/80"}`}>{info}</p>
          {/* CTA sits under the copy, translucent in the brand colour - a plain
              translucent fill would read grey over the artwork, so it keeps the
              colour plus a light border and backdrop blur */}
          <span
            className={`mt-2.5 sm:mt-3.5 inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 sm:px-5 sm:py-2 font-display text-[15px] sm:text-[17px] tracking-wide text-white border border-white/30 backdrop-blur-sm${transparent ? " bg-[#1F1F1F] transition-colors duration-300 group-hover:bg-[var(--cta)] group-hover:border-transparent" : ""}`}
            style={transparent ? ({ "--cta": accentColor || "#E36B11" } as React.CSSProperties) : { backgroundColor: `${color}b3` }}
          >
            {cta} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </span>
        </div>
      </div>
    </button>
  );
}
