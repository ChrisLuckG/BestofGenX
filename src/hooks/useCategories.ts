"use client";

import { useCallback, useEffect, useState } from "react";
import { UI_CATEGORIES } from "@/lib/categories";

export interface CategoryOption {
  slug: string;
  label: string;
  color?: string;
}

/**
 * Client-safe hook for the merged static + dynamically-created category list
 * (see src/app/api/categories/route.ts and src/models/Category.ts).
 *
 * IMPORTANT: this module must never import anything Mongo-related, not even
 * indirectly and not behind a dynamic import. A "use client" module that
 * reaches @/lib/mongodb pulls the driver into the browser bundle and every
 * route starts returning 500 while `tsc` stays green - see the
 * "Client/server bundling trap" section in AGENTS.md. Importing UI_CATEGORIES
 * from @/lib/categories is safe: that module is pure data + regexes.
 *
 * Seeds state with the static list so dropdowns are never momentarily empty on
 * first paint, then replaces it with the merged list from the API.
 *
 * Every consumer calls this independently and refetches on the shared
 * 'categories-updated' window event, rather than prop-drilling one fetch
 * result from ArticlesTab down through ContainerBlock into each block editor.
 */
// Module-level cache shared by every hook instance.
//
// Each ContainerBlock subscribes independently, so a template with 9 containers
// plus ArticlesTab fired TEN identical GET /api/categories on every page load
// (visible as a wall of `GET /api/categories 200` in the dev log). `inFlight`
// collapses concurrent mounts onto one request; `cached` lets later mounts
// render immediately instead of flashing the static fallback list.
//
// Invalidated by ensureCategory() below, which is the only thing that can
// change the list. Note there is deliberately no `force` parameter: clearing
// `cached` IS the invalidation, and a force flag would have to bypass the
// `inFlight` guard too - which would fire one request per mounted hook again,
// exactly after a rename, when all ten of them refresh at once.
let cached: CategoryOption[] | null = null;
let inFlight: Promise<CategoryOption[] | null> | null = null;

function fetchCategories(): Promise<CategoryOption[] | null> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;
  const p = fetch("/api/categories")
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        cached = data.categories as CategoryOption[];
        return cached;
      }
      return null;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  inFlight = p;
  return p;
}

export function useCategories(): CategoryOption[] {
  const [categories, setCategories] = useState<CategoryOption[]>(
    () => cached ?? UI_CATEGORIES.map((c) => ({ slug: c.value, label: c.label }))
  );

  const refresh = useCallback(() => {
    fetchCategories().then((list) => {
      // null => request failed; keep the static fallback already in state. An
      // offline dropdown still offering the nine built-in verticals beats an
      // empty one.
      if (list) setCategories(list);
    });
  }, []);

  useEffect(() => {
    refresh();
    // ensureCategory() clears `cached` before dispatching, so this refetches
    // once and every other mounted hook joins the same in-flight request.
    window.addEventListener("categories-updated", refresh);
    return () => window.removeEventListener("categories-updated", refresh);
  }, [refresh]);

  return categories;
}

/**
 * Ensure a Category document exists for `label`, then tell every mounted
 * useCategories() to refetch so the new option appears in all dropdowns at
 * once.
 *
 * Called when an admin commits a container rename (ContainerBlock's
 * onCommitName -> on blur, not on every keystroke: renaming "Eis" to
 * "EisHockey" character by character would otherwise create eight categories).
 */
export async function ensureCategory(label: string): Promise<void> {
  if (!label || !label.trim()) return;
  try {
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json();
    if (data.success) {
      cached = null; // the list may have grown - force the next read to refetch
      window.dispatchEvent(new CustomEvent("categories-updated"));
    }
  } catch (e) {
    console.error("Failed to ensure category:", e);
  }
}
