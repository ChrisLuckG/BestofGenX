import dbConnect from "@/lib/mongoose";
import Article from "@/models/Article";
import { SITE_URL, articleUrl } from "@/lib/articleUrl";
import { getCategoryLabel } from "@/lib/categories";

// /feed.xml - RSS 2.0 of the newest 50 published articles: feed readers, aggregators and search engines pick up new
// articles from it within minutes (linked from the magazine and every article as <link rel="alternate">).
export const revalidate = 600;

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  await dbConnect();
  const rows = await Article.find({ status: "published", mainCategory: "articles", contentType: { $in: ["article", null] } })
    .sort({ publishedAt: -1 }).limit(50)
    .select("title subtitle coverImage thumbnailUrl category publishedAt createdAt authorName")
    .lean<{ _id: unknown; title: string; subtitle?: string; coverImage?: string; thumbnailUrl?: string; category?: string; publishedAt?: Date; createdAt?: Date; authorName?: string }[]>();
  const items = rows.map(a => {
    const url = articleUrl(a._id, a.title);
    const img = a.thumbnailUrl || a.coverImage || "";
    return `    <item>
      <title>${esc(a.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${new Date(a.publishedAt || a.createdAt || Date.now()).toUTCString()}</pubDate>
      ${a.subtitle ? `<description>${esc(a.subtitle)}</description>` : ""}
      ${a.category ? `<category>${esc(getCategoryLabel(a.category))}</category>` : ""}
      ${a.authorName ? `<dc:creator>${esc(a.authorName)}</dc:creator>` : ""}
      ${img.startsWith("http") ? `<media:content url="${esc(img)}" medium="image" />` : ""}
    </item>`;
  }).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Best of GenX</title>
    <link>${SITE_URL}/magazine</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <description>The magazine for Generation X - the people, music, films, games and moments of everyone born 1965 to 1980.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
