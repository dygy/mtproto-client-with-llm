// @ts-nocheck
import SessionStore, { type SessionData } from './database';
import { TELEGRAM_API_ID, TELEGRAM_API_HASH } from './env.js';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

// Re-export SessionData type for compatibility
export type { SessionData };

// Global session store for active clients (in-memory cache)
const sessions = new Map<string, SessionData>();

// Load session from database and recreate client if needed
async function loadSessionFromDatabase(sessionId: string): Promise<SessionData | null> {
  try {
    const sessionData = await SessionStore.getSession(sessionId);
    if (!sessionData) {
      return null;
    }

    // If session has no client but is authenticated, recreate the client
    if (sessionData.isAuthenticated && !sessionData.client && sessionData.telegramSession) {
      try {
        const { TelegramClient } = await import('telegram');
        const { StringSession } = await import('telegram/sessions/index.js');

        const API_ID = TELEGRAM_API_ID;
        const API_HASH = TELEGRAM_API_HASH;

        if (API_ID && API_HASH) {
          const session = new StringSession(sessionData.telegramSession);
          const client = new TelegramClient(session, API_ID, API_HASH, {
            connectionRetries: 5,
            timeout: 15000, // 15 second timeout
            retryDelay: 2000, // 2 second delay between retries
            autoReconnect: true, // Enable auto-reconnection
            maxConcurrentDownloads: 1, // Reduce concurrent operations
          });

          // Connect the client with timeout
          try {
            await client.connect();
            sessionData.client = client;

            // Set up connection monitoring
            client.addEventHandler(async () => {
              // Connection event - no logging needed
            });

          } catch (error) {
            console.error(`❌ Failed to connect client for session ${sessionId}:`, error);
            // Don't set the client if connection failed
            sessionData.client = null;
          }
        }
      } catch (error) {
        console.error(`❌ Error recreating client for session ${sessionId}:`, error);
      }
    }

    return sessionData;
  } catch (error) {
    console.error(`❌ Error loading session ${sessionId}:`, error);
    return null;
  }
}

export async function setSession(sessionId: string, data: SessionData) {
  // Store in memory cache for active clients
  sessions.set(sessionId, data);

  // Get the Telegram session string if client exists
  let telegramSession = '';
  if (data.client && data.isAuthenticated) {
    try {
      telegramSession = data.client.session.save();
    } catch (error) {
      console.error('Error getting session string:', error);
    }
  }

  // Prepare clean data for database (exclude client and add telegramSession)
  const dbData = {
    phoneNumber: data.phoneNumber,
    phoneCodeHash: data.phoneCodeHash,
    isAuthenticated: data.isAuthenticated,
    userInfo: data.userInfo,
    telegramSession,
    // QR login fields
    loginTokenBase64: data.loginTokenBase64,
    qrGenerated: data.qrGenerated,
    expires: data.expires
  };

  // Save to SQLite database
  await SessionStore.setSession(sessionId, dbData);
}

export async function getSession(sessionId: string): Promise<SessionData | undefined> {
  // First check in-memory cache
  let session = sessions.get(sessionId);

  // If not in memory, try to load from database
  if (!session) {
    console.log(`📀 Loading session ${sessionId} from SQLite database...`);
    const dbSession = await loadSessionFromDatabase(sessionId);
    if (dbSession) {
      console.log(`✅ Session ${sessionId} loaded from database, adding to memory cache`);
      sessions.set(sessionId, dbSession);
      session = dbSession;
    } else {
      console.log(`❌ Session ${sessionId} not found in database`);
    }
  }
  return session;
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  // Remove from memory cache
  const memoryDeleted = sessions.delete(sessionId);

  // Remove from database
  const dbDeleted = await SessionStore.deleteSession(sessionId);

  return memoryDeleted || dbDeleted;
}

export async function hasSession(sessionId: string): Promise<boolean> {
  // Check memory cache first
  if (sessions.has(sessionId)) {
    return true;
  }

  // Check database
  const dbSession = await SessionStore.getSession(sessionId);
  return dbSession !== null;
}

