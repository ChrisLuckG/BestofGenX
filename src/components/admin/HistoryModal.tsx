"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, X, Sparkles, FileText, RotateCcw, Check, Play, BookOpen, Eye, Youtube } from "lucide-react";

/**
 * Minimal "On This Day" History flow, extracted from the Newsroom Conference so it
 * can be driven from the Articles tab.
 *
 * It keeps the parts of the conference flow that carry behaviour, and drops the
 * conference scaffolding (departments, chat, piece lifecycle):
 *  - reporters are asked SEQUENTIALLY, each one told what the others already found,
 *    otherwise several reporters return the same event
 *  - previously used titles are remembered for 21 days under the SAME localStorage
 *    key the conference uses, so a multi-day event (Woodstock, 15-18 Aug 1969)
 *    cannot be retold once per day of its span
 *  - the admin account ("Eastercorn") is excluded from the roster
 *
 * Banner and headline are optional for /api/editorial/history-compile: without a
 * banner the route generates a cover itself, which takes ~2 minutes.
 */

const HISTORY_USED_KEY = "newsroom-historyUsed";
const USED_TITLE_TTL_MS = 21 * 24 * 60 * 60 * 1000;

interface HistoryEvent {
  id: string;
  title: string;
  year: number;
  date: string;
  description: string;
  category: string;
  youtubeSearch: string;
  youtubeVideoId?: string;
  reporterId: string;
  reporterName: string;
  selected: boolean;
  loading: boolean;
  error?: string;
}

interface Reporter {
  id: string;
  name: string;
}

interface HistoryModalProps {
  onClose: () => void;
  /** Called after an article was created, so the caller can refresh its list. */
  onCreated?: () => void;
}

/**
 * Pull the 11-character video id out of whatever the user pasted: a watch URL, a
 * youtu.be short link, an /embed/ or /shorts/ path, or the bare id. Returns null
 * when nothing id-shaped is in there, so a typo clears the video instead of
 * storing a string that renders as a broken thumbnail.
 */
export function parseYouTubeId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) return value;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /\/embed\/([\w-]{11})/,
    /\/shorts\/([\w-]{11})/,
    /\/live\/([\w-]{11})/,
  ];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) return m[1];
  }
  return null;
}

function recentlyUsedTitles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_USED_KEY) || "[]") as Array<{ title: string; at: number }>;
    const cutoff = Date.now() - USED_TITLE_TTL_MS;
    return raw.filter(e => e.at > cutoff).map(e => e.title);
  } catch {
    return [];
  }
}

