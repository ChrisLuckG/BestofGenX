import type { MetadataRoute } from "next";
import dbConnect from "@/lib/mongoose";
import Article from "@/models/Article";
import { CATEGORIES } from "@/lib/categories";
import { articleUrl } from "@/lib/articleUrl";

// /sitemap.xml - every published article, the magazine (and its category pages) and the info pages, so search
// engines find the content (the app itself has no crawlable links). Rebuilt at most once an hour.
export const revalidate = 3600;

const SITE = "https://www.bestofgenx.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE}/magazine`, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...CATEGORIES.filter(c => c.slug !== "eastercorn").map(c => ({ url: `${SITE}/magazine?category=${c.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...["about", "impressum", "datenschutz", "agb", "kontakt"].map(p => ({ url: `${SITE}/${p}`, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
  try {
    await dbConnect();
    const articles = await Article.find({ status: "published", mainCategory: "articles", contentType: { $in: ["article", null] } })
      .sort({ publishedAt: -1 }).select("_id title publishedAt updatedAt createdAt").limit(45000).lean<{ _id: unknown; title?: string; publishedAt?: Date; updatedAt?: Date; createdAt?: Date }[]>();
    return [
      ...fixed,
      ...articles.map(a => ({ url: articleUrl(a._id, a.title), lastModified: a.updatedAt || a.publishedAt || a.createdAt, changeFrequency: "monthly" as const, priority: 0.8 })),
    ];
  } catch {
    return fixed; // the database is unreachable: at least the fixed pages
  }
}
