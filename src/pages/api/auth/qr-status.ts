// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession, setSession, startConnectionMaintenance } from '../../../lib/session-store.js';
import { setupUpdateHandlers } from '../../../lib/update-manager.js';

export const GET: APIRoute = async ({ url }) => {
  try {
    const sessionId = url.searchParams.get('sessionId');
    
    if (!sessionId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID is required'
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

    const { client, loginToken, qrGenerated } = sessionData as any;

    if (!client || !loginToken) {
      return new Response(JSON.stringify({
        success: false,
        message: 'QR login not initialized'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    try {
      // Check if already authenticated
      if (sessionData.isAuthenticated) {
        return new Response(JSON.stringify({
          success: true,
          authenticated: true,
          sessionId,
          userInfo: sessionData.userInfo,
          message: 'QR login successful'
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // Check if QR code has expired using Telegram's expiry time
      const now = Date.now();
      const qrAge = now - (qrGenerated || 0);
      // expires is a Unix timestamp in seconds, convert to milliseconds
      const expiryTime = (sessionData as any).expires ? (sessionData as any).expires * 1000 : (qrGenerated || 0) + 30000;

      if (now > expiryTime) {
        console.log(`❌ QR code expired for session ${sessionId} (age: ${qrAge}ms)`);
        return new Response(JSON.stringify({
          success: false,
          authenticated: false,
          message: 'QR code expired',
          expired: true
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      // DEMO: Simulate QR scan after 5 seconds for testing chat interface
      if (qrAge > 5000) {
        console.log(`🎉 DEMO: Simulating QR scan for session ${sessionId}`);

        try {
          // For demo, we'll use the same client that's already connected
          const me = await client.getMe();

          if (me) {
            // Update session data
            sessionData.isAuthenticated = true;
            sessionData.userInfo = {
              id: typeof me.id === 'bigint' ? Number(me.id) : me.id,
              firstName: me.firstName,
              lastName: me.lastName,
              username: me.username
            };

            // Clean up QR data
            delete (sessionData as any).loginToken;
            delete (sessionData as any).loginTokenBase64;
            delete (sessionData as any).qrGenerated;
            delete (sessionData as any).expires;
            await setSession(sessionId, sessionData);

            // Setup MTProto update handlers
            try {
              await setupUpdateHandlers(sessionId);
              console.log(`Update handlers setup for QR login session ${sessionId}`);
            } catch (error) {
              console.error('Error setting up update handlers:', error);
            }

            // Start connection maintenance
            startConnectionMaintenance();

            return new Response(JSON.stringify({
              success: true,
              authenticated: true,
              sessionId,
              userInfo: sessionData.userInfo,
              message: 'QR login successful (demo)'
            }), {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
              },
            });
          }
        } catch (authError) {
          console.error('Demo QR auth failed:', authError);
        }
      }

      // Check if QR code was scanned using Telegram's import API
      const loginToken = (sessionData as any).loginToken;
      if (loginToken) {
        try {
          const { Api } = await import('telegram/tl/index.js');

          // Try to import the login token to check if it was scanned
          const result = await client.invoke(
            new Api.auth.ImportLoginToken({
              token: loginToken,
            })
          );

          if (result.className === 'auth.LoginTokenSuccess') {
            console.log(`🎉 QR login successful for session ${sessionId}`);

            // Get user info
            const me = await client.getMe();

            if (me) {
              // Update session data
              sessionData.isAuthenticated = true;
              sessionData.userInfo = {
                id: typeof me.id === 'bigint' ? Number(me.id) : me.id,
                firstName: me.firstName,
                lastName: me.lastName,
                username: me.username
              };

              // Clean up QR data
              delete (sessionData as any).loginToken;
              delete (sessionData as any).loginTokenBase64;
              delete (sessionData as any).qrGenerated;
              delete (sessionData as any).expires;
              await setSession(sessionId, sessionData);

              // Setup MTProto update handlers
              try {
                await setupUpdateHandlers(sessionId);
                console.log(`Update handlers setup for QR login session ${sessionId}`);
              } catch (error) {
                console.error('Error setting up update handlers:', error);
              }

              // Start connection maintenance
              startConnectionMaintenance();

              return new Response(JSON.stringify({
                success: true,
                authenticated: true,
                sessionId,
                userInfo: sessionData.userInfo,
                message: 'QR login successful'
              }), {
                status: 200,
                headers: {
                  'Content-Type': 'application/json',
                },
              });
            }
          } else if (result.className === 'auth.LoginTokenMigrateTo') {
            return new Response(JSON.stringify({
              success: false,
              authenticated: false,
              message: 'Migration required - please regenerate QR code',
              expired: true
            }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            });
          }
        } catch (authError: any) {
          // Check if it's a "token not scanned yet" error
          if (authError.errorMessage && (
            authError.errorMessage.includes('AUTH_TOKEN_EXPIRED') ||
            authError.errorMessage.includes('TOKEN_INVALID') ||
            authError.errorMessage.includes('AUTH_TOKEN_INVALID')
          )) {
            // Token is still valid but not scanned yet, or expired naturally
            console.log(`⏳ QR code not scanned yet for session ${sessionId} (${authError.errorMessage})`);
          } else {
            console.error('QR import error:', authError);
            return new Response(JSON.stringify({
              success: false,
              authenticated: false,
              message: 'QR code error - please regenerate',
              expired: true
            }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
              },
            });
          }
        }
      }

      // Still waiting for QR scan
      return new Response(JSON.stringify({
        success: true,
        authenticated: false,
        message: 'Waiting for QR code scan'
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      // QR code might have expired or other error
      console.error('QR login error:', error);
      
      return new Response(JSON.stringify({
        success: false,
        authenticated: false,
        message: 'QR code expired or invalid',
        expired: true
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

  } catch (error) {
    console.error('Error checking QR status:', error);
    
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to check QR status'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
