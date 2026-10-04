"use client";

import {
  BookOpen,
  Swords,
  Trophy,
  FileText,
  Users,
  ArrowRight,
  ChevronLeft,
  Hourglass,
  Sparkles,
  Palmtree,
} from "lucide-react";
import { formatCurrencyWithSymbol } from "@/utils/currency";

/** BOGX credited on sign-up. */
const SIGNUP_BONUS = 5;

/** Donation goal in EUR. */
const DONATION_GOAL_EUR = 10_000_000;
/** Raised so far - set to 0 until real money comes in. */
const DONATION_RAISED_EUR = 0;

// ============================================================
// The welcome page shown when the welcome notification is opened.
//
// Rebuilt with a GenX-style warm palette: gold gradients, cream cards,
// dashed lines, large Bebas Neue typography for figures.
// ============================================================

/**
 * Warm gold gradient used for CTAs and the hero. The old middle stop (#C4772A)
 * was a desaturated brown that read as mud where the gradient was widest - the
 * retirement-home header. Ramping burnt orange straight into bright gold keeps
 * every stop saturated.
 */
const GOLD_GRADIENT = 'linear-gradient(120deg, #D4550E 0%, #E36B11 42%, #E8A33C 100%)';

/**
 * Same ramp, darkened, for gradient text on the cream cards. The bright end of
 * GOLD_GRADIENT (#E8A33C) does not carry enough contrast against #F5EDE4 to be
 * read as type.
 */
const GOLD_GRADIENT_TEXT = 'linear-gradient(120deg, #A63E0A 0%, #E36B11 55%, #C4772A 100%)';

/** Diagonal print texture - cheap nod to screen-printed 80s posters, no asset needed. */
const PRINT_TEXTURE = 'repeating-linear-gradient(135deg, rgba(245,240,232,0.07) 0 2px, transparent 2px 9px)';

/**
 * Hero background clip. The gold gradient stays on the container underneath as
 * the fallback, so a failed or still-buffering video degrades to the branded
 * fill rather than to a bare box.
 */
const HERO_VIDEO = '/videos/welcome-hero-bg.mp4';

interface WelcomeNewsPanelProps {
  /** Shown in the intro line when known. */
  username?: string;
  /** Logged in members do not need the sign-up CTA. */
  isLoggedIn?: boolean;
  /** Opens the sign-up / login flow. */
  onShowSignup?: () => void;
  /** Navigate to the Welcome Reel / feed. */
  onShowBogxers?: () => void;
  /** Back to the notification list. Kept here so the host page stays a one-liner. */
  onBack?: () => void;
}

const HOW_IT_WORKS = [
  {
    icon: BookOpen,
    title: 'Daily Trivia',
    text: 'Remember when you knew every lyric, every movie quote? Time to prove it.',
  },
  {
    icon: Swords,
    title: 'Quiz Battles',
    text: 'Go head-to-head with other members. Friendly competition, bragging rights included.',
  },
  {
    icon: Trophy,
    title: 'Daily Leaderboard',
    text: "See who's on top today. Rankings reset at 10:00 AM Berlin time - everyone gets a fresh start.",
  },
  {
    icon: FileText,
    title: 'Articles & Videos',
    text: 'Stories, throwbacks, and videos that take you back. Written by people who were there.',
  },
];

/**
 * Large display figure with a kicker label above.
 *
 * The kicker deliberately does NOT use `font-display`: globals.css pins
 * `letter-spacing: 0.01em !important` on that class, which silently killed the
 * wide tracking a kicker needs. Inter at 10px with real 0.22em spacing is what
 * the label was always supposed to look like.
 */
function BigFigure({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#E36B11]/80 block mb-1">
        {kicker}
      </span>
      <span
        className="font-display text-5xl md:text-6xl leading-[0.85] block tabular-nums bg-clip-text text-transparent"
        style={{ backgroundImage: GOLD_GRADIENT_TEXT }}
      >
        {children}
      </span>
    </div>
  );
}