function rememberTitle(title: string) {
  if (typeof window === "undefined" || !title) return;
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_USED_KEY) || "[]") as Array<{ title: string; at: number }>;
    const cutoff = Date.now() - USED_TITLE_TTL_MS;
    const next = raw.filter(e => e.at > cutoff && e.title !== title);
    next.push({ title, at: Date.now() });
    localStorage.setItem(HISTORY_USED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export default function HistoryModal({ onClose, onCreated }: HistoryModalProps) {
  const [reporters, setReporters] = useState<Reporter[]>([]);
  const [reportersLoading, setReportersLoading] = useState(true);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [searching, setSearching] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerGenerating, setBannerGenerating] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [headline, setHeadline] = useState<string | null>(null);
  const [headlineGenerating, setHeadlineGenerating] = useState(false);
  // Pasted-but-not-yet-saved video links, keyed by event id, plus the rejection
  // reason. Kept out of the event itself so a draft never reaches the article.
  const [videoDrafts, setVideoDrafts] = useState<Record<string, string>>({});
  const [videoErrors, setVideoErrors] = useState<Record<string, string>>({});
  const cancelRef = useRef(false);

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // Load the AI reporters. "Eastercorn" is the admin account, not a reporter -
  // asking it for a historical event would use a profile with no valid voice.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/users?isAIReporter=true");
        const data = await res.json();
        if (!active) return;
        if (data.success) {
          setReporters(
            (data.users || [])
              .filter((u: any) => u._id && u.username !== "ai_eastercorn" && u.displayName !== "Eastercorn")
              .map((u: any) => ({ id: String(u._id), name: u.displayName || u.username }))
          );
        }
      } catch {
        /* surfaced as "no reporters" below */
      } finally {
        if (active) setReportersLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const patch = (id: string, changes: Partial<HistoryEvent>) =>
    setEvents(prev => prev.map(e => (e.id === id ? { ...e, ...changes } : e)));

  // Attach a hand-picked video. Validated on save rather than while typing, so a
  // half-typed link is not silently ignored and a bad one says why.
  const saveVideo = (eventId: string) => {
    const raw = (videoDrafts[eventId] || "").trim();
    if (!raw) return;
    const id = parseYouTubeId(raw);
    if (!id) {
      setVideoErrors(prev => ({ ...prev, [eventId]: "Not a YouTube link or video id" }));
      return;
    }
    patch(eventId, { youtubeVideoId: id });
    setVideoDrafts(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    setVideoErrors(prev => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  };

  const fetchEvent = async (reporterId: string, exclude: string[]) => {
    const res = await fetch("/api/editorial/history-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reporterId,
        excludeEvents: exclude,
        // Keep the event when YouTube has nothing: it already passed the pool and
        // day-exactness gates, and a video can be pasted in by hand below.
        allowWithoutVideo: true,
      }),
    });
    return res.json();
  };

  const startSearch = async () => {
    if (reporters.length === 0) return;
    cancelRef.current = false;
    setSearching(true);
    setHeadline(null);
    setVideoDrafts({});
    setVideoErrors({});

    const pending: HistoryEvent[] = reporters.map(r => ({
      id: `${r.id}-${Date.now()}`,
      title: "",
      year: 0,
      date: "",
      description: "",
      category: "",
      youtubeSearch: "",
      reporterId: r.id,
      reporterName: r.name,
      selected: false,
      loading: true,
    }));
    setEvents(pending);

    // Sequential on purpose: each reporter is told what the others already found.
    // Seeded with earlier days so multi-day events do not resurface daily.
    const found = recentlyUsedTitles();

    for (const entry of pending) {
      if (cancelRef.current) {
        setEvents(prev => prev.map(e => (e.loading ? { ...e, loading: false, error: "Stopped" } : e)));
        break;
      }
      try {
        const data = await fetchEvent(entry.reporterId, found);
        if (data.success && data.event) {
          found.push(data.event.title);
          rememberTitle(data.event.title);
          patch(entry.id, { ...data.event, loading: false, selected: true });
        } else {
          patch(entry.id, { loading: false, error: data.error || "Failed" });
        }
      } catch {
        patch(entry.id, { loading: false, error: "Network error" });
      }
    }

    cancelRef.current = false;
    setSearching(false);
  };

  // Re-roll one reporter, excluding what the others currently hold.
  const rerollEvent = async (event: HistoryEvent) => {
    // The card keeps its id, so an unsaved draft would otherwise stick to the NEW
    // event and could be saved onto something it was never meant for.
    setVideoDrafts(prev => {
      const next = { ...prev };
      delete next[event.id];
      return next;
    });
    setVideoErrors(prev => {
      const next = { ...prev };
      delete next[event.id];
      return next;
    });
    patch(event.id, { loading: true, error: undefined, youtubeVideoId: undefined });
    const exclude = events.filter(e => e.id !== event.id && e.title).map(e => e.title);
    try {
      const data = await fetchEvent(event.reporterId, exclude);
      if (data.success && data.event) {
        rememberTitle(data.event.title);
        patch(event.id, { ...data.event, loading: false, selected: true });
      } else {
        patch(event.id, { loading: false, error: data.error || "Failed" });
      }
    } catch {
      patch(event.id, { loading: false, error: "Network error" });
    }
  };

  const selected = events.filter(e => e.selected && !e.error && e.title);

  const generateHeadline = async () => {
    if (selected.length === 0) return;
    setHeadlineGenerating(true);
    try {
      const res = await fetch("/api/editorial/history-headline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: selected.map(e => ({ title: e.title, year: e.year })) }),
      });
      const data = await res.json();
      if (data.success && data.headline) setHeadline(data.headline);
    } catch {
      /* keep the previous headline */
    }
    setHeadlineGenerating(false);
  };

  const generateBanner = async () => {
    if (selected.length === 0) return;
    setBannerGenerating(true);
    try {
      const res = await fetch("/api/editorial/history-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: selected.map(e => ({ title: e.title, year: e.year, category: e.category })),
        }),
      });
      const data = await res.json();
      if (data.success && data.imageUrl) {
        setBanner(data.imageUrl);
        if (data.headline) setHeadline(data.headline);
        setShowBanner(true);
      } else {
        alert(`Banner failed: ${data.error}`);
      }
    } catch {
      alert("Banner failed: network error");
    }
    setBannerGenerating(false);
  };

  const createArticle = async () => {
    if (selected.length === 0) return;
    setCompiling(true);
    try {
      const res = await fetch("/api/editorial/history-compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          events: selected.map(e => ({
            title: e.title,
            year: e.year,
            date: e.date,
            description: e.description,
            category: e.category,
            youtubeSearch: e.youtubeSearch,
            youtubeVideoId: e.youtubeVideoId,
            reporterId: e.reporterId,
            reporterName: e.reporterName,
          })),
          bannerImage: banner,
          headline,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEvents([]);
        setBanner(null);
        setHeadline(null);
        onCreated?.();
        alert(`History article created as draft.\n\nTitle: ${data.title}\nEvents: ${data.eventCount}`);
        onClose();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch {
      alert("Failed: network error");
    }
    setCompiling(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-500" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">On This Day — {today}</h3>
              <p className="text-xs text-gray-500">Each reporter proposes one historical event</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {reportersLoading
              ? "Loading reporters..."
              : reporters.length === 0
                ? "No reporters available"
                : `${reporters.length} reporters${events.length > 0 ? ` · ${selected.length} of ${events.length} selected` : ""}`}
          </span>
          <div className="flex items-center gap-2">
            {searching && (
              <button
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
              >
                <X className="w-3 h-3" /> Stop
              </button>
            )}
            <button
              onClick={startSearch}
              disabled={searching || reportersLoading || reporters.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {events.length > 0 ? "Search Again" : "Start Search"}
            </button>
          </div>
        </div>

        {/* Events */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <BookOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm font-medium text-gray-500">No events yet</p>
              <p className="text-xs mt-1">Click &quot;Start Search&quot; to let the reporters propose events</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {events.map(event => (
                <div
                  key={event.id}
                  onClick={() => {
                    if (!event.loading && !event.error) patch(event.id, { selected: !event.selected });
                  }}
                  className={`rounded-lg border p-3 transition-colors ${
                    event.loading
                      ? "border-gray-200 bg-gray-50"
                      : event.error
                        ? "border-red-200 bg-red-50"
                        : event.selected
                          ? "border-green-500 bg-green-50/40 cursor-pointer"
                          : "border-gray-200 hover:border-gray-300 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">{event.reporterName}</span>
                    {!event.loading && !event.error && (
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          event.selected ? "bg-green-600 border-green-600" : "border-gray-300"
                        }`}
                      >
                        {event.selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    )}
                  </div>

                  {event.loading ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                      <span className="text-xs text-gray-500">Searching...</span>
                    </div>
                  ) : event.error ? (
                    <div className="py-1">
                      <p className="text-xs text-red-600">{event.error}</p>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          rerollEvent(event);
                        }}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> Try again
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] text-gray-400 mb-0.5">{event.date}</div>
                      <h4 className="text-sm font-bold text-gray-900 mb-1.5">{event.title}</h4>
                      <p className="text-xs text-gray-600 leading-relaxed mb-2">{event.description}</p>

                      {event.youtubeVideoId ? (
                        <div className="mb-2">
                          <a
                            href={`https://www.youtube.com/watch?v=${event.youtubeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="relative block rounded overflow-hidden group"
                          >
                            <img
                              src={`https://img.youtube.com/vi/${event.youtubeVideoId}/mqdefault.jpg`}
                              alt={event.title}
                              className="w-full h-auto rounded"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                              <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                                <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
                              </div>
                            </div>
                          </a>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              patch(event.id, { youtubeVideoId: undefined });
                            }}
                            className="mt-1 text-[10px] text-gray-400 hover:text-gray-600"
                          >
                            Remove video
                          </button>
                        </div>
                      ) : (
                        // No footage was found. The event itself is verified, so it stays
                        // usable - paste a link and it is attached to the article.
                        <div className="mb-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <Youtube className="w-3 h-3 text-gray-400 flex-shrink-0" />
                            <input
                              value={videoDrafts[event.id] || ""}
                              onChange={e => {
                                const value = e.target.value;
                                setVideoDrafts(prev => ({ ...prev, [event.id]: value }));
                                if (videoErrors[event.id]) {
                                  setVideoErrors(prev => {
                                    const next = { ...prev };
                                    delete next[event.id];
                                    return next;
                                  });
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  saveVideo(event.id);
                                }
                              }}
                              placeholder="Paste a YouTube link"
                              className={`flex-1 bg-white border px-2 py-1 rounded text-[10px] text-gray-700 ${
                                videoErrors[event.id] ? "border-red-400" : "border-gray-300"
                              }`}
                            />
                            <button
                              onClick={() => saveVideo(event.id)}
                              disabled={!(videoDrafts[event.id] || "").trim()}
                              className="px-2 py-1 rounded text-[10px] font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-40 flex-shrink-0"
                            >
                              Save
                            </button>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className={`text-[10px] ${videoErrors[event.id] ? "text-red-600" : "text-gray-400"}`}>
                              {videoErrors[event.id] || "No video found automatically"}
                            </p>
                            <a
                              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                                event.youtubeSearch || `${event.title} ${event.year}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-gray-400 hover:text-gray-600 underline"
                            >
                              search on YouTube
                            </a>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                          {event.category}
                        </span>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            rerollEvent(event);
                          }}
                          className="text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        >
                          <RotateCcw className="w-2.5 h-2.5" /> Different event
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {events.length > 0 && (
          <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14 flex-shrink-0">Headline</span>
              <input
                value={headline || ""}
                onChange={e => setHeadline(e.target.value || null)}
                placeholder="Optional — generated if left empty"
                className="flex-1 bg-white border border-gray-300 px-2 py-1 rounded text-xs text-gray-900"
              />
              <button
                onClick={generateHeadline}
                disabled={headlineGenerating || selected.length === 0}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
              >
                {headlineGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Generate
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {banner && (
                  <button
                    onClick={() => setShowBanner(true)}
                    className="relative w-16 h-10 rounded overflow-hidden border border-green-500"
                    title="View banner"
                  >
                    <img src={banner} alt="Banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                      <Eye className="w-3 h-3 text-white" />
                    </div>
                  </button>
                )}
                <button
                  onClick={generateBanner}
                  disabled={bannerGenerating || selected.length === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-50"
                >
                  {bannerGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {bannerGenerating ? "Generating... (60-90s)" : banner ? "Regenerate banner" : "Generate banner"}
                </button>
                {!banner && <span className="text-[10px] text-gray-400">optional — cover is generated on save</span>}
              </div>

              <button
                onClick={createArticle}
                disabled={compiling || selected.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 flex-shrink-0"
              >
                {compiling ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                {compiling ? "Creating..." : `Create History Article (${selected.length})`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Banner preview */}
      {showBanner && banner && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-6"
          onClick={() => setShowBanner(false)}
        >
          <img src={banner} alt="Banner" className="max-w-full max-h-full rounded shadow-xl" />
        </div>
      )}
    </div>
  );
}
