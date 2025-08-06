// @ts-nocheck
import { useState, useEffect } from 'react';
import SessionSelector from './SessionSelector';
import LoginForm from './LoginForm';
import Dashboard from './Dashboard';

type AuthState = 'loading' | 'session-select' | 'login' | 'authenticated';

interface UserInfo {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
}

export default function AuthManager() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Add a small delay to ensure hydration is complete
    const timer = setTimeout(() => {
      checkAuthState();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const checkAuthState = async () => {
    try {
      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        console.log('❌ Not in browser environment, skipping auth check');
        return;
      }

      // Check localStorage first
      const storedSessionId = localStorage.getItem('telegram_session_id');
      const storedUserInfo = localStorage.getItem('telegram_user_info');
      console.log('📱 localStorage check:', { hasSessionId: !!storedSessionId, hasUserInfo: !!storedUserInfo });

      if (storedSessionId && storedUserInfo) {
        console.log('📱 Found session in localStorage, verifying...');

        try {
          // Verify session is still valid
          const healthResponse = await fetch(`/api/session/health/${storedSessionId}`);
          const healthData = await healthResponse.json();

          if (healthData.success && healthData.healthy) {
            console.log('✅ Stored session is valid');
            setSessionId(storedSessionId);
            setUserInfo(healthData.userInfo);
            setAuthState('authenticated');
            return;
          } else {
            console.log('🔄 Stored session is invalid, clearing localStorage');

            // Check if this is an auth error that requires logout
            if (healthData.shouldLogout) {
              console.log(`🚪 Session requires logout: ${healthData.errorCode} - ${healthData.message}`);
              setError(`Authentication error: ${healthData.message}`);
            }

            localStorage.removeItem('telegram_session_id');
            localStorage.removeItem('telegram_user_info');
            localStorage.removeItem('telegram_user_id');
          }
        } catch (parseError) {
          console.error('❌ Error parsing stored user info:', parseError);
          localStorage.clear();
        }
      }

      // No valid localStorage session, check for available sessions in database
      console.log('🔍 Checking for available sessions in database...');
      const sessionsResponse = await fetch('/api/sessions');
      console.log('📊 Sessions API response status:', sessionsResponse.status);

      if (!sessionsResponse.ok) {
        throw new Error(`Sessions API failed with status ${sessionsResponse.status}`);
      }

      const sessionsData = await sessionsResponse.json();
      console.log('📊 Sessions data:', sessionsData);

      if (sessionsData.success && sessionsData.sessions && sessionsData.sessions.length > 0) {
        console.log(`✅ Found ${sessionsData.sessions.length} available sessions`);
        setAuthState('session-select');
      } else {
        console.log('📝 No available sessions, showing login form');
        setAuthState('login');
      }
    } catch (error) {
      console.error('❌ Error checking auth state:', error);
      setError(`Failed to check authentication state: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setAuthState('login');
    }
  };

  const handleSessionSelect = async (selectedSessionId: string, selectedUserInfo: UserInfo) => {
    console.log(`🔄 Session selected: ${selectedSessionId}`);
    
    try {
      // Store session data
      localStorage.setItem('telegram_session_id', selectedSessionId);
      localStorage.setItem('telegram_user_info', JSON.stringify(selectedUserInfo));
      localStorage.setItem('telegram_user_id', selectedUserInfo.id.toString());
      
      // Update state
      setSessionId(selectedSessionId);
      setUserInfo(selectedUserInfo);
      setAuthState('authenticated');
      
      console.log('✅ Session restored and authenticated');
    } catch (error) {
      console.error('❌ Error handling session selection:', error);
      setError('Failed to restore session');
    }
  };

  const handleLoginSuccess = (newSessionId: string, newUserInfo: UserInfo) => {
    console.log(`✅ Login successful: ${newSessionId}`);
    
    setSessionId(newSessionId);
    setUserInfo(newUserInfo);
    setAuthState('authenticated');
  };

  const handleLogout = () => {
    console.log('🚪 Logging out...');
    
    // Clear localStorage
    localStorage.removeItem('telegram_session_id');
    localStorage.removeItem('telegram_user_info');
    localStorage.removeItem('telegram_user_id');
    
    // Reset state
    setSessionId(null);
    setUserInfo(null);
    setAuthState('loading');
    
    // Re-check auth state
    checkAuthState();
  };

  const handleNewSession = () => {
    console.log('🆕 Creating new session...');
    setAuthState('login');
  };

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="layout-centered container-elevated p-6 border-2 border-blue-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {isClient ? 'Checking authentication...' : 'Loading React component...'}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            AuthManager Loading State (Client: {isClient ? 'Yes' : 'No'})
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError('');
              checkAuthState();
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Add debugging
  console.log('🎯 AuthManager render - State:', authState, 'Error:', error);

  // Render appropriate component based on auth state
  switch (authState) {
    case 'session-select':
      return (
        <SessionSelector
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
        />
      );

    case 'login':
      return (
        <LoginForm
          onLoginSuccess={handleLoginSuccess}
        />
      );

    case 'authenticated':
      return sessionId && userInfo ? (
        <Dashboard
          sessionId={sessionId}
          userInfo={userInfo}
          onLogout={handleLogout}
        />
      ) : null;

    default:
      console.log('❓ Unknown auth state:', authState);
      return (
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400">Unknown state: {authState}</p>
          </div>
        </div>
      );
  }
}
