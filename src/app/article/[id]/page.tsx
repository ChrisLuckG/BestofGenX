import { Metadata } from "next";
import Link from "next/link";
import dbConnect from "@/lib/mongoose";
import Article from "@/models/Article";
import ArticlePageClient from "./ArticlePageClient";
import AdSenseScript from "@/components/AdSenseScript";
import { SITE_URL, articlePath, articleUrl } from "@/lib/articleUrl";
import { getCategoryLabel, getCategoryColor } from "@/lib/categories";

// /article/<id> and /article/<id>/<slug> (the readable one, ./[slug]/page.tsx re-exports this file). Everything
// a search engine needs is in the server HTML: the full text (initialArticle), the canonical slug URL, structured
// data (NewsArticle + breadcrumbs) and links to more articles.
type Props = {
  params: Promise<{ id: string; slug?: string }>;
};

const absolute = (src?: string | null) => {
  if (!src || src.startsWith("data:")) return `${SITE_URL}/images/genxlogo1.png`;
  return src.startsWith("http") ? src : `${SITE_URL}${src.startsWith("/") ? "" : "/"}${src}`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  try {
    await dbConnect();
    const article = await Article.findById(id).lean();
    
    if (!article) {
      return {
        title: "Article not found | Best of GenX",
      };
    }

    const title = `${article.title} | Best of GenX`;
    const description = article.subtitle || article.title;
    const image = absolute(article.coverImage);
    const url = articleUrl(id, article.title);

    return {
      title,
      description,
      metadataBase: new URL(SITE_URL),
      // a content page: indexable (the root layout says noindex for the app screens) - published ones only
      robots: article.status === "published" ? { index: true, follow: true } : { index: false, follow: false },
      alternates: { canonical: url, types: { "application/rss+xml": `${SITE_URL}/feed.xml` } },
      openGraph: {
        title: article.title,
        description,
        url,
        siteName: 'Best of GenX',
        images: [{ 
          url: image, 
          width: 1200, 
          height: 630,
          alt: article.title,
        }],
        type: "article",
        locale: 'en_US',
        publishedTime: (article.publishedAt || article.createdAt)?.toISOString?.(),
        authors: article.authorName ? [article.authorName] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: article.title,
        description,
        images: [image],
        site: '@bestofgenx',
      },
    };
  } catch {
    return {
      title: "Best of GenX",
    };
  }
}

type Related = { _id: unknown; title: string; subtitle?: string; coverImage?: string; thumbnailUrl?: string; category?: string; publishedAt?: Date; createdAt?: Date };

export default async function ArticleRoute({ params }: Props) {
  const { id } = await params;
  // The published article goes along with the page, so its HTML carries the full text (not a loading screen):
  // that is what search engines and the AdSense review read. Drafts are not handed out here.
  let initialArticle: any = null;
  let related: Related[] = [];
  try {
    await dbConnect();
    const a = await Article.findOne({ _id: id, status: 'published' }).select('-coverImageBase64').lean();
    if (a) {
      initialArticle = JSON.parse(JSON.stringify(a));
      // More from the same category - plain links, the way search engines find the next article
      related = await Article.find({ _id: { $ne: id }, status: 'published', mainCategory: 'articles', contentType: { $in: ['article', null] }, ...(a.category ? { category: a.category } : {}) })
        .sort({ publishedAt: -1 }).limit(6).select('title subtitle coverImage thumbnailUrl category publishedAt createdAt').lean<Related[]>();
    }
  } catch { /* an invalid id or a database hiccup: the page loads it in the browser as before */ }

  const jsonLd = initialArticle ? [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: String(initialArticle.title).slice(0, 110),
      description: initialArticle.subtitle || undefined,
      image: [absolute(initialArticle.coverImage)],
      datePublished: initialArticle.publishedAt || initialArticle.createdAt,
      dateModified: initialArticle.updatedAt || initialArticle.publishedAt || initialArticle.createdAt,
      author: [{ "@type": initialArticle.authorName && initialArticle.authorName !== "BOGX Team" ? "Person" : "Organization", name: initialArticle.authorName || "BOGX Team" }],
      publisher: { "@type": "Organization", name: "Best of GenX", logo: { "@type": "ImageObject", url: `${SITE_URL}/images/genxlogo1.png` } },
      mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl(id, initialArticle.title) },
      ...(initialArticle.personName ? { about: { "@type": "Person", name: initialArticle.personName } } : {}),
      articleSection: initialArticle.category ? getCategoryLabel(initialArticle.category) : undefined,
      inLanguage: "en",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Magazine", item: `${SITE_URL}/magazine` },
        ...(initialArticle.category ? [{ "@type": "ListItem", position: 2, name: getCategoryLabel(initialArticle.category), item: `${SITE_URL}/magazine?category=${initialArticle.category}` }] : []),
        { "@type": "ListItem", position: initialArticle.category ? 3 : 2, name: initialArticle.title, item: articleUrl(id, initialArticle.title) },
      ],
    },
  ] : null;

  return (
    <>
      <ArticlePageClient articleId={id} initialArticle={initialArticle} />
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />}
      {related.length > 0 && (
        <section className="bg-[#F5F0E8] border-t border-[#E5DDD0]" aria-label="More articles">
          <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-2xl tracking-wide text-gray-900">More from Best of GenX</h2>
              <Link href={initialArticle?.category ? `/magazine?category=${initialArticle.category}` : "/magazine"} className="text-sm text-[#E36B11] hover:underline">All articles →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map(r => {
                const img = r.thumbnailUrl || r.coverImage || "";
                return (
                  <Link key={String(r._id)} href={articlePath(r._id, r.title)} className="block group">
                    {img && !img.startsWith("data:") && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={r.title} loading="lazy" className="w-full aspect-video object-cover rounded-lg mb-2" />
                    )}
                    {r.category && <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: getCategoryColor(r.category) }}>{getCategoryLabel(r.category)}</span>}
                    <h3 className="font-display text-lg tracking-wide leading-snug text-gray-900 group-hover:text-[#E36B11]">{r.title}</h3>
                    {r.subtitle && <p className="text-sm text-gray-600 line-clamp-2">{r.subtitle}</p>}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
      {/* ads only where there is content: a published article */}
      {initialArticle && <AdSenseScript />}
    </>
  );
}
