// @ts-nocheck
import { deleteSession } from './session-store.js';

export interface TelegramErrorResponse {
  shouldLogout: boolean;
  shouldReconnect: boolean;
  message: string;
  errorCode?: string;
}

/**
 * Handles Telegram API errors and determines appropriate action
 */
export async function handleTelegramError(error: any, sessionId: string): Promise<TelegramErrorResponse> {
  const errorMessage = error?.message || error?.errorMessage || String(error);
  const errorCode = error?.errorMessage || error?.code || '';
  


  // AUTH_KEY_UNREGISTERED - The authentication key is no longer valid
  if (errorMessage.includes('AUTH_KEY_UNREGISTERED')) {
    try {
      // Delete the invalid session
      await deleteSession(sessionId);
    } catch (deleteError) {
      console.error(`Error deleting session ${sessionId}:`, deleteError);
    }

    return {
      shouldLogout: true,
      shouldReconnect: false,
      message: 'Your authentication key is no longer valid. Please log in again.',
      errorCode: 'AUTH_KEY_UNREGISTERED'
    };
  }

  // AUTH_KEY_DUPLICATED - Multiple sessions with same key
  if (errorMessage.includes('AUTH_KEY_DUPLICATED')) {

    
    try {
      await deleteSession(sessionId);

    } catch (deleteError) {
      console.error(`Error deleting session ${sessionId}:`, deleteError);
    }

    return {
      shouldLogout: true,
      shouldReconnect: false,
      message: 'Duplicate authentication detected. Please log in again.',
      errorCode: 'AUTH_KEY_DUPLICATED'
    };
  }

  // SESSION_REVOKED - Session was revoked by user or Telegram
  if (errorMessage.includes('SESSION_REVOKED')) {
    try {
      await deleteSession(sessionId);
    } catch (deleteError) {
      console.error(`Error deleting session ${sessionId}:`, deleteError);
    }

    return {
      shouldLogout: true,
      shouldReconnect: false,
      message: 'Your session was revoked. Please log in again.',
      errorCode: 'SESSION_REVOKED'
    };
  }

  // USER_DEACTIVATED - User account was deactivated
  if (errorMessage.includes('USER_DEACTIVATED')) {

    
    try {
      await deleteSession(sessionId);

    } catch (deleteError) {
      console.error(`❌ Error deleting session ${sessionId}:`, deleteError);
    }

    return {
      shouldLogout: true,
      shouldReconnect: false,
      message: 'Your Telegram account has been deactivated.',
      errorCode: 'USER_DEACTIVATED'
    };
  }

  // CONNECTION_NOT_INITED - Client not properly initialized
  if (errorMessage.includes('CONNECTION_NOT_INITED')) {

    
    return {
      shouldLogout: false,
      shouldReconnect: true,
      message: 'Connection not initialized. Attempting to reconnect...',
      errorCode: 'CONNECTION_NOT_INITED'
    };
  }

  // TIMEOUT errors - Temporary network issues
  if (errorMessage.includes('TIMEOUT') || errorMessage.includes('timeout')) {

    
    return {
      shouldLogout: false,
      shouldReconnect: true,
      message: 'Connection timeout. Retrying...',
      errorCode: 'TIMEOUT'
    };
  }

  // FLOOD_WAIT - Rate limiting
  if (errorMessage.includes('FLOOD_WAIT')) {
    const waitTime = errorMessage.match(/FLOOD_WAIT_(\d+)/)?.[1] || '60';

    
    return {
      shouldLogout: false,
      shouldReconnect: false,
      message: `Rate limited. Please wait ${waitTime} seconds before trying again.`,
      errorCode: 'FLOOD_WAIT'
    };
  }

  // PHONE_NUMBER_BANNED - Phone number is banned
  if (errorMessage.includes('PHONE_NUMBER_BANNED')) {
    console.log(`📱 PHONE_NUMBER_BANNED detected`);
    
    try {
      await deleteSession(sessionId);

    } catch (deleteError) {
      console.error(`❌ Error deleting session ${sessionId}:`, deleteError);
    }

    return {
      shouldLogout: true,
      shouldReconnect: false,
      message: 'Your phone number has been banned from Telegram.',
      errorCode: 'PHONE_NUMBER_BANNED'
    };
  }

  // Default case - unknown error

  
  return {
    shouldLogout: false,
    shouldReconnect: false,
    message: `Telegram API error: ${errorMessage}`,
    errorCode: 'UNKNOWN'
  };
}

/**
 * Broadcasts authentication error to frontend via SSE
 */
export function broadcastAuthError(sessionId: string, errorResponse: TelegramErrorResponse) {
  try {
    // Import broadcastToSession dynamically to avoid circular imports
    import('./update-manager.js').then(({ broadcastToSession }) => {
      broadcastToSession(sessionId, {
        type: 'auth_error',
        data: {
          shouldLogout: errorResponse.shouldLogout,
          shouldReconnect: errorResponse.shouldReconnect,
          message: errorResponse.message,
          errorCode: errorResponse.errorCode
        },
        timestamp: new Date().toISOString()
      });
      

    }).catch(error => {
      console.error('Error broadcasting auth error:', error);
    });
  } catch (error) {
    console.error('Error in broadcastAuthError:', error);
  }
}
