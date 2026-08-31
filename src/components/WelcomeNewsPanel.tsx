"use client";

import { BookOpen, Swords, Trophy, FileText, Users, Heart, ArrowRight, ChevronLeft } from "lucide-react";
import { formatCurrencyWithSymbol } from "@/utils/currency";

/** BOGX credited on sign-up. */
const SIGNUP_BONUS = 5;

// ============================================================
// The welcome page shown when the welcome notification is opened.
//
// Rebuilt from a design mockup after the original was lost (it only ever
// existed in the working tree - neither git nor the editor history had it).
//
// The two photographs from the mockup (retro living room hero, cassette +
// headphones) do not exist in /public/images. Their slots are marked below:
// drop a file in and set `heroImage` / `sideImage` to switch them on. Until
// then the hero uses a dark surface and the "How it works" list runs full
// width, rather than referencing files that would 404.
// ============================================================

interface WelcomeNewsPanelProps {
  /** Shown in the intro line when known. */
  username?: string;
  /** Logged in members do not need the sign-up CTA. */
  isLoggedIn?: boolean;
  /** Opens the sign-up / login flow. */
  onShowSignup?: () => void;
  /** "Learn more about our community" target. */
  onLearnMore?: () => void;
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
    text: "See who's on top today. Rankings reset at midnight - everyone gets a fresh start.",
  },
  {
    icon: FileText,
    title: 'Articles & Videos',
    text: 'Stories, throwbacks, and videos that take you back. Written by people who were there.',
  },
];

// Set these once the artwork exists in /public/images
const heroImage: string | null = null;
const sideImage: string | null = null;

export default function WelcomeNewsPanel({
  username,
  isLoggedIn = false,
  onShowSignup,
  onLearnMore,
  onBack,
}: WelcomeNewsPanelProps) {
  return (
    <div className="px-4 py-4 space-y-4">
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#E36B11] font-display text-sm tracking-wide"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      )}
      {/* HERO */}
      <div
        className="relative overflow-hidden rounded-xl px-6 py-10 md:px-10 md:py-14"
        style={{ backgroundColor: '#1A1A1A' }}
      >
        {heroImage && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-60"
            style={{ backgroundImage: `url('${heroImage}')` }}
          />
        )}
        {/* Keeps the copy readable whether or not the photo is present */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A] via-[#1A1A1A]/80 to-transparent" />

        <div className="relative max-w-md">
          <span className="font-display text-[11px] tracking-[0.2em] text-white/60">
            NEWS &amp; UPDATES
          </span>
          <h2 className="font-serif text-4xl md:text-5xl leading-tight text-white mt-3 mb-4">
            The best of GenX
          </h2>
          <p className="text-sm md:text-base text-white/70 leading-relaxed">
            Relive the music, movies, TV shows, and moments that defined our era
            &mdash; the 80s and 90s.
          </p>
        </div>
      </div>

      {/* WHAT IS BOGX */}
      <div className="bg-[#F5F0E8] border border-warm rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="w-14 h-14 rounded-full border border-warm flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-[#E36B11]" />
          </div>

          <div className="flex-1">
            <h3 className="font-serif text-2xl text-gray-900 mb-2">What is BOGX?</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              BOGX (Best of GenX points) is our community currency. Earn points by
              playing trivia, competing in battles, and participating in the
              community. Your balance reflects your engagement and expertise.
            </p>
          </div>

          {!isLoggedIn && (
            <div className="md:border-l md:border-warm md:pl-6 flex flex-col items-center flex-shrink-0">
              {/* An amount is never written as bare text - it always carries the
                  coin image, like the header counter and the wager buttons do. */}
              <button
                onClick={onShowSignup}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-[#E36B11] text-white font-display text-base tracking-wider transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
              >
                Sign up and get
                <img src="/images/bogxcoin.png" alt="" className="w-5 h-5" />
                {formatCurrencyWithSymbol(SIGNUP_BONUS)}
              </button>
              <span className="text-[11px] text-gray-400 mt-2">
                Join the community and start earning.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="bg-[#F5F0E8] border border-warm rounded-xl overflow-hidden">
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-6">
            <h3 className="font-serif text-2xl text-gray-900 mb-4">How it works</h3>
            <div className="divide-y divide-warm">
              {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-11 h-11 rounded-xl border border-warm flex items-center justify-center flex-shrink-0">
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

          {sideImage && (
            <div
              className="md:w-2/5 min-h-[220px] bg-cover bg-center"
              style={{ backgroundImage: `url('${sideImage}')` }}
            />
          )}
        </div>
      </div>

      {/* CLOSING STRIP */}
      <div className="bg-[#EFE9DF] border border-warm rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Heart className="w-5 h-5 text-[#E36B11] flex-shrink-0" />
        <div className="flex-1">
          <div className="font-display text-sm tracking-wide text-gray-900">
            Built for the generation that changed everything.
          </div>
          <p className="text-xs text-gray-500">Real memories. Real people. Real connection.</p>
        </div>
        {onLearnMore && (
          <button
            onClick={onLearnMore}
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-[#E36B11] transition-colors flex-shrink-0"
          >
            Learn more about our community
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
