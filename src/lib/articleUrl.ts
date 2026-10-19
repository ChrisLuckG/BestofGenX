// Public article URLs: /article/<id>/<title-slug> - readable, with the words people search for. The id stays in front,
// so a changed title never breaks a link, and the old /article/<id> keeps working (its canonical points here).
// Dependency-free (client and server).
export const SITE_URL = "https://www.bestofgenx.com";

export function articleSlug(title?: string | null): string {
  return String(title || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+[^-]*$/, m => (m.length > 1 && String(title || "").length > 80 ? "" : m)) // do not end mid-word when cut
    .replace(/-+$/g, "");
}

export function articlePath(id: unknown, title?: string | null): string {
  const slug = articleSlug(title);
  return `/article/${String(id)}${slug ? `/${slug}` : ""}`;
}

export const articleUrl = (id: unknown, title?: string | null) => `${SITE_URL}${articlePath(id, title)}`;
