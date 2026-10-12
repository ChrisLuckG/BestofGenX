"use client";

import { useState, useEffect } from "react";
import { Loader2, X, Radio, FileText, Music } from "lucide-react";

/**
 * Minimal "Community Radio" article flow, extracted from the Newsroom Conference
 * so it can be driven from the Articles tab.
 *
 * Unlike the History flow, the article is created by the API itself:
 * /api/editorial/chat with `articleMode: true` writes an Article and returns
 * `articleDraftId`. Without `autoPublish` it lands as a draft.
 *
 * Two flags carry behaviour and must be sent together:
 *  - `skipYoutube: true` - this is a music piece, so no YouTube search happens and
 *    the sections get Spotify embeds instead. It also switches the route to the
 *    radio JSON format (`spotifyEmbed` per section) and turns on @username
 *    highlighting
 *  - `spotifyLinks` - the route matches songs by `song|band` to build the embeds.
 *    Without it the sections have nothing to embed
 *
 * Only requests with status "added" are used, same as the conference: those are
 * the ones curated in the Requests tab.
 */

interface SongRequest {
  _id: string;
  username: string;
  playlist: string;
  band: string;
  song: string;
  link?: string;
  coverImage?: string;
}

interface Reporter {
  id: string;
  name: string;
}

interface RadioModalProps {
  onClose: () => void;
  /** Called after an article was created, so the caller can refresh its list. */
  onCreated?: () => void;
}

export default function RadioModal({ onClose, onCreated }: RadioModalProps) {
  const [songs, setSongs] = useState<SongRequest[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [reporterId, setReporterId] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // Songs curated in the Requests tab, plus the reporter roster. "Eastercorn" is
  // the admin account, not a reporter - its writingStyle is not one of the four
  // defined voices, so an article written "by" it silently uses a fallback voice.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [songsRes, usersRes] = await Promise.all([
          fetch("/api/song-request?status=added"),
          fetch("/api/admin/users?isAIReporter=true"),
        ]);
        const songsData = await songsRes.json();
        const usersData = await usersRes.json();
        if (!active) return;
        if (songsData.success) setSongs(songsData.requests || []);
        if (usersData.success) {
          const list: Reporter[] = (usersData.users || [])
            .filter((u: any) => u._id && u.username !== "ai_eastercorn" && u.displayName !== "Eastercorn")
            .map((u: any) => ({ id: String(u._id), name: u.displayName || u.username }));
          setReporters(list);
          if (list.length > 0) setReporterId(list[0].id);
        }
      } catch {
        /* surfaced as empty states below */
      } finally {
        if (active) setSongsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Songs per playlist, for the summary line - it is the one thing that tells you
  // at a glance what the article will be about.
  const byPlaylist = songs.reduce<Record<string, number>>((acc, s) => {
    const key = s.playlist || "Unsorted";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const generate = async () => {
    if (songs.length === 0 || !reporterId) return;
    const reporter = reporters.find(r => r.id === reporterId);
    setGenerating(true);

    const songList = songs
      .map(
        r =>
          `- "${r.song}" by ${r.band} (requested by @${r.username} for ${r.playlist})${
            r.link ? ` [SPOTIFY: ${r.link}]` : ""
          }`
      )
      .join("\n");

    const prompt = `Write a "Community Radio" article celebrating the songs our readers requested this month.

SONG REQUESTS FROM OUR COMMUNITY:
${songList}

Write an engaging article that:
1. Thanks our community for their great taste in music
2. Groups songs by genre/mood/era if possible
3. Tells a short story or fun fact about 3-5 of the most interesting songs
4. Mentions the usernames who requested them (they'll love seeing their name!)
5. Encourages more song requests

IMPORTANT FORMATTING:
- For each section, use "spotifyEmbed" instead of "youtubeSearch"
- Use the SPOTIFY links provided above (the [SPOTIFY: ...] URLs)
- DO NOT search for YouTube videos - this is a MUSIC article with Spotify embeds only

Tone: Warm, appreciative, music-nerd enthusiastic. Like a DJ thanking callers.
Category: music
Length: 800-1200 words

IMPORTANT: Generate a full article, NOT a birthday proposal. This is about the SONGS listed above.`;

    try {
      const res = await fetch("/api/editorial/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reporterUserId: reporterId,
          message: prompt,
          articleMode: true,
          // Music piece: no YouTube search, Spotify embeds instead.
          skipYoutube: true,
          spotifyLinks: songs.map(s => ({
            song: s.song,
            band: s.band,
            link: s.link,
            coverImage: s.coverImage,
          })),
          // autoPublish deliberately omitted - the article lands as a draft.
        }),
      });
      const data = await res.json();
      const articleId = data.articleDraftId || data.articleId;

      if (articleId) {
        onCreated?.();
        alert(
          `Radio article created as draft.\n\nWritten by: ${reporter?.name || "reporter"}\nSongs: ${songs.length}`
        );
        onClose();
      } else {
        alert(`Failed: ${data.error || data.response || data.reply || "no article was returned"}`);
      }
    } catch (e: any) {
      alert(`Failed: ${e?.message || "network error"}`);
    }
    setGenerating(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-gray-500" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">Community Radio Article</h3>
              <p className="text-xs text-gray-500">Built from the song requests marked &quot;Added&quot;</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {songsLoading
              ? "Loading song requests..."
              : songs.length === 0
                ? "No songs marked \u201cAdded\u201d"
                : `${songs.length} songs · ${Object.keys(byPlaylist).length} playlists`}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500">Written by</label>
            <select
              value={reporterId}
              onChange={e => setReporterId(e.target.value)}
              disabled={reporters.length === 0 || generating}
              className="bg-white border border-gray-300 px-2 py-1 rounded text-xs text-gray-900 disabled:opacity-50"
            >
              {reporters.length === 0 && <option value="">No reporters</option>}
              {reporters.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Songs */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {songsLoading ? (
            <div className="h-full flex items-center justify-center gap-2 py-12 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : songs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <Music className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No songs available</p>
              <p className="text-xs mt-1">Mark song requests as &quot;Added&quot; in the Requests tab first</p>
            </div>
          ) : (
            <div className="space-y-1">
              {songs.map(s => (
                <div key={s._id} className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
                  {s.coverImage ? (
                    <img src={s.coverImage} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Music className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 truncate">{s.song}</div>
                    <div className="text-[10px] text-gray-500 truncate">{s.band}</div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">
                    {s.playlist}
                  </span>
                  <span className="text-[10px] text-gray-400 w-24 truncate text-right flex-shrink-0">
                    @{s.username}
                  </span>
                  {!s.link && (
                    <span className="text-[10px] text-amber-600 flex-shrink-0" title="No Spotify link - cannot be embedded">
                      no link
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <span className="text-[10px] text-gray-400">
            {songs.length > 0 && `${songs.filter(s => s.link).length} of ${songs.length} songs can be embedded`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs rounded"
            >
              Cancel
            </button>
            <button
              onClick={generate}
              disabled={generating || songsLoading || songs.length === 0 || !reporterId}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
              {generating ? "Writing article..." : "Generate Article"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
