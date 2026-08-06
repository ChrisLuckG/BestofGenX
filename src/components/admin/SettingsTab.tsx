"use client";

import { useState, useEffect } from "react";
import { Loader2, Coins, Trophy, Bell, CheckCircle, XCircle, RefreshCw, Filter, Info } from "lucide-react";

// All Push Notifications that exist in the codebase
const PUSH_NOTIFICATIONS = [
  // Battles
  { source: 'battle-challenge', title: '⚔️ Battle Challenge!', trigger: 'Wenn jemand dich zu einem Battle herausfordert', file: 'battles/[id]/submit' },
  { source: 'battle-accepted', title: '⚔️ Battle Accepted!', trigger: 'Wenn dein Gegner das Battle annimmt', file: 'battles/[id]/accept' },
  { source: 'battle-declined', title: '😔 Challenge Declined', trigger: 'Wenn dein Gegner ablehnt', file: 'battles/[id]/decline' },
  { source: 'battle-result-win', title: '🏆 You Won the Battle!', trigger: 'Wenn du ein Battle gewinnst', file: 'battles/[id]/complete' },
  { source: 'battle-result-lose', title: '😔 Battle Lost', trigger: 'Wenn du ein Battle verlierst', file: 'battles/[id]/complete' },
  { source: 'battle-result-tie', title: '🤝 Battle Tie!', trigger: 'Wenn das Battle unentschieden endet', file: 'battles/[id]/complete' },
  { source: 'battle-forfeit', title: '🏆 Battle Won!', trigger: 'Wenn Gegner aufgibt', file: 'battles/[id]/forfeit' },
  { source: 'battle-cancelled', title: '⚠️ Battle Cancelled', trigger: 'Wenn Battle abgebrochen wird', file: 'battles/[id]/cancel-waiting' },
  { source: 'battle-expired', title: '⏰ Battle Expired', trigger: 'Cron: Battle nach 48h abgelaufen', file: 'cron/cleanup-battles' },
  // Bot Battles
  { source: 'bot-challenge', title: '⚔️ Battle Challenge!', trigger: 'Cron: Bot fordert dich heraus', file: 'cron/bot-challenge-users' },
  // Games
  { source: 'game-start', title: '🎮 Neues Spiel gestartet!', trigger: 'Cron: Neues Trivia-Spiel beginnt', file: 'cron/game-start' },
  { source: 'game-reminder', title: '⏰ Spiel endet bald!', trigger: 'Cron: Erinnerung vor Spielende', file: 'cron/game-reminder' },
  { source: 'game-ending', title: '🏁 Spiel beendet!', trigger: 'Cron: Spiel ist zu Ende', file: 'cron/game-ending' },
  // Predictions
  { source: 'prediction-new', title: 'New Predictions Available!', trigger: 'Cron: Neue Predictions generiert', file: 'cron/generate-predictions' },
  { source: 'prediction-result', title: 'Prediction Won/Lost', trigger: 'Cron: Prediction aufgelöst', file: 'cron/resolve-predictions' },
  // Song Requests
  { source: 'song-request-new', title: '🎵 New Song Request', trigger: 'User schlägt Song vor (an Admins)', file: 'song-request' },
  { source: 'song-request-status', title: '🎵 Song Request Update', trigger: 'Admin ändert Status deines Requests', file: 'song-request' },
  // Test
  { source: 'test', title: '🎉 Test Notification', trigger: 'Manueller Test aus Admin', file: 'test-push' },
];

// BOGX Coin rewards - FIXED VALUES (not configurable, just for display)
const BOGX_REWARDS = [
  { action: 'Daily Login', amount: 0.01, description: 'Einmal pro Tag beim ersten Login' },
  { action: 'Artikel lesen', amount: 0.05, description: 'Geht auch an den Autor' },
  { action: 'Rankroll Vote', amount: 0.01, description: 'Pro Abstimmung' },
  { action: 'Battle gewinnen (10P)', amount: 0.10, description: 'Einsatz 10 Punkte' },
  { action: 'Battle gewinnen (25P)', amount: 0.25, description: 'Einsatz 25 Punkte' },
  { action: 'Battle gewinnen (50P)', amount: 0.50, description: 'Einsatz 50 Punkte' },
  { action: 'Battle gewinnen (100P)', amount: 1.00, description: 'Einsatz 100 Punkte' },
  { action: 'Battle gewinnen (150P)', amount: 1.50, description: 'Einsatz 150 Punkte' },
  { action: 'Trivia richtig', amount: 0.01, description: 'Pro richtige Antwort' },
  { action: 'Prediction richtig', amount: 0.50, description: 'Vorhersage eingetroffen' },
];

// Membership tiers
const MEMBERSHIP_TIERS = [
  { level: 5, name: 'Rookie', minCoins: 0, maxCoins: 19.99, color: '#9CA3AF' },
  { level: 4, name: 'Slacker', minCoins: 20, maxCoins: 39.99, color: '#A78BFA' },
  { level: 3, name: 'Radical', minCoins: 40, maxCoins: 79.99, color: '#60A5FA' },
  { level: 2, name: 'Legendary', minCoins: 80, maxCoins: 149.99, color: '#FBBF24' },
  { level: 1, name: 'Icon', minCoins: 150, maxCoins: Infinity, color: '#F472B6' },
];

interface NotificationLog {
  _id: string;
  userId: string;
  username?: string;
  title: string;
  body: string;
  type: string;
  source: string;
  success: boolean;
  error?: string;
  createdAt: string;
}

interface NotificationStats {
  _id: string;
  total: number;
  successful: number;
  failed: number;
}

