"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, Upload, Image as ImageIcon } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  'about': 'About Us / Who We Are',
  'impressum': 'Impressum',
  'datenschutz': 'Datenschutz',
  'agb': 'AGB',
  'kontakt': 'Kontakt',
  'presse': 'Presse',
  'karriere': 'Karriere',
};

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [page, setPage] = useState({
    title: PAGE_TITLES[slug] || slug,
    subtitle: '',
    content: '',
    coverImage: '',
    status: 'published' as 'draft' | 'published',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPage();
  }, [slug]);

  const loadPage = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pages?slug=${slug}`);
      const data = await res.json();
      if (data.success && data.page) {
        setPage({
          title: data.page.title || PAGE_TITLES[slug] || slug,
          subtitle: data.page.subtitle || '',
          content: data.page.content || '',
          coverImage: data.page.coverImage || '',
          status: data.page.status || 'published',
        });
      }
    } catch (e) {
      console.error('Failed to load page:', e);
    } finally {
      setLoading(false);
    }
  };

  const savePage = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...page }),
      });
      const data = await res.json();
      if (data.success) {
        alert('Page saved!');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      console.error('Failed to save page:', e);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (data.success && data.url) {
        setPage({ ...page, coverImage: data.url });
      }
    } catch (e) {
      console.error('Upload failed:', e);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D4873A] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold">Edit Page: {PAGE_TITLES[slug] || slug}</h1>
              <p className="text-xs text-gray-400">/{slug}</p>
            </div>
          </div>
          <button
            onClick={savePage}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-[#D4873A] rounded-lg font-bold hover:bg-[#C4772A] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Cover Image */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <label className="text-sm font-medium text-gray-400 mb-2 block">Cover Image</label>
          <div className="flex items-center gap-4">
            {page.coverImage ? (
              <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-gray-600">
                <img src={page.coverImage} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPage({ ...page, coverImage: '' })}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs"
                >
                  ×
                </button>
              </div>
            ) : (
              <div className="w-32 h-20 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-gray-500" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading...' : 'Upload Image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Title */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <label className="text-sm font-medium text-gray-400 mb-2 block">Title</label>
          <input
            type="text"
            value={page.title}
            onChange={(e) => setPage({ ...page, title: e.target.value })}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#D4873A]"
          />
        </div>

        {/* Subtitle */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <label className="text-sm font-medium text-gray-400 mb-2 block">Subtitle (optional)</label>
          <input
            type="text"
            value={page.subtitle}
            onChange={(e) => setPage({ ...page, subtitle: e.target.value })}
            placeholder="Short description..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4873A]"
          />
        </div>

        {/* Content */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <label className="text-sm font-medium text-gray-400 mb-2 block">Content (HTML)</label>
          <textarea
            value={page.content}
            onChange={(e) => setPage({ ...page, content: e.target.value })}
            rows={20}
            placeholder="<h2>Section Title</h2>
<p>Your content here...</p>

<h3>Another Section</h3>
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#D4873A] font-mono text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">
            Use HTML tags: &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;a href=&quot;...&quot;&gt;
          </p>
        </div>

        {/* Status */}
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <label className="text-sm font-medium text-gray-400 mb-2 block">Status</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPage({ ...page, status: 'published' })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                page.status === 'published'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              Published
            </button>
            <button
              onClick={() => setPage({ ...page, status: 'draft' })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                page.status === 'draft'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              Draft
            </button>
          </div>
        </div>

        {/* Preview Link */}
        <div className="text-center">
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#D4873A] hover:underline text-sm"
          >
            Preview page →
          </a>
        </div>
      </div>
    </div>
  );
}
