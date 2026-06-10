"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface DynamicPageProps {
  slug: string;
  defaultTitle: string;
  defaultContent: string;
}

export default function DynamicPage({ slug, defaultTitle, defaultContent }: DynamicPageProps) {
  const router = useRouter();
  const [page, setPage] = useState<{ title: string; subtitle?: string; content: string; coverImage?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/pages?slug=${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.page) {
          setPage(data.page);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-cream border-b border-warm px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-[#D4873A]/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{page?.title || defaultTitle}</h1>
            {page?.subtitle && <p className="text-xs text-gray-500">{page.subtitle}</p>}
          </div>
        </div>
      </div>

      {/* Cover Image */}
      {page?.coverImage && (
        <div className="w-full h-48 overflow-hidden">
          <img src={page.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#D4873A] animate-spin" />
          </div>
        ) : (
          <div 
            className="prose prose-sm max-w-none text-gray-700 
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mb-4 [&_h2]:mt-6
              [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mb-3 [&_h3]:mt-6
              [&_h4]:font-bold [&_h4]:text-gray-800 [&_h4]:mb-2 [&_h4]:mt-4
              [&_p]:mb-4 [&_p]:text-sm
              [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-4 [&_ul]:text-sm [&_ul]:space-y-1
              [&_a]:text-[#D4873A] [&_a:hover]:underline
              [&_strong]:font-bold"
            dangerouslySetInnerHTML={{ __html: page?.content || defaultContent }}
          />
        )}
      </div>
    </div>
  );
}
