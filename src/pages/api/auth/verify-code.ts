// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, setSession, startConnectionMaintenance } from '../../../lib/session-store.js';
import { setupUpdateHandlers } from '../../../lib/update-manager.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { phoneNumber, code, phoneCodeHash, sessionId } = await request.json();
    
    if (!phoneNumber || !code || !phoneCodeHash || !sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'All fields are required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Get session data
    console.log(`Looking for session ${sessionId}`);
    const sessionData = await getSession(sessionId);
    if (!sessionData) {
      console.log(`Session ${sessionId} not found`);
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found or expired'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { client } = sessionData;

    try {
      // Use the low-level API to sign in
      const { Api } = await import('telegram/tl/index.js');
      const result = await client.invoke(
        new Api.auth.SignIn({
          phoneNumber,
          phoneCodeHash,
          phoneCode: code
        })
      );

      if (result && result.user) {
        // Update session data
        sessionData.isAuthenticated = true;
        sessionData.userInfo = {
          id: typeof result.user.id === 'bigint' ? Number(result.user.id) : result.user.id,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          username: result.user.username,
          phone: sessionData.phoneNumber
        };

        // Save the session string for client recreation
        sessionData.sessionString = (client.session as any).save();
        console.log(`💾 Saved session string for ${sessionId} (length: ${sessionData.sessionString?.length || 0})`);

        await setSession(sessionId, sessionData);

        // Setup MTProto update handlers
        try {
          await setupUpdateHandlers(sessionId);
          console.log(`Update handlers setup for session ${sessionId}`);
        } catch (error) {
          console.error('Error setting up update handlers:', error);
        }

        // Start connection maintenance
        startConnectionMaintenance();

        return new Response(JSON.stringify({
          success: true,
          sessionId,
          userInfo: sessionData.userInfo,
          message: 'Authentication successful'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          message: 'Authentication failed'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid verification code'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('Error in verify-code:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to verify code'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
