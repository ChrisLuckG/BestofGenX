"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ArticlePage from "@/components/ArticlePage";

interface ArticlePageClientProps {
  articleId: string;
}

export default function ArticlePageClient({ articleId }: ArticlePageClientProps) {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if mobile or desktop
    setIsMobile(window.innerWidth < 768);
  }, []);

  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      router.back();
    } else {
      // No history, go to home
      router.push(isMobile ? '/mobile' : '/desktop');
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <ArticlePage 
        articleId={articleId} 
        onBack={handleBack}
        onShowLogin={() => router.push(isMobile ? '/mobile?login=true' : '/desktop?login=true')}
        onOpenAuthor={(authorName) => router.push(`/author/${encodeURIComponent(authorName)}`)}
      />
    </div>
  );
}
