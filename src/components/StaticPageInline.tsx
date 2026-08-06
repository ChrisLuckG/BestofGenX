"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

interface StaticPageInlineProps {
  slug: string;
  defaultTitle: string;
  onClose: () => void;
}

const DEFAULTS: Record<string, { title: string; content: string }> = {
  impressum: {
    title: 'Impressum',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Angaben gemäß § 5 TMG</h2><p class="mb-4"><strong>Best of GenX</strong><br/>Ein Projekt für die Generation X</p><p class="mb-4">E-Mail: <a href="mailto:contact@bestofgenx.com" class="text-[#E36B11] hover:underline">contact@bestofgenx.com</a></p>`,
  },
  datenschutz: {
    title: 'Datenschutz',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Datenschutzerklärung</h2><p class="mb-4 text-sm">Bitte konfigurieren Sie diese Seite im Admin-Bereich.</p>`,
  },
  agb: {
    title: 'AGB',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Allgemeine Geschäftsbedingungen</h2><p class="mb-4 text-sm">Bitte konfigurieren Sie diese Seite im Admin-Bereich.</p>`,
  },
  kontakt: {
    title: 'Kontakt',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Kontakt</h2><p class="mb-4">E-Mail: <a href="mailto:contact@bestofgenx.com" class="text-[#E36B11] hover:underline">contact@bestofgenx.com</a></p>`,
  },
  about: {
    title: 'About Us',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">About Best of GenX</h2><p class="mb-4 text-sm">The home of Generation X culture.</p>`,
  },
  karriere: {
    title: 'Karriere',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Karriere</h2><p class="mb-4 text-sm">Bitte konfigurieren Sie diese Seite im Admin-Bereich.</p>`,
  },
  presse: {
    title: 'Presse',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Presse</h2><p class="mb-4 text-sm">Bitte konfigurieren Sie diese Seite im Admin-Bereich.</p>`,
  },
};

export default function StaticPageInline({ slug, defaultTitle, onClose }: StaticPageInlineProps) {
  const [page, setPage] = useState<{ title: string; content: string; coverImage?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pages?slug=${slug}`)
      .then(res => res.json())
      .then(data => { if (data.success && data.page) setPage(data.page); })
      .finally(() => setLoading(false));
  }, [slug]);

  const defaults = DEFAULTS[slug] || { title: defaultTitle, content: '' };
  const title = page?.title || defaults.title;
  const content = page?.content || defaults.content;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Back button (mobile only) + Title */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="lg:hidden p-1.5 rounded-full hover:bg-[#E36B11]/10 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      </div>

      {page?.coverImage && (
        <div className="w-full h-40 overflow-hidden rounded-xl mb-6">
          <img src={page.coverImage} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#E36B11] animate-spin" />
        </div>
      ) : (
        <div
          className="prose prose-sm max-w-none text-gray-700"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </div>
  );
}
