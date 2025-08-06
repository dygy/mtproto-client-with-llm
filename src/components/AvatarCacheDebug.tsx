// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { avatarCache } from '../lib/avatar-cache';

interface AvatarCacheDebugProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const AvatarCacheDebug: React.FC<AvatarCacheDebugProps> = ({ isOpen = true, onClose }) => {
  const [stats, setStats] = useState<{
    size: number;
    totalSize: number;
    oldestEntry: number | null;
  }>({ size: 0, totalSize: 0, oldestEntry: null });

  const refreshStats = () => {
    setStats(avatarCache.getCacheStats());
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
      const interval = setInterval(refreshStats, 1000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleClearCache = () => {
    avatarCache.clearCache();
    refreshStats();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatAge = (timestamp: number): string => {
    const age = Date.now() - timestamp;
    const minutes = Math.floor(age / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Avatar Cache Debug
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <div className="text-sm text-gray-600 dark:text-gray-400">Cached Avatars</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats.size}
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Size</div>
              <div className="text-xl font-semibold text-gray-900 dark:text-white">
                {formatBytes(stats.totalSize)}
              </div>
            </div>
          </div>

          {stats.oldestEntry && (
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
              <div className="text-sm text-gray-600 dark:text-gray-400">Oldest Entry</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {formatAge(stats.oldestEntry)} ago
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            <button
              onClick={refreshStats}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
            
            <button
              onClick={handleClearCache}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Clear Cache
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Avatars are cached for 24 hours</p>
            <p>• Maximum 100 avatars in cache</p>
            <p>• Uses browser storage + memory cache</p>
            <p>• Supports ETags for efficient updates</p>
            <p>• Check console for detailed cache operations</p>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs">
            <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">Console Log Legend:</div>
            <div className="space-y-1 text-blue-800 dark:text-blue-200">
              <p>💾 Cache hit - Using existing cached avatar</p>
              <p>🌐 Network fetch - Downloading new avatar</p>
              <p>🔍 Conditional request - Checking for updates</p>
              <p>✅ HTTP 304 - Avatar unchanged, cache refreshed</p>
              <p>🔄 Updated - Avatar changed, cache updated</p>
              <p>⚡ Preload - Background avatar loading</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvatarCacheDebug;
