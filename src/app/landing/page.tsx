'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        localStorage.setItem('bogx_user', JSON.stringify(data.user));
        const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);
        window.location.href = isMobile ? '/mobile' : '/desktop';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      {/* Fullscreen Background Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-50"
      >
        <source src="/videos/landing-bg.mp4" type="video/mp4" />
      </video>
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6">
        
        {/* Dev Mode Badge */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 px-4 py-2 bg-[#D4873A] rounded-full text-white text-sm font-medium shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Development Mode – Release Coming Soon!
          </div>
        </div>
        
        {/* Logo */}
        <Image
          src="/images/genxlogo.png"
          alt="Best of GenX"
          width={180}
          height={70}
          className="mb-10 drop-shadow-2xl"
        />
        
        {/* Login Box */}
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-black/50 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Developer Login</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm text-center">
              {error}
            </div>
          )}
          
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 mb-3 focus:outline-none focus:border-[#D4873A]"
            required
          />
          
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 mb-5 focus:outline-none focus:border-[#D4873A]"
            required
          />
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#D4873A] hover:bg-[#c17832] text-white font-bold rounded-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        
        {/* Footer */}
        <p className="absolute bottom-6 text-gray-500 text-sm">
          © 2024 Best of GenX
        </p>
      </div>
    </div>
  );
}
