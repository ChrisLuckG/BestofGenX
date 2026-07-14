"use client";

import { useState, useEffect } from "react";
import GenXLoader from "@/components/GenXLoader";
import StaticPageLayout from "@/components/StaticPageLayout";

export default function DatenschutzPage() {
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
    <StaticPageLayout title={page?.title || 'Datenschutz'}>
      {page?.coverImage && (
        <div className="w-full h-40 overflow-hidden rounded-xl mb-6">
          <img src={page.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><GenXLoader size="md" /></div>
      ) : (
        <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: page?.content || defaultContent }} />
      )}
    </StaticPageLayout>
  );
}
