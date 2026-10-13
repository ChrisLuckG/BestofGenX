// Wikidata hands out portraits as `http://commons.wikimedia.org/wiki/Special:FilePath/<file>`.
// That is a redirect served by the MediaWiki application (not the image CDN), it always
// ends in the FULL-SIZE original, and Wikimedia rate-limits it hard: 24 of 30 parallel
// requests got HTTP 429. A list of 40 people therefore showed broken thumbnails, while
// the single image in the picker loaded fine.
//
// The commons API returns the exact CDN thumbnail address (50 files per request, no
// rate limit at this volume). Computing the path ourselves from an md5 of the file name
// looks tempting but fails for originals narrower than the requested width - roughly one
// in ten here - because Wikimedia refuses to upscale; the API already knows those.
const FILEPATH = /^https?:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/([^?#]+)/i;
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'BestOfGenX/1.0 (https://bestofgenx.com; people image thumbnails)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const isFilePathUrl = (url?: string | null): boolean => !!url && FILEPATH.test(url);

function titleOf(url: string): string | null {
  const m = FILEPATH.exec(url);
  if (!m) return null;
  try { return 'File:' + decodeURIComponent(m[1]).replace(/_/g, ' '); } catch { return null; }
}

// ?utm_* parameters are tracking noise the API appends
const clean = (u: string) => { try { const x = new URL(u); x.search = ''; return x.toString(); } catch { return u; } };

/**
 * Resolve Special:FilePath URLs to CDN thumbnails of `width` px.
 * Only entries that could be resolved are in the result; callers keep the old value
 * for the rest. Safe to call with other URLs mixed in - they are ignored.
 */
export async function resolveCommonsThumbs(urls: string[], width = 330): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = Array.from(new Set(urls.filter(isFilePathUrl)));
  for (let i = 0; i < wanted.length; i += 50) {
    const batch = wanted.slice(i, i + 50);
    const titles = batch.map(u => titleOf(u)!);
    const body = new URLSearchParams({
      action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url', iiurlwidth: String(width), titles: titles.join('|'),
    });
    let j: any = null;
    for (let attempt = 0; attempt < 4 && !j; attempt++) {
      try {
        const r = await fetch(API, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (r.status === 429 || r.status >= 500) { await sleep(3000 * (attempt + 1)); continue; }
        j = await r.json();
      } catch { await sleep(2000 * (attempt + 1)); }
    }
    if (!j?.query) continue;
    const norm = new Map<string, string>((j.query.normalized || []).map((n: any) => [n.from, n.to]));
    const redir = new Map<string, string>((j.query.redirects || []).map((n: any) => [n.from, n.to]));
    const byTitle = new Map<string, any>((Object.values(j.query.pages || {}) as any[]).map(p => [p.title, p]));
    batch.forEach((url, k) => {
      let t = titles[k];
      t = norm.get(t) ?? t;
      t = redir.get(t) ?? t;
      const info = byTitle.get(t)?.imageinfo?.[0];
      const thumb = info?.thumburl || info?.url;
      if (thumb) out.set(url, clean(thumb));
    });
    await sleep(300);
  }
  return out;
}

/** Single-URL convenience for importers: falls back to the https form of the input. */
export async function resolveCommonsThumb(url: string, width = 330): Promise<string> {
  if (!isFilePathUrl(url)) return url;
  const hit = (await resolveCommonsThumbs([url], width)).get(url);
  return hit || url.replace(/^http:/i, 'https:');
}
