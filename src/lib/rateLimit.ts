// Simple in-memory rate limiter
const rateLimit = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  limit: number = 100, 
  windowMs: number = 60000 // 1 minute
): { success: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimit.get(identifier);
  
  // Clean up old entries periodically
  if (Math.random() < 0.01) {
    rateLimit.forEach((value, key) => {
      if (value.resetTime < now) rateLimit.delete(key);
    });
  }
  
  if (!record || record.resetTime < now) {
    rateLimit.set(identifier, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  
  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }
  
  record.count++;
  return { success: true, remaining: limit - record.count };
}

// Stricter limits for sensitive endpoints
export const RATE_LIMITS = {
  login: { limit: 5, window: 300000 },      // 5 per 5 min
  register: { limit: 3, window: 600000 },   // 3 per 10 min
  api: { limit: 100, window: 60000 },       // 100 per min
  upload: { limit: 10, window: 60000 },     // 10 per min
  aiGenerate: { limit: 20, window: 60000 }, // 20 per min
};
