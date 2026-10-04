"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Loader2, Monitor, Tablet, Smartphone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ArcadeTab from "@/components/admin/CardsTab";
import MikeTab from "@/components/admin/MikeTabNew";
import RankrollTab from "@/components/admin/RankrollTab";
import UsersTab from "@/components/admin/UsersTab";
import RewardsTab from "@/components/admin/RewardsTab";
import ArticlesTab from "@/components/admin/ArticlesTab";
import CurrencyTab from "@/components/admin/SettingsTab";
import RequestsTab from "@/components/admin/RequestsTab";

import MarketingTab from "@/components/admin/MarketingTab";
import TVTab from "@/components/admin/TVTab";
import MenschenTab from "@/components/admin/MenschenTab";
import NewsroomConference from "@/components/admin/NewsroomConference";

const PRINTFUL_URL = 'https://www.printful.com/dashboard/default';

// Preview buttons - open the live site at different viewport sizes
const PREVIEW_SIZES: { label: string; width: number; height: number; icon: typeof Monitor }[] = [
  { label: "Desktop", width: 1440, height: 900, icon: Monitor },
  { label: "Tablet", width: 834, height: 1000, icon: Tablet },
  { label: "Mobile", width: 390, height: 844, icon: Smartphone },
];

type TabType = 'articles' | 'arcade' | 'rewards' | 'rankroll' | 'users' | 'currency' | 'requests' | 'marketing' | 'tv' | 'mike' | 'menschen' | 'conference';

// Frontend-related tabs (left)
const CONTENT_TABS: { id: TabType; label: string }[] = [
  { id: 'articles', label: 'Articles' },
  { id: 'arcade', label: 'Trivia' },
  { id: 'rankroll', label: 'Rankroll' },
  { id: 'tv', label: 'TV' },
];

// Configuration / external tabs (right)
const CONFIG_TABS: { id: TabType; label: string }[] = [
  { id: 'rewards', label: 'Rewards' },
  { id: 'users', label: 'Users' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'currency', label: 'Currency' },
  { id: 'mike', label: 'Mike' },
  { id: 'conference', label: '?? Conference' },
];

export default function AdminPage() {
  const { user, isLoggedIn } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  
  // When a reporter's rankroll proposal is selected from the Newsroom Conference,
  // this holds the title/description so RankrollTab auto-creates a new ranking.
  const [pendingRankrollTitle, setPendingRankrollTitle] = useState<string | null>(null);
  const [pendingRankrollDescription, setPendingRankrollDescription] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Restore last active tab from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-active-tab') as TabType | null;
      if (saved && ['articles', 'arcade', 'rewards', 'rankroll', 'users', 'currency', 'requests', 'marketing', 'tv', 'mike', 'menschen', 'conference'].includes(saved)) {
        return saved;
      }
    }
    return 'arcade';
  });

  const [newRequestsCount, setNewRequestsCount] = useState(0);

  // Fetch new requests count
  const fetchNewRequestsCount = useCallback(async () => {
    try {
      const res = await fetch('/api/song-request?status=new');
      const data = await res.json();
      if (data.success) {
        setNewRequestsCount(data.requests?.length || 0);
      }
    } catch (e) {
      console.error('Failed to fetch requests count:', e);
    }
  }, []);

  // Persist active tab to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin-active-tab', activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    const timer = setTimeout(() => setAuthChecked(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Fetch new requests count on mount and when switching away from requests tab
  useEffect(() => {
    fetchNewRequestsCount();
  }, [fetchNewRequestsCount, activeTab]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#E36B11] animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn || !user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md border border-gray-200 text-center shadow-sm">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-6">
            {!isLoggedIn ? "Please login with an admin account." : "You don't have admin privileges."}
          </p>
          <a href="/" className="text-gray-500 hover:text-gray-900 text-xs">&larr; Back to App</a>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <div className="w-full max-w-[2200px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <div className="flex items-center gap-1">
            {PREVIEW_SIZES.map((size) => (
              <button
                key={size.label}
                onClick={() => {
                  window.open('/', '_blank', `width=${size.width},height=${size.height},menubar=no,toolbar=no,location=no,status=no`);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900 text-xs font-medium transition-colors"
                title={`Open in ${size.width}×${size.height} window`}
              >
                <size.icon className="w-3.5 h-3.5" />
                {size.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {/* Content/frontend tabs - left */}
          <div className="flex gap-1">
            {CONTENT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
            {/* Shop - opens Printful in a new window */}
            <a
              href={PRINTFUL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-tab inline-flex items-center gap-1.5"
              title="Open Printful Dashboard in new tab"
            >
              Shop
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
                <path d="M7 17 17 7M7 7h10v10" />
              </svg>
            </a>
            {/* Radio - Song Requests & Radio Stations */}
            <button
              onClick={() => setActiveTab('requests')}
              className={`admin-tab relative ${activeTab === 'requests' ? 'active' : ''}`}
            >
              Radio
              {newRequestsCount > 0 && (
                <span className="absolute top-0 -right-2 min-w-[16px] h-[16px] flex items-center justify-center px-1 text-[9px] font-bold bg-red-500 text-white rounded-full">
                  {newRequestsCount}
                </span>
              )}
            </button>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-w-2" />

          {/* Config/external tabs - right */}
          <div className="flex gap-1">
            {CONFIG_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'arcade' && <ArcadeTab />}
        {activeTab === 'articles' && <ArticlesTab userId={user?.id} onGoToMenschen={() => setActiveTab('menschen')} />}
        {activeTab === 'users' && <UsersTab userId={user?.id} onGoToArticles={() => setActiveTab('articles')} />}
        {activeTab === 'rewards' && <RewardsTab />}
        {/* Rankroll stays mounted for pending proposals from Conference */}
        {(activeTab === 'rankroll' || pendingRankrollTitle) && (
          <RankrollTab
            initialNewTitle={pendingRankrollTitle}
            initialNewDescription={pendingRankrollDescription}
            onProposalHandled={() => { setPendingRankrollTitle(null); setPendingRankrollDescription(null); }}
            hideListView={activeTab !== 'rankroll'}
          />
        )}
        {activeTab === 'currency' && <CurrencyTab />}
        {activeTab === 'requests' && <RequestsTab onArticleCreated={() => setActiveTab('articles')} onStatusChange={fetchNewRequestsCount} />}
        {activeTab === 'marketing' && <MarketingTab />}
        {/* TV stays mounted so video searches continue when switching tabs */}
        <div className={activeTab === 'tv' ? '' : 'hidden'}>
          <TVTab />
        </div>
        {activeTab === 'mike' && <MikeTab />}
        {/* Menschen stays mounted so birthday searches continue when switching tabs */}
        <div className={activeTab === 'menschen' ? '' : 'hidden'}>
          <MenschenTab userId={user?.id} />
        </div>
        {/* Conference stays mounted so background searches continue when switching tabs */}
        <div className={activeTab === 'conference' ? '' : 'hidden'}>
          <NewsroomConference
            userId={user?.id}
            onRankrollProposed={(title: string, description: string) => {
              // Stay on the Conference tab - the editor opens as an overlay on top of it.
              setPendingRankrollTitle(title);
              setPendingRankrollDescription(description);
            }}
          />
        </div>
      </div>

      
    </div>
  );
}
