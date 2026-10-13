"use client";

import { useEffect, useState, useRef } from "react";
import { Music, Headphones, Play, ExternalLink, Check, ClipboardPaste, ChevronRight, ChevronLeft } from "lucide-react";
import PageHeader, { HeaderButton } from "@/components/PageHeader";
import BackButton from "@/components/BackButton";
import MusicSongList from "@/components/games/MusicSongList";
import { useAuth } from "@/context/AuthContext";

interface CommunitySoundPageProps {
  onBack?: () => void;
  onOpenRadio?: () => void;
  onShowLogin?: () => void;
  isDesktop?: boolean;
}

interface CommunityArticle {
  title: string;
  subtitle?: string;
  coverImage?: string;
}

interface RadioStation {
  _id: string;
  name: string;
  description: string;
  playlistId: string;
  imageUrl?: string;
}

// Cache keys and TTL
const CACHE_KEY_ARTICLE = 'community_sound_article';
const CACHE_KEY_STATIONS = 'community_sound_stations';
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch { return null; }
}

function setCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch { /* quota exceeded - ignore */ }
}

// Accent colour is the Music category colour from lib/categories.ts (slug
// 'music', #15803D) - this page used a generic #22C55E, so a Music article and
// the Music page were two different greens. Tailwind arbitrary values must be
// literal at build time, so the hex is repeated in the classes below rather than
// read from getCategoryColor(); keep them in sync with categories.ts.

