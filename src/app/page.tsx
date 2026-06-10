'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      
      if (data.success) {
        // Store user in the correct localStorage key that AuthContext reads
        const userForStorage = {
          id: data.user._id,
          username: data.user.username,
          email: data.user.email,
          avatar: data.user.avatar,
          country: data.user.country,
          countryFlag: data.user.countryFlag,
          isGuest: false,
          isAdmin: data.user.isAdmin || false,
          gamesPlayed: data.user.gamesPlayed || 0,
          wins: data.user.wins || 0,
          coins: data.user.points || 0,
          bogxCoins: data.user.bogxCoins || 0,
        };
        localStorage.setItem('sporttock_user', JSON.stringify(userForStorage));
        const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);
        window.location.href = isMobile ? '/mobile' : '/desktop';
      } else if (data.needsVerification) {
        setError('');
        setNeedsVerification(true);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendingEmail(true);
    setSuccessMessage('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Verification email sent! Check your inbox.');
      } else {
        setError(data.error || 'Failed to send email');
      }
    } catch {
      setError('Failed to send email');
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden">
      {/* Warm Gradient Background (Fallback) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1510] via-[#2a1f15] to-[#0f0d0a]" />
      
      {/* Fullscreen Background Video/Image */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover object-[center_25%]"
        ref={(el) => { if (el) el.playbackRate = 0.25; }}
      >
        <source src="/images/Hintergund/don.mp4" type="video/mp4" />
      </video>
      
      {/* Subtle Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-end h-full px-6 pb-6">
        
        {/* Dev Badge - Blinking */}
        <div className="absolute top-4 left-4 flex items-center gap-2 text-white text-xs tracking-wider uppercase font-medium">
          <span className="w-2 h-2 bg-[#D4873A] rounded-full animate-pulse" />
          <span className="text-white/90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Dev Mode</span>
        </div>
        
        {/* Bottom Block - Logo + Form + Footer */}
        <div className="flex flex-col items-center w-full max-w-xs">
          {/* Logo */}
          <img
            src="/images/bogxtranscreamgroß.png"
            alt="BOGX"
            className="w-full -mb-8 drop-shadow-[0_4px_20px_rgba(0,0,0,0.6)] pointer-events-none"
          />
          
          {/* Login Form - Compact */}
          <form onSubmit={handleLogin} className="w-full space-y-2">
            {error && !needsVerification && (
              <p className="text-red-400 text-sm text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{error}</p>
            )}
            
            {needsVerification && (
              <div className="p-3 rounded-lg text-center" style={{ backgroundColor: 'rgba(212,135,58,0.2)', border: '1px solid rgba(212,135,58,0.4)' }}>
                <p className="text-[#D4873A] text-sm font-semibold mb-1">Email Verification Required</p>
                <p className="text-white/80 text-xs mb-2">We sent a link to <strong>{email}</strong></p>
                <button 
                  type="button"
                  onClick={handleResendVerification} 
                  disabled={resendingEmail}
                  className="text-[#D4873A] text-xs font-semibold hover:underline"
                >
                  {resendingEmail ? 'Sending...' : "Didn't receive it? Resend email"}
                </button>
                {successMessage && <p className="text-green-400 text-xs mt-1">{successMessage}</p>}
              </div>
            )}
            
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#D4873A] text-center shadow-lg border border-white/20 text-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
              required
            />
            
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2.5 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#D4873A] text-center shadow-lg border border-white/20 text-sm"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
              required
            />
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#D4873A] text-white text-base font-semibold tracking-wide transition-all disabled:opacity-50 hover:bg-[#e5954a] rounded-lg shadow-xl"
            >
              {loading ? 'Loading...' : 'Sign In'}
            </button>
          </form>
          
          {/* Footer */}
          <p className="mt-4 text-white/60 text-xs tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            © 2026 Best of GenX
          </p>
        </div>
      </div>
    </div>
  );
}
