// @ts-nocheck
interface CachedAvatar {
  url: string;
  blob: Blob;
  timestamp: number;
  etag?: string;
  lastModified?: string;
}

interface AvatarCacheEntry {
  data: CachedAvatar;
  objectUrl: string;
}

class AvatarCacheService {
  private cache = new Map<string, AvatarCacheEntry>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CACHE_SIZE = 100; // Maximum number of cached avatars
  private readonly STORAGE_KEY = 'telegram-avatar-cache';

  constructor() {
    this.loadFromStorage();
    this.cleanupExpiredEntries();
  }

  private getCacheKey(sessionId: string, userId: string, size: string): string {
    return `${sessionId}:${userId}:${size}`;
  }

  private async loadFromStorage(): Promise<void> {
    try {
      if (typeof window === 'undefined') return;

      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      console.log(`🗄️ Loading ${Object.keys(data).length} avatar metadata from storage`);

      // Only restore metadata, not the actual cache entries
      // This helps with ETag/Last-Modified headers for efficient re-fetching
      for (const [key, entry] of Object.entries(data)) {
        const cachedEntry = entry as any;
        if (this.isValidCacheEntry(cachedEntry)) {
          // Store metadata only for efficient HTTP conditional requests
          this.cache.set(key, {
            data: {
              url: cachedEntry.url,
              blob: null as any, // Will be re-fetched
              timestamp: cachedEntry.timestamp,
              etag: cachedEntry.etag,
              lastModified: cachedEntry.lastModified
            },
            objectUrl: ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading avatar cache from storage:', error);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof window === 'undefined') return;

      const dataToStore: Record<string, any> = {};
      
      for (const [key, entry] of this.cache.entries()) {
        // Store metadata only (not the blob)
        dataToStore[key] = {
          url: entry.data.url,
          timestamp: entry.data.timestamp,
          etag: entry.data.etag,
          lastModified: entry.data.lastModified
        };
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (error) {
      console.error('Error saving avatar cache to storage:', error);
    }
  }

  private isValidCacheEntry(entry: any): boolean {
    return entry && 
           entry.url && 
           entry.timestamp && 
           (Date.now() - entry.timestamp) < this.CACHE_DURATION;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.data.timestamp > this.CACHE_DURATION) {
        // Revoke object URL to free memory
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl);
        }
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired avatar cache entries`);
      this.saveToStorage();
    }

    // Limit cache size
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].data.timestamp - b[1].data.timestamp);
      
      const toRemove = entries.slice(0, this.cache.size - this.MAX_CACHE_SIZE);
      for (const [key, entry] of toRemove) {
        if (entry.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl);
        }
        this.cache.delete(key);
      }
      
      console.log(`🗑️ Removed ${toRemove.length} old avatar cache entries to maintain size limit`);
      this.saveToStorage();
    }
  }

  async getAvatar(sessionId: string, userId: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<string | null> {
    const cacheKey = this.getCacheKey(sessionId, userId, size);
    const cached = this.cache.get(cacheKey);

    // Check if we have a valid cached entry with blob
    if (cached && cached.data.blob && cached.objectUrl) {
      const age = Date.now() - cached.data.timestamp;
      if (age < this.CACHE_DURATION) {
        return cached.objectUrl;
      } else {
        console.log(`⏰ Cache expired for user ${userId} (age: ${Math.round(age / 1000 / 60)}min), refetching`);
      }
    }

    // Need to fetch avatar
    try {
      const avatarUrl = `/api/avatars/${sessionId}/${userId}?size=${size}`;

      // Add cache headers if we have etag/lastModified
      const headers: HeadersInit = {};
      const hasConditionalHeaders = cached?.data.etag || cached?.data.lastModified;

      if (cached?.data.etag) {
        headers['If-None-Match'] = cached.data.etag;
      }
      if (cached?.data.lastModified) {
        headers['If-Modified-Since'] = cached.data.lastModified;
      }

      if (hasConditionalHeaders) {
        console.log(`🔍 Checking for avatar updates for user ${userId} (conditional request)`);
      }

      const response = await fetch(avatarUrl, { headers });

      if (response.status === 304) {
        // Not modified, update timestamp and return existing
        if (cached && cached.objectUrl) {
          cached.data.timestamp = Date.now();
          this.saveToStorage();
          console.log(`✅ Avatar unchanged for user ${userId} (HTTP 304), refreshed cache timestamp`);
          return cached.objectUrl;
        }
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      // Check if this is a new avatar or an update
      const isNewAvatar = !cached;
      const isUpdatedAvatar = cached && cached.data.blob;

      // Clean up old object URL if it exists
      if (cached?.objectUrl) {
        URL.revokeObjectURL(cached.objectUrl);
      }

      // Store in cache
      const cacheEntry: AvatarCacheEntry = {
        data: {
          url: avatarUrl,
          blob,
          timestamp: Date.now(),
          etag: response.headers.get('etag') || undefined,
          lastModified: response.headers.get('last-modified') || undefined
        },
        objectUrl
      };

      this.cache.set(cacheKey, cacheEntry);
      this.saveToStorage();

      // More accurate logging
      if (isNewAvatar) {
        console.log(`✅ Cached new avatar for user ${userId}`);
      } else if (isUpdatedAvatar) {
        console.log(`🔄 Updated cached avatar for user ${userId}`);
      }
      return objectUrl;

    } catch (error) {
      console.error(`❌ Failed to fetch avatar for user ${userId}:`, error);
      
      // Return cached version if available, even if expired
      if (cached?.objectUrl) {
        console.log(`🔄 Using expired cached avatar for user ${userId} as fallback`);
        return cached.objectUrl;
      }
      
      return null;
    }
  }

  clearCache(): void {
    console.log(`🗑️ Clearing avatar cache (${this.cache.size} entries)`);
    
    // Revoke all object URLs
    for (const entry of this.cache.values()) {
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
    }
    
    this.cache.clear();
    localStorage.removeItem(this.STORAGE_KEY);
  }

  getCacheStats(): { size: number; totalSize: number; oldestEntry: number | null } {
    let totalSize = 0;
    let oldestTimestamp = Date.now();

    for (const entry of this.cache.values()) {
      if (entry.data.blob) {
        totalSize += entry.data.blob.size;
      }
      if (entry.data.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.data.timestamp;
      }
    }

    return {
      size: this.cache.size,
      totalSize,
      oldestEntry: this.cache.size > 0 ? oldestTimestamp : null
    };
  }

  // Preload avatar for better UX
  async preloadAvatar(sessionId: string, userId: string, size: 'small' | 'medium' | 'large' = 'medium'): Promise<void> {
    const cacheKey = this.getCacheKey(sessionId, userId, size);
    const cached = this.cache.get(cacheKey);

    // Skip preload if we already have a valid cached entry
    if (cached && cached.data.blob && cached.objectUrl) {
      const age = Date.now() - cached.data.timestamp;
      if (age < this.CACHE_DURATION) {
        return;
      }
    }

    try {
      await this.getAvatar(sessionId, userId, size);
    } catch (error) {
      // Ignore preload errors
      console.warn(`⚠️ Failed to preload avatar for user ${userId}:`, error);
    }
  }
}

// Export singleton instance
export const avatarCache = new AvatarCacheService();
