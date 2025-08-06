// @ts-nocheck
import React, { useState } from 'react';
import { apiClient, storage } from '../lib/api';

interface LoginFormProps {
  onLoginSuccess?: (sessionId: string, userInfo: any) => void;
}

export default function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneCodeHash, setPhoneCodeHash] = useState('');
  const [sessionId, setSessionId] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.sendCode(phoneNumber);
      
      if (response.success) {
        setPhoneCodeHash(response.phoneCodeHash);
        setSessionId(response.sessionId);
        setStep('code');
      } else {
        setError(response.message || 'Failed to send verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.verifyCode(phoneNumber, code, phoneCodeHash, sessionId);
      
      if (response.success) {
        // Store session info
        storage.setSessionId(response.sessionId);
        storage.setUserInfo(response.userInfo);

        // Call callback if provided
        if (onLoginSuccess) {
          onLoginSuccess(response.sessionId, response.userInfo);
        }

        // Dispatch custom event for Astro page to listen to
        window.dispatchEvent(new CustomEvent('loginSuccess', {
          detail: {
            sessionId: response.sessionId,
            userInfo: response.userInfo
          }
        }));
      } else {
        setError(response.message || 'Invalid verification code');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('phone');
    setCode('');
    setError('');
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {step === 'phone' ? 'Login to Telegram' : 'Enter Verification Code'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          {step === 'phone' 
            ? 'Enter your phone number to receive a verification code'
            : `We sent a code to ${phoneNumber}`
          }
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-md">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1234567890"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         placeholder-gray-400 dark:placeholder-gray-500"
              required
              disabled={loading}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Include country code (e.g., +1 for US, +44 for UK)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !phoneNumber.trim()}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm 
                       text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed
                       dark:focus:ring-offset-gray-800"
          >
            {loading ? (
              <div className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending Code...
              </div>
            ) : (
              'Send Verification Code'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Verification Code
            </label>
            <input
              type="text"
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="12345"
              maxLength={5}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-lg tracking-widest
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                         placeholder-gray-400 dark:placeholder-gray-500"
              required
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Enter the 5-digit code sent to your phone
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm 
                         text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 
                         hover:bg-gray-50 dark:hover:bg-gray-600
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         dark:focus:ring-offset-gray-800"
            >
              Back
            </button>
            
            <button
              type="submit"
              disabled={loading || code.length !== 5}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm 
                         text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed
                         dark:focus:ring-offset-gray-800"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </div>
              ) : (
                'Verify Code'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
