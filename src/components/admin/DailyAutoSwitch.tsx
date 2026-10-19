"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Sparkles } from "lucide-react";
import DailyAutoModal from "./DailyAutoModal";

// Toolbar control for Daily Auto: a SWITCH for the whole automation (on = the hourly job
// generates and publishes, off = nothing runs, the slot settings are kept) plus a clock
// button that opens the per-slot schedule.
export default function DailyAutoSwitch({ userId, onChanged }: { userId?: string; onChanged?: () => void }) {
  const [master, setMaster] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await (await fetch(`/api/admin/daily-auto?userId=${userId}`)).json();
      if (data.success) setMaster(!!data.masterEnabled);
    } catch { /* the switch stays disabled until a load succeeds */ }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    if (master === null || saving) return;
    setSaving(true);
    try {
      const data = await (await fetch("/api/admin/daily-auto", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, master: !master }),
      })).json();
      if (data.success) setMaster(!!data.masterEnabled);
      else alert(data.error || "Failed to switch Daily Auto");
    } catch {
      alert("Failed to switch Daily Auto");
    } finally {
      setSaving(false);
    }
  };

  const on = master === true;
  return (
    <>
      <div className={`flex items-stretch rounded border text-xs font-medium overflow-hidden ${on ? "border-purple-600" : "border-gray-200"}`}>
        <button
          role="switch"
          aria-checked={on}
          aria-label="Daily Auto"
          onClick={toggle}
          disabled={master === null || saving}
          title={on ? "Daily Auto is ON - click to switch off" : "Daily Auto is OFF - click to switch on"}
          className={`flex items-center gap-1.5 px-2 py-1 transition-colors disabled:opacity-60 ${on ? "bg-purple-600 text-paper hover:bg-purple-500" : "bg-white text-gray-600 hover:bg-gray-50"}`}
        >
          <span className={`relative shrink-0 w-7 h-4 rounded-full transition-colors ${on ? "bg-white/40" : "bg-gray-300"}`}>
            <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${on ? "translate-x-3" : ""}`} />
          </span>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Daily Auto
        </button>
        <button
          onClick={() => setOpen(true)}
          title="Schedule"
          aria-label="Open the Daily Auto schedule"
          className={`px-1.5 border-l transition-colors ${on ? "border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
        >
          <Clock className="w-3 h-3" />
        </button>
      </div>
      {open && (
        <DailyAutoModal
          userId={userId}
          master={master}
          onMasterChange={setMaster}
          onClose={() => { setOpen(false); load(); }}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
