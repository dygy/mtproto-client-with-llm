// @ts-nocheck
import type { APIRoute } from 'astro';
import { verifySessionPassword, generateUnlockToken } from '../../../lib/session-password.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { sessionId, password } = await request.json();

    if (!sessionId || !password) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID and password are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Verify the password
    const isValid = await verifySessionPassword(sessionId, password);

    if (!isValid) {
      console.log(`❌ Invalid password for session ${sessionId}`);
      
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid password'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Generate unlock token
    const unlockToken = generateUnlockToken(sessionId);

    console.log(`✅ Password verified for session ${sessionId}`);

    return new Response(JSON.stringify({
      success: true,
      sessionId,
      unlockToken,
      message: 'Session unlocked'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('Session password verification error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Verification failed'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

