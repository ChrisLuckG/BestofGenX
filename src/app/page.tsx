'use client';

import { useState, useEffect } from 'react';

const SITE_PASSWORD = process.env.NEXT_PUBLIC_SITE_PASSWORD || 'bogx2025';
const STORAGE_KEY = 'bogx_site_access';

export default function Home() {
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === SITE_PASSWORD) {
      const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);
      window.location.replace(isMobile ? '/mobile' : '/desktop');
    } else {
      setReady(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === SITE_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, SITE_PASSWORD);
      const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);
      window.location.replace(isMobile ? '/mobile' : '/desktop');
    } else {
      setError(true);
      setInput('');
      setTimeout(() => setError(false), 1500);
    }
  };

  if (!ready) return null;

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1510] via-[#2a1f15] to-[#0f0d0a]" />
      <video
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover object-[center_25%]"
        ref={(el) => { if (el) el.playbackRate = 0.25; }}
      >
        <source src="/images/Hintergund/don.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />

      <div className="relative z-10 flex flex-col items-center justify-end h-full px-6 pb-6">
        <div className="flex flex-col items-center w-full max-w-xs">
          <img
            src="/images/bogxtranscreamgroß.png"
            alt="BOGX"
            className="w-full -mb-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none"
          />

          <form onSubmit={handleSubmit} className="w-full space-y-2">
              {error && (
                <p className="text-red-400 text-sm text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Wrong password</p>
              )}
              <input
                type="password"
                placeholder="Access Password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#D4873A] text-center shadow-lg border border-white/20 text-sm"
                style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
              />
              <button type="submit" className="w-full py-2.5 bg-[#D4873A] text-white text-base font-semibold tracking-wide transition-all hover:bg-[#e5954a] rounded-lg shadow-xl">
                Enter
              </button>
            </form>

          <p className="mt-4 text-white/60 text-xs tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            © 2026 Best of GenX
          </p>
        </div>
      </div>
    </div>
  );
}
