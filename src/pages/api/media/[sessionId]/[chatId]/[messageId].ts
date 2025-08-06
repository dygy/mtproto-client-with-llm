// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '@/lib/session-store.ts';
import fs from 'fs';
import path from 'path';

// Create cache directory if it doesn't exist
const cacheDir = path.join(process.cwd(), 'data', 'media-cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const { sessionId, chatId, messageId } = params;
    const thumbnail = url.searchParams.get('thumbnail') === 'true';

    if (!sessionId || !chatId || !messageId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID, Chat ID, and Message ID are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Check cache first
    const cacheKey = `${sessionId}_${chatId}_${messageId}${thumbnail ? '_thumb' : ''}`;
    const cacheFile = path.join(cacheDir, cacheKey);

    if (fs.existsSync(cacheFile)) {
      const cachedData = fs.readFileSync(cacheFile);
      const stats = fs.statSync(cacheFile);

      // Cache for 24 hours
      const cacheAge = Date.now() - stats.mtime.getTime();
      if (cacheAge < 24 * 60 * 60 * 1000) {
        return new Response(cachedData, {
          status: 200,
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
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

    if (!sessionData.isAuthenticated) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not authenticated'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const isConnected = await ensureClientConnected(sessionId);
    if (!isConnected) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to connect to Telegram'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { client } = sessionData;

    // Get the message first
    let chatEntity;
    try {
      chatEntity = await client.getEntity(parseInt(chatId));
    } catch (error) {
      // Try alternative entity resolution methods
      try {
        chatEntity = await client.getEntity(-Math.abs(parseInt(chatId)));
      } catch (error2) {
        try {
          chatEntity = await client.getEntity(-1000000000000 - Math.abs(parseInt(chatId)));
        } catch (error3) {
          // Return a placeholder image instead of 404 to prevent flood waits
          const placeholderSvg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="#f0f0f0"/>
            <text x="50" y="50" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="#666">No Image</text>
          </svg>`;

          return new Response(placeholderSvg, {
            status: 200,
            headers: {
              'Content-Type': 'image/svg+xml',
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      }
    }

    // Get messages to find the specific message
    const { Api } = await import('telegram');

    const result = await client.invoke(
      new Api.messages.GetHistory({
        peer: chatEntity,
        offsetId: parseInt(messageId) + 1,
        limit: 10, // Get more messages to increase chance of finding it
        addOffset: 0,
        maxId: 0,
        minId: 0,
        hash: 0 as any,
      })
    );

    let message = result.messages.find((msg: any) => msg.id === parseInt(messageId));
    if (!message) {

      // Try getting messages around the target message ID
      const result2 = await client.invoke(
        new Api.messages.GetHistory({
          peer: chatEntity,
          offsetId: parseInt(messageId),
          limit: 20,
          addOffset: -10, // Get messages before and after
          maxId: 0,
          minId: 0,
          hash: 0 as any,
        })
      );

      const message2 = result2.messages.find((msg: any) => msg.id === parseInt(messageId));

      if (!message2) {
        // Return placeholder instead of 404
        const placeholderSvg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="#f0f0f0"/>
          <text x="50" y="50" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="#666">Message Not Found</text>
        </svg>`;

        return new Response(placeholderSvg, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }

      // Use the found message
      message = message2;
    }

    if (!message.media) {
      // Return placeholder for messages without media
      const placeholderSvg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="#f0f0f0"/>
        <text x="50" y="50" text-anchor="middle" dy=".3em" font-family="Arial" font-size="12" fill="#666">No Media</text>
      </svg>`;

      return new Response(placeholderSvg, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    let buffer: Buffer;
    let mimeType = 'application/octet-stream';
    let fileName = 'media';

    if (message.media.className === 'MessageMediaPhoto') {
      try {

        const photoBuffer = await client.downloadMedia(message.media, {
          thumb: thumbnail ? 's' : undefined,
        });

        if (!photoBuffer || photoBuffer.length === 0) {

          // Try downloading without thumb parameter
          const altPhotoBuffer = await client.downloadMedia(message.media);

          if (!altPhotoBuffer || altPhotoBuffer.length === 0) {
            throw new Error('Photo download returned empty buffer');
          }

          buffer = Buffer.from(altPhotoBuffer);
        } else {
          buffer = Buffer.from(photoBuffer);
        }

        mimeType = 'image/jpeg';
        fileName = `photo_${messageId}.jpg`;

      } catch (photoError) {
        console.error(`❌ Photo download failed:`, photoError);
        throw new Error(`Failed to download photo: ${photoError instanceof Error ? photoError.message : String(photoError)}`);
      }
      
    } else if (message.media.className === 'MessageMediaDocument') {
      console.log(`📄 Downloading document from message ${messageId}`);
      
      const document = message.media.document;
      if (!document) {
        throw new Error('Document not found in media');
      }

      // Get document attributes
      let isVideo = false;
      let isAudio = false;
      let isSticker = false;
      let isGif = false;
      
      for (const attr of document.attributes || []) {
        if (attr.className === 'DocumentAttributeVideo') {
          isVideo = true;
          if (attr.roundMessage) {
            fileName = `video_note_${messageId}`;
          } else {
            fileName = `video_${messageId}`;
          }
        } else if (attr.className === 'DocumentAttributeAudio') {
          isAudio = true;
          fileName = `audio_${messageId}`;
        } else if (attr.className === 'DocumentAttributeSticker') {
          isSticker = true;
          fileName = `sticker_${messageId}`;
        } else if (attr.className === 'DocumentAttributeAnimated') {
          isGif = true;
          fileName = `animation_${messageId}`;
        } else if (attr.className === 'DocumentAttributeFilename') {
          fileName = attr.fileName || fileName;
        }
      }

      // Check for Lottie stickers (TGS format)
      const isLottieSticker = document.mimeType === 'application/x-tgsticker' ||
                             fileName.endsWith('.tgs') ||
                             (isSticker && document.mimeType === 'application/gzip');

      // Set appropriate MIME type
      if (isLottieSticker) {
        mimeType = 'application/json'; // Serve Lottie as JSON for frontend parsing
      } else if (document.mimeType) {
        mimeType = document.mimeType;
      } else if (isVideo) {
        mimeType = 'video/mp4';
      } else if (isAudio) {
        mimeType = 'audio/mpeg';
      } else if (isSticker) {
        mimeType = 'image/webp';
      } else if (isGif) {
        mimeType = 'image/gif';
      }

      // For thumbnails of videos/documents, try to get thumbnail
      if (thumbnail && (isVideo || (!isAudio && !isSticker))) {
        try {
          const thumbBuffer = await client.downloadMedia(message.media, {
            thumb: 's',
          });
          if (thumbBuffer) {
            buffer = Buffer.from(thumbBuffer);
            mimeType = 'image/jpeg';
            fileName = `thumb_${fileName}.jpg`;
          } else {
            throw new Error('No thumbnail available');
          }
        } catch (thumbError) {
          console.warn(`⚠️ Failed to get thumbnail for ${messageId}, downloading full media:`, thumbError);
          // Fall back to full media
          const mediaBuffer = await client.downloadMedia(message.media);
          if (!mediaBuffer) {
            throw new Error('Failed to download media');
          }
          buffer = Buffer.from(mediaBuffer);
        }
      } else {
        // Download full media
        const mediaBuffer = await client.downloadMedia(message.media);
        if (!mediaBuffer) {
          throw new Error('Failed to download media');
        }

        let finalBuffer = Buffer.from(mediaBuffer);

        // Special handling for Lottie stickers (TGS format)
        if (isLottieSticker) {
          try {
            // TGS files are gzipped JSON, decompress them
            const zlib = await import('zlib');
            const decompressed = zlib.gunzipSync(finalBuffer);
            finalBuffer = decompressed;
          } catch (decompressError) {
            console.warn(`⚠️ Failed to decompress TGS file, serving as-is:`, decompressError);
          }
        }

        buffer = finalBuffer;
      }
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unsupported media type'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Cache the downloaded media
    try {
      fs.writeFileSync(cacheFile, buffer);
    } catch (cacheError) {
      console.warn('Failed to cache media:', cacheError);
    }

    const cacheControl = thumbnail ? 'public, max-age=86400' : 'public, max-age=3600'; // 24h for thumbnails, 1h for full media

    return new Response(buffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': cacheControl,
        'Content-Length': buffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('❌ Error downloading media:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to download media'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