export default function WelcomeNewsPanel({
  username,
  isLoggedIn = false,
  onShowSignup,
  onShowBogxers,
  onBack,
}: WelcomeNewsPanelProps) {
  return (
    <div className="px-4 py-4 space-y-5">
      {/* The top action leads INTO the community rather than back out of the page -
          a plain "Back" was the weakest possible thing to offer someone who just
          read the manifesto. Falls back to a real back link on any host that has
          no rankings target, so no surface is left without a way out. */}
      {onShowBogxers ? (
        <button
          onClick={onShowBogxers}
          className="flex items-center gap-1.5 text-[#E36B11] font-display text-sm tracking-wide group"
        >
          Show me the BOGXers
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : onBack ? (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#E36B11] font-display text-sm tracking-wide"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      ) : null}

      {/* ── HERO ────────────────────────────────────────────────── */}
      {/* min-height is explicit: the copy now runs the full width and so wraps
          into fewer lines than it did in the old max-w-lg column. Without a floor
          the box would collapse to whatever the text happens to need and the clip
          would lose the room it needs to read as a background. */}
      <div
        className="relative overflow-hidden rounded-xl px-6 py-10 md:px-10 md:py-14 flex items-stretch min-h-[300px] md:min-h-[380px]"
        style={{ background: GOLD_GRADIENT }}
      >
        <video
          src={HERO_VIDEO}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          autoPlay
          loop
          playsInline
        />
        {/* Legibility scrim, kept deliberately thin. Full-width copy does need
            cover on the right, but buying that with a heavy overlay hid the clip
            entirely. The contrast is carried by a text-shadow on the copy itself
            instead, which costs the background nothing. */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A]/75 via-[#1A1A1A]/45 to-[#2A1608]/25" />
        {/* Screen-print texture, keeps the fill from looking like a plastic banner */}
        <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />

        {/* The shadow is what makes the thin scrim above viable - it keeps the
            copy readable over the bright frames of the clip without darkening it.
            The whole group sits at the bottom (justify-end) so the headline stays
            attached to the copy it introduces - splitting them to opposite edges
            left the title floating on its own. The clip keeps the open top. */}
        <div className="relative w-full flex flex-col justify-end [text-shadow:0_2px_6px_rgba(0,0,0,0.75)]">
          <div>
            <span className="font-display text-[11px] tracking-[0.2em] text-white/70">
              NEWS &amp; UPDATES
            </span>
            <h2 className="font-display text-5xl md:text-7xl tracking-wide leading-[0.95] text-white mt-3">
              The Best of GenX
            </h2>
            {username && (
              <p className="font-display text-lg tracking-wide text-white/85 mt-2">
                Good to see you, {username}.
              </p>
            )}
          </div>


        </div>
      </div>

      {/* ── BLOCK 1: DUE DATE 2090 ───────────────────────────── */}
      <div className="bg-[#F5EDE4] border border-[#E36B11]/20 rounded-xl overflow-hidden">
        <div className="relative overflow-hidden px-5 py-3" style={{ background: GOLD_GRADIENT }}>
          <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />
          <h3 className="relative font-display text-xl md:text-2xl tracking-wide text-white flex items-center gap-2 leading-none">
            <Hourglass className="w-5 h-5 flex-shrink-0" />
            Due Date 2090
          </h3>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-700 leading-relaxed">
            According to some nerdy algorithm, 2090 is our curtain call. The last of us
            will flick off the lights for our badass generation, just like someone did
            before us. Before we vanish into the cosmos, BestofGenX wants to honor the
            greatest, the craziest, the most horrifying people of our time &mdash; and
            what better way to do it than celebrating their birthdays?
          </p>

          {onShowBogxers ? (
            <button
              onClick={onShowBogxers}
              className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#E36B11] font-semibold hover:underline group"
            >
              There were so many. Check them out
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed mt-4">
              There were so many out there.
            </p>
          )}


        </div>
      </div>

      {/* ── BLOCK 2: BOGX AND AI ─────────────────────────────── */}
      <div className="bg-[#F5EDE4] border border-[#E36B11]/20 rounded-xl overflow-hidden">
        <div className="relative overflow-hidden px-5 py-3" style={{ background: GOLD_GRADIENT }}>
          <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />
          <h3 className="relative font-display text-xl md:text-2xl tracking-wide text-white flex items-center gap-2 leading-none">
            <Sparkles className="w-5 h-5 flex-shrink-0" />
            BOGX and AI
          </h3>
        </div>

        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Text column - 60% */}
            <div className="md:w-[60%]">
              <p className="text-sm text-gray-700 leading-relaxed">
                Like every technology we&rsquo;ve seen come along, we absorb this one too.
                Without AI this page wouldn&rsquo;t exist, so let&rsquo;s skip the hypocrisy.
                For us it&rsquo;s more like break dance or beatboxing: I throw in some ideas,
                and Jude Law here throws out the rotten ones. So whatever you see here &mdash;
                know that there are human souls behind it.
              </p>
            </div>

            {/* Separator line */}
            <div className="hidden md:block w-px bg-[#E36B11]/30 self-stretch" />

            {/* Jude Law gif - 40% */}
            <div className="md:w-[40%] flex justify-center">
              <img
                src="/images/jude-law-ai.gif"
                alt="Jude Law AI"
                className="w-full max-w-[280px] h-auto rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── BLOCK 3: 1.6 BN + DONATION GOAL ─────────────────── */}
      <div className="bg-[#F5EDE4] border border-[#E36B11]/20 rounded-xl overflow-hidden">
        <div className="relative overflow-hidden px-5 py-3" style={{ background: GOLD_GRADIENT }}>
          <div className="absolute inset-0" style={{ backgroundImage: PRINT_TEXTURE }} />
          <h3 className="relative font-display text-xl md:text-2xl tracking-wide text-white flex items-center gap-2 leading-none">
            <Users className="w-5 h-5 flex-shrink-0" />
            1.6 BN GenX Souls Out There
          </h3>
        </div>

        <div className="p-6">
          <p className="text-sm text-gray-700 leading-relaxed">
            The mission&rsquo;s simple: get as many GenXers online as we can, have everyone
            chip in 1 to 10 bucks, and we build the world the way we want it.
          </p>

          {/* Donation goal as follow-up */}
          <div className="mt-5 pt-5 border-t border-dashed border-[#E36B11]/30">
            <div className="flex items-center gap-2 mb-3">
              <Palmtree className="w-5 h-5 text-[#E36B11] flex-shrink-0" />
              <h4 className="font-display text-lg tracking-wide text-gray-900">
                A Retirement Home for 300
              </h4>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              A retirement home for 300 people in the Philippines &mdash; or any dream
              island that will have us. Once it stands, we raffle it off right here: 300
              winners, fully sponsored retirement, from the age of 55.
            </p>

            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4">
              <BigFigure kicker="ESTIMATED COST">
                &euro;{(DONATION_GOAL_EUR / 1_000_000).toFixed(0)}
                <span className="text-2xl md:text-3xl"> M</span>
              </BigFigure>
              <BigFigure kicker="YOUR PART">
                1&ndash;10
                <span className="text-2xl md:text-3xl"> BUCKS</span>
              </BigFigure>
            </div>

            {DONATION_RAISED_EUR > 0 && (
              <div className="mt-4">
                <div className="h-2 rounded-full bg-[#E5DDD0] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (DONATION_RAISED_EUR / DONATION_GOAL_EUR) * 100)}%`,
                      background: GOLD_GRADIENT,
                    }}
                  />
                </div>
                <span className="text-[11px] text-gray-500 mt-1.5 block">
                  &euro;{DONATION_RAISED_EUR.toLocaleString('de-DE')} raised so far
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <div className="bg-[#F5EDE4] border border-[#E36B11]/20 rounded-xl overflow-hidden">
        <div className="p-6">
          <h3 className="font-display text-2xl tracking-wide text-gray-900 mb-4">How it works</h3>
          <div className="divide-y divide-[#E36B11]/20">
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <div className="w-11 h-11 rounded-xl border border-[#E36B11]/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[#E36B11]" />
                </div>
                <div>
                  <div className="font-display text-base tracking-wide text-gray-900">{title}</div>
                  <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CLOSING CTA ─────────────────────────────────────── */}
      {onShowBogxers && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onShowBogxers}
            className="px-8 py-4 rounded-xl text-white font-display text-lg tracking-wider transition-transform active:scale-[0.99] flex items-center gap-2 shadow-md"
            style={{ background: GOLD_GRADIENT }}
          >
            Show me the BOGXers
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