export default function CurrencyTab() {
  const [activeTab, setActiveTab] = useState<'rewards' | 'notifications'>('rewards');
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [stats, setStats] = useState<NotificationStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string>('');

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const url = selectedSource 
        ? `/api/admin/notification-logs?limit=100&source=${encodeURIComponent(selectedSource)}`
        : '/api/admin/notification-logs?limit=100';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setSources(data.sources || []);
        setStats(data.stats || []);
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'notifications') {
      loadNotifications();
    }
  }, [activeTab, selectedSource]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('de-DE', { 
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const getSourceColor = (source: string) => {
    if (source.includes('battle')) return 'text-purple-400 bg-purple-400/10';
    if (source.includes('cron')) return 'text-blue-400 bg-blue-400/10';
    if (source.includes('game')) return 'text-green-400 bg-green-400/10';
    if (source.includes('prediction')) return 'text-yellow-400 bg-yellow-400/10';
    return 'text-gray-400 bg-gray-400/10';
  };

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('rewards')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'rewards' 
              ? 'bg-[#E36B11] text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Coins className="w-4 h-4" />
          BOGX Rewards
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
            activeTab === 'notifications' 
              ? 'bg-[#E36B11] text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <Bell className="w-4 h-4" />
          Push Notifications
        </button>
      </div>

      {activeTab === 'rewards' && (
        <>
          {/* BOGX Rewards Overview */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <img src="/images/bogxcoin.png" alt="BOGX" className="w-10 h-10" />
              <div>
                <h2 className="text-base font-bold">BOGX Coin Rewards</h2>
                <p className="text-xs text-gray-400">Übersicht aller Aktionen die BOGX Coins vergeben</p>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-300">
                Diese Werte sind im Code festgelegt und nicht über das Admin-Panel änderbar. 
                Änderungen müssen im Code gemacht werden (awardBogx.ts, battle routes, etc.)
              </p>
            </div>

            <div className="space-y-2">
              {BOGX_REWARDS.map((reward, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between bg-gray-700/50 rounded-lg px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-sm">{reward.action}</div>
                    <div className="text-xs text-gray-400">{reward.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[#E36B11] font-bold text-lg">+{reward.amount.toFixed(2)}</span>
                    <span className="text-xs text-gray-400">BOGX</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Membership Tiers */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-[#E36B11]" />
              <h3 className="text-sm font-bold">Membership Tiers</h3>
            </div>
            <div className="space-y-2">
              {MEMBERSHIP_TIERS.map((tier) => (
                <div 
                  key={tier.level} 
                  className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{ backgroundColor: tier.color + '30', color: tier.color }}
                    >
                      {tier.level}
                    </div>
                    <span className="font-semibold" style={{ color: tier.color }}>{tier.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {tier.minCoins.toFixed(2)} - {tier.maxCoins === Infinity ? '∞' : tier.maxCoins.toFixed(2)} BOGX
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === 'notifications' && (
        <>
          {/* All Notifications Overview */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-5 h-5 text-[#E36B11]" />
              <h3 className="text-sm font-bold">Alle Push Notifications im Code</h3>
              <span className="text-xs text-gray-500">({PUSH_NOTIFICATIONS.length} Typen)</span>
            </div>
            
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {PUSH_NOTIFICATIONS.map((notif, i) => (
                <div 
                  key={i}
                  className="flex items-center justify-between bg-gray-700/30 rounded px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="font-medium text-white whitespace-nowrap">{notif.title}</span>
                    <span className="text-gray-400 truncate">{notif.trigger}</span>
                  </div>
                  <span className="text-gray-500 text-[10px] ml-2 whitespace-nowrap">{notif.file}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#E36B11]" />
                Notification Stats by Source
              </h3>
              <button
                onClick={loadNotifications}
                disabled={loading}
                className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {stats.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">Noch keine Notifications geloggt</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {stats.map((stat) => (
                  <div 
                    key={stat._id}
                    className={`rounded-lg p-3 cursor-pointer transition-all ${
                      selectedSource === stat._id 
                        ? 'bg-[#E36B11]/20 border border-[#E36B11]/50' 
                        : 'bg-gray-700/50 hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedSource(selectedSource === stat._id ? '' : stat._id)}
                  >
                    <div className="text-xs text-gray-400 truncate mb-1">{stat._id}</div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold">{stat.total}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-400">{stat.successful} ✓</span>
                        {stat.failed > 0 && <span className="text-red-400">{stat.failed} ✗</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="bg-gray-700 rounded px-3 py-1.5 text-sm border border-gray-600"
            >
              <option value="">Alle Sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {selectedSource && (
              <button
                onClick={() => setSelectedSource('')}
                className="text-xs text-gray-400 hover:text-white"
              >
                Filter zurücksetzen
              </button>
            )}
          </div>

          {/* Notification Log Table */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">Zeit</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">User</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">Source</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">Title</th>
                    <th className="text-left px-3 py-2 text-xs text-gray-400 font-medium">Body</th>
                    <th className="text-center px-3 py-2 text-xs text-gray-400 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-gray-500">
                        Keine Notifications gefunden
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-700/30">
                        <td className="px-3 py-2 text-xs text-gray-400 whitespace-nowrap">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {log.username || log.userId.slice(-6)}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${getSourceColor(log.source)}`}>
                            {log.source}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={log.title}>
                          {log.title}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-400 max-w-[250px] truncate" title={log.body}>
                          {log.body}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {log.success ? (
                            <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                          ) : (
                            <div className="flex items-center justify-center gap-1" title={log.error}>
                              <XCircle className="w-4 h-4 text-red-400" />
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

