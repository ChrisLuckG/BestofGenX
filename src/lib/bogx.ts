// BOGX Currency Helper Functions

// Format BOGX coins for display (always 2 decimals)
export function formatBOGX(coins: number): string {
  return coins.toFixed(2);
}

// Format BOGX with symbol
export function formatBOGXWithSymbol(coins: number): string {
  return `${coins.toFixed(2)} BOGX`;
}

// Convert old points to BOGX (100 points = 1.00 BOGX)
export function pointsToBOGX(points: number): number {
  return points / 100;
}

// Convert BOGX to old points (1.00 BOGX = 100 points)
export function bogxToPoints(bogx: number): number {
  return Math.round(bogx * 100);
}

// Membership tiers based on BOGX coins
export const MEMBERSHIP_TIERS = [
  { level: 5, name: 'Rookie', minCoins: 0, maxCoins: 19.99, color: '#9CA3AF', icon: '🌱' },
  { level: 4, name: 'Slacker', minCoins: 20, maxCoins: 39.99, color: '#A78BFA', icon: '😎' },
  { level: 3, name: 'Radical', minCoins: 40, maxCoins: 79.99, color: '#60A5FA', icon: '🔥' },
  { level: 2, name: 'Legendary', minCoins: 80, maxCoins: 149.99, color: '#FBBF24', icon: '⭐' },
  { level: 1, name: 'Icon', minCoins: 150, maxCoins: Infinity, color: '#F472B6', icon: '👑' },
];

// Get membership tier from coins
export function getMembershipTier(coins: number) {
  return MEMBERSHIP_TIERS.find(t => coins >= t.minCoins && coins <= t.maxCoins) || MEMBERSHIP_TIERS[0];
}

// Battle bet mapping (old points → BOGX)
export const BATTLE_BET_MAPPING: Record<number, number> = {
  10: 0.10,
  25: 0.25,
  50: 0.50,
  100: 1.00,
  150: 1.50,
};

// Convert battle bet points to BOGX
export function battleBetToBOGX(points: number): number {
  return BATTLE_BET_MAPPING[points] || pointsToBOGX(points);
}

// Default reward values in BOGX
export const BOGX_REWARDS = {
  dailyLogin: 0.01,
  readArticle: 0.05,
  voteRanking: 0.01,
  welcomeBonus: 5.00, // 500 points = 5.00 BOGX
  referralBonus: 5.00, // 500 points = 5.00 BOGX
};

// Shop ratio: 1 EUR = X BOGX
export const SHOP_RATIO = 3; // 1€ = 3 BOGX

// Convert EUR price to BOGX
export function eurToBOGX(eur: number, ratio: number = SHOP_RATIO): number {
  return eur * ratio;
}
