/**
 * Simple in-memory cache for API responses
 * Reduces database load for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 100; // Max entries to prevent memory leaks

  /**
   * Get cached data or fetch it
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    // Fetch fresh data
    const data = await fetcher();
    
    // Store in cache
    this.set(key, data, ttlSeconds);
    
    return data;
  }

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttlSeconds: number = 60): void {
    // Evict old entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Get cached data (returns undefined if not found or expired)
   */
  get<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    if (!cached) return undefined;
    
    if (cached.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    
    return cached.data;
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all entries matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cache keys
export const CACHE_KEYS = {
  POLLS_ACTIVE: 'polls:active',
  ARTICLES_FEED: 'articles:feed',
  RANKINGS: 'rankings',
  ONLINE_USERS: 'users:online',
} as const;

// Default TTLs (in seconds)
export const CACHE_TTL = {
  SHORT: 30,      // 30 seconds - for frequently changing data
  MEDIUM: 120,    // 2 minutes - for semi-static data
  LONG: 300,      // 5 minutes - for rarely changing data
  VERY_LONG: 600, // 10 minutes - for static data
} as const;
