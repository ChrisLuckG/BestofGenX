"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Music, ChevronRight, ChevronUp, ChevronLeft, Crown, Plus, ExternalLink, Radio, Disc3, Users, Clock, BarChart2, Mic2, ListMusic, Headphones, Play } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface SongRequest {
  _id: string;
  username: string;
  playlist: string;
  band: string;
  song: string;
  link?: string;
  coverImage?: string;
  status: 'new' | 'in_progress' | 'added' | 'rejected';
  votes: number;
  votedBy: string[];
  createdAt: string;
}

const ART_COLORS = [
  { bg: '#1a1a2e', accent: '#e94560' }, { bg: '#16213e', accent: '#0f9ac8' },
  { bg: '#2d1b69', accent: '#e2d535' }, { bg: '#0d2137', accent: '#ff6b35' },
  { bg: '#1B4332', accent: '#40916C' }, { bg: '#4A0E0E', accent: '#E63946' },
  { bg: '#2c1654', accent: '#9b5de5' }, { bg: '#023E8A', accent: '#00B4D8' },
];

function AlbumArt({ band, song, size = 'md' }: { band: string; song: string; size?: 'sm' | 'md' | 'lg' }) {
  const idx = ((band.charCodeAt(0) || 0) + (song.charCodeAt(0) || 0)) % ART_COLORS.length;
  const c = ART_COLORS[idx];
  const cls = size === 'lg' ? 'w-full h-32' : size === 'sm' ? 'w-10 h-10 rounded-lg' : 'w-12 h-12 rounded-lg';
  return (
    <div className={`${cls} flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: c.bg }}>
      <Music style={{ color: c.accent }} className={size === 'lg' ? 'w-12 h-12' : 'w-5 h-5'} />
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Skeleton component
const Skeleton = ({ className }: { className: string }) => (
  <div className={`animate-pulse bg-gray-300/50 rounded ${className}`} />
);

// Skeleton for Community Picks (horizontal cards)
function CommunityPicksSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex-shrink-0 w-32 rounded-xl overflow-hidden bg-white/50">
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="p-2 space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-2 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton for Suggestions (vertical list)
function SuggestionsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 bg-cream border border-warm rounded-xl">
          <Skeleton className="w-12 h-12 rounded-lg" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2 w-1/3" />
          </div>
          <Skeleton className="w-10 h-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

interface MusicSongListProps {
  theme?: string;
  playlist?: string;
  onOpenRadio?: () => void;
}

export default function MusicSongList({ playlist, onOpenRadio }: MusicSongListProps) {
  const { user, isLoggedIn } = useAuth();
  const [added, setAdded] = useState<SongRequest[]>([]);
  const [newSongs, setNewSongs] = useState<SongRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [showSuggest, setShowSuggest] = useState(false);
  const [songData, setSongData] = useState({ playlist: '', band: '', song: '', link: '' });
  const [songSent, setSongSent] = useState(false);
  const [stations, setStations] = useState<{ _id: string; name: string }[]>([]);
  const [sortBy, setSortBy] = useState<'votes' | 'newest'>('votes');
  
  // Refs for scroll containers (desktop arrows)
  const picksScrollRef = useRef<HTMLDivElement>(null);
  
  // Handle song click - open Spotify directly
  const handlePlaySong = (song: SongRequest) => {
    if (song.link) {
      window.open(song.link, '_blank');
    }
  };

  const loadSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/song-request');
      const data = await res.json();
      if (data.success) {
        const all: SongRequest[] = data.requests;
        const filtered = playlist
          ? all.filter(s => s.playlist.toLowerCase().includes(playlist.toLowerCase()))
          : all;
        setAdded(filtered.filter(s => s.status === 'added').sort((a, b) => (b.votes || 0) - (a.votes || 0)).slice(0, 10));
        setNewSongs(filtered.filter(s => s.status === 'new' || s.status === 'in_progress'));
        if (user?.id) {
          const voted = new Set<string>();
          filtered.forEach(s => { if (s.votedBy?.includes(user.id)) voted.add(s._id); });
          setVotedIds(voted);
        }
      }
    } catch {}
    setLoading(false);
  }, [playlist, user?.id]);

  useEffect(() => { loadSongs(); }, [loadSongs]);
  useEffect(() => {
    fetch('/api/radio-stations').then(r => r.json()).then(d => { if (d.success) setStations(d.stations || []); }).catch(() => {});
  }, []);

  const handleVote = async (songId: string) => {
    if (!isLoggedIn || !user?.id) return;
    const alreadyVoted = votedIds.has(songId);
    setVotedIds(prev => { const n = new Set(prev); if (alreadyVoted) n.delete(songId); else n.add(songId); return n; });
    setNewSongs(prev => prev.map(s => s._id === songId ? { ...s, votes: (s.votes || 0) + (alreadyVoted ? -1 : 1) } : s));
    try {
      await fetch('/api/song-request', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: songId, userId: user.id }) });
    } catch {}
  };

  const sorted = [...newSongs].sort((a, b) =>
    sortBy === 'votes' ? (b.votes || 0) - (a.votes || 0) : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Scroll helpers for desktop
  const scrollPicks = (direction: 'left' | 'right') => {
    if (picksScrollRef.current) {
      const scrollAmount = 300;
      picksScrollRef.current.scrollBy({ 
        left: direction === 'left' ? -scrollAmount : scrollAmount, 
        behavior: 'smooth' 
      });
    }
  };

  return (
    <div className="mt-6 space-y-8">

      {/* TOP COMMUNITY PICKS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-[#22C55E]" />
              <span className="font-bold text-sm uppercase tracking-wider text-gray-900">Top Community Picks</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">These tracks made it to the playlist this month</p>
          </div>
          {/* Desktop scroll arrows */}
          {!loading && added.length > 3 && (
            <div className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => scrollPicks('left')}
                className="w-8 h-8 rounded-full bg-white/80 border border-warm flex items-center justify-center hover:bg-[#22C55E]/10 hover:border-[#22C55E] transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button 
                onClick={() => scrollPicks('right')}
                className="w-8 h-8 rounded-full bg-white/80 border border-warm flex items-center justify-center hover:bg-[#22C55E]/10 hover:border-[#22C55E] transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <CommunityPicksSkeleton />
        ) : added.length > 0 ? (
          <div ref={picksScrollRef} className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {added.slice(0, 5).map((song, i) => {
              const idx = ((song.band.charCodeAt(0) || 0) + (song.song.charCodeAt(0) || 0)) % ART_COLORS.length;
              const c = ART_COLORS[idx];
              return (
                <div 
                  key={song._id} 
                  onClick={() => handlePlaySong(song)}
                  className="flex-shrink-0 w-32 rounded-xl overflow-hidden relative group cursor-pointer hover:scale-105 transition-transform" 
                  style={{ backgroundColor: c.bg }}
                >
                  {song.link && (
                    <a href={song.link} target="_blank" rel="noopener noreferrer"
                      className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={e => e.stopPropagation()}>
                      <ExternalLink className="w-3.5 h-3.5 text-white/70" />
                    </a>
                  )}
                  <div className="h-28 flex items-center justify-center relative overflow-hidden">
                    {song.coverImage ? (
                      <img src={song.coverImage} alt={song.song} className="w-full h-full object-cover group-hover:opacity-30 transition-opacity" />
                    ) : (
                      <Music style={{ color: c.accent }} className="w-12 h-12 group-hover:opacity-30 transition-opacity" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-[#1DB954] flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-2 bg-black/40">
                    <p className="text-[11px] font-bold text-white truncate">{song.song}</p>
                    <p className="text-[9px] text-white/60 truncate">{song.band}</p>
                    <span className="text-[8px] text-white/40 mt-1">@{song.username}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">No community picks yet</p>
        )}
      </div>

      {/* Separator */}
      <div className="border-t border-warm my-6" />

      {/* NEW SUGGESTIONS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-[#22C55E]" />
              <span className="font-bold text-sm uppercase tracking-wider text-gray-900">Song Suggestions</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Discover new tracks and vote for your favorites</p>
          </div>
          {!loading && (
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'votes' | 'newest')}
              className="text-xs border border-warm rounded-lg px-2 py-1.5 bg-cream text-gray-700 focus:outline-none focus:border-[#22C55E]">
              <option value="votes">Top Voted</option>
              <option value="newest">Newest</option>
            </select>
          )}
        </div>

        {/* Suggestion list */}
        {loading ? (
          <SuggestionsSkeleton />
        ) : (
          <div className="space-y-2">
          {sorted.map(song => {
            const voted = votedIds.has(song._id);
            return (
              <div 
                key={song._id} 
                onClick={() => song.link && handlePlaySong(song)}
                className={`flex items-center gap-3 p-3 bg-cream border border-warm rounded-xl hover:border-[#22C55E]/30 hover:shadow-sm transition-all ${song.link ? 'cursor-pointer' : ''}`}
              >
                {/* Album cover or play icon */}
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden relative"
                  style={{ opacity: song.link ? 1 : 0.4, backgroundColor: song.coverImage ? undefined : '#1DB954' }}
                >
                  {song.coverImage ? (
                    <>
                      <img src={song.coverImage} alt={song.song} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                      </div>
                    </>
                  ) : (
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">{song.song}</p>
                    <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E] flex-shrink-0">
                      {song.playlist}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{song.band}</p>
                  <p className="text-[10px] text-gray-400">
                    Suggested by @{song.username} · {timeAgo(song.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-10">
                  <span className="text-sm font-bold text-gray-900">{song.votes || 0}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide">VOTES</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleVote(song._id); }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    voted ? 'bg-[#22C55E] text-white shadow-md scale-105'
                    : isLoggedIn ? 'bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E] hover:text-white'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                  title={!isLoggedIn ? 'Log in to vote' : voted ? 'Remove vote' : 'Vote'}>
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-400">
              <Music className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              No suggestions yet. Be the first!
            </div>
          )}
          </div>
        )}
      </div>

    </div>
  );
}
