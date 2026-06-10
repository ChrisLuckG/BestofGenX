"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ImpressumPage() {
  const router = useRouter();
  const [page, setPage] = useState<{ title: string; subtitle?: string; content: string; coverImage?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pages?slug=impressum')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.page) {
          setPage(data.page);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Default content if no DB entry
  const defaultContent = `
    <h2 class="text-xl font-bold text-gray-900 mb-4">Angaben gemäß § 5 TMG</h2>
    <p class="mb-4"><strong>Best of GenX</strong><br/>Ein Projekt für die Generation X<br/>80s, 90s & Early 2000s Entertainment</p>
    <h3 class="text-lg font-bold text-gray-900 mt-6 mb-3">Kontakt</h3>
    <p class="mb-4">E-Mail: <a href="mailto:contact@bestofgenx.com" class="text-[#D4873A] hover:underline">contact@bestofgenx.com</a></p>
    <h3 class="text-lg font-bold text-gray-900 mt-6 mb-3">Verantwortlich für den Inhalt</h3>
    <p class="mb-4">Best of GenX Team<br/>E-Mail: <a href="mailto:contact@bestofgenx.com" class="text-[#D4873A] hover:underline">contact@bestofgenx.com</a></p>
    <p class="text-xs text-gray-500 mt-8">Stand: Juni 2026</p>
  `;

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
          <h1 className="text-lg font-bold text-gray-900">{page?.title || 'Impressum'}</h1>
        </div>
      </div>

      {/* Cover Image */}
      {page?.coverImage && (
        <div className="w-full h-40 overflow-hidden">
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
            className="prose prose-sm max-w-none text-gray-700"
            dangerouslySetInnerHTML={{ __html: page?.content || defaultContent }}
          />
        )}
      </div>
    </div>
  );
}
