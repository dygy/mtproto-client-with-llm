// @ts-nocheck
import type { APIRoute } from 'astro';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { setSession, generateSessionId } from '../../../lib/session-store.js';
import { TELEGRAM_API_ID, TELEGRAM_API_HASH } from '../../../lib/env.js';

// Use imported environment variables
const API_ID = TELEGRAM_API_ID;
const API_HASH = TELEGRAM_API_HASH;

if (!API_ID || !API_HASH) {
  console.error('Please set TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { phoneNumber } = await request.json();
    
    if (!phoneNumber) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Phone number is required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

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

    const sessionId = generateSessionId();
    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, {
      connectionRetries: 5,
    });

    await client.connect();

    // Use the low-level API to send code
    const { Api } = await import('telegram/tl/index.js');
    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: API_ID,
        apiHash: API_HASH,
        settings: new Api.CodeSettings({})
      })
    );

    // Store session data
    await setSession(sessionId, {
      client,
      phoneNumber,
      phoneCodeHash: (result as any).phoneCodeHash,
      sessionString: (client.session as any).save(),
      isAuthenticated: false
    });

    console.log(`Session ${sessionId} created for phone ${phoneNumber}`);

    return new Response(JSON.stringify({
      success: true,
      phoneCodeHash: (result as any).phoneCodeHash,
      sessionId,
      message: 'Verification code sent'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Error sending code:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send verification code'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
