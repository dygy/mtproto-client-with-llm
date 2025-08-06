// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

interface ConnectionStatusProps {
  sessionId: string;
  className?: string;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  sessionId, 
  className = '' 
}) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, [sessionId]);

  const checkConnection = async () => {
    try {
      const response = await apiClient.getSessionInfo(sessionId);
      setIsConnected(response.success && response.isAuthenticated);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Error checking connection:', error);
      setIsConnected(false);
      setLastChecked(new Date());
    }
  };

  const getStatusColor = () => {
    if (isConnected === null) return 'bg-gray-400'; // Loading
    return isConnected ? 'bg-green-500' : 'bg-red-500';
  };

  const getStatusText = () => {
    if (isConnected === null) return 'Checking...';
    return isConnected ? 'Connected' : 'Disconnected';
  };

  const formatLastChecked = () => {
    if (!lastChecked) return '';
    return lastChecked.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {getStatusText()}
        {lastChecked && (
          <span className="ml-1">({formatLastChecked()})</span>
        )}
      </span>
      <button
        onClick={checkConnection}
        className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        title="Check connection"
      >
        ↻
      </button>
    </div>
  );
};

export default ConnectionStatus;
