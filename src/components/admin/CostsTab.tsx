"use client";

import { useState, useEffect } from "react";
import { Sparkles, Database, Cloud, RefreshCw, AlertCircle, ExternalLink, DollarSign, FileText, HardDrive, Activity, Mail, CreditCard, TrendingUp, TrendingDown, Code2, Image as ImageIcon, HelpCircle, BarChart3, Users } from "lucide-react";
import GenXLoader from "@/components/GenXLoader";

interface OpenAIData {
  success: boolean;
  configured: boolean;
  error?: string;
  helpUrl?: string;
  monthlyCostUsd?: number;
  modelBreakdown?: { model: string; inputTokens: number; outputTokens: number }[];
  dailyCosts?: { date: string; amount: number }[];
  period?: { from: string; to: string };
  hardLimitUsd?: number | null;
  softLimitUsd?: number | null;
  creditBalanceUsd?: number | null;
  creditGrantedUsd?: number | null;
}

interface MongoData {
  success: boolean;
  configured: boolean;
  error?: string;
  helpUrl?: string;
  monthlyCostUsd?: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  lineItems?: { sku: string; description: string; amountUsd: number }[];
  clusters?: {
    name: string;
    project: string;
    tier: string;
    region: string;
    diskSizeGB: number;
    mongoVersion: string;
    state: string;
    backupEnabled: boolean;
  }[];
  clusterError?: string | null;
  dbStats?: {
    dbName: string;
    dataSize: number;
    storageSize: number;
    indexSize: number;
    totalSize: number;
    objects: number;
    collectionCount: number;
  } | null;
}

interface VercelData {
  success: boolean;
  configured: boolean;
  error?: string;
  helpUrl?: string;
  account?: { username: string; email: string };
  projectCount?: number;
  projects?: { id: string; name: string }[];
  blob?: { stores: { name: string; sizeBytes: number }[]; totalBytes: number };
  recentDeployments?: number;
  note?: string;
}

interface ResendData {
  success: boolean;
  configured: boolean;
  error?: string;
  helpUrl?: string;
  monthlyCount?: number;
  estimatedPlan?: string;
  estimatedCostUsd?: number;
  freeLimit?: number;
  statusBreakdown?: Record<string, number>;
  note?: string;
}

interface StripeData {
  success: boolean;
  configured: boolean;
  error?: string;
  helpUrl?: string;
  currency?: string;
  monthlyRevenue?: number;
  monthlyFees?: number;
  monthlyNet?: number;
  monthlySuccessCount?: number;
  monthlyFailCount?: number;
  balance?: { available: number; pending: number };
}

interface WindsurfData {
  success: boolean;
  configured: boolean;
  error?: string;
  helpUrl?: string;
  monthlyCostUsd?: number;
  planName?: string;
  note?: string;
}

interface CloudinaryData {
  success: boolean;
  configured?: boolean;
  error?: string;
  plan?: string;
  storage?: { usage: number; limit: number; used_percent: number };
  bandwidth?: { usage: number; limit: number; used_percent: number };
  resources?: number;
  transformations?: { usage: number; limit: number; used_percent: number };
  credits?: { usage: number; limit: number; used_percent: number };
}

