// @ts-nocheck
import { useState, useEffect } from 'react';

interface Session {
  sessionId: string;
  phoneNumber: string;
  userInfo: {
    id: number;
    firstName?: string;
    lastName?: string;
    username?: string;
  };
  lastActive: string;
  createdAt: string;
}

interface SessionSelectorProps {
  onSessionSelect?: (sessionId: string, userInfo: any) => void;
  onNewSession?: () => void;
}

export default function SessionSelector({ onSessionSelect, onNewSession }: SessionSelectorProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/sessions');
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions || []);
        console.log(`✅ Loaded ${data.sessions?.length || 0} sessions`);
      } else {
        setError(data.message || 'Failed to load sessions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSessionSelect = async (session: Session) => {
    try {
      setRestoring(session.sessionId);
      setError('');

      console.log(`🔄 Restoring session: ${session.sessionId}`);

      // Verify session health before selecting
      const healthResponse = await fetch(`/api/session/health/${session.sessionId}`);
      const healthData = await healthResponse.json();

      if (healthData.success && healthData.healthy) {
        console.log('✅ Session is healthy, storing in localStorage');

        // Store session data in localStorage
        localStorage.setItem('telegram_session_id', session.sessionId);
        localStorage.setItem('telegram_user_info', JSON.stringify(healthData.userInfo));
        localStorage.setItem('telegram_user_id', healthData.userInfo.id.toString());

        // Call callback
        if (onSessionSelect) {
          onSessionSelect(session.sessionId, healthData.userInfo);
        }

        console.log('✅ Session restored successfully');
      } else {
        setError(`Session for ${session.userInfo.firstName} is no longer valid`);
        console.error('❌ Session is not healthy:', healthData.message);
      }
    } catch (err) {
      setError(`Failed to restore session: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('❌ Session restore error:', err);
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="layout-centered container-elevated p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            No Sessions Found
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No existing sessions found. Please create a new session.
          </p>
          <button 
            onClick={onNewSession}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Create New Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-centered container-elevated p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Select Session
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Choose an existing session to continue
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {sessions.map(session => (
          <button
            key={session.sessionId}
            onClick={() => handleSessionSelect(session)}
            disabled={restoring === session.sessionId}
            className="w-full p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                {restoring === session.sessionId ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  session.userInfo.firstName?.charAt(0) || '?'
                )}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900 dark:text-white">
                  {session.userInfo.firstName || 'Unknown'} {session.userInfo.lastName || ''}
                  {restoring === session.sessionId && (
                    <span className="ml-2 text-sm text-blue-600 dark:text-blue-400">Restoring...</span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {session.phoneNumber}
                  {session.userInfo.username && ` • @${session.userInfo.username}`}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  Last active: {formatDate(session.lastActive)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="text-center">
        <button 
          onClick={onNewSession}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Create New Session
        </button>
      </div>
    </div>
  );
}
