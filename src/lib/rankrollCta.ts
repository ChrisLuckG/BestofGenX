// Rankroll call-to-action block that sits inside an article's HTML.
//
// One definition for the admin BlockEditor and for server-side generation (Daily
// Auto). ArticlePage reads `data-rankroll-id` from a click on .rankroll-cta-banner
// to open the rankroll, and /api/polls/[id] finds the linked article by searching
// the article content for that same attribute - so the markup is a contract.
//
// Dependency-free on purpose: importable from client components AND server code.
export const RANKROLL_CTA_HTML = `<div class="cta-block rankroll-cta-banner" data-cta-type="rankroll" data-rankroll-id="" data-rankroll-title="" style="display:flex;flex-direction:column;gap:12px;padding:16px;background:linear-gradient(to right,rgba(212,135,58,0.15),rgba(212,135,58,0.05));border-radius:16px;border:1px solid rgba(212,135,58,0.2);margin:24px 0;cursor:pointer;"><div style="display:flex;align-items:center;gap:12px;"><div class="cta-icon" style="width:44px;height:44px;min-width:44px;background:#E36B11;border-radius:50%;display:flex;align-items:center;justify-content:center;" data-emoji="🗳️"><svg width="22" height="22" fill="white" viewBox="0 0 24 24"><path d="M18 13h-.68l-2 2h1.91L19 17H5l1.78-2h2.05l-2-2H6l-3 3v4c0 1.1.89 2 1.99 2H19c1.1 0 2-.89 2-2v-4l-3-3zm-1-5.05l-4.95 4.95-3.54-3.54 4.95-4.95 3.54 3.54zm-4.24-5.66L6.39 8.66a.996.996 0 000 1.41l4.95 4.95c.39.39 1.02.39 1.41 0l6.36-6.36a.996.996 0 000-1.41l-4.95-4.95a.996.996 0 00-1.41 0z"/></svg></div><div><div class="rankroll-title" style="font-weight:700;color:#1a1a1a;font-size:14px;line-height:1.3;">Vote Now!</div><div style="font-size:12px;color:#666;line-height:1.4;">Vote & rank your favorites</div></div></div><span style="display:block;text-align:center;padding:10px 18px;background:#E36B11;color:white;border-radius:10px;font-weight:700;font-size:13px;">VOTE NOW</span></div>`;

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The CTA pointing at one specific rankroll, titled like BlockEditor does it. */
export function buildRankrollCta(pollId: string, title: string): string {
  return RANKROLL_CTA_HTML
    .replace('data-rankroll-id=""', `data-rankroll-id="${pollId}"`)
    .replace('data-rankroll-title=""', `data-rankroll-title="${escapeAttr(title)}"`)
    .replace(/<div class="rankroll-title"([^>]*)>[^<]*<\/div>/, `<div class="rankroll-title"$1>${escapeText(title)}</div>`);
}
