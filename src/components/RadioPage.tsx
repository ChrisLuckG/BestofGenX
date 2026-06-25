"use client";

import { useState, useEffect, useMemo } from "react";
import { Radio, Play, ExternalLink, Music, Check, ClipboardPaste } from "lucide-react";
import GenXLoader from "./GenXLoader";
import { useAuth } from "@/context/AuthContext";
import { RadioSkeleton } from "@/components/desktop/DesktopSkeletons";

// Animated Equalizer Component
function Equalizer({ barCount = 20, isDesktop = false }: { barCount?: number; isDesktop?: boolean }) {
  const heights = isDesktop ? [40, 60, 80, 100] : [35, 50, 70, 90];
  const bars = useMemo(() =>
    Array.from({ length: barCount }).map((_, i) => ({
      height: `${heights[Math.floor(Math.random() * heights.length)]}%`,
      duration: `${(0.4 + Math.random() * 0.3).toFixed(2)}s`,
      delay: `${((i * 0.05) % 0.5).toFixed(2)}s`,
    })), [barCount]);
  
  return (
    <div className={`flex items-end justify-between w-full ${isDesktop ? 'h-16' : 'h-14'}`}>
      {bars.map((bar, i) => (
          <div
            key={i}
            className="bg-gradient-to-t from-[#D4873A]/60 to-[#E5A55A]/40 rounded-t-sm flex-1 mx-[1px]"
            style={{
              maxWidth: isDesktop ? '6px' : '5px',
              animation: `equalizer ${bar.duration} ease-in-out ${bar.delay} infinite alternate`,
              height: bar.height,
            }}
          />
        ))}
      <style>{`
        @keyframes equalizer {
          0% { height: 20%; opacity: 0.6; }
          100% { height: 100%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

interface RadioStation {
  _id: string;
  name: string;
  description: string;
  playlistId: string;
}

interface RadioPageProps {
  isDesktop?: boolean;
}

export default function RadioPage({ isDesktop = false }: RadioPageProps) {
  const { user, isLoggedIn } = useAuth();
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [songRequestData, setSongRequestData] = useState({ playlist: '', band: '', song: '', link: '' });
  const [songRequestSent, setSongRequestSent] = useState(false);

  useEffect(() => {
    fetch('/api/radio-stations')
      .then(res => res.json())
      .then(data => {
        if (data.success) setStations(data.stations || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full h-full min-h-full" style={{ backgroundColor: '#F5F0E8' }}>
        <RadioSkeleton />
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#F5F0E8' }}>
      {/* Header - consistent with other pages */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-warm bg-gradient-to-b from-[#D4873A]/5 to-transparent">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-[#D4873A]" />
          <div>
            <span className="font-display text-lg tracking-wider text-gray-900 block leading-none">Radio</span>
            <span className="text-[10px] text-gray-500 -mt-0.5 block">The sound of GenX</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold text-green-600 tracking-wider">ON AIR</span>
        </div>
      </div>
      
      {/* Equalizer Banner */}
      <div className={`bg-gradient-to-b from-cream to-[#F5F0E8] ${isDesktop ? 'px-4 py-4' : 'px-3 py-3'}`}>
        <div className="w-full">
          <Equalizer barCount={isDesktop ? 50 : 45} isDesktop={isDesktop} />
        </div>
      </div>

      {/* Stations Grid */}
      <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'none' }}>
        <p className="text-sm text-gray-600 mb-6">Pick a station and enjoy the best music from the 80s, 90s & 2000s.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {stations.map((station, index) => (
            <button
              key={station._id}
              onClick={() => window.open(`https://open.spotify.com/playlist/${station.playlistId}`, '_blank')}
              className="relative flex items-center gap-3 p-4 rounded-xl bg-white/50 backdrop-blur-sm shadow-md hover:shadow-lg hover:bg-white/70 transition-all text-left group border border-white/60"
            >
                            <div className="w-12 h-12 rounded-full bg-[#D4873A] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-md">
                <Play className="w-5 h-5 text-white fill-white ml-0.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm tracking-wide text-gray-900 truncate group-hover:text-[#D4873A] transition-colors">{station.name}</p>
                {station.description && <p className="text-xs text-gray-500 truncate">{station.description}</p>}
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#D4873A] transition-colors flex-shrink-0" />
            </button>
          ))}
        </div>

        {stations.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No radio stations available yet.
          </div>
        )}

        {/* Song Request Section */}
        {isLoggedIn && (
          <div className="mt-6 bg-cream rounded-2xl border border-warm overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#D4873A]/10 to-[#D4873A]/5 px-5 py-4 border-b border-warm flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#D4873A]/10 flex items-center justify-center">
                  <Music className="w-5 h-5 text-[#D4873A]" />
                </div>
                <div>
                  <h3 className="font-display text-base tracking-wide text-gray-900 uppercase">Song Request</h3>
                  <p className="text-xs text-gray-500">Request a song for the stream.</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[#D4873A]">
                <img src="/images/bogxcoin.png" alt="" className="w-4 h-4" />
                <span className="text-sm font-semibold">Earn 0.10</span>
                <span className="text-xs text-gray-500"> when we play your song!</span>
              </div>
            </div>
            
            {songRequestSent ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-7 h-7 text-green-500" />
                </div>
                <p className="font-bold text-gray-900">Your request is underway!</p>
                <p className="text-sm text-gray-500 mt-1">Our team will take it from here.</p>
                <button
                  onClick={() => setSongRequestSent(false)}
                  className="mt-3 text-xs text-[#D4873A] hover:underline"
                >
                  Suggest another song
                </button>
              </div>
            ) : (
              <>
                {/* Grid Layout - 3 columns on desktop */}
                <div className={`grid gap-4 p-5 ${isDesktop ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                  {/* Playlist Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Playlist</label>
                    <div className="relative">
                      <select
                        value={songRequestData.playlist}
                        onChange={(e) => setSongRequestData({...songRequestData, playlist: e.target.value})}
                        className="w-full px-4 py-3 text-sm border-2 border-warm rounded-xl bg-white text-gray-900 focus:outline-none focus:border-[#D4873A] transition-colors appearance-none cursor-pointer"
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
                        <img src="/images/spotify.png" alt="" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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
                          className="w-full pl-9 pr-4 py-3 text-sm border-2 border-warm rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#D4873A] transition-colors"
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
                        className="px-3 py-3 bg-cream border border-warm hover:border-[#D4873A] rounded-xl transition-colors flex items-center gap-1.5 text-[#D4873A] text-sm"
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
                      <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-gray-900 font-medium text-sm truncate">{songRequestData.band} – {songRequestData.song}</span>
                      </div>
                    ) : songRequestData.link ? (
                      <div className="mb-2 px-3 py-2 bg-[#D4873A]/10 rounded-lg">
                        <span className="text-[#D4873A] text-xs animate-pulse">Loading track info...</span>
                      </div>
                    ) : null}
                    <button
                      onClick={() => {
                        if (songRequestData.playlist && songRequestData.band && songRequestData.song) {
                          const payload = {
                            userId: user?.id,
                            username: user?.username,
                            playlist: songRequestData.playlist.replace('Best of GenX - ', ''),
                            band: songRequestData.band,
                            song: songRequestData.song,
                            link: songRequestData.link || null,
                          };
                          fetch('/api/song-request', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          }).catch((err) => console.error('Song request failed:', err));
                          setSongRequestSent(true);
                          setSongRequestData({ playlist: '', band: '', song: '', link: '' });
                        }
                      }}
                      disabled={!songRequestData.playlist || !songRequestData.band || !songRequestData.song || !songRequestData.link}
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:border-2 disabled:border-gray-200 bg-[#D4873A] text-white hover:bg-[#C4772A] flex items-center justify-center gap-2 border-2 border-[#D4873A]"
                    >
                      <Music className="w-4 h-4" />
                      Send Request
                    </button>
                    <p className="text-[10px] text-gray-400 mt-1.5">We review your request</p>
                  </div>
                </div>
                
                {/* Info Banner with 3 points */}
                <div className="border-t border-warm bg-gradient-to-r from-[#D4873A]/5 to-transparent px-5 py-4">
                  <div className={`grid gap-6 ${isDesktop ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                        <Music className="w-4 h-4 text-[#D4873A]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Your Request Counts</p>
                        <p className="text-[11px] text-gray-500">We play your songs in the stream</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#D4873A]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Earn 0.10</p>
                        <p className="text-[11px] text-gray-500">For every played song</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#D4873A]/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-4 h-4 text-[#D4873A]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Quick Review</p>
                        <p className="text-[11px] text-gray-500">We review all requests regularly</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Login prompt for non-logged in users */}
        {!isLoggedIn && (
          <div className="mt-8 bg-gradient-to-br from-[#D4873A]/20 to-[#D4873A]/10 rounded-xl p-5 text-center border border-[#D4873A]/30">
            <Music className="w-8 h-8 text-[#D4873A] mx-auto mb-2" />
            <p className="text-gray-900 font-medium">Want to request a song?</p>
            <p className="text-sm text-gray-500 mt-1">Log in to suggest songs and earn coins!</p>
          </div>
        )}
      </div>
    </div>
  );
}
