import { Metadata } from "next";
import dbConnect from "@/lib/mongoose";
import Article from "@/models/Article";
import ArticlePageClient from "./ArticlePageClient";

type Props = {
  params: Promise<{ id: string }>;
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
    // Ensure image URL is absolute and properly formatted
    let image = article.coverImage || "https://www.bestofgenx.com/images/genxlogo1.png";
    if (image && !image.startsWith('http')) {
      image = `https://www.bestofgenx.com${image.startsWith('/') ? '' : '/'}${image}`;
    }
    const articleUrl = `https://www.bestofgenx.com/article/${id}`;

    return {
      title,
      description,
      metadataBase: new URL('https://www.bestofgenx.com'),
      openGraph: {
        title: article.title,
        description,
        url: articleUrl,
        siteName: 'Best of GenX',
        images: [{ 
          url: image, 
          width: 1200, 
          height: 630,
          alt: article.title,
        }],
        type: "article",
        locale: 'de_DE',
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

export default async function ArticleRoute({ params }: Props) {
  const { id } = await params;
  return <ArticlePageClient articleId={id} />;
}
