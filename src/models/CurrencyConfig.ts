import mongoose from 'mongoose';

export interface ICurrencyConfig {
  loginDaily: number;      // Daily login reward
  readArticle: number;     // Read article reward (also goes to author)
  battleBet10: number;     // Battle bet 10 points → BOGX
  battleBet25: number;     // Battle bet 25 points → BOGX
  battleBet50: number;     // Battle bet 50 points → BOGX
  battleBet100: number;    // Battle bet 100 points → BOGX
  battleBet150: number;    // Battle bet 150 points → BOGX
  voteRanking: number;     // Vote on ranking
  shopRatio: number;       // 1 EUR = X BOGX coins
}

const CurrencyConfigSchema = new mongoose.Schema<ICurrencyConfig>({
  loginDaily: { type: Number, default: 0.01 },
  readArticle: { type: Number, default: 0.05 },
  battleBet10: { type: Number, default: 0.10 },
  battleBet25: { type: Number, default: 0.25 },
  battleBet50: { type: Number, default: 0.50 },
  battleBet100: { type: Number, default: 1.00 },
  battleBet150: { type: Number, default: 1.50 },
  voteRanking: { type: Number, default: 0.01 },
  shopRatio: { type: Number, default: 3 },
}, { timestamps: true });

export default mongoose.models.CurrencyConfig || mongoose.model<ICurrencyConfig>('CurrencyConfig', CurrencyConfigSchema);

// Membership tiers based on BOGX coins
export const MEMBERSHIP_TIERS = [
  { level: 5, name: 'Rookie', minCoins: 0, maxCoins: 19.99, color: '#9CA3AF' },
  { level: 4, name: 'Slacker', minCoins: 20, maxCoins: 39.99, color: '#A78BFA' },
  { level: 3, name: 'Radical', minCoins: 40, maxCoins: 79.99, color: '#60A5FA' },
  { level: 2, name: 'Legendary', minCoins: 80, maxCoins: 149.99, color: '#FBBF24' },
  { level: 1, name: 'Icon', minCoins: 150, maxCoins: Infinity, color: '#F472B6' },
];

// Helper to get membership tier from coins
export function getMembershipTier(coins: number) {
  return MEMBERSHIP_TIERS.find(t => coins >= t.minCoins && coins <= t.maxCoins) || MEMBERSHIP_TIERS[0];
}

// Helper to format BOGX coins (always 2 decimals)
export function formatBOGX(coins: number): string {
  return coins.toFixed(2);
}

// Default config values
export const DEFAULT_CURRENCY_CONFIG: ICurrencyConfig = {
  loginDaily: 0.01,
  readArticle: 0.05,
  battleBet10: 0.10,
  battleBet25: 0.25,
  battleBet50: 0.50,
  battleBet100: 1.00,
  battleBet150: 1.50,
  voteRanking: 0.01,
  shopRatio: 3,
};
