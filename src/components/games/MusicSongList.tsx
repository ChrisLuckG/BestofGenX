"use client";

import { useEffect, useState, useCallback } from "react";
import { Music, ChevronRight, ChevronUp, Crown, Plus, ExternalLink, Radio, Disc3, Users, Clock, BarChart2, Mic2, ListMusic, Headphones, Play } from "lucide-react";
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

const LOADING_MESSAGES = [
  { text: 'Scanning the airwaves...', Icon: Radio },
  { text: 'Fetching the community picks...', Icon: Users },
  { text: 'Digging through the crates...', Icon: Disc3 },
  { text: 'Loading tracks from the vault...', Icon: ListMusic },
  { text: 'Checking who voted for what...', Icon: BarChart2 },
  { text: 'Tuning into the frequency...', Icon: Mic2 },
  { text: 'Pulling the latest suggestions...', Icon: Music },
  { text: 'Almost there...', Icon: Clock },
];

function MusicLoader() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length);
        setFade(true);
      }, 300);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const { text, Icon } = LOADING_MESSAGES[msgIdx];

  return (
    <div className="mt-6 py-12 flex flex-col items-center gap-6">
      {/* Animated bars */}
      <div className="flex items-end gap-1 h-10">
        {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 1, 0.45, 0.75].map((h, i) => (
          <div
            key={i}
            className="w-2 rounded-t-sm bg-[#E36B11]"
            style={{
              height: `${h * 100}%`,
              animation: `musicbar 0.9s ease-in-out ${(i * 0.1).toFixed(1)}s infinite alternate`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes musicbar {
          0% { transform: scaleY(0.3); opacity: 0.4; }
          100% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>

      {/* Rotating message */}
      <div className="text-center transition-opacity duration-300" style={{ opacity: fade ? 1 : 0 }}>
        <Icon className="w-5 h-5 text-[#E36B11] mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">{text}</p>
        <p className="text-xs text-gray-400 mt-1">Hang tight, we're pulling the playlist together</p>
      </div>
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

  if (loading) return <MusicLoader />;

  return (
    <div className="mt-6 space-y-8">

      {/* TOP COMMUNITY PICKS */}
      {added.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[#E36B11]" />
                <span className="font-bold text-sm uppercase tracking-wider text-gray-900">Top Community Picks</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">These tracks made it to the playlist this month</p>
            </div>
            <button className="text-xs font-semibold text-[#E36B11] hover:underline flex items-center gap-1">
              View Full Playlist <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
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
                  <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-[#E36B11] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white">{i + 1}</span>
                  </div>
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
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] text-white/40">@{song.username}</span>
                      {(song.votes || 0) > 0 && <span className="text-[8px] bg-green-500/30 text-green-400 px-1 rounded font-bold">{song.votes}v</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NEW SUGGESTIONS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-[#E36B11]" />
              <span className="font-bold text-sm uppercase tracking-wider text-gray-900">New Suggestions</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Discover new tracks and vote for your favorites</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as 'votes' | 'newest')}
              className="text-xs border border-warm rounded-lg px-2 py-1.5 bg-cream text-gray-700 focus:outline-none focus:border-[#E36B11]">
              <option value="votes">Top Voted</option>
              <option value="newest">Newest</option>
            </select>
            {isLoggedIn && (
              <button onClick={() => setShowSuggest(s => !s)}
                className="flex items-center gap-1 px-3 py-1.5 bg-[#E36B11] text-white text-xs font-bold rounded-lg hover:bg-[#C4772A] transition-colors">
                <Plus className="w-3.5 h-3.5" /> Suggest a Song
              </button>
            )}
          </div>
        </div>

        {/* Inline suggest form */}
        {showSuggest && isLoggedIn && (
          <div className="mb-4 p-4 bg-cream border border-warm rounded-xl shadow-sm">
            {songSent ? (
              <div className="text-center py-3">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="font-bold text-sm text-gray-900">Request sent!</p>
                <button onClick={() => setSongSent(false)} className="mt-1 text-xs text-[#E36B11] hover:underline">Suggest another</button>
              </div>
            ) : (
              <div className="space-y-3">
                <select value={songData.playlist} onChange={e => setSongData(d => ({ ...d, playlist: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-warm rounded-lg bg-cream focus:outline-none focus:border-[#E36B11]">
                  <option value="">Choose playlist...</option>
                  {stations.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                </select>
                <input type="url" value={songData.link}
                  onChange={async e => {
                    const v = e.target.value;
                    setSongData(d => ({ ...d, link: v }));
                    if (v.includes('spotify.com') && v.includes('track')) {
                      try {
                        const r = await fetch(`/api/spotify-info?url=${encodeURIComponent(v)}`);
                        const d = await r.json();
                        if (d.success) setSongData(prev => ({ ...prev, song: d.song || prev.song, band: d.band || prev.band }));
                      } catch {}
                    }
                  }}
                  placeholder="Paste Spotify link..."
                  className="w-full px-3 py-2 text-sm border border-warm rounded-lg bg-cream focus:outline-none focus:border-[#E36B11]" />
                {(songData.band || songData.song) && (
                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {songData.band} – {songData.song}
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (songData.playlist && songData.band && songData.song) {
                      await fetch('/api/song-request', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user?.id, username: user?.username, ...songData }) });
                      setSongSent(true);
                      setSongData({ playlist: '', band: '', song: '', link: '' });
                      setTimeout(loadSongs, 1000);
                    }
                  }}
                  disabled={!songData.playlist || !songData.band || !songData.song}
                  className="w-full py-2 bg-[#E36B11] text-white text-sm font-bold rounded-lg hover:bg-[#C4772A] disabled:opacity-40 transition-colors">
                  Send Request
                </button>
              </div>
            )}
          </div>
        )}

        {/* Suggestion list */}
        <div className="space-y-2">
          {sorted.map(song => {
            const voted = votedIds.has(song._id);
            return (
              <div 
                key={song._id} 
                onClick={() => song.link && handlePlaySong(song)}
                className={`flex items-center gap-3 p-3 bg-cream border border-warm rounded-xl hover:border-[#E36B11]/30 hover:shadow-sm transition-all ${song.link ? 'cursor-pointer' : ''}`}
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
                  <p className="text-sm font-semibold text-gray-900 truncate">{song.song}</p>
                  <p className="text-xs text-gray-600 truncate">{song.band}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Suggested by @{song.username} · {timeAgo(song.createdAt)}
                  </p>
                  <span className="inline-block mt-1 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-[#E36B11]/10 text-[#E36B11]">
                    {song.playlist}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0 w-10">
                  <span className="text-sm font-bold text-gray-900">{song.votes || 0}</span>
                  <span className="text-[9px] text-gray-400 uppercase tracking-wide">VOTES</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleVote(song._id); }}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    voted ? 'bg-[#E36B11] text-white shadow-md scale-105'
                    : isLoggedIn ? 'bg-[#E36B11]/10 text-[#E36B11] hover:bg-[#E36B11] hover:text-white'
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

        {/* Footer */}
        <div className="mt-4 flex items-center gap-3 p-4 bg-[#E36B11]/10 border border-[#E36B11]/20 rounded-xl">
          <div className="w-9 h-9 rounded-full bg-[#E36B11]/20 flex items-center justify-center flex-shrink-0">
            <Crown className="w-4 h-4 text-[#E36B11]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Your Vote Counts!</p>
            <p className="text-xs text-gray-500">The most voted tracks make it into next month's playlist.</p>
          </div>
          {onOpenRadio && (
            <button
              onClick={onOpenRadio}
              className="flex items-center gap-2 px-4 py-2 bg-[#E36B11] text-white text-xs font-bold rounded-lg hover:bg-[#C4772A] transition-colors flex-shrink-0">
              <Headphones className="w-3.5 h-3.5" />
              Listen on Radio
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
