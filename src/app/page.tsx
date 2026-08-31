'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);
    window.location.replace(isMobile ? '/mobile' : '/desktop');
  }, []);

  return (
    <div className="bg-cream min-h-screen flex flex-col items-center justify-center">
      {/* Logo */}
      <img 
        src="/images/bogx-logo.png" 
        alt="BOGX" 
        className="w-32 h-32 mb-6 animate-pulse"
      />
      {/* Loading text */}
      <p className="font-display text-lg tracking-wider text-gray-600">
        Redirecting...
      </p>
    </div>
  );
}
