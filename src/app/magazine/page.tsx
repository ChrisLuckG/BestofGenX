import type { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongoose";
import Article from "@/models/Article";
import { CATEGORIES, getCategoryLabel, getCategoryColor } from "@/lib/categories";
import AdSenseScript from "@/components/AdSenseScript";
import { articlePath } from "@/lib/articleUrl";

// The public magazine: every published article, rendered on the SERVER with plain links - what search engines and
// the AdSense review read. The app (/mobile, /desktop) loads everything in the browser and looked like an empty
// "Loading" screen to them (refused 19.10.2026: "ads on screens without publisher content").
export const dynamic = "force-dynamic";

const PER_PAGE = 24;
const SITE = "https://www.bestofgenx.com";

type Props = { searchParams: { page?: string; category?: string } };

const pageOf = (sp: Props["searchParams"]) => Math.max(1, parseInt(sp.page || "1", 10) || 1);
const categoryOf = (sp: Props["searchParams"]) => (CATEGORIES.some(c => c.slug === sp.category) ? sp.category! : null);

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const cat = categoryOf(searchParams);
  const page = pageOf(searchParams);
  const label = cat ? getCategoryLabel(cat) : null;
  const qs = new URLSearchParams({ ...(cat ? { category: cat } : {}), ...(page > 1 ? { page: String(page) } : {}) }).toString();
  return {
    title: `${label ? `${label} - ` : ""}Best of GenX Magazine${page > 1 ? ` (page ${page})` : ""}`,
    description: "Stories about the people, music, films, games and moments of Generation X - born 1965 to 1980. New articles every day.",
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE}/magazine${qs ? `?${qs}` : ""}`, types: { "application/rss+xml": `${SITE}/feed.xml` } },
    metadataBase: new URL(SITE),
  };
}

type Row = { _id: unknown; title: string; subtitle?: string; coverImage?: string; thumbnailUrl?: string; category?: string; publishedAt?: Date; createdAt?: Date; authorName?: string };

const dateOf = (a: Row) => new Date(a.publishedAt || a.createdAt || Date.now()).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
const imageOf = (a: Row) => {
  const src = a.thumbnailUrl || a.coverImage || "";
  return src.startsWith("data:") ? "" : src; // never inline megabytes of base64 into the list
};

export default async function MagazinePage({ searchParams }: Props) {
  const page = pageOf(searchParams);
  const cat = categoryOf(searchParams);
  await dbConnect();
  const filter: Record<string, unknown> = { status: "published", mainCategory: "articles", contentType: { $in: ["article", null] } };
  if (cat) filter.category = cat;
  const [rows, total] = await Promise.all([
    Article.find(filter).sort({ publishedAt: -1, createdAt: -1 }).skip((page - 1) * PER_PAGE).limit(PER_PAGE)
      .select("title subtitle coverImage thumbnailUrl category publishedAt createdAt authorName").lean<Row[]>(),
    Article.countDocuments(filter),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const link = (p: number, c: string | null = cat) => {
    const qs = new URLSearchParams({ ...(c ? { category: c } : {}), ...(p > 1 ? { page: String(p) } : {}) }).toString();
    return `/magazine${qs ? `?${qs}` : ""}`;
  };
  const [lead, ...rest] = rows;

  return (
    <div className="min-h-screen bg-[#F5F0E8] text-gray-900">
      <header className="border-b border-[#E5DDD0] bg-[#F5F0E8]">
        <div className="max-w-6xl mx-auto px-4 py-5 flex items-center justify-between gap-4">
          <Link href="/magazine" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/genxlogo1.png" alt="Best of GenX" width={40} height={40} />
            <span>
              <span className="block font-display text-2xl tracking-wide leading-none">Best of GenX</span>
              <span className="block text-xs text-gray-500">The magazine for Generation X (born 1965-1980)</span>
            </span>
          </Link>
          <Link href="/" className="shrink-0 whitespace-nowrap font-display tracking-wider text-sm bg-[#E36B11] text-white px-3 sm:px-4 py-2 rounded-lg hover:brightness-110">OPEN THE APP</Link>
        </div>
        <nav className="max-w-6xl mx-auto px-4 pb-3 flex flex-wrap gap-2 text-sm" aria-label="Categories">
          <Link href={link(1, null)} className={`px-3 py-1 rounded-sm border ${!cat ? "bg-gray-900 text-white border-gray-900" : "border-[#E5DDD0] hover:bg-white"}`}>All</Link>
          {CATEGORIES.filter(c => c.slug !== "eastercorn").map(c => (
            <Link key={c.slug} href={link(1, c.slug)} className={`px-3 py-1 rounded-sm border ${cat === c.slug ? "text-white" : "border-[#E5DDD0] hover:bg-white"}`}
              style={cat === c.slug ? { backgroundColor: c.color, borderColor: c.color } : undefined}>{c.label}</Link>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="font-display text-4xl tracking-wide mb-1">{cat ? getCategoryLabel(cat) : "Latest stories"}</h1>
        <p className="text-gray-600 mb-6">
          {total} {total === 1 ? "article" : "articles"} about the people, music, films, games and moments that shaped Generation X.
        </p>

        {!rows.length && <p className="text-gray-500">No articles yet.</p>}

        {lead && (
          <article className="mb-8">
            <Link href={articlePath(lead._id, lead.title)} className="grid md:grid-cols-2 gap-6 group">
              {imageOf(lead) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageOf(lead)} alt={lead.title} className="w-full aspect-video object-cover rounded-lg" />
              )}
              <div className="flex flex-col justify-center">
                {lead.category && <span className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: getCategoryColor(lead.category) }}>{getCategoryLabel(lead.category)}</span>}
                <h2 className="font-display text-3xl md:text-4xl tracking-wide leading-tight group-hover:text-[#E36B11]">{lead.title}</h2>
                {lead.subtitle && <p className="text-gray-600 mt-3 text-lg">{lead.subtitle}</p>}
                <p className="text-sm text-gray-500 mt-3">{lead.authorName || "BOGX Team"} · {dateOf(lead)}</p>
              </div>
            </Link>
          </article>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rest.map(a => (
            <article key={String(a._id)}>
              <Link href={articlePath(a._id, a.title)} className="block group">
                {imageOf(a) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageOf(a)} alt={a.title} loading="lazy" className="w-full aspect-video object-cover rounded-lg mb-3" />
                )}
                {a.category && <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: getCategoryColor(a.category) }}>{getCategoryLabel(a.category)}</span>}
                <h2 className="font-display text-xl tracking-wide leading-snug group-hover:text-[#E36B11]">{a.title}</h2>
                {a.subtitle && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.subtitle}</p>}
                <p className="text-xs text-gray-500 mt-2">{a.authorName || "BOGX Team"} · {dateOf(a)}</p>
              </Link>
            </article>
          ))}
        </div>

        {pages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-10" aria-label="Pages">
            {page > 1 && <Link href={link(page - 1)} rel="prev" className="px-4 py-2 border border-[#E5DDD0] rounded-lg hover:bg-white">← Newer</Link>}
            <span className="text-sm text-gray-500 px-2">Page {page} of {pages}</span>
            {page < pages && <Link href={link(page + 1)} rel="next" className="px-4 py-2 border border-[#E5DDD0] rounded-lg hover:bg-white">Older →</Link>}
          </nav>
        )}
      </main>

      <footer className="border-t border-[#E5DDD0] mt-8">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600">
          <span>© {new Date().getFullYear()} Best of GenX</span>
          <Link href="/about" className="hover:text-gray-900">About</Link>
          <Link href="/impressum" className="hover:text-gray-900">Imprint</Link>
          <Link href="/datenschutz" className="hover:text-gray-900">Privacy</Link>
          <Link href="/agb" className="hover:text-gray-900">Terms</Link>
          <Link href="/kontakt" className="hover:text-gray-900">Contact</Link>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "WebSite", name: "Best of GenX", url: `${SITE}/magazine`, inLanguage: "en",
          description: "The magazine for Generation X - the people, music, films, games and moments of everyone born 1965 to 1980." },
        { "@context": "https://schema.org", "@type": "Organization", name: "Best of GenX", url: SITE, logo: `${SITE}/images/genxlogo1.png` },
        { "@context": "https://schema.org", "@type": "ItemList", itemListElement: rows.map((a, i) => ({ "@type": "ListItem", position: (page - 1) * PER_PAGE + i + 1, url: `${SITE}${articlePath(a._id, a.title)}`, name: a.title })) },
      ]).replace(/</g, "\\u003c") }} />
      {rows.length > 0 && <AdSenseScript />}
    </div>
  );
}
