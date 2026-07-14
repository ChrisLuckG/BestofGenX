"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import ArcadeTab from "@/components/admin/CardsTab";
import MikeTab from "@/components/admin/MikeTabNew";
import RankrollTab from "@/components/admin/RankrollTab";
import UsersTab from "@/components/admin/UsersTab";
import RewardsTab from "@/components/admin/RewardsTab";
import ArticlesTab from "@/components/admin/ArticlesTab";
import CurrencyTab from "@/components/admin/SettingsTab";
import CostsTab from "@/components/admin/CostsTab";
import RequestsTab from "@/components/admin/RequestsTab";
// PredictionsTab is now embedded in ArcadeTab
import MarketingTab from "@/components/admin/MarketingTab";
import TVTab from "@/components/admin/TVTab";
import MenschenTab from "@/components/admin/MenschenTab";
import NewsroomConference from "@/components/admin/NewsroomConference";

const PRINTFUL_URL = 'https://www.printful.com/dashboard/default';

type TabType = 'articles' | 'arcade' | 'rewards' | 'rankroll' | 'users' | 'currency' | 'costs' | 'requests' | 'marketing' | 'tv' | 'mike' | 'menschen' | 'conference';

// Frontend-related tabs (left)
const CONTENT_TABS: { id: TabType; label: string }[] = [
  { id: 'articles', label: 'Articles' },
  { id: 'arcade', label: 'Arcade' },
  { id: 'rankroll', label: 'Rankroll' },
  { id: 'tv', label: 'TV' },
];

// Configuration / external tabs (right)
const CONFIG_TABS: { id: TabType; label: string }[] = [
  { id: 'rewards', label: 'Rewards' },
  { id: 'users', label: 'Users' },
  { id: 'costs', label: 'Costs' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'currency', label: 'Currency' },
  { id: 'mike', label: 'Mike' },
  { id: 'menschen', label: 'Menschen' },
  { id: 'conference', label: '📰 Conference' },
];

export default function AdminPage() {
  const { user, isLoggedIn } = useAuth();
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    // Restore last active tab from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin-active-tab') as TabType | null;
      if (saved && ['articles', 'arcade', 'rewards', 'rankroll', 'users', 'currency', 'costs', 'requests', 'marketing', 'tv', 'mike', 'menschen', 'conference'].includes(saved)) {
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D4873A] animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn || !user?.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md border border-gray-700 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 text-sm mb-6">
            {!isLoggedIn ? "Please login with an admin account." : "You don't have admin privileges."}
          </p>
          <a href="/" className="text-gray-400 hover:text-white text-xs">&larr; Back to App</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-3 py-3" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div className="w-full max-w-[2200px] mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">Admin Panel</h1>
          <a href="/" target="_blank" className="text-gray-400 hover:text-white text-xs">&larr; Back to App</a>
        </div>
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          {/* Content/frontend tabs - left */}
          <div className="flex gap-1">
            {CONTENT_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === tab.id ? 'bg-[#D4873A] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
            {/* Shop - opens Printful in a new window */}
            <a
              href={PRINTFUL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white inline-flex items-center gap-1.5"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 relative ${
                activeTab === 'requests' ? 'bg-[#D4873A] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  activeTab === tab.id ? 'bg-[#D4873A] text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {activeTab === 'arcade' && <ArcadeTab />}
        {activeTab === 'articles' && <ArticlesTab userId={user?.id} />}
        {activeTab === 'users' && <UsersTab userId={user?.id} onGoToArticles={() => setActiveTab('articles')} />}
        {activeTab === 'rewards' && <RewardsTab />}
        {activeTab === 'rankroll' && <RankrollTab />}
        {activeTab === 'currency' && <CurrencyTab />}
        {activeTab === 'costs' && <CostsTab />}
        {activeTab === 'requests' && <RequestsTab onArticleCreated={() => setActiveTab('articles')} onStatusChange={fetchNewRequestsCount} />}
                {activeTab === 'marketing' && <MarketingTab />}
        {activeTab === 'tv' && <TVTab />}
        {activeTab === 'mike' && <MikeTab />}
        {activeTab === 'menschen' && <MenschenTab userId={user?.id} />}
        {activeTab === 'conference' && <NewsroomConference userId={user?.id} />}
      </div>
    </div>
  );
}
