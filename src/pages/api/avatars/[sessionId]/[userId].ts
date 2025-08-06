// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../lib/session-store.js';

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { sessionId, userId } = params;
    const size = url.searchParams.get('size') || 'medium'; // small, medium, large
    
    if (!sessionId || !userId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID and User ID are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // For mock sessions, return a placeholder avatar
    if (!sessionData.isAuthenticated) {
      const placeholderSvg = `
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="20" fill="#3B82F6"/>
          <text x="20" y="26" text-anchor="middle" fill="white" font-family="system-ui" font-size="16" font-weight="600">
            ${userId.toString().slice(-1)}
          </text>
        </svg>
      `;
      
      return new Response(placeholderSvg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Ensure client is connected
    const isConnected = await ensureClientConnected(sessionId);
    if (!isConnected) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to connect Telegram client'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { client } = sessionData;

    try {
      // Get entity (user, channel, or group)
      let entity;
      const numericId = parseInt(userId);

      // Try different ways to get the entity
      try {
        entity = await client.getEntity(numericId);
      } catch (error) {
        // If direct ID fails, try as negative ID for groups/channels
        try {
          entity = await client.getEntity(-Math.abs(numericId));
        } catch (error2) {
          // Try as channel ID (add -100 prefix for supergroups)
          try {
            entity = await client.getEntity(-1000000000000 - Math.abs(numericId));
          } catch (error3) {
            console.error('Failed to get entity with all methods:', {
              numericId,
              error: error3 instanceof Error ? error3.message : 'Unknown error'
            });
            throw error3;
          }
        }
      }

      if (!entity || !entity.photo) {
        // Return placeholder if no photo
        const placeholderSvg = `
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="#6B7280"/>
            <path d="M20 8C16.6863 8 14 10.6863 14 14C14 17.3137 16.6863 20 20 20C23.3137 20 26 17.3137 26 14C26 10.6863 23.3137 8 20 8Z" fill="white"/>
            <path d="M20 22C14.4772 22 10 26.4772 10 32V34C10 35.1046 10.8954 36 12 36H28C29.1046 36 30 35.1046 30 34V32C30 26.4772 25.5228 22 20 22Z" fill="white"/>
          </svg>
        `;
        
        return new Response(placeholderSvg, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }

      // Download profile photo (works for users, channels, and groups)
      const photoSize = size === 'large' ? 'x' : size === 'small' ? 's' : 'm';
      const buffer = await client.downloadProfilePhoto(entity, {
        file: photoSize,
      });

      if (!buffer) {
        throw new Error('Failed to download profile photo');
      }

      const mimeType = 'image/jpeg'; // Telegram usually returns JPEG

      return new Response(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        },
      });

    } catch (error) {
      console.error('Error downloading avatar:', error);
      
      // Return placeholder on error
      const placeholderSvg = `
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="20" cy="20" r="20" fill="#EF4444"/>
          <path d="M20 8C16.6863 8 14 10.6863 14 14C14 17.3137 16.6863 20 20 20C23.3137 20 26 17.3137 26 14C26 10.6863 23.3137 8 20 8Z" fill="white"/>
          <path d="M20 22C14.4772 22 10 26.4772 10 32V34C10 35.1046 10.8954 36 12 36H28C29.1046 36 30 35.1046 30 34V32C30 26.4772 25.5228 22 20 22Z" fill="white"/>
        </svg>
      `;
      
      return new Response(placeholderSvg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=300', // Short cache for errors
        },
      });
    }

  } catch (error) {
    console.error('Avatar API error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
