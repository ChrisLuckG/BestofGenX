"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import GenXLoader from "@/components/GenXLoader";

export default function DatenschutzPage() {
  const router = useRouter();
  const [page, setPage] = useState<{ title: string; subtitle?: string; content: string; coverImage?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pages?slug=datenschutz')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.page) {
          setPage(data.page);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const defaultContent = `
    <h2 class="text-xl font-bold text-gray-900 mb-4">Datenschutzerklärung</h2>
    <p class="mb-4 text-sm">Bitte konfigurieren Sie diese Seite im Admin-Bereich.</p>
  `;

  return (
    <div className="min-h-screen bg-cream">
      <div className="sticky top-0 z-50 bg-cream border-b border-warm px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-[#D4873A]/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">{page?.title || 'Datenschutz'}</h1>
        </div>
      </div>
      {page?.coverImage && (
        <div className="w-full h-40 overflow-hidden">
          <img src={page.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12"><GenXLoader size="md" /></div>
        ) : (
          <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: page?.content || defaultContent }} />
        )}
      </div>
    </div>
  );
}
