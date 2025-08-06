// @ts-nocheck
// Dashboard component
import ChatInterface from './ChatInterface';

interface UserInfo {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
}

interface DashboardProps {
  sessionId: string;
  userInfo: UserInfo;
  onLogout: () => void;
}

export default function Dashboard({ sessionId, userInfo, onLogout }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* User info header */}
      <div className="container-elevated p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome, {userInfo.firstName || 'User'}!
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Session: {sessionId}
              {userInfo.username && ` • @${userInfo.username}`}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Chat interface */}
      <ChatInterface 
        sessionId={sessionId}
        userInfo={userInfo}
      />
    </div>
  );
}
