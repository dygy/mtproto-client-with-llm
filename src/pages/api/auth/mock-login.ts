// @ts-nocheck
import type { APIRoute } from 'astro';
import { setSession, generateSessionId } from '../../../lib/session-store.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { action } = await request.json();
    
    if (action === 'create') {
      // Create a mock authenticated session for testing
      const sessionId = generateSessionId();
      
      console.log(`🎭 Creating mock authenticated session ${sessionId}`);

      // Create mock session data
      const mockSessionData = {
        client: null, // No real client for mock
        phoneNumber: '+1234567890',
        isAuthenticated: true,
        userInfo: {
          id: 999,
          firstName: 'Test',
          lastName: 'User',
          username: 'testuser'
        }
      };

      // Save the mock session
      await setSession(sessionId, mockSessionData);

      console.log(`✅ Mock session created: ${sessionId}`);

      return new Response(JSON.stringify({
        success: true,
        sessionId,
        userInfo: mockSessionData.userInfo,
        message: 'Mock session created'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

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
    console.error('Error in mock login:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create mock session'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
