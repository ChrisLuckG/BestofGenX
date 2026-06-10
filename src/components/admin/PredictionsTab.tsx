"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Sparkles, Trash2, Check, RefreshCw, Clock, Calendar, X, CheckCircle2, BarChart3 } from "lucide-react";

interface PredictionOption {
  id: string;
  label: string;
}

interface OptionStat {
  id: string;
  votes: number;
  percent: number;
}

interface Prediction {
  _id: string;
  question: string;
  category: string;
  options: PredictionOption[];
  correctOptionId: string | null;
  pointsReward: number;
  status: "draft" | "active" | "resolved" | "cancelled";
  closesAt: string;
  eventDate: string;
  genXRelated: boolean;
  source: "bot" | "manual";
  totalPredictions: number;
  optionStats?: OptionStat[];
  totalVotes?: number;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-gray-600/30 text-gray-300" },
  active: { label: "Active", cls: "bg-green-500/20 text-green-400" },
  resolved: { label: "Resolved", cls: "bg-[#D4873A]/20 text-[#D4873A]" },
  cancelled: { label: "Cancelled", cls: "bg-red-500/20 text-red-400" },
};

function groupKey(iso: string): string {
  // Group by local YYYY-MM-DD of the closesAt timestamp
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeTimeLeft(iso: string): { label: string; tone: "open" | "soon" | "closed" } {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return { label: "Closed", tone: "closed" };
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  let label: string;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const remH = h % 24;
    label = `${d}d ${remH}h ${m}m ${s}s`;
  } else if (h >= 1) {
    label = `${h}h ${m}m ${s}s`;
  } else if (m >= 1) {
    label = `${m}m ${s}s`;
  } else {
    label = `${s}s`;
  }
  const tone: "open" | "soon" | "closed" = h < 1 ? "soon" : "open";
  return { label, tone };
}