export default function CommunitySoundPage({ onBack, onOpenRadio, onShowLogin, isDesktop = false }: CommunitySoundPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [article, setArticle] = useState<CommunityArticle | null>(() => getCached<CommunityArticle>(CACHE_KEY_ARTICLE));
  const [stations, setStations] = useState<RadioStation[]>(() => getCached<RadioStation[]>(CACHE_KEY_STATIONS) || []);
  const [loading, setLoading] = useState(!getCached(CACHE_KEY_ARTICLE) && !getCached(CACHE_KEY_STATIONS));
  const [songRequestData, setSongRequestData] = useState({ playlist: '', band: '', song: '', link: '' });
  const [songRequestSent, setSongRequestSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to top when component mounts
  useEffect(() => {
    const scrollToTop = () => {
      // Internal scroll container
      scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
      // Desktop parent container
      const parentScroll = document.querySelector('[data-content-scroll]');
      if (parentScroll) {
        parentScroll.scrollTop = 0;
      }
      // Window scroll as fallback
      window.scrollTo(0, 0);
    };
    
    // Immediate
    scrollToTop();
    // After paint
    requestAnimationFrame(scrollToTop);
    // After a short delay as final fallback
    const timer = setTimeout(scrollToTop, 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // If we have cached data, show it immediately but still refresh in background
    const hasCachedData = article || stations.length > 0;
    
    // Fetch article and stations in parallel
    Promise.all([
      fetch('/api/articles?contentType=music-community&status=published&limit=1').then(res => res.json()),
      fetch('/api/radio-stations').then(res => res.json()),
    ])
      .then(([articleData, stationsData]) => {
        if (articleData.success && articleData.articles?.[0]) {
          const art = articleData.articles[0];
          setArticle(art);
          setCache(CACHE_KEY_ARTICLE, art);
        }
        if (stationsData.success && stationsData.stations) {
          setStations(stationsData.stations);
          setCache(CACHE_KEY_STATIONS, stationsData.stations);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const heroImg = article?.coverImage || '';
  const isVideo = /\.(mp4|webm|mov)($|\?)/i.test(heroImg) || heroImg.includes('/video/');

  // Preload images for faster display
  useEffect(() => {
    const imagesToPreload: string[] = [];
    if (heroImg && !isVideo) imagesToPreload.push(heroImg);
    stations.forEach(s => { if (s.imageUrl) imagesToPreload.push(s.imageUrl); });
    
    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src;
    });
  }, [heroImg, isVideo, stations]);

  // Skeleton component for loading state
  const Skeleton = ({ className }: { className: string }) => (
    <div className={`animate-pulse bg-gray-300/50 rounded ${className}`} />
  );

  // Ref for stations scroll
  const stationsScrollRef = useRef<HTMLDivElement>(null);
  
  // Scroll helpers for desktop
  const scrollStations = (direction: 'left' | 'right') => {
    if (stationsScrollRef.current) {
      const scrollAmount = 300;
      stationsScrollRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  return (
    <div className="w-full h-full min-h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header - consistent with other pages */}
      {/* Desktop has its own persistent navigation, so an in-page back button is
          redundant there. Mobile still needs it - it is the only way out of this view. */}
      <PageHeader icon={Music} iconColor="#15803D" title="Community Sound" subtitle="Your songs. Our playlist." onBack={onBack && !isDesktop ? onBack : undefined} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Hero banner - always show video background */}
        <div className={`relative w-full overflow-hidden bg-gray-200 ${isDesktop ? 'aspect-[3/1]' : 'aspect-[16/9]'}`}>
          <video 
            src="/videos/community-sound-bg.mp4" 
            className="w-full h-full object-cover" 
            muted 
            autoPlay 
            loop 
            playsInline 
          />
        </div>

        <div className="px-4 py-4 md:px-6">
          {/* Subtitle with green bar like article headlines */}
          <p className="font-serif italic text-xl leading-snug mb-6 border-l-4 border-[#15803D] pl-4 text-[#15803D]">
            Your songs. Our playlist. Every month, Gen X picks the tracks.
          </p>

          {/* 1. Stations - Horizontal swipeable row */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-[#15803D]" />
                  <span className="font-bold text-sm uppercase tracking-wider text-gray-900">Our Playlists</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">Swipe to explore our curated stations</p>
              </div>
              {/* Desktop scroll arrows */}
              {!loading && stations.length > 3 && (
                <div className="hidden md:flex items-center gap-1">
                  <button 
                    onClick={() => scrollStations('left')}
                    className="w-8 h-8 rounded-full bg-white/80 border border-warm flex items-center justify-center hover:bg-[#15803D]/10 hover:border-[#15803D] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <button 
                    onClick={() => scrollStations('right')}
                    className="w-8 h-8 rounded-full bg-white/80 border border-warm flex items-center justify-center hover:bg-[#15803D]/10 hover:border-[#15803D] transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
            {loading ? (
              <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex-shrink-0 w-36">
                    <Skeleton className="w-full h-36 rounded-xl" />
                  </div>
                ))}
              </div>
            ) : stations.length > 0 ? (
              <div ref={stationsScrollRef} className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                {stations.map((station) => (
                  <button
                    key={station._id}
                    onClick={() => window.open(`https://open.spotify.com/playlist/${station.playlistId}`, '_blank')}
                    className="flex-shrink-0 w-36 rounded-xl overflow-hidden shadow-md hover:shadow-lg hover:scale-105 transition-all group"
                  >
                    <div className="w-full h-36 overflow-hidden bg-[#15803D] flex items-center justify-center relative">
                      {station.imageUrl ? (
                        <>
                          <img src={station.imageUrl} alt={station.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-10 h-10 text-white fill-white ml-0.5" />
                          </div>
                        </>
                      ) : (
                        <Play className="w-10 h-10 text-white fill-white ml-0.5" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Separator */}
          <div className="border-t border-warm my-6" />

          {/* 2. Top Community Picks + New Suggestions */}
          <MusicSongList onOpenRadio={onOpenRadio} />

          {/* Song Request Section */}
          {isLoggedIn && (
            <div className="mt-8 bg-cream rounded-2xl border border-warm overflow-hidden shadow-sm">
              <div className="bg-[#15803D]/10 px-5 py-4 border-b border-warm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#15803D]/10 flex items-center justify-center">
                    <Music className="w-5 h-5 text-[#15803D]" />
                  </div>
                  <div>
                    <h3 className="font-display text-base tracking-wide text-gray-900 uppercase">Song Request</h3>
                    <p className="text-xs text-gray-500">Request a song for the stream.</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[#15803D]">
                  <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                  <span className="text-sm font-semibold">Earn 0.10</span>
                  <span className="text-xs text-gray-500 hidden sm:inline"> when we add your song!</span>
                </div>
              </div>
              
              {songRequestSent ? (
                <div className="text-center py-6">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[#15803D]/20 flex items-center justify-center">
                    <Check className="w-7 h-7 text-[#15803D]" />
                  </div>
                  <p className="font-bold text-gray-900">Your request is underway!</p>
                  <p className="text-sm text-gray-500 mt-1">Our team will take it from here.</p>
                  <button onClick={() => setSongRequestSent(false)} className="mt-3 text-xs text-[#15803D] hover:underline">
                    Suggest another song
                  </button>
                </div>
              ) : (
                <>
                  <div className={`grid gap-4 p-5 ${isDesktop ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    {/* Playlist Selection */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Playlist</label>
                      <div className="relative">
                        <select
                          value={songRequestData.playlist}
                          onChange={(e) => setSongRequestData({...songRequestData, playlist: e.target.value})}
                          className="w-full px-4 py-3 text-sm border-2 border-warm rounded-xl bg-white text-gray-900 focus:outline-none focus:border-[#15803D] transition-colors appearance-none cursor-pointer"
                        >
                          <option value="">Choose playlist...</option>
                          {stations.map(s => (
                            <option key={s._id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">Choose from our playlists</p>
                    </div>
                    
                    {/* Spotify Link */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Spotify Link</label>
                      <div className="flex gap-2">
                        <div className="flex-1 relative">
                          <input
                            type="url"
                            value={songRequestData.link}
                            onChange={async (e) => {
                              const newLink = e.target.value;
                              setSongRequestData(prev => ({...prev, link: newLink}));
                              if (newLink.includes('spotify.com') && newLink.includes('track')) {
                                try {
                                  const res = await fetch(`/api/spotify-info?url=${encodeURIComponent(newLink)}`);
                                  const data = await res.json();
                                  if (data.success) {
                                    setSongRequestData(prev => ({ ...prev, song: data.song || prev.song, band: data.band || prev.band }));
                                  }
                                } catch (e) { console.error('Failed to fetch track info:', e); }
                              }
                            }}
                            placeholder="Spotify link here..."
                            className="w-full px-4 py-3 text-sm border-2 border-warm rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#15803D] transition-colors"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const text = await navigator.clipboard.readText();
                              if (text) {
                                setSongRequestData(prev => ({...prev, link: text}));
                                if (text.includes('spotify.com') && text.includes('track')) {
                                  const res = await fetch(`/api/spotify-info?url=${encodeURIComponent(text)}`);
                                  const data = await res.json();
                                  if (data.success) {
                                    setSongRequestData(prev => ({ ...prev, song: data.song || prev.song, band: data.band || prev.band }));
                                  }
                                }
                              }
                            } catch (e) { console.error('Clipboard access denied:', e); }
                          }}
                          className="px-3 py-3 bg-cream border border-warm hover:border-[#15803D] rounded-xl transition-colors flex items-center gap-1.5 text-[#15803D] text-sm"
                        >
                          <ClipboardPaste className="w-4 h-4" />
                          Paste
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">Link to your requested song</p>
                    </div>
                    
                    {/* Submit Button */}
                    <div className={`${isDesktop ? '' : 'sm:col-span-2'}`}>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Submit</label>
                      {(songRequestData.band || songRequestData.song) ? (
                        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-[#15803D]/5 border border-[#15803D]/20 rounded-lg">
                          <Check className="w-4 h-4 text-[#15803D] flex-shrink-0" />
                          <span className="text-gray-900 font-medium text-sm truncate">{songRequestData.band} – {songRequestData.song}</span>
                        </div>
                      ) : songRequestData.link ? (
                        <div className="mb-2 px-3 py-2 bg-[#15803D]/10 rounded-lg">
                          <span className="text-[#15803D] text-xs animate-pulse">Loading track info...</span>
                        </div>
                      ) : null}
                      <button
                        onClick={() => {
                          if (songRequestData.playlist && songRequestData.band && songRequestData.song) {
                            fetch('/api/song-request', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                userId: user?.id,
                                username: user?.username,
                                playlist: songRequestData.playlist.replace('Best of GenX - ', ''),
                                band: songRequestData.band,
                                song: songRequestData.song,
                                link: songRequestData.link || null,
                              }),
                            }).catch((err) => console.error('Song request failed:', err));
                            setSongRequestSent(true);
                            setSongRequestData({ playlist: '', band: '', song: '', link: '' });
                          }
                        }}
                        disabled={!songRequestData.playlist || !songRequestData.band || !songRequestData.song || !songRequestData.link}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:border-2 disabled:border-gray-200 bg-[#15803D] text-white hover:bg-[#166534] flex items-center justify-center gap-2 border-2 border-[#15803D]"
                      >
                        <Music className="w-4 h-4" />
                        Send Request
                      </button>
                      <p className="text-[10px] text-gray-400 mt-1.5">We review your request</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Login prompt for non-logged in users */}
          {!isLoggedIn && (
            <div className="mt-8 bg-gradient-to-br from-[#15803D]/20 to-[#15803D]/10 rounded-xl p-5 text-center border border-[#15803D]/30">
              <Music className="w-8 h-8 text-[#15803D] mx-auto mb-2" />
              <p className="text-gray-900 font-medium">Want to request a song?</p>
              <p className="text-sm text-gray-500 mt-1">Log in to suggest songs and earn coins!</p>
              <button
                onClick={onShowLogin}
                className="mt-4 px-6 py-2.5 bg-[#15803D] text-white font-display text-sm rounded-lg hover:bg-[#166534] transition-colors"
              >
                Log In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