export async function getAllSessions(): Promise<Map<string, SessionData>> {
  // This function is mainly for debugging, so we'll return the memory cache
  // In production, you might want to load all sessions from database
  return sessions;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Helper function to ensure client is connected with retry logic
export async function ensureClientConnected(sessionId: string, maxRetries: number = 2): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await attemptClientConnection(sessionId);
    if (result) {
      return true;
    }

    if (attempt < maxRetries) {
      const delayMs = 2000 * attempt; // 2s, 4s delay
      console.log(`⏳ Waiting ${delayMs}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.error(`❌ All connection attempts failed for session ${sessionId}`);
  return false;
}

// Helper function to check if a session's client is healthy
export async function isClientHealthy(sessionId: string): Promise<boolean> {
  try {
    const sessionData = await getSession(sessionId);
    if (!sessionData || !sessionData.client) {
      return false;
    }

    // Quick connection check
    if (!sessionData.client.connected) {
      return false;
    }

    // Try a simple API call with short timeout
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Health check timeout')), 5000)
    );

    const healthCheckPromise = sessionData.client.getMe();
    await Promise.race([healthCheckPromise, timeoutPromise]);

    return true;
  } catch (error) {
    console.log(`🏥 Health check failed for session ${sessionId}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

// Helper function to get connection status without attempting to connect
export async function getConnectionStatus(sessionId: string): Promise<{
  hasSession: boolean;
  hasClient: boolean;
  isConnected: boolean;
  isAuthenticated: boolean;
}> {
  try {
    const sessionData = await getSession(sessionId);

    return {
      hasSession: !!sessionData,
      hasClient: !!sessionData?.client,
      isConnected: sessionData?.client?.connected || false,
      isAuthenticated: sessionData?.isAuthenticated || false
    };
  } catch (error) {
    return {
      hasSession: false,
      hasClient: false,
      isConnected: false,
      isAuthenticated: false
    };
  }
}

// Internal function to attempt client connection
async function attemptClientConnection(sessionId: string): Promise<boolean> {
  const sessionData = await getSession(sessionId);
  if (!sessionData) {
    console.error(`❌ No session data found for ${sessionId}`);
    return false;
  }

  if (!sessionData.client) {
    console.log(`⚠️ No client found in session data for ${sessionId}, attempting to recreate...`);

    // Try to recreate the client if we have session data but no client
    if (sessionData.isAuthenticated && sessionData.userInfo) {
      try {
        console.log(`🔧 Recreating Telegram client for authenticated session ${sessionId}`);

        console.log(`🔍 Using imported credentials: API_ID=${TELEGRAM_API_ID}, API_HASH=${TELEGRAM_API_HASH ? 'set' : 'missing'}`);

        if (!TELEGRAM_API_ID || !TELEGRAM_API_HASH) {
          console.error(`❌ Cannot recreate client: Missing API credentials - API_ID=${TELEGRAM_API_ID}, API_HASH=${TELEGRAM_API_HASH ? 'set' : 'missing'}`);
          return false;
        }

        const { TelegramClient } = await import('telegram');
        const { StringSession } = await import('telegram/sessions');

        // Create new client with stored session string and improved connection settings
        const client = new TelegramClient(
          new StringSession(sessionData.sessionString || ''),
          TELEGRAM_API_ID,
          TELEGRAM_API_HASH,
          {
            connectionRetries: 3,
            retryDelay: 2000,
            timeout: 30000,
            useWSS: false, // Use TCP instead of WebSocket for better reliability
            autoReconnect: true,
            maxConcurrentDownloads: 1,
          }
        );

        // Store the recreated client
        sessionData.client = client;
        await setSession(sessionId, sessionData);

        console.log(`✅ Client recreated for session ${sessionId}`);
      } catch (error) {
        console.error(`❌ Failed to recreate client for session ${sessionId}:`, error);
        return false;
      }
    } else {
      console.error(`❌ Cannot recreate client: Session not authenticated or missing user info`);
      return false;
    }
  }

  try {
    if (!sessionData.client.connected) {
      console.log(`🔄 Client not connected, attempting to reconnect for session ${sessionId}`);
      console.log(`📋 Session info: user=${sessionData.userInfo?.firstName || 'Unknown'}, phone=${sessionData.userInfo?.phone || 'Unknown'}`);

      // Check if we have valid API credentials
      const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
      const API_HASH = process.env.TELEGRAM_API_HASH || '';

      if (!API_ID || !API_HASH) {
        console.error(`❌ Missing Telegram API credentials: API_ID=${API_ID}, API_HASH=${API_HASH ? 'set' : 'missing'}`);
        return false;
      }

      console.log(`🔑 Using API credentials: API_ID=${API_ID}, API_HASH=${API_HASH ? 'set' : 'missing'}`);

      // Add timeout to prevent hanging - increased to 30 seconds for better reliability
      console.log(`⏱️ Starting connection with 30 second timeout...`);
      const connectPromise = sessionData.client.connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
      );

      await Promise.race([connectPromise, timeoutPromise]);

      if (sessionData.client.connected) {
        console.log(`✅ Client successfully reconnected for session ${sessionId}`);
      } else {
        console.error(`❌ Client connection failed - connected=${sessionData.client.connected}`);
        return false;
      }
    }
    return sessionData.client.connected;
  } catch (error) {
    console.error(`❌ Error connecting client for session ${sessionId}:`, error);
    console.error(`📋 Error details:`, {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
    });

    // Handle Telegram authentication errors
    try {
      const { handleTelegramError, broadcastAuthError } = await import('./telegram-error-handler.js');
      const errorResponse = await handleTelegramError(error, sessionId);

      if (errorResponse.shouldLogout) {
        console.log(`🚪 Connection error requires logout for session ${sessionId}: ${errorResponse.errorCode}`);

        // Broadcast auth error to frontend
        broadcastAuthError(sessionId, errorResponse);

        // Delete the invalid session
        try {
          await deleteSession(sessionId);
          console.log(`🗑️ Deleted invalid session ${sessionId} due to connection error`);
        } catch (deleteError) {
          console.error(`❌ Error deleting session ${sessionId}:`, deleteError);
        }
      } else if (errorResponse.shouldReconnect) {
        console.log(`🔄 Connection error suggests reconnection for session ${sessionId}: ${errorResponse.errorCode}`);
      }
    } catch (handlerError) {
      console.error('❌ Error in telegram error handler:', handlerError);
    }

    // If connection fails, clean up the client
    if (sessionData.client) {
      try {
        console.log(`🧹 Cleaning up failed client for session ${sessionId}`);
        await sessionData.client.disconnect();
      } catch (disconnectError) {
        console.error(`❌ Error disconnecting failed client:`, disconnectError);
      }
      sessionData.client = null;
    }

    return false;
  }
}

// Periodically check and maintain client connections
export async function maintainClientConnections(): Promise<void> {
  // Temporarily disabled aggressive maintenance that might cause disconnections
  // Only check if clients exist, don't make API calls

  for (const [sessionId, sessionData] of sessions.entries()) {
    if (!sessionData.client || !sessionData.isAuthenticated) {
      continue;
    }

    try {
      // Only reconnect if client is actually disconnected
      if (!sessionData.client.connected) {
        await sessionData.client.connect();
      }
      // Removed aggressive getMe() call that might cause disconnections

    } catch (error) {
      console.error(`Failed to maintain connection for session ${sessionId}:`, error);
    }
  }
}

// Start periodic connection maintenance
let maintenanceInterval: NodeJS.Timeout | null = null;

export function startConnectionMaintenance(): void {
  if (maintenanceInterval) {
    return; // Already running
  }

  maintenanceInterval = setInterval(async () => {
    try {
      await maintainClientConnections();
    } catch (error) {
      console.error('Error in connection maintenance:', error);
    }
  }, 300000); // Every 5 minutes instead of 1 minute
}

export function stopConnectionMaintenance(): void {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
    console.log('🛑 Stopped connection maintenance');
  }
}

// Helper function to recreate a client for a session
async function recreateClientForSession(sessionId: string): Promise<void> {
  const sessionData = sessions.get(sessionId);
  if (!sessionData) {
    return;
  }

  const API_ID = parseInt(process.env.TELEGRAM_API_ID || '0');
  const API_HASH = process.env.TELEGRAM_API_HASH || '';

  if (!API_ID || !API_HASH) {
    throw new Error('Missing Telegram API credentials');
  }

  const session = new StringSession(sessionData.telegramSession);
  const client = new TelegramClient(session, API_ID, API_HASH, {
    connectionRetries: 5,
    timeout: 15000,
    retryDelay: 2000,
    autoReconnect: true,
    maxConcurrentDownloads: 1,
  });

  await client.connect();
  sessionData.client = client;

  console.log(`🔄 Successfully recreated client for session ${sessionId}`);
}