// Live countdown badge component for admin
function LiveCountdownBadge({ closesAt }: { closesAt: string }) {
  const [timeData, setTimeData] = useState(() => computeTimeLeft(closesAt));

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeData(computeTimeLeft(closesAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [closesAt]);

  const bgColor =
    timeData.tone === "closed"
      ? "bg-gray-600/30"
      : timeData.tone === "soon"
        ? "bg-red-500/20"
        : "bg-[#D4873A]/20";
  const textColor =
    timeData.tone === "closed"
      ? "text-gray-400"
      : timeData.tone === "soon"
        ? "text-red-400"
        : "text-[#D4873A]";

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${bgColor} ${textColor}`}>
      <Clock className="w-3 h-3" />
      {timeData.label}
    </span>
  );
}

function formatGroupHeader(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
];

const CATEGORY_COLORS: Record<string, string> = {
  sport: "bg-green-500/20 text-green-400",
  politics: "bg-red-500/20 text-red-400",
  entertainment: "bg-purple-500/20 text-purple-400",
  music: "bg-pink-500/20 text-pink-400",
  tech: "bg-blue-500/20 text-blue-400",
  world: "bg-cyan-500/20 text-cyan-400",
  other: "bg-gray-500/20 text-gray-400",
};

export default function PredictionsTab() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/predictions?status=${filter}`);
      const data = await res.json();
      if (data.success) setPredictions(data.predictions);
    } catch (e) {
      console.error("Failed to load predictions:", e);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/predictions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 3, perDay: 4 }),
      });
      const data = await res.json();
      if (data.success) {
        setFilter("draft");
        await load();
      } else {
        alert(data.error || "Generation failed");
      }
    } catch (e) {
      console.error("Generate failed:", e);
      alert("Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const setStatus = async (id: string, status: "active" | "draft") => {
    setPredictions((prev) => prev.map((p) => (p._id === id ? { ...p, status } : p)));
    await fetch("/api/admin/predictions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    }).catch(() => load());
    // If the filter no longer matches, refresh the list
    if (filter !== "all" && filter !== status) load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this prediction?")) return;
    setPredictions((prev) => prev.filter((p) => p._id !== id));
    await fetch(`/api/admin/predictions?id=${id}`, { method: "DELETE" }).catch(() => load());
  };

  // Group predictions by the day they close so admins see deadlines clearly
  const grouped = useMemo(() => {
    const groups = new Map<string, Prediction[]>();
    for (const p of predictions) {
      const key = groupKey(p.closesAt);
      const existing = groups.get(key);
      if (existing) existing.push(p);
      else groups.set(key, [p]);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ key, header: formatGroupHeader(items[0].closesAt), items }));
  }, [predictions]);

  const resolve = async (id: string, correctOptionId: string) => {
    if (!confirm("Resolve with this answer? Points will be awarded to correct predictors.")) return;
    const res = await fetch("/api/admin/predictions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, correctOptionId }),
    });
    const data = await res.json();
    if (data.success) {
      alert(`Resolved. ${data.awarded ?? 0} player(s) awarded points.`);
      load();
    } else {
      alert(data.error || "Resolve failed");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#D4873A]" />
          <h2 className="text-sm font-bold">Predictions</h2>
          <span className="text-xs text-gray-500">({predictions.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#D4873A] text-white hover:bg-[#C4772A] transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {generating ? "Generating..." : "Generate (3 days)"}
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-1 mb-4">
        {STATUS_FILTERS.map((opt) => (
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
      ) : predictions.length === 0 ? (
        <p className="text-center text-gray-500 text-sm py-12">
          No predictions here. Hit "Generate" to let the bot find some.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <div key={group.key}>
              {/* Closing-date header */}
              <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-gray-700">
                <Calendar className="w-3.5 h-3.5 text-[#D4873A]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Closes &middot; {group.header}
                </h3>
                <span className="text-[10px] text-gray-500">({group.items.length})</span>
              </div>

              <div className="space-y-2">
                {group.items.map((p) => {
                  const isSelected = p.status === "active";
                  const statusBadge = STATUS_BADGE[p.status] || STATUS_BADGE.draft;
                  return (
                    <div
                      key={p._id}
                      className={`relative bg-gray-800 rounded-xl p-3 transition-colors ${
                        isSelected
                          ? "border-2 border-[#D4873A] shadow-[0_0_0_3px_rgba(212,135,58,0.12)]"
                          : "border border-gray-700"
                      }`}
                    >
                      {/* Selected marker */}
                      {isSelected && (
                        <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-[#D4873A] flex items-center justify-center shadow-md">
                          <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        </div>
                      )}

                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                              {statusBadge.label}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[p.category] || CATEGORY_COLORS.other}`}>
                              {p.category}
                            </span>
                            {p.genXRelated && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4873A]/20 text-[#D4873A]">GenX</span>
                            )}
                            <LiveCountdownBadge closesAt={p.closesAt} />
                            <span className="text-[10px] text-gray-500">
                              {new Date(p.closesAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="text-[10px] text-gray-500">+{p.pointsReward} pts</span>
                            {(p.totalVotes ?? 0) > 0 && (
                              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" /> {p.totalVotes} vote{p.totalVotes === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-white">{p.question}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {p.status === "draft" && (
                            <button
                              onClick={() => setStatus(p._id, "active")}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#D4873A] text-white hover:bg-[#C4772A] transition-colors"
                              title="Activate & publish"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Select
                            </button>
                          )}
                          {p.status === "active" && (
                            <button
                              onClick={() => setStatus(p._id, "draft")}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
                              title="Deselect (back to draft)"
                            >
                              <X className="w-3.5 h-3.5" />
                              Deselect
                            </button>
                          )}
                          <button
                            onClick={() => remove(p._id)}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Options with vote stats */}
                      <div className="space-y-1.5">
                        {p.options.map((o) => {
                          const isCorrect = p.correctOptionId === o.id;
                          const stat = p.optionStats?.find((s) => s.id === o.id);
                          const votes = stat?.votes ?? 0;
                          const percent = stat?.percent ?? 0;
                          const clickable = p.status === "active";
                          const Tag = clickable ? "button" : ("div" as const);
                          return (
                            <Tag
                              key={o.id}
                              onClick={clickable ? () => resolve(p._id, o.id) : undefined}
                              className={`relative w-full overflow-hidden rounded-lg text-left ${
                                clickable ? "hover:ring-1 hover:ring-[#D4873A] cursor-pointer" : ""
                              } ${isCorrect ? "bg-green-600/20 border border-green-500/40" : "bg-gray-700/50 border border-gray-700"}`}
                              title={clickable ? "Mark as the correct answer" : undefined}
                            >
                              {/* Percent fill bar */}
                              <div
                                className={`absolute inset-y-0 left-0 ${isCorrect ? "bg-green-500/25" : "bg-[#D4873A]/15"}`}
                                style={{ width: `${percent}%` }}
                              />
                              <div className="relative flex items-center justify-between px-2.5 py-1.5">
                                <span className="text-xs flex items-center gap-1.5 text-gray-200">
                                  {isCorrect && <Check className="w-3 h-3 text-green-400" />}
                                  {o.label}
                                </span>
                                <span className="text-[11px] tabular-nums text-gray-400">
                                  <span className="text-gray-200 font-bold">{votes}</span> vote{votes === 1 ? "" : "s"} · {percent}%
                                </span>
                              </div>
                            </Tag>
                          );
                        })}
                      </div>
                      {p.status === "active" && (
                        <p className="text-[10px] text-gray-500 mt-2">
                          Click an option to mark it correct & award points.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
