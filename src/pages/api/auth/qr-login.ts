// @ts-nocheck
import type { APIRoute } from 'astro';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { setSession, generateSessionId } from '../../../lib/session-store.js';

// Get environment variables
const API_ID = parseInt(import.meta.env.TELEGRAM_API_ID || '0');
const API_HASH = import.meta.env.TELEGRAM_API_HASH || '';

if (!API_ID || !API_HASH) {
  console.error('Please set TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { action } = await request.json();

    if (!API_ID || !API_HASH) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Telegram API credentials not configured'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (action === 'generate') {
      // Generate QR code for login using proper Telegram API
      const sessionId = generateSessionId();
      const session = new StringSession('');
      const client = new TelegramClient(session, API_ID, API_HASH, {
        connectionRetries: 5,
      });

      await client.connect();

      console.log(`🔲 Starting QR login for session ${sessionId}`);

      try {
        // Use Telegram's official QR login API
        const { Api } = await import('telegram/tl/index.js');

        // Export login token for QR code
        const result = await client.invoke(
          new Api.auth.ExportLoginToken({
            apiId: API_ID,
            apiHash: API_HASH,
            exceptIds: [], // Empty array for new login
          })
        );

        if (result.className === 'auth.LoginToken') {
          // Convert token to base64 for QR code
          const tokenBytes = result.token;
          const tokenBase64 = Buffer.from(tokenBytes).toString('base64url');

          // Store session data with login token
          await setSession(sessionId, {
            client,
            phoneNumber: '',
            isAuthenticated: false,
            loginToken: tokenBytes,
            loginTokenBase64: tokenBase64,
            qrGenerated: Date.now(),
            expires: result.expires
          });

          console.log(`✅ QR login token generated for session ${sessionId}`);

          return new Response(JSON.stringify({
            success: true,
            sessionId,
            token: tokenBase64,
            expires: result.expires,
            message: 'QR code generated'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          });
        } else {
          throw new Error('Failed to export login token');
        }

      } catch (error) {
        console.error('Error exporting login token:', error);
        throw new Error('Failed to generate QR login token');
      }

    } else {
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid action'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('Error in QR login:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate QR code'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
