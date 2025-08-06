// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, ensureClientConnected } from '../../../../../lib/session-store.js';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { sessionId, chatId } = params;
    
    if (!sessionId || !chatId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID and Chat ID are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const formData = await request.formData();
    const mediaFile = formData.get('media') as File;
    const caption = formData.get('caption') as string;

    if (!mediaFile) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Media file is required'
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

    // For demo purposes, return mock success if not authenticated
    if (!sessionData.isAuthenticated || !sessionData.client) {
      console.log(`📤 Mock sending media to chat ${chatId}: ${mediaFile.name} (${mediaFile.type})`);
      
      const mockMessage = {
        id: Date.now(),
        text: caption || '',
        date: new Date().toISOString(),
        fromId: sessionData.userInfo?.id || 12345,
        fromName: sessionData.userInfo?.firstName || 'You',
        chatId: parseInt(chatId),
        isOutgoing: true,
        mediaType: getMediaType(mediaFile.type),
        hasMedia: true,
        mediaInfo: {
          fileName: mediaFile.name,
          fileSize: mediaFile.size,
          mimeType: mediaFile.type
        }
      };

      return new Response(JSON.stringify({
        success: true,
        message: mockMessage
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
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
      // Get the chat entity
      const dialogs = await client.getDialogs({ limit: 100 });
      const targetDialog = dialogs.find((dialog: any) =>
        dialog.entity.id?.toJSNumber()?.toString() === chatId
      );

      if (!targetDialog) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Chat not found'
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Convert File to Buffer for Telegram client
      const arrayBuffer = await mediaFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Send the media message
      const sentMessage = await client.sendFile(targetDialog.entity, {
        file: buffer,
        caption: caption || undefined,
        fileName: mediaFile.name
      });

      console.log(`✅ Media sent to chat ${targetDialog.title}: ${mediaFile.name}`);

      // Format the response
      const messageResponse = {
        id: sentMessage.id,
        text: caption || '',
        date: new Date().toISOString(),
        fromId: sessionData.userInfo?.id,
        fromName: sessionData.userInfo?.firstName || 'You',
        chatId: parseInt(chatId),
        isOutgoing: true,
        mediaType: getMediaType(mediaFile.type),
        hasMedia: true,
        mediaInfo: {
          fileName: mediaFile.name,
          fileSize: mediaFile.size,
          mimeType: mediaFile.type
        }
      };

      return new Response(JSON.stringify({
        success: true,
        message: messageResponse
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error(`❌ Error sending media to chat ${chatId}:`, error);
      return new Response(JSON.stringify({
        success: false,
        message: `Failed to send media: ${error instanceof Error ? error.message : 'Unknown error'}`
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('❌ Error in send media API:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

function getMediaType(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return mimeType.includes('gif') ? 'gif' : 'photo';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else {
    return 'document';
  }
}
