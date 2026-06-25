"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Music, RefreshCw, Copy, Check, ExternalLink, FileText, Plus, Trash2, Radio, GripVertical, Edit2 } from "lucide-react";
import GenXLoader from "@/components/GenXLoader";

interface RadioStation {
  _id: string;
  name: string;
  description: string;
  playlistId: string;
  imageUrl?: string;
  order: number;
  active: boolean;
}

interface SongRequest {
  _id: string;
  username: string;
  playlist: string;
  band: string;
  song: string;
  link?: string;
  status: "new" | "in_progress" | "added" | "rejected";
  createdAt: string;
}

const STATUS_OPTIONS: { value: SongRequest["status"] | "all"; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "added", label: "Added" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

const STATUS_STYLES: Record<SongRequest["status"], string> = {
  new: "bg-[#D4873A]/20 text-[#D4873A]",
  in_progress: "bg-blue-500/20 text-blue-400",
  added: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
};

interface RequestsTabProps {
  onArticleCreated?: () => void;
  onStatusChange?: () => void;
}

export default function RequestsTab({ onArticleCreated, onStatusChange }: RequestsTabProps) {
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [allAddedRequests, setAllAddedRequests] = useState<SongRequest[]>([]); // All "added" songs for article generation
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SongRequest["status"] | "all">("new");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<string | null>(null);
  
  // Spotify integration state
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  
  // Check Spotify connection status
  useEffect(() => {
    fetch('/api/spotify/status')
      .then(res => res.json())
      .then(data => setSpotifyConnected(data.connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  // Add song to Spotify playlist
  const addToSpotifyPlaylist = async (request: SongRequest) => {
    if (!request.link) {
      alert('No Spotify link available');
      return;
    }
    
    // Find the matching station/playlist (partial match - station name contains playlist name)
    const station = stations.find(s => 
      s.name.toLowerCase().includes(request.playlist.toLowerCase()) ||
      request.playlist.toLowerCase().includes(s.name.toLowerCase())
    );
    if (!station) {
      alert(`No station found for playlist "${request.playlist}". Add the station first.`);
      return;
    }

    setAddingToPlaylist(request._id);
    try {
      const res = await fetch('/api/spotify/add-to-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spotifyUrl: request.link,
          playlistId: station.playlistId,
        }),
      });
      
      // Check if response is JSON
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        alert('Server error - please reconnect Spotify');
        return;
      }
      
      const data = await res.json();
      
      if (data.needsAuth) {
        // Redirect to Spotify auth
        window.location.href = '/api/spotify/auth';
        return;
      }
      
      if (data.success) {
        // Update status to "added"
        await updateStatus(request._id, 'added');
        alert('Song added to playlist!');
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Failed to add to playlist:', e);
      alert('Failed to add to playlist');
    } finally {
      setAddingToPlaylist(null);
    }
  };
  
  // Radio stations state
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [newStation, setNewStation] = useState({ name: '', description: '', playlistId: '', imageUrl: '' });
  const [addingStation, setAddingStation] = useState(false);
  const [editingStation, setEditingStation] = useState<RadioStation | null>(null);

  // Load radio stations
  const loadStations = useCallback(async () => {
    setStationsLoading(true);
    try {
      const res = await fetch('/api/radio-stations');
      const data = await res.json();
      if (data.success) setStations(data.stations || []);
    } catch (e) {
      console.error('Failed to load stations:', e);
    } finally {
      setStationsLoading(false);
    }
  }, []);

  // Add new station
  const addStation = async () => {
    if (!newStation.name || !newStation.playlistId) {
      alert('Name and Playlist ID required');
      return;
    }
    setAddingStation(true);
    try {
      const res = await fetch('/api/radio-stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newStation),
      });
      const data = await res.json();
      if (data.success) {
        setStations(prev => [...prev, data.station]);
        setNewStation({ name: '', description: '', playlistId: '', imageUrl: '' });
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Failed to add station:', e);
    } finally {
      setAddingStation(false);
    }
  };

  // Delete station
  const deleteStation = async (id: string) => {
    if (!confirm('Delete this station?')) return;
    try {
      await fetch(`/api/radio-stations?id=${id}`, { method: 'DELETE' });
      setStations(prev => prev.filter(s => s._id !== id));
    } catch (e) {
      console.error('Failed to delete station:', e);
    }
  };

  // Update station
  const updateStation = async () => {
    if (!editingStation) return;
    try {
      const res = await fetch('/api/radio-stations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStation._id,
          name: editingStation.name,
          description: editingStation.description,
          playlistId: editingStation.playlistId,
          imageUrl: editingStation.imageUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStations(prev => prev.map(s => s._id === editingStation._id ? data.station : s));
        setEditingStation(null);
      } else {
        alert('Failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Failed to update station:', e);
    }
  };

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  const copyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateArticle = async () => {
    if (allAddedRequests.length === 0) {
      alert('No added songs to generate article from. Mark songs as "Added" first.');
      return;
    }

    setGenerating(true);
    setGeneratedArticle(null);

    try {
      const res = await fetch('/api/admin/generate-song-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: allAddedRequests, createArticle: true }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedArticle(data.article);
        if (data.articleId) {
          alert('✅ Monthly article created! Check the Articles tab to edit and publish.');
          if (onArticleCreated) {
            // Article was created, switch to Articles tab
            onArticleCreated();
          }
        }
      } else {
        alert('Failed to generate article: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Article generation failed:', e);
      alert('Failed to generate article');
    } finally {
      setGenerating(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/song-request?status=${filter}`);
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch (e) {
      console.error("Failed to load song requests:", e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Load all "added" songs separately for article generation
  const loadAddedSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/song-request?status=added');
      const data = await res.json();
      if (data.success) setAllAddedRequests(data.requests);
    } catch (e) {
      console.error("Failed to load added songs:", e);
    }
  }, []);

  useEffect(() => {
    load();
    loadAddedSongs();
  }, [load, loadAddedSongs]);

  const updateStatus = async (id: string, status: SongRequest["status"]) => {
    // Optimistic update - remove from list if status doesn't match current filter
    setRequests((prev) => {
      if (filter === "all") {
        // If showing all, just update the status
        return prev.map((r) => (r._id === id ? { ...r, status } : r));
      } else {
        // If filtered, remove the item since it no longer matches
        return prev.filter((r) => r._id !== id);
      }
    });
    try {
      await fetch("/api/song-request", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      // Notify parent to refresh badge count
      onStatusChange?.();
    } catch (e) {
      console.error("Failed to update status:", e);
      load();
    }
  };

  return (
    <div className="space-y-6">
      {/* Radio Stations Section */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#1DB954]" />
            <h2 className="text-sm font-bold">Radio Stations</h2>
            <span className="text-xs text-gray-500">({stations.length})</span>
          </div>
        </div>

        {/* Add New Station Form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Station Name"
            value={newStation.name}
            onChange={(e) => setNewStation(prev => ({ ...prev, name: e.target.value }))}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
          />
          <input
            type="text"
            placeholder="Description"
            value={newStation.description}
            onChange={(e) => setNewStation(prev => ({ ...prev, description: e.target.value }))}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
          />
          <input
            type="text"
            placeholder="Spotify Playlist ID"
            value={newStation.playlistId}
            onChange={(e) => setNewStation(prev => ({ ...prev, playlistId: e.target.value }))}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
          />
          <input
            type="text"
            placeholder="Cover Image URL (optional)"
            value={newStation.imageUrl}
            onChange={(e) => setNewStation(prev => ({ ...prev, imageUrl: e.target.value }))}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
          />
          <button
            onClick={addStation}
            disabled={addingStation || !newStation.name || !newStation.playlistId}
            className="px-4 py-2 bg-[#1DB954] text-white rounded-lg text-sm font-medium hover:bg-[#1ed760] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {addingStation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>

        {/* Stations Grid */}
        {stationsLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-[#1DB954] animate-spin" />
          </div>
        ) : stations.length === 0 ? (
          <p className="text-center text-gray-500 text-sm py-4">No stations yet. Add your first Spotify playlist above.</p>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {stations.map((station) => (
              <div 
                key={station._id} 
                onClick={() => window.open(`https://open.spotify.com/playlist/${station.playlistId}`, '_blank')}
                className="bg-gray-700/50 rounded-lg p-2 border border-gray-600 hover:border-[#1DB954]/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                  </div>
                  <p className="text-[11px] font-bold text-white truncate flex-1">{station.name.replace('Best of GenX - ', '')}</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingStation(station); }}
                    className="flex-1 py-1 rounded bg-[#D4873A]/10 text-[#D4873A] hover:bg-[#D4873A]/20 transition-colors text-[10px] font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteStation(station._id); }}
                    className="px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Station Modal */}
        {editingStation && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-4 w-full max-w-md border border-gray-700">
              <h3 className="text-sm font-bold text-white mb-4">Edit Station</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Station Name"
                  value={editingStation.name}
                  onChange={(e) => setEditingStation({ ...editingStation, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={editingStation.description}
                  onChange={(e) => setEditingStation({ ...editingStation, description: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
                />
                <input
                  type="text"
                  placeholder="Spotify Playlist ID"
                  value={editingStation.playlistId}
                  onChange={(e) => setEditingStation({ ...editingStation, playlistId: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
                />
                <input
                  type="text"
                  placeholder="Cover Image URL (optional)"
                  value={editingStation.imageUrl || ''}
                  onChange={(e) => setEditingStation({ ...editingStation, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:border-[#D4873A]"
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setEditingStation(null)}
                  className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={updateStation}
                  className="flex-1 py-2 bg-[#1DB954] text-white rounded-lg text-sm font-medium hover:bg-[#1ed760]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Song Requests Section */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-[#D4873A]" />
            <h2 className="text-sm font-bold">Song Requests</h2>
            <span className="text-xs text-gray-500">({requests.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Spotify</span>
              <button
                onClick={async () => {
                  if (spotifyConnected) {
                    await fetch('/api/spotify/disconnect', { method: 'POST' });
                    setSpotifyConnected(false);
                  } else {
                    window.location.href = '/api/spotify/auth';
                  }
                }}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  spotifyConnected ? 'bg-[#1DB954]' : 'bg-gray-600'
                }`}
              >
                <span 
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    spotifyConnected ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <button
              onClick={() => { load(); loadStations(); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              filter === opt.value ? "bg-[#D4873A] text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#D4873A] animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-12">No song requests yet.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req._id}
              className="bg-gray-800 border border-gray-700 rounded-xl p-3"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {req.band} — {req.song}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {req.playlist} · by {req.username} · {new Date(req.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_STYLES[req.status]}`}>
                    {req.status.replace("_", " ")}
                  </span>
                  <select
                    value={req.status}
                    onChange={(e) => updateStatus(req._id, e.target.value as SongRequest["status"])}
                    className="text-xs bg-gray-700 text-white rounded-lg px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-[#D4873A]"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="added">Added</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
              {/* Spotify Link Row */}
              {req.link && (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-700">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">Spotify:</span>
                  <a 
                    href={req.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-[#1DB954] hover:underline truncate flex-1"
                  >
                    {req.link}
                  </a>
                  <button
                    onClick={() => copyLink(req._id, req.link!)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      copiedId === req._id 
                        ? "bg-green-500/20 text-green-400" 
                        : "bg-gray-700 text-gray-400 hover:text-white"
                    }`}
                    title="Copy link"
                  >
                    {copiedId === req._id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={req.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-gray-700 text-[#1DB954] hover:bg-gray-600 transition-colors"
                    title="Open in Spotify"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => addToSpotifyPlaylist(req)}
                    disabled={addingToPlaylist === req._id || req.status === 'added'}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 ${
                      req.status === 'added'
                        ? 'bg-green-500/20 text-green-400 cursor-default'
                        : 'bg-[#1DB954] text-white hover:bg-[#1ed760]'
                    }`}
                    title={spotifyConnected ? "Add to playlist" : "Connect Spotify first"}
                  >
                    {addingToPlaylist === req._id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : req.status === 'added' ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    {req.status === 'added' ? 'Added' : 'Add'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Generate Article Section */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={generateArticle}
            disabled={generating || allAddedRequests.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#D4873A] text-white hover:bg-[#C4772A]"
          >
            {generating ? (
              <GenXLoader size="sm" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {generating ? 'Generating...' : 'Generate Monthly Article'}
          </button>
          <p className="text-xs text-gray-500 mt-1">
            Creates an article from all "Added" songs ({allAddedRequests.length} songs ready)
          </p>

          {/* Generated Article Preview */}
          {generatedArticle && (
            <div className="mt-4 bg-gray-700 border border-gray-600 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Generated Article</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedArticle);
                    alert('Article copied to clipboard!');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-gray-600 text-gray-300 hover:bg-gray-500 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy
                </button>
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap text-xs leading-relaxed max-h-96 overflow-y-auto">
                {generatedArticle}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
