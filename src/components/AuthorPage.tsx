"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, FileText, Eye, Heart, Instagram, Facebook, Linkedin, Globe } from "lucide-react";
import { useBackButton } from "@/hooks/useBackButton";
import GenXLoader from "./GenXLoader";

interface AuthorArticle {
  _id: string;
  title: string;
  subtitle?: string;
  coverImage?: string;
  category: string;
  publishedAt?: string;
  readTime?: number;
  views: number;
  likes: number;
  authorAvatar?: string;
}

interface AuthorInfo {
  name: string;
  bio?: string;
  avatar?: string;
  articleCount: number;
  totalViews: number;
  totalLikes: number;
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    website?: string;
  };
}

interface AuthorPageProps {
  authorName: string;
  onBack: () => void;
  onOpenArticle: (id: string) => void;
}

export default function AuthorPage({ authorName, onBack, onOpenArticle }: AuthorPageProps) {
  useBackButton(true, onBack);

  const [articles, setArticles] = useState<AuthorArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorInfo, setAuthorInfo] = useState<AuthorInfo | null>(null);

  useEffect(() => {
    const fetchAuthorData = async () => {
      try {
        // Fetch articles + author profile in parallel
        const [articlesRes, authorRes] = await Promise.all([
          fetch(`/api/articles?author=${encodeURIComponent(authorName)}&status=published`),
          fetch(`/api/author?name=${encodeURIComponent(authorName)}`),
        ]);
        const articlesData = await articlesRes.json();
        const authorData = await authorRes.json();
        const list: AuthorArticle[] = articlesData.articles || [];

        // Compute aggregate stats
        const totalViews = list.reduce((sum, a) => sum + (a.views || 0), 0);
        const totalLikes = list.reduce((sum, a) => sum + (a.likes || 0), 0);

        // Get avatar from author profile or fallback to article
        const authorProfile = authorData.author;
        const avatar = authorProfile?.avatar || list.find((a) => a.authorAvatar)?.authorAvatar;

        setArticles(list);
        setAuthorInfo({
          name: authorProfile?.name || authorName,
          avatar,
          bio: authorProfile?.bio || '',
          socialLinks: authorProfile?.socialLinks || {},
          articleCount: list.length,
          totalViews,
          totalLikes,
        });
      } catch (error) {
        console.error('Failed to load author:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAuthorData();
  }, [authorName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <GenXLoader />
      </div>
    );
  }

  // Initials fallback for avatar
  const initials = authorName
    .split(' ')
    .map((n) => n[0]?.toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('');

  return (
    <div className="absolute inset-0 bg-cream overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)', scrollbarWidth: 'none' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur border-b border-warm/30">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#E36B11] text-white hover:bg-[#c06a2a] transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Author Profile</h1>
        </div>
      </div>

      {/* Author Hero */}
      <div
        className="relative px-5 py-8"
        style={{
          background: 'linear-gradient(135deg,#1A1A1A 0%,#2a2a2a 50%,#1A1A1A 100%)',
        }}
      >
        <div className="flex flex-col items-center text-center">
          {/* Avatar */}
          {authorInfo?.avatar ? (
            <img
              src={authorInfo.avatar}
              alt={authorName}
              className="w-24 h-24 rounded-full object-cover mb-4 shadow-xl"
              style={{ border: '3px solid rgba(212,135,58,0.6)' }}
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-xl"
              style={{
                background: 'linear-gradient(135deg,#E36B11 0%,#a86b2b 100%)',
                border: '3px solid rgba(212,135,58,0.4)',
              }}
            >
              <span className="text-3xl font-bold text-white">{initials || '?'}</span>
            </div>
          )}

          {/* Name */}
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{authorInfo?.name}</h2>
          <p className="text-xs text-[#E36B11] font-medium uppercase tracking-[0.15em] mb-4">
            BOGX Contributor
          </p>

          {/* Bio */}
          {authorInfo?.bio && (
            <p className="text-sm text-white/80 max-w-md leading-relaxed mb-4 px-4">{authorInfo.bio}</p>
          )}

          {/* Social Links */}
          {authorInfo?.socialLinks && (
            (authorInfo.socialLinks.instagram || authorInfo.socialLinks.facebook || authorInfo.socialLinks.linkedin || authorInfo.socialLinks.website) && (
              <div className="flex items-center gap-2 mb-4">
                {authorInfo.socialLinks.facebook && (
                  <SocialBtn href={authorInfo.socialLinks.facebook} label="Facebook"><Facebook className="w-4 h-4" /></SocialBtn>
                )}
                {authorInfo.socialLinks.instagram && (
                  <SocialBtn href={authorInfo.socialLinks.instagram} label="Instagram"><Instagram className="w-4 h-4" /></SocialBtn>
                )}
                {authorInfo.socialLinks.linkedin && (
                  <SocialBtn href={authorInfo.socialLinks.linkedin} label="LinkedIn"><Linkedin className="w-4 h-4" /></SocialBtn>
                )}
                {authorInfo.socialLinks.website && (
                  <SocialBtn href={authorInfo.socialLinks.website} label="Website"><Globe className="w-4 h-4" /></SocialBtn>
                )}
              </div>
            )
          )}

          {/* Stats */}
          <div className="flex items-center gap-6 mt-2">
            <Stat icon={<FileText className="w-4 h-4" />} value={authorInfo?.articleCount || 0} label="Articles" />
            <div className="w-px h-8" style={{ background: 'rgba(212,135,58,0.3)' }} />
            <Stat icon={<Eye className="w-4 h-4" />} value={authorInfo?.totalViews || 0} label="Views" />
            <div className="w-px h-8" style={{ background: 'rgba(212,135,58,0.3)' }} />
            <Stat icon={<Heart className="w-4 h-4" />} value={authorInfo?.totalLikes || 0} label="Likes" />
          </div>
        </div>
      </div>

      {/* Articles List */}
      <div className="px-5 py-6">
        <h3 className="text-xs font-bold text-gray-600 uppercase tracking-[0.15em] mb-4">
          Articles by {authorName} ({articles.length})
        </h3>

        {articles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            No published articles yet.
          </div>
        ) : (
          <div className="space-y-3">
            {articles.map((article) => (
              <button
                key={article._id}
                onClick={() => onOpenArticle(article._id)}
                className="w-full text-left bg-white border border-warm/40 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex gap-3 p-2"
              >
                {/* Thumbnail */}
                {article.coverImage ? (
                  <img
                    src={article.coverImage}
                    alt={article.title}
                    className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 flex-shrink-0 rounded-lg bg-gradient-to-br from-[#E36B11]/20 to-[#E36B11]/5 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#E36B11]/50" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0 py-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#E36B11] mb-1">
                    {article.category}
                  </p>
                  <h4 className="text-sm font-bold text-gray-800 line-clamp-2 leading-tight mb-1">
                    {article.title}
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    {article.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(article.publishedAt)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {article.views || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3" />
                      {article.likes || 0}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-8 bg-cream" />
    </div>
  );
}

function SocialBtn({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-110"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(212,135,58,0.25)',
        color: '#E36B11',
      }}
    >
      {children}
    </a>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1 text-[#E36B11]">
        {icon}
        <span className="text-lg font-bold text-white">{formatNumber(value)}</span>
      </div>
      <span className="text-[10px] text-white/50 uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}
