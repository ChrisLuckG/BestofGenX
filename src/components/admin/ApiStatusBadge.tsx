"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

/**
 * OpenAI key/quota indicator, taken over from the Newsroom Conference header.
 *
 * Why it caches: /api/openai/status answers by making a REAL completion call
 * (gpt-4o-mini, max_tokens 5). The conference stayed mounted and therefore asked
 * once per page load, but ArticlesTab is mounted and unmounted on every tab
 * switch - copying the plain `useEffect` would bill a call each time the admin
 * clicks "Articles". The result is cached in sessionStorage for CACHE_TTL_MS and
 * a click forces a fresh check.
 *
 * The route's failure messages are German ("Quota aufgebraucht", "API Key
 * ungültig"); the badge shows an English label per status and keeps the original
 * text as the tooltip, so the shared route does not have to change.
 */

const CACHE_KEY = "admin-openai-status";
const CACHE_TTL_MS = 10 * 60 * 1000;

type Status = "active" | "quota_exceeded" | "invalid_key" | "error";

interface StatusResult {
  status: Status;
  message: string;
}

const LABELS: Record<Status, string> = {
  active: "API OK",
  quota_exceeded: "Quota exceeded",
  invalid_key: "Invalid API key",
  error: "API error",
};

const STYLES: Record<Status, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  quota_exceeded: "bg-red-50 text-red-700 border-red-200",
  invalid_key: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-gray-100 text-gray-600 border-gray-200",
};

function readCache(): StatusResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StatusResult & { at: number };
    if (!parsed.at || Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return { status: parsed.status, message: parsed.message };
  } catch {
    return null;
  }
}

export default function ApiStatusBadge() {
  const [result, setResult] = useState<StatusResult | null>(() => readCache());
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) {
        setResult(cached);
        return;
      }
    }
    setChecking(true);
    try {
      const res = await fetch("/api/openai/status");
      const data = await res.json();
      const next: StatusResult = {
        status: (data.status as Status) || "error",
        message: data.message || "Unknown response",
      };
      setResult(next);
      try {
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...next, at: Date.now() }));
      } catch {
        /* storage full or blocked - the badge still works, just uncached */
      }
    } catch {
      setResult({ status: "error", message: "Could not reach the status endpoint" });
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (checking && !result) {
    return (
      <span className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-400 text-xs font-medium">
        <Loader2 className="w-3 h-3 animate-spin" />
        API
      </span>
    );
  }

  if (!result) return null;

  const ok = result.status === "active";

  // A failing key is actionable, so the badge links to the usage dashboard -
  // same behaviour the conference had.
  const content = (
    <>
      {checking ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : ok ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <AlertCircle className="w-3 h-3" />
      )}
      {LABELS[result.status]}
    </>
  );

  if (ok) {
    return (
      <button
        onClick={() => check(true)}
        title={`${result.message} — click to re-check`}
        className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${STYLES.active} hover:opacity-80`}
      >
        {content}
      </button>
    );
  }

  return (
    <a
      href="https://platform.openai.com/usage"
      target="_blank"
      rel="noopener noreferrer"
      title={result.message}
      className={`flex items-center gap-1 px-2 py-1 rounded border text-xs font-medium ${STYLES[result.status]} hover:opacity-80`}
    >
      {content}
    </a>
  );
}
