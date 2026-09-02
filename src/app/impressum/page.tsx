"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import StaticPageLayout from "@/components/StaticPageLayout";

export default function ImpressumPage() {
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
    <h2 class="text-xl font-bold text-gray-900 mb-4">Imprint</h2>
    <p class="mb-4"><strong>Best of GenX</strong><br/>A project for Generation X<br/>80s, 90s &amp; Early 2000s Entertainment</p>
    <h3 class="text-lg font-bold text-gray-900 mt-6 mb-3">Contact</h3>
    <p class="mb-4">Email: <a href="mailto:contact@bestofgenx.com" class="text-[#E36B11] hover:underline">contact@bestofgenx.com</a></p>
    <h3 class="text-lg font-bold text-gray-900 mt-6 mb-3">Responsible for content</h3>
    <p class="mb-4">Best of GenX Team<br/>Email: <a href="mailto:contact@bestofgenx.com" class="text-[#E36B11] hover:underline">contact@bestofgenx.com</a></p>
  `;

  return (
    <StaticPageLayout title={page?.title || 'Imprint'}>
      {page?.coverImage && (
        <div className="w-full h-40 overflow-hidden rounded-xl mb-6">
          <img src={page.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#E36B11] animate-spin" />
        </div>
      ) : (
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: page?.content || defaultContent }}
        />
      )}
    </StaticPageLayout>
  );
}
