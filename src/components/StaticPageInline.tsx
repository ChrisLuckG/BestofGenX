"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

// Known static page slugs that should be handled inline
const STATIC_SLUGS = ['impressum', 'datenschutz', 'agb', 'kontakt', 'about'];

interface StaticPageInlineProps {
  slug: string;
  defaultTitle: string;
  onClose: () => void;
  onNavigate?: (slug: string) => void;
}

// Fallbacks shown only until the page exists in the DB. The real content is
// edited under /admin/pages/<slug>. Slugs stay German because they are the DB
// keys and the public URLs; the visible text is English.
const DEFAULTS: Record<string, { title: string; content: string }> = {
  impressum: {
    title: 'Imprint',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Imprint</h2><p class="mb-4"><strong>Best of GenX</strong><br/>A project for Generation X</p><p class="mb-4">Email: <a href="mailto:contact@bestofgenx.com" class="text-[#E36B11] hover:underline">contact@bestofgenx.com</a></p>`,
  },
  datenschutz: {
    title: 'Privacy Policy',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Privacy Policy</h2><p class="mb-4 text-sm">This page has not been configured yet.</p>`,
  },
  agb: {
    title: 'Terms & Conditions',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Terms &amp; Conditions</h2><p class="mb-4 text-sm">This page has not been configured yet.</p>`,
  },
  kontakt: {
    title: 'Contact',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">Contact</h2><p class="mb-4">Email: <a href="mailto:contact@bestofgenx.com" class="text-[#E36B11] hover:underline">contact@bestofgenx.com</a></p>`,
  },
  about: {
    title: 'About Us',
    content: `<h2 class="text-xl font-bold text-gray-900 mb-4">About Best of GenX</h2><p class="mb-4 text-sm">The home of Generation X culture.</p>`,
  },
};

export default function StaticPageInline({ slug, defaultTitle, onClose, onNavigate }: StaticPageInlineProps) {
  const [page, setPage] = useState<{ title: string; content: string; coverImage?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pages?slug=${slug}`)
      .then(res => res.json())
      .then(data => { if (data.success && data.page) setPage(data.page); })
      .finally(() => setLoading(false));
  }, [slug]);

  // Intercept clicks on internal static page links
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !onNavigate) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      // Check if it's an internal static page link (e.g., /impressum, /datenschutz)
      const match = href.match(/^\/([a-z]+)$/);
      if (match && STATIC_SLUGS.includes(match[1])) {
        e.preventDefault();
        onNavigate(match[1]);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onNavigate, loading]);

  const defaults = DEFAULTS[slug] || { title: defaultTitle, content: '' };
  const title = page?.title || defaults.title;
  const content = page?.content || defaults.content;

  return (
    <div className="p-6">
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
          ref={contentRef}
          className="max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
    </div>
  );
}