interface AppUsageData {
  success: boolean;
  stats?: {
    cards: { total: number; thisMonth: number; last30Days: number; last7Days: number; totalQuestions: number };
    articles: { total: number; published: number; thisMonth: number; withCover: number; aiGeneratedCovers: number };
    images: { total: number; cardPreview: number; cardPlayer: number; articleCover: number };
    polls: { total: number; thisMonth: number };
    users: { total: number; newThisMonth: number };
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function formatUsd(amount: number | undefined | null): string {
  const safe = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(safe);
}

function safeNum(v: any): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

export default function CostsTab() {
  const [openai, setOpenai] = useState<OpenAIData | null>(null);
  const [mongo, setMongo] = useState<MongoData | null>(null);
  const [vercel, setVercel] = useState<VercelData | null>(null);
  const [resend, setResend] = useState<ResendData | null>(null);
  const [stripe, setStripe] = useState<StripeData | null>(null);
  const [windsurf, setWindsurf] = useState<WindsurfData | null>(null);
  const [cloudinaryData, setCloudinaryData] = useState<CloudinaryData | null>(null);
  const [appUsage, setAppUsage] = useState<AppUsageData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [openaiRes, mongoRes, vercelRes, resendRes, stripeRes, windsurfRes, cloudinaryRes, usageRes] = await Promise.all([
        fetch('/api/admin/costs/openai').then(r => r.json()).catch(() => ({ success: false, error: 'Network error' })),
        fetch('/api/admin/costs/mongodb').then(r => r.json()).catch(() => ({ success: false, error: 'Network error' })),
        fetch('/api/admin/costs/vercel').then(r => r.json()).catch(() => ({ success: false, error: 'Network error' })),
        fetch('/api/admin/costs/resend').then(r => r.json()).catch(() => ({ success: false, error: 'Network error' })),
        fetch('/api/admin/costs/stripe').then(r => r.json()).catch(() => ({ success: false, error: 'Network error' })),
        fetch('/api/admin/costs/windsurf').then(r => r.json()).catch(() => ({ success: false, error: 'Network error' })),
        fetch('/api/admin/costs/cloudinary').then(r => r.json()).catch(() => ({ success: false, error: 'Network error' })),
        fetch('/api/admin/costs/app-usage').then(r => r.json()).catch(() => ({ success: false })),
      ]);
      setOpenai(openaiRes);
      setMongo(mongoRes);
      setVercel(vercelRes);
      setResend(resendRes);
      setStripe(stripeRes);
      setWindsurf(windsurfRes);
      setCloudinaryData(cloudinaryRes);
      setAppUsage(usageRes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Combined monthly cost total (NaN-safe)
  const totalCostUsd = safeNum(openai?.monthlyCostUsd) + safeNum(mongo?.monthlyCostUsd) + safeNum(resend?.estimatedCostUsd) + safeNum(windsurf?.monthlyCostUsd);
  // Revenue (Stripe)
  const revenue = safeNum(stripe?.monthlyNet);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-sm font-bold">Service Costs</h2>
            <p className="text-[11px] text-gray-400">OpenAI · MongoDB Atlas · Vercel — billing period: this month</p>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Profit / Loss summary */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-green-400 font-bold mb-1">
              <TrendingUp className="w-3 h-3" />
              Revenue
            </div>
            <div className="text-lg font-bold text-white">{formatUsd(revenue)}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">From Stripe (net)</div>
          </div>

          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-400 font-bold mb-1">
              <TrendingDown className="w-3 h-3" />
              Costs
            </div>
            <div className="text-lg font-bold text-white">{formatUsd(totalCostUsd)}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">AI + DB + Email</div>
          </div>

          <div className={`p-3 rounded-lg border ${revenue - totalCostUsd >= 0 ? 'bg-[#D4873A]/10 border-[#D4873A]/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold mb-1 ${revenue - totalCostUsd >= 0 ? 'text-[#D4873A]' : 'text-red-400'}`}>
              <DollarSign className="w-3 h-3" />
              Net
            </div>
            <div className="text-lg font-bold text-white">{formatUsd(revenue - totalCostUsd)}</div>
            <div className="text-[9px] text-gray-500 mt-0.5">{revenue - totalCostUsd >= 0 ? 'Profit' : 'Loss'}</div>
          </div>
        </div>
      </div>

      {/* App Usage Stats */}
      {appUsage?.success && appUsage.stats && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-[#D4873A]" />
            <h3 className="text-sm font-bold">App Usage — What you generated</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            <UsageStat
              icon={<HelpCircle className="w-4 h-4" />}
              label="Questions"
              value={appUsage.stats.cards.totalQuestions}
              sub={`${appUsage.stats.cards.total} cards`}
              color="purple"
            />
            <UsageStat
              icon={<ImageIcon className="w-4 h-4" />}
              label="Images"
              value={appUsage.stats.images.total}
              sub={`${appUsage.stats.images.cardPreview + appUsage.stats.images.cardPlayer} cards · ${appUsage.stats.images.articleCover} articles`}
              color="orange"
            />
            <UsageStat
              icon={<FileText className="w-4 h-4" />}
              label="Articles"
              value={appUsage.stats.articles.total}
              sub={`${appUsage.stats.articles.published} published · ${appUsage.stats.articles.thisMonth} this month`}
              color="green"
            />
            <UsageStat
              icon={<Activity className="w-4 h-4" />}
              label="Polls"
              value={appUsage.stats.polls.total}
              sub={`${appUsage.stats.polls.thisMonth} this month`}
              color="blue"
            />
            <UsageStat
              icon={<Users className="w-4 h-4" />}
              label="Users"
              value={appUsage.stats.users.total}
              sub={`+${appUsage.stats.users.newThisMonth} this month`}
              color="indigo"
            />
            <UsageStat
              icon={<Sparkles className="w-4 h-4" />}
              label="Cards (30d)"
              value={appUsage.stats.cards.last30Days}
              sub={`${appUsage.stats.cards.last7Days} last 7 days`}
              color="pink"
            />
          </div>
        </div>
      )}

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">

      {/* OpenAI Card */}
      <ProviderCard
        icon={<Sparkles className="w-4 h-4" />}
        title="OpenAI / ChatGPT"
        color="purple"
        data={openai}
        loading={loading && !openai}
      >
        {openai?.success && (() => {
          const now = new Date();
          const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
          const dayOfMonth = now.getDate();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
          const costSoFar = safeNum(openai.monthlyCostUsd);
          const dailyAvg = dayOfMonth > 0 ? costSoFar / dayOfMonth : 0;
          const projected = dailyAvg * daysInMonth;
          const topDay = openai.dailyCosts?.length
            ? [...openai.dailyCosts].sort((a, b) => b.amount - a.amount)[0]
            : null;
          return (
            <>
              {/* Billing period banner */}
              <div className="mb-3 p-2 bg-purple-500/5 border border-purple-500/20 rounded text-[10px]">
                <div className="text-purple-300 font-bold uppercase tracking-wider">Billing Period</div>
                <div className="text-gray-400 mt-0.5">{monthName} — resets on {monthEnd}</div>
                <div className="text-gray-500">Day {dayOfMonth} of {daysInMonth}</div>
              </div>

              {/* Credit Balance (Pay-as-you-go) - takes priority */}
              {typeof openai.creditBalanceUsd === 'number' && openai.creditBalanceUsd > 0 ? (
                (() => {
                  const balance = safeNum(openai.creditBalanceUsd);
                  const granted = safeNum(openai.creditGrantedUsd) || (balance + costSoFar);
                  const usedPct = granted > 0 ? Math.min(((granted - balance) / granted) * 100, 100) : 0;
                  // Days remaining at current burn rate
                  const daysRemaining = dailyAvg > 0 ? Math.floor(balance / dailyAvg) : null;
                  const lowBalance = balance < 5;
                  return (
                    <div className={`mb-3 p-2.5 rounded border ${lowBalance ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${lowBalance ? 'text-red-400' : 'text-green-400'}`}>
                          Credit Balance (Pay-as-you-go)
                        </span>
                        <span className="text-base font-bold text-white">{formatUsd(balance)}</span>
                      </div>
                      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 transition-all ${lowBalance ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${100 - usedPct}%` }} />
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                        <span>{(100 - usedPct).toFixed(0)}% remaining</span>
                        {daysRemaining !== null && (
                          <span className={lowBalance ? 'text-red-400 font-bold' : ''}>
                            ~{daysRemaining} days at current rate
                          </span>
                        )}
                      </div>
                      {lowBalance && (
                        <div className="mt-1.5 text-[10px] text-red-300">
                          ⚠ Low balance — <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer" className="underline">top up credits</a>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : openai.hardLimitUsd && openai.hardLimitUsd > 0 ? (
                (() => {
                  const limit = safeNum(openai.hardLimitUsd);
                  const pct = Math.min((costSoFar / limit) * 100, 100);
                  const projectedPct = Math.min((projected / limit) * 100, 100);
                  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-purple-500';
                  return (
                    <div className="mb-3 p-2.5 bg-gray-900/50 border border-gray-700 rounded">
                      <div className="flex items-center justify-between text-[10px] mb-1.5">
                        <span className="font-bold uppercase tracking-wider text-gray-400">Budget (Hard Limit)</span>
                        <span className="text-white font-bold">{formatUsd(costSoFar)} <span className="text-gray-500">/ {formatUsd(limit)}</span></span>
                      </div>
                      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div className={`absolute inset-y-0 left-0 ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                        {projectedPct > pct && (
                          <div className="absolute inset-y-0 left-0 bg-purple-500/30 transition-all" style={{ width: `${projectedPct}%`, marginLeft: `${pct}%` }} />
                        )}
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                        <span>{pct.toFixed(1)}% used</span>
                        <span>Projected: {projectedPct.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="mb-3 p-2 bg-gray-900/50 border border-gray-700 rounded text-[10px] text-gray-500">
                  <span className="font-bold text-gray-400">No budget / credits detected via API.</span> Manage at{' '}
                  <a href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noopener noreferrer" className="text-[#D4873A] hover:underline">platform.openai.com → Billing</a>
                </div>
              )}

              <CostRow label="Spent so far" value={formatUsd(costSoFar)} highlight />
              <CostRow label="Daily average" value={formatUsd(dailyAvg)} />
              <CostRow label="Projected month" value={formatUsd(projected)} />
              {topDay && topDay.amount > 0 && (
                <CostRow
                  label={`Highest day (${new Date(topDay.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})`}
                  value={formatUsd(topDay.amount)}
                />
              )}

              {openai.modelBreakdown && openai.modelBreakdown.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                    Token Usage by Model (last 30d)
                  </div>
                  <div className="space-y-1.5">
                    {openai.modelBreakdown.slice(0, 5).map((m) => (
                      <div key={m.model} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 font-mono">{m.model}</span>
                        <span className="text-gray-400">
                          <span className="text-blue-400">{m.inputTokens.toLocaleString()}</span>
                          <span className="text-gray-600"> in · </span>
                          <span className="text-green-400">{m.outputTokens.toLocaleString()}</span>
                          <span className="text-gray-600"> out</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mini daily chart */}
              {openai.dailyCosts && openai.dailyCosts.length > 1 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                    Daily Spend (this month)
                  </div>
                  <div className="flex items-end gap-0.5 h-12">
                    {openai.dailyCosts.map((d, i) => {
                      const max = Math.max(...openai.dailyCosts!.map(x => x.amount), 0.01);
                      const heightPct = (d.amount / max) * 100;
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-purple-500/40 hover:bg-purple-400 transition-colors rounded-t"
                          style={{ height: `${Math.max(heightPct, 2)}%` }}
                          title={`${d.date}: ${formatUsd(d.amount)}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                    <span>Day 1</span>
                    <span>Day {dayOfMonth}</span>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </ProviderCard>

      {/* MongoDB Card */}
      <ProviderCard
        icon={<Database className="w-4 h-4" />}
        title="MongoDB Atlas"
        color="green"
        data={mongo}
        loading={loading && !mongo}
      >
        {mongo?.success && (
          <>
            <CostRow label="Current Invoice" value={formatUsd(mongo.monthlyCostUsd || 0)} highlight />
            {mongo.status && (
              <CostRow label="Status" value={mongo.status} />
            )}

            {/* Cluster Error / Permission hint */}
            {(!mongo.clusters || mongo.clusters.length === 0) && mongo.clusterError && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-300">
                  <span className="font-bold">Cluster info unavailable:</span> {mongo.clusterError}
                </div>
              </div>
            )}

            {/* Live Storage Usage */}
            {mongo.dbStats && (() => {
              const isFree = mongo.clusters?.some((c) => c.tier === 'M0');
              const limitBytes = isFree ? 512 * 1024 * 1024 : (mongo.clusters?.[0]?.diskSizeGB || 10) * 1024 * 1024 * 1024;
              const usedBytes = mongo.dbStats!.storageSize + mongo.dbStats!.indexSize;
              const pct = (usedBytes / limitBytes) * 100;
              const barColor = pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-green-500';
              const remaining = limitBytes - usedBytes;
              return (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                    Storage Usage (live)
                  </div>
                  <div className="p-2.5 bg-gray-900/50 rounded border border-gray-700">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-white">{formatBytes(usedBytes)}</span>
                      <span className="text-[10px] text-gray-400">of {formatBytes(limitBytes)} {isFree && '(Free)'}</span>
                    </div>
                    <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`absolute inset-y-0 left-0 ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                      <span>{pct.toFixed(1)}% used</span>
                      <span>{formatBytes(remaining)} free</span>
                    </div>

                    {/* Breakdown */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-700">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-gray-500">Data</div>
                        <div className="text-xs text-white font-bold">{formatBytes(mongo.dbStats!.dataSize)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-gray-500">Indexes</div>
                        <div className="text-xs text-white font-bold">{formatBytes(mongo.dbStats!.indexSize)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-gray-500">Documents</div>
                        <div className="text-xs text-white font-bold">{mongo.dbStats!.objects.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-gray-500">Collections</div>
                        <div className="text-xs text-white font-bold">{mongo.dbStats!.collectionCount}</div>
                      </div>
                    </div>

                    {pct > 85 && isFree && (
                      <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-300">
                        <span className="font-bold">⚠ Storage Critical!</span> You&apos;re running out on the Free tier.
                        Upgrade to <a href="https://www.mongodb.com/pricing" target="_blank" rel="noopener noreferrer" className="underline">M10 ($57/mo)</a> or higher to scale.
                      </div>
                    )}
                    {pct > 65 && pct <= 85 && isFree && (
                      <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[10px] text-amber-300">
                        <span className="font-bold">Heads up:</span> {(100 - pct).toFixed(0)}% storage left. Consider upgrading soon.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Clusters */}
            {mongo.clusters && mongo.clusters.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                  Clusters ({mongo.clusters.length})
                </div>
                <div className="space-y-2">
                  {mongo.clusters.map((c, i) => {
                    const isFreeT = c.tier === 'M0';
                    const limitGB = isFreeT ? 0.5 : c.diskSizeGB;
                    return (
                      <div key={i} className="p-2 bg-gray-900/50 rounded border border-gray-700">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white">{c.name}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded ${isFreeT ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {c.tier} {isFreeT && '(Free)'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 space-y-0.5">
                          <div className="flex justify-between">
                            <span>Region</span>
                            <span className="text-gray-300">{c.region}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Storage</span>
                            <span className="text-gray-300">{c.diskSizeGB} GB</span>
                          </div>
                          <div className="flex justify-between">
                            <span>MongoDB</span>
                            <span className="text-gray-300">v{c.mongoVersion}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>State</span>
                            <span className={c.state === 'IDLE' ? 'text-green-400' : 'text-amber-400'}>{c.state}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {mongo.lineItems && mongo.lineItems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                  Line Items
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {mongo.lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs gap-3">
                      <span className="text-gray-300 truncate flex-1" title={item.description}>{item.sku}</span>
                      <span className="text-gray-400 flex-shrink-0">{formatUsd(item.amountUsd)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </ProviderCard>

      {/* Vercel Card */}
      <ProviderCard
        icon={<Cloud className="w-4 h-4" />}
        title="Vercel (Hosting + Blob)"
        color="blue"
        data={vercel}
        loading={loading && !vercel}
      >
        {vercel?.success && (
          <>
            {vercel.account && (
              <CostRow label="Account" value={vercel.account.username} />
            )}
            {vercel.projectCount !== undefined && (
              <CostRow label="Projects" value={`${vercel.projectCount}`} icon={<FileText className="w-3 h-3" />} />
            )}
            {vercel.blob && (
              <CostRow
                label="Blob Storage"
                value={formatBytes(vercel.blob.totalBytes)}
                icon={<HardDrive className="w-3 h-3" />}
              />
            )}
            {vercel.recentDeployments !== undefined && (
              <CostRow
                label="Recent Deployments (30d)"
                value={`${vercel.recentDeployments}`}
                icon={<Activity className="w-3 h-3" />}
              />
            )}
            {vercel.note && (
              <p className="text-[10px] text-gray-500 mt-2 italic">{vercel.note}</p>
            )}
            <a
              href="https://vercel.com/dashboard/usage"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-[#D4873A] hover:underline"
            >
              View detailed usage on Vercel <ExternalLink className="w-3 h-3" />
            </a>
          </>
        )}
      </ProviderCard>

      {/* Resend Card */}
      <ProviderCard
        icon={<Mail className="w-4 h-4" />}
        title="Resend (Email)"
        color="orange"
        data={resend}
        loading={loading && !resend}
      >
        {resend?.success && (
          <>
            <CostRow label="Plan" value={resend.estimatedPlan || 'Free'} />
            <CostRow
              label="Emails Sent (this month)"
              value={`${resend.monthlyCount || 0} / ${resend.freeLimit || 3000}`}
              icon={<Mail className="w-3 h-3" />}
            />
            <CostRow label="Estimated Cost" value={formatUsd(resend.estimatedCostUsd || 0)} highlight />
            {resend.statusBreakdown && Object.keys(resend.statusBreakdown).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2">
                  Recent Status
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(resend.statusBreakdown).map(([status, count]) => (
                    <span key={status} className="text-[10px] px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                      {status}: <span className="font-bold text-white">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {resend.note && (
              <p className="text-[10px] text-gray-500 mt-2 italic">{resend.note}</p>
            )}
          </>
        )}
      </ProviderCard>

      {/* Stripe Card */}
      <ProviderCard
        icon={<CreditCard className="w-4 h-4" />}
        title="Stripe (Payments)"
        color="indigo"
        data={stripe}
        loading={loading && !stripe}
      >
        {stripe?.success && (
          <>
            <CostRow label="Revenue (this month)" value={formatUsd(stripe.monthlyRevenue || 0)} />
            <CostRow label="Stripe Fees" value={formatUsd(stripe.monthlyFees || 0)} />
            <CostRow label="Net Revenue" value={formatUsd(stripe.monthlyNet || 0)} highlight />
            <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Successful</div>
                <div className="text-sm font-bold text-green-400">{stripe.monthlySuccessCount || 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Failed</div>
                <div className="text-sm font-bold text-red-400">{stripe.monthlyFailCount || 0}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Available</div>
                <div className="text-sm font-bold text-white">{formatUsd(stripe.balance?.available || 0)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-500">Pending</div>
                <div className="text-sm font-bold text-amber-400">{formatUsd(stripe.balance?.pending || 0)}</div>
              </div>
            </div>
          </>
        )}
      </ProviderCard>

      {/* Windsurf (Cascade) Card */}
      <ProviderCard
        icon={<Code2 className="w-4 h-4" />}
        title="Windsurf (AI Coding Assistant)"
        color="pink"
        data={windsurf}
        loading={loading && !windsurf}
      >
        {windsurf?.success && (
          <>
            <CostRow label="Plan" value={windsurf.planName || 'Subscription'} />
            <CostRow label="Monthly Cost" value={formatUsd(windsurf.monthlyCostUsd || 0)} highlight />
            {windsurf.note && (
              <p className="text-[10px] text-gray-500 mt-2 italic">{windsurf.note}</p>
            )}
            <a
              href="https://windsurf.com/account"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-[11px] text-[#D4873A] hover:underline"
            >
              View account on Windsurf <ExternalLink className="w-3 h-3" />
            </a>
          </>
        )}
      </ProviderCard>

      {/* Cloudinary Card */}
      <ProviderCard
        icon={<ImageIcon className="w-4 h-4" />}
        title="Cloudinary (Images & Videos)"
        color="blue"
        data={cloudinaryData}
        loading={loading && !cloudinaryData}
      >
        {cloudinaryData?.success && (() => {
          const stor = cloudinaryData.storage;
          const bw = cloudinaryData.bandwidth;
          const storPct = stor ? Math.min(stor.used_percent ?? (stor.usage / stor.limit * 100), 100) : 0;
          const bwPct = bw ? Math.min(bw.used_percent ?? (bw.usage / bw.limit * 100), 100) : 0;
          const barColor = (pct: number) => pct > 85 ? 'bg-red-500' : pct > 65 ? 'bg-amber-500' : 'bg-blue-500';
          return (
            <>
              {cloudinaryData.plan && <CostRow label="Plan" value={cloudinaryData.plan} />}
              {cloudinaryData.resources !== undefined && <CostRow label="Total Assets" value={cloudinaryData.resources.toLocaleString()} icon={<ImageIcon className="w-3 h-3" />} />}
              {stor && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">Storage</div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white font-bold">{formatBytes(stor.usage)}</span>
                    <span className="text-gray-400">of {formatBytes(stor.limit)}</span>
                  </div>
                  <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 ${barColor(storPct)} transition-all`} style={{ width: `${storPct}%` }} />
                  </div>
                  <div className="text-[9px] text-gray-500 mt-1">{storPct.toFixed(1)}% used · {formatBytes(stor.limit - stor.usage)} free</div>
                </div>
              )}
              {bw && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5">Bandwidth (this month)</div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white font-bold">{formatBytes(bw.usage)}</span>
                    <span className="text-gray-400">of {formatBytes(bw.limit)}</span>
                  </div>
                  <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 ${barColor(bwPct)} transition-all`} style={{ width: `${bwPct}%` }} />
                  </div>
                  <div className="text-[9px] text-gray-500 mt-1">{bwPct.toFixed(1)}% used</div>
                </div>
              )}
              <a href="https://cloudinary.com/console" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-[11px] text-[#D4873A] hover:underline">
                Open Cloudinary Console <ExternalLink className="w-3 h-3" />
              </a>
            </>
          );
        })()}
      </ProviderCard>

      </div> {/* End Provider Cards Grid */}

      {/* Setup hint */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-[11px] text-gray-400">
        <div className="font-bold text-gray-300 mb-1">Setup — Required Env Variables</div>
        <ul className="mt-1.5 space-y-0.5 font-mono text-[10px]">
          <li>· <span className="text-purple-400">OPENAI_ADMIN_KEY</span> — <a href="https://platform.openai.com/settings/organization/admin-keys" target="_blank" rel="noopener noreferrer" className="text-[#D4873A] hover:underline">platform.openai.com</a></li>
          <li>· <span className="text-green-400">MONGODB_ATLAS_PUBLIC_KEY</span> + <span className="text-green-400">_PRIVATE_KEY</span> + <span className="text-green-400">_ORG_ID</span></li>
          <li>· <span className="text-blue-400">VERCEL_TOKEN</span> — <a href="https://vercel.com/account/tokens" target="_blank" rel="noopener noreferrer" className="text-[#D4873A] hover:underline">vercel.com/account/tokens</a></li>
          <li>· <span className="text-orange-400">RESEND_API_KEY</span> — <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#D4873A] hover:underline">resend.com/api-keys</a></li>
          <li>· <span className="text-indigo-400">STRIPE_SECRET_KEY</span> — already configured (used for payments)</li>
          <li>· <span className="text-pink-400">WINDSURF_MONTHLY_USD</span>=15 (and optional <span className="text-pink-400">WINDSURF_PLAN_NAME</span>=Pro)</li>
        </ul>
      </div>
    </div>
  );
}

function ProviderCard({
  icon,
  title,
  color,
  data,
  loading,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  color: 'purple' | 'green' | 'blue' | 'orange' | 'indigo' | 'pink';
  data: { success?: boolean; configured?: boolean; error?: string; helpUrl?: string } | null;
  loading: boolean;
  children?: React.ReactNode;
}) {
  const colorMap = {
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400' },
    indigo: { bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', text: 'text-indigo-400' },
    pink: { bg: 'bg-pink-500/10', border: 'border-pink-500/30', text: 'text-pink-400' },
  }[color];

  return (
    <div className={`bg-gray-800 rounded-xl p-4 border ${colorMap.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-7 h-7 rounded-lg ${colorMap.bg} ${colorMap.text} flex items-center justify-center`}>
          {icon}
        </div>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <GenXLoader />
        </div>
      )}

      {!loading && data && !data.success && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-200">
              {data.configured === false ? 'Not configured' : 'Error'}
            </p>
            <p className="text-[11px] text-amber-300/70 mt-0.5 break-words">{data.error}</p>
            {data.helpUrl && (
              <a
                href={data.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-amber-300 hover:underline"
              >
                Setup guide <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {!loading && data?.success && children}
    </div>
  );
}

function UsageStat({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  color: 'purple' | 'green' | 'blue' | 'orange' | 'indigo' | 'pink';
}) {
  const colorMap = {
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    green: 'text-green-400 bg-green-500/10 border-green-500/30',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    pink: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
  }[color];
  return (
    <div className={`p-2.5 rounded-lg border ${colorMap}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider font-bold">{label}</span>
      </div>
      <div className="text-lg font-bold text-white leading-none">{value.toLocaleString()}</div>
      {sub && <div className="text-[9px] text-gray-400 mt-1 leading-tight">{sub}</div>}
    </div>
  );
}

function CostRow({ label, value, highlight, icon }: { label: string; value: string; highlight?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-gray-400 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className={`text-sm font-bold ${highlight ? 'text-[#D4873A]' : 'text-white'}`}>{value}</span>
    </div>
  );
}
