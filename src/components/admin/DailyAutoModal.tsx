"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, RefreshCw, X } from "lucide-react";
import { useConfirm } from "./ConfirmModal";

// The Daily Auto schedule. Every slot is an hour in Berlin time; its article is LIVE
// from the start of that hour. The switch decides whether the hourly cron handles the
// slot. "Run now" generates and publishes a slot immediately.

type SlotStatus = "off" | "waiting" | "generating" | "ready" | "live" | "error" | "missed" | "skipped";

interface SlotView {
  id: string;
  kind: string;
  label: string;
  range: string;
  start: string;
  enabled: boolean;
  status: SlotStatus;
  /** The types this slot can be switched to; `problem` is why one is closed here */
  kinds: { kind: string; label: string; problem: string | null }[];
  articleId: string | null;
  personName: string | null;
  message: string | null;
}

const STATUS_STYLE: Record<SlotStatus, { text: string; cls: string }> = {
  off: { text: "Off", cls: "bg-gray-100 text-gray-500" },
  waiting: { text: "Scheduled", cls: "bg-blue-50 text-blue-700" },
  generating: { text: "Generating...", cls: "bg-amber-50 text-amber-700" },
  ready: { text: "Ready", cls: "bg-purple-50 text-purple-700" },
  live: { text: "Live", cls: "bg-green-50 text-green-700" },
  error: { text: "Error", cls: "bg-red-50 text-red-700" },
  missed: { text: "Missed", cls: "bg-gray-100 text-gray-500" },
  skipped: { text: "Skipped", cls: "bg-gray-100 text-gray-500" },
};

export default function DailyAutoModal({ userId, master, onMasterChange, onClose, onChanged }: {
  userId?: string;
  /** The master switch (lives in the toolbar); null while it is still loading. */
  master?: boolean | null;
  onMasterChange?: (on: boolean) => void;
  onClose: () => void;
  /** Called after a Run now, so the article list can refresh. */
  onChanged?: () => void;
}) {
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const apply = (data: any) => {
    if (data?.slots) setSlots(data.slots);
    if (typeof data?.masterEnabled === "boolean") onMasterChange?.(data.masterEnabled);
  };

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await (await fetch(`/api/admin/daily-auto?userId=${userId}`)).json();
      if (!data.success) throw new Error(data.error || "Failed to load");
      apply(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [userId]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 15000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setEnabled = async (slotId: string, enabled: boolean) => {
    setBusy(slotId);
    setError(null);
    try {
      const data = await (await fetch("/api/admin/daily-auto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slotId, enabled }),
      })).json();
      if (!data.success) throw new Error(data.error || "Failed");
      apply(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const setKind = async (slotId: string, kind: string) => {
    setBusy(`kind-${slotId}`);
    setError(null);
    try {
      const data = await (await fetch("/api/admin/daily-auto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slotId, kind }),
      })).json();
      if (!data.success) throw new Error(data.error || "Failed");
      apply(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const runNow = async (slot: SlotView) => {
    // With an article already there the button REPLACES it; otherwise it just generates one
    const replace = !!slot.articleId;
    const ok = await confirm(replace
      ? {
          title: `Rerun ${slot.label}`,
          message: `Generate a NEW article for this slot and delete the current one${slot.personName ? ` (${slot.personName})` : ""}, including its rankroll, votes and comments.\n\nThe new one is about a different person. If the current one is live, the new one goes live immediately; if the generation fails, nothing is deleted.`,
          confirmLabel: "Replace it",
          variant: "danger",
        }
      : {
          title: `Run ${slot.label}`,
          message: `Generate and publish "${slot.label}" right now?\n\nThis can take a few minutes and goes live immediately.`,
          confirmLabel: "Run now",
          variant: "info",
        });
    if (!ok) return;
    setBusy(`run-${slot.id}`);
    setError(null);
    try {
      const data = await (await fetch("/api/admin/daily-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, slotId: slot.id, rerun: replace }),
      })).json();
      if (data.slots) apply(data);
      if (!data.success) throw new Error(data.error || data.result || "Run failed");
      onChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(null);
    }
  };

  const allOn = !!slots?.length && slots.every(s => s.enabled);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-[640px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Daily Auto</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Berlin time. Each article goes live at the start of its slot; switched-on slots run by themselves.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>

        {master === false && (
          <div className="px-5 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-100">
            Daily Auto is switched off - nothing is generated or published. Your slot settings below are kept.
          </div>
        )}

        <div className={`overflow-y-auto ${master === false ? "opacity-60" : ""}`}>
          {!slots && !error && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading</div>
          )}
          {slots?.map(slot => {
            const st = STATUS_STYLE[slot.status];
            const running = busy === `run-${slot.id}`;
            const generating = slot.status === "generating" || running;
            return (
              <div key={slot.id} className="px-5 py-3 border-b border-gray-100 last:border-b-0 flex items-center gap-4">
                <button
                  role="switch"
                  aria-checked={slot.enabled}
                  aria-label={`${slot.enabled ? "Disable" : "Enable"} ${slot.label} at ${slot.start}`}
                  disabled={busy === slot.id}
                  onClick={() => setEnabled(slot.id, !slot.enabled)}
                  className={`relative shrink-0 w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${slot.enabled ? "bg-green-600" : "bg-gray-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${slot.enabled ? "translate-x-4" : ""}`} />
                </button>

                <div className="w-28 shrink-0 text-sm font-medium text-gray-900 tabular-nums">{slot.range}</div>

                <div className="min-w-0 flex-1">
                  {/* What this hour makes - pick any type that is allowed here */}
                  <select
                    value={slot.kind}
                    onChange={e => setKind(slot.id, e.target.value)}
                    disabled={busy === `kind-${slot.id}` || slot.status === "generating"}
                    aria-label={`Type for ${slot.range}`}
                    className="-ml-1 w-52 max-w-full cursor-pointer rounded border border-transparent bg-transparent py-0.5 pl-1 pr-1 text-sm text-gray-900 hover:border-gray-200 hover:bg-white focus:border-gray-300 focus:outline-none disabled:opacity-60"
                  >
                    {slot.kinds.map(k => (
                      <option key={k.kind} value={k.kind} disabled={!!k.problem} title={k.problem || undefined}>
                        {k.label}{k.problem ? " (not possible here)" : ""}
                      </option>
                    ))}
                  </select>
                  {(slot.personName || slot.message) && (
                    <div className={`text-xs truncate ${slot.status === "error" ? "text-red-600" : "text-gray-500"}`} title={slot.message || slot.personName || ""}>
                      {slot.status === "error" ? slot.message : slot.personName || slot.message}
                    </div>
                  )}
                </div>

                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${st.cls}`}>
                  {generating && <Loader2 className="w-3 h-3 animate-spin" />}
                  {slot.status === "ready" ? `Live ${slot.start}` : st.text}
                </span>

                <button
                  onClick={() => runNow(slot)}
                  disabled={!!busy || slot.status === "generating"}
                  title={slot.articleId ? "Replace the current article with a new one" : "Generate and publish now"}
                  className="shrink-0 w-[84px] flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-40"
                >
                  {slot.articleId ? <><RefreshCw className="w-3 h-3" /> Rerun</> : <><Play className="w-3 h-3" /> Run now</>}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
          <div className="text-xs min-h-[1rem]">{error && <span className="text-red-600">{error}</span>}</div>
          <button
            onClick={() => setEnabled("all", !allOn)}
            disabled={!slots || busy === "all"}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {allOn ? "Disable all" : "Enable all"}
          </button>
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}
