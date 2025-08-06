// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Users, Hash } from 'lucide-react';
import { avatarCache } from '../lib/avatar-cache';

interface AvatarProps {
  sessionId?: string;
  userId: string;
  userName?: string;
  size?: 'small' | 'medium' | 'large' | number;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ sessionId, userId, userName, size = 'medium', className }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const isMountedRef = useRef(true);

  // Load avatar image when component mounts or sessionId/userId changes
  useEffect(() => {
    isMountedRef.current = true;

    const loadAvatar = async () => {
      if (!sessionId || !userId) {
        console.log(`⚠️ No sessionId or userId provided for avatar: sessionId=${sessionId}, userId=${userId}`);
        if (isMountedRef.current) {
          setImageLoading(false);
          setImageError(true);
        }
        return;
      }

      try {
        if (isMountedRef.current) {
          setImageLoading(true);
          setImageError(false);
        }

        const cacheSize = typeof size === 'number' ? 'medium' : size;
        const cachedUrl = await avatarCache.getAvatar(sessionId, userId, cacheSize);

        if (isMountedRef.current) {
          if (cachedUrl) {
            setImageUrl(cachedUrl);
            setImageLoading(false);
            setImageError(false);
          } else {
            setImageUrl(null);
            setImageLoading(false);
            setImageError(true);
            console.log(`❌ Avatar failed to load for user ${userId}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error loading avatar for user ${userId}:`, error);
        if (isMountedRef.current) {
          setImageUrl(null);
          setImageLoading(false);
          setImageError(true);
        }
      }
    };

    loadAvatar();

    // Cleanup function
    return () => {
      isMountedRef.current = false;
    };
  }, [sessionId, userId, size]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // These handlers are no longer needed since we handle loading in the cache service
  // but keeping them for potential future use or fallback scenarios

  const getInitials = (): string => {
    if (userName) {
      const words = userName.trim().split(' ');
      if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
      }
      return userName[0]?.toUpperCase() || '?';
    }
    return userId.slice(-1);
  };

  const getSizeClasses = (): string => {
    if (typeof size === 'number') {
      return `text-sm`;
    }

    switch (size) {
      case 'small':
        return 'w-8 h-8 text-xs';
      case 'large':
        return 'w-12 h-12 text-base';
      case 'medium':
      default:
        return 'w-10 h-10 text-sm';
    }
  };

  const getSizeStyle = (): React.CSSProperties => {
    if (typeof size === 'number') {
      return {
        width: `${size}px`,
        height: `${size}px`,
      };
    }
    return {};
  };

  const getColorFromUserId = (): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-yellow-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500'
    ];

    const hash = userId.split('').reduce((acc, char) => {
      return acc + char.charCodeAt(0);
    }, 0);

    return colors[hash % colors.length];
  };

  const getChatTypeIcon = (): React.ReactElement | null => {
    const numericId = parseInt(userId);

    // Detect chat type based on ID patterns
    if (numericId < 0) {
      // Negative IDs are typically groups/channels
      if (numericId < -1000000000000) {
        // Supergroup/channel
        return <Hash className="w-3 h-3" />;
      } else {
        // Regular group
        return <Users className="w-3 h-3" />;
      }
    }
    return null;
  };

  const sizeClasses = getSizeClasses();
  const baseClasses = `${sizeClasses} rounded-full flex items-center justify-center font-medium text-white flex-shrink-0`;
  const colorClass = getColorFromUserId();
  const chatTypeIcon = getChatTypeIcon();

  // Show real avatar if available and loaded, otherwise show fallback
  const showRealAvatar = imageUrl && !imageError && !imageLoading;

  return (
    <div
      className={`${baseClasses} ${showRealAvatar ? 'bg-gray-200 dark:bg-gray-700' : colorClass} ${className || ''} relative overflow-hidden`}
      style={getSizeStyle()}
    >
      {showRealAvatar ? (
        <img
          src={imageUrl}
          alt={userName || `User ${userId}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <>
          {imageLoading && sessionId ? (
            <div className="animate-pulse">
              <div className="w-full h-full bg-gray-300 dark:bg-gray-600 rounded-full"></div>
            </div>
          ) : (
            getInitials()
          )}
        </>
      )}
      {chatTypeIcon && (
        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-1 text-gray-600 dark:text-gray-300">
          {chatTypeIcon}
        </div>
      )}
    </div>
  );
};

export default Avatar;
