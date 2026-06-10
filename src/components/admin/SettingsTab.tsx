"use client";

import { useState, useEffect } from "react";
import { Loader2, Coins, Save, Trophy } from "lucide-react";

// BOGX Coin rewards configuration
interface CoinConfig {
  loginDaily: number;      // Daily login reward
  readArticle: number;     // Read article reward (also goes to author)
  battleBet10: number;     // Battle bet 10 points
  battleBet25: number;     // Battle bet 25 points
  battleBet50: number;     // Battle bet 50 points
  battleBet100: number;    // Battle bet 100 points
  battleBet150: number;    // Battle bet 150 points
  voteRanking: number;     // Vote on ranking
  shopRatio: number;       // 1 EUR = X BOGX coins
}

// Membership tiers
const MEMBERSHIP_TIERS = [
  { level: 5, name: 'Rookie', minCoins: 0, maxCoins: 19.99, color: '#9CA3AF' },
  { level: 4, name: 'Slacker', minCoins: 20, maxCoins: 39.99, color: '#A78BFA' },
  { level: 3, name: 'Radical', minCoins: 40, maxCoins: 79.99, color: '#60A5FA' },
  { level: 2, name: 'Legendary', minCoins: 80, maxCoins: 149.99, color: '#FBBF24' },
  { level: 1, name: 'Icon', minCoins: 150, maxCoins: Infinity, color: '#F472B6' },
];

const DEFAULT_CONFIG: CoinConfig = {
  loginDaily: 0.05,
  readArticle: 0.20,
  battleBet10: 0.10,
  battleBet25: 0.25,
  battleBet50: 0.50,
  battleBet100: 1.00,
  battleBet150: 1.50,
  voteRanking: 0.05,
  shopRatio: 3, // 1 EUR = 3 BOGX
};

export default function CurrencyTab() {
  const [config, setConfig] = useState<CoinConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load config from API
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/admin/currency-config');
        const data = await res.json();
        if (data.success && data.config) {
          setConfig(data.config);
        }
      } catch (e) {
        console.error('Failed to load currency config:', e);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/currency-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save currency config:', e);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof CoinConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <img src="/images/bogxcoin.png" alt="BOGX" className="w-10 h-10" />
            <div>
              <h2 className="text-base font-bold">BOGX Currency</h2>
              <p className="text-xs text-gray-400">Configure coin rewards for all actions</p>
            </div>
          </div>
          <button
            onClick={saveConfig}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${
              saved ? 'bg-green-600' : 'bg-[#D4873A] hover:bg-[#C4772A]'
            } disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Save className="w-4 h-4" /> : <Coins className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Config'}
          </button>
        </div>

        {/* Coin Rewards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Daily Login */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <label className="text-xs text-gray-400 block mb-1">Daily Login</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={config.loginDaily}
                onChange={(e) => updateConfig('loginDaily', parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-600 rounded px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">BOGX</span>
            </div>
          </div>

          {/* Read Article */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <label className="text-xs text-gray-400 block mb-1">Read Article (→ Author)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={config.readArticle}
                onChange={(e) => updateConfig('readArticle', parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-600 rounded px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">BOGX</span>
            </div>
          </div>

          {/* Vote Ranking */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <label className="text-xs text-gray-400 block mb-1">Vote on Ranking</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={config.voteRanking}
                onChange={(e) => updateConfig('voteRanking', parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-600 rounded px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">BOGX</span>
            </div>
          </div>

          {/* Shop Ratio */}
          <div className="bg-gray-700/50 rounded-lg p-3">
            <label className="text-xs text-gray-400 block mb-1">Shop: 1€ =</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={config.shopRatio}
                onChange={(e) => updateConfig('shopRatio', parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-600 rounded px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-400 whitespace-nowrap">BOGX</span>
            </div>
          </div>
        </div>

        {/* Battle Bets */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#D4873A]" />
            QuizzBattle Bets
          </h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { key: 'battleBet10', label: '10P' },
              { key: 'battleBet25', label: '25P' },
              { key: 'battleBet50', label: '50P' },
              { key: 'battleBet100', label: '100P' },
              { key: 'battleBet150', label: '150P' },
            ].map(({ key, label }) => (
              <div key={key} className="bg-gray-700/50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-gray-500 mb-1">{label} →</div>
                <input
                  type="number"
                  step="0.01"
                  value={config[key as keyof CoinConfig]}
                  onChange={(e) => updateConfig(key as keyof CoinConfig, parseFloat(e.target.value) || 0)}
                  className="w-full bg-gray-600 rounded px-1.5 py-1 text-xs text-center"
                />
                <div className="text-[10px] text-[#D4873A] mt-1">BOGX</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Membership Tiers */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-bold mb-3">Membership Tiers</h3>
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

      {/* Shop Preview */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <h3 className="text-sm font-bold mb-3">Shop Price Preview (1€ = {config.shopRatio} BOGX)</h3>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[5, 10, 15, 20, 25, 30, 50, 100].map((eur) => (
            <div key={eur} className="bg-gray-700/50 rounded-lg p-2">
              <div className="text-gray-400">{eur}€</div>
              <div className="text-[#D4873A] font-bold">{(eur * config.shopRatio).toFixed(2)} BOGX</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
