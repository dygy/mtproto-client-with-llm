// @ts-nocheck
// Client-side application logic for authentication and messaging
const API_BASE_URL = '/api';

import type { ApiResponse } from '../types/database.js';

// State variables
let currentSessionId: string | null = null;
let currentPhoneCodeHash: string | null = null;
let currentPhoneNumber: string | null = null;
let sseConnection: EventSource | null = null;
let healthCheckInterval: number | null = null;
let qrStatusInterval: number | null = null;
let qrExpiryTimeout: number | null = null;
let qrCountdownInterval: number | null = null;
let currentLoginMethod: 'sms' | 'qr' = 'sms';

// DOM elements (will be initialized when DOM is ready)
let loginContainer: HTMLElement | null = null;
let dashboardContainer: HTMLElement | null = null;
let sessionSelectorContainer: HTMLElement | null = null;
let phoneForm: HTMLFormElement | null = null;
let codeForm: HTMLFormElement | null = null;
let qrForm: HTMLElement | null = null;
let phoneInput: HTMLInputElement | null = null;
let codeInput: HTMLInputElement | null = null;
let errorMessage: HTMLElement | null = null;
let errorText: HTMLElement | null = null;
let formTitle: HTMLElement | null = null;
let formDescription: HTMLElement | null = null;
let sendCodeBtn: HTMLButtonElement | null = null;
let verifyCodeBtn: HTMLButtonElement | null = null;
let backBtn: HTMLButtonElement | null = null;
let logoutBtn: HTMLButtonElement | null = null;
let userInfo: HTMLElement | null = null;
let sessionInfo: HTMLElement | null = null;
let userDetails: HTMLElement | null = null;
let connectionIndicator: HTMLElement | null = null;
let connectionStatus: HTMLElement | null = null;
// NOTE: These variables are disabled since message handling is done by React components
// let messagesList: HTMLElement | null = null;
// let messageCount: HTMLElement | null = null;
let testUpdatesBtn: HTMLButtonElement | null = null;
let smsLoginTab: HTMLButtonElement | null = null;
let qrLoginTab: HTMLButtonElement | null = null;
let qrCanvas: HTMLCanvasElement | null = null;
let qrLoading: HTMLElement | null = null;
let qrInstructions: HTMLElement | null = null;
let qrStatus: HTMLElement | null = null;
let qrRefreshBtn: HTMLButtonElement | null = null;

// Initialize DOM elements
function initializeDOMElements(): void {
  console.log('🔧 Initializing DOM elements...');
  loginContainer = document.getElementById('login-form');
  dashboardContainer = document.getElementById('dashboard');
  sessionSelectorContainer = document.getElementById('session-selector-container');

  console.log('📦 DOM elements found:', {
    loginContainer: !!loginContainer,
    dashboardContainer: !!dashboardContainer,
    sessionSelectorContainer: !!sessionSelectorContainer
  });
  phoneForm = document.getElementById('phone-form') as HTMLFormElement;
  codeForm = document.getElementById('code-form') as HTMLFormElement;
  qrForm = document.getElementById('qr-form');
  phoneInput = document.getElementById('phone') as HTMLInputElement;
  codeInput = document.getElementById('code') as HTMLInputElement;
  errorMessage = document.getElementById('error-message');
  errorText = document.getElementById('error-text');
  formTitle = document.getElementById('form-title');
  formDescription = document.getElementById('form-description');
  sendCodeBtn = document.getElementById('send-code-btn') as HTMLButtonElement;
  verifyCodeBtn = document.getElementById('verify-code-btn') as HTMLButtonElement;
  backBtn = document.getElementById('back-btn') as HTMLButtonElement;
  logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
  userInfo = document.getElementById('user-info');
  sessionInfo = document.getElementById('session-info');
  userDetails = document.getElementById('user-details');
  connectionIndicator = document.getElementById('connection-indicator');
  testUpdatesBtn = document.getElementById('test-updates-btn') as HTMLButtonElement;
  smsLoginTab = document.getElementById('sms-login-tab') as HTMLButtonElement;
  qrLoginTab = document.getElementById('qr-login-tab') as HTMLButtonElement;
  qrCanvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
  qrLoading = document.getElementById('qr-loading');
  qrInstructions = document.getElementById('qr-instructions');
  qrStatus = document.getElementById('qr-status');
  qrRefreshBtn = document.getElementById('qr-refresh-btn') as HTMLButtonElement;
}

// Utility functions
function showError(message: string): void {
  if (errorText && errorMessage) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
  }
}

function hideError(): void {
  if (errorMessage) {
    errorMessage.classList.add('hidden');
  }
}

function setLoading(button: HTMLButtonElement | null, isLoading: boolean, originalText: string): void {
  if (!button) return;
  
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = `
      <div class="flex items-center">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading...
      </div>
    `;
  } else {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// API functions
async function sendCode(phoneNumber: string): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/send-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phoneNumber }),
  });
  return response.json();
}

async function verifyCode(phoneNumber: string, code: string, phoneCodeHash: string, sessionId: string): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-code`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      phoneNumber,
      code,
      phoneCodeHash,
      sessionId,
    }),
  });
  return response.json();
}


async function deleteSession(sessionId: string): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/session/${sessionId}`, {
    method: 'DELETE',
  });
  return response.json();
}

async function checkSessionHealth(sessionId: string): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/session/health/${sessionId}`);
  return response.json();
}

async function listSessions(): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions`);
  return response.json();
}

async function generateQRCode(): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/qr-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'generate' }),
  });
  return response.json();
}

async function checkQRStatus(sessionId: string): Promise<ApiResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/qr-status?sessionId=${sessionId}`);
  return response.json();
}

// SSE (Server-Sent Events) functions for real-time updates
// NOTE: This function is disabled to prevent duplicate SSE connections
// SSE is now handled by the React ChatInterface component
/* eslint-disable @typescript-eslint/no-unused-vars */
// function connectSSE(sessionId: string): void {
//   if (sseConnection) {
//     sseConnection.close();
//   }

//   console.log(`Connecting to SSE for session ${sessionId}`);
//   sseConnection = new EventSource(`/api/updates/${sessionId}`);

//   sseConnection.onopen = function() {
//     console.log('SSE connected');
//     updateConnectionStatus('Connected', true);
//   };

//   sseConnection.onmessage = function(event) {
//     try {
//       const update = JSON.parse(event.data);
//       handleSSEUpdate(update);
//     } catch (error) {
//       console.error('Error parsing SSE message:', error);
//     }
//   };

//   sseConnection.onerror = function(error) {
//     console.error('SSE error:', error);
//     updateConnectionStatus('Connection Error', false);

//     // Attempt to reconnect after 5 seconds
//     setTimeout(() => {
//       if (currentSessionId) {
//         connectSSE(currentSessionId);
//       }
//     }, 5000);
//   };
// }

// NOTE: This function is also disabled since SSE is handled by React components
// function handleSSEUpdate(update: any): void {
//   console.log('Received SSE update:', update);

//   switch (update.type) {
//     case 'connected':
//       console.log('SSE connection established');
//       break;

//     case 'message':
//       addMessageToList(update.data);
//       break;

//     case 'user_status':
//       console.log('User status update:', update.data);
//       break;

//     case 'typing':
//       console.log('Typing indicator:', update.data);
//       break;

//     case 'heartbeat':
//       // Keep connection alive
//       break;

//     case 'test':
//       console.log('Test update received:', update.data);
//       showTestNotification(update.data);
//       break;

//     default:
//       console.log('Unknown update type:', update.type);
//   }
// }

// NOTE: This function is also disabled since SSE is handled by React components
// function showTestNotification(data: any): void {
//   const notification = document.createElement('div');
//   notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
//   notification.textContent = `Test update: ${data.message} (Dialogs: ${data.dialogsCount})`;
//   document.body.appendChild(notification);

//   setTimeout(() => {
//     notification.remove();
//   }, 3000);
// }

// Session health monitoring
function startSessionHealthCheck(sessionId: string): void {
  // Clear any existing health check
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  console.log(`🏥 Starting session health monitoring for ${sessionId}`);

  // Check immediately
  checkSessionHealthAndHandle(sessionId);

  // Then check every 30 seconds
  healthCheckInterval = window.setInterval(() => {
    checkSessionHealthAndHandle(sessionId);
  }, 30000);
}

async function checkSessionHealthAndHandle(sessionId: string): Promise<void> {
  try {
    const healthResponse = await checkSessionHealth(sessionId);

    if (!healthResponse.success || !healthResponse.healthy) {
      console.error(`❌ Session ${sessionId} is unhealthy:`, healthResponse.message);

      // Show user notification
      showSessionErrorNotification(healthResponse.message || 'Session expired');

      // Auto logout after 3 seconds
      setTimeout(() => {
        handleAutoLogout('Session expired or became invalid');
      }, 3000);

      return;
    }

    // Session is healthy
    console.log(`✅ Session ${sessionId} health check passed`);
    updateConnectionStatus('Connected', true);

  } catch (error) {
    console.error(`❌ Session health check failed for ${sessionId}:`, error);

    // Show error notification
    showSessionErrorNotification('Connection lost');

    // Auto logout after 5 seconds to give time for reconnection
    setTimeout(() => {
      handleAutoLogout('Connection lost');
    }, 5000);
  }
}

function showSessionErrorNotification(message: string): void {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 max-w-sm';
  notification.innerHTML = `
    <div class="flex items-center">
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <div>
        <p class="font-medium">Session Error</p>
        <p class="text-sm">${message}</p>
        <p class="text-xs mt-1">Logging out automatically...</p>
      </div>
    </div>
  `;
  document.body.appendChild(notification);

  // Remove notification after 5 seconds
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

function handleAutoLogout(reason: string): void {
  console.log(`🚪 Auto logout triggered: ${reason}`);

  // Clear health check interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // Stop QR polling
  stopQRPolling();

  // Close SSE connection
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }

  // Clear local storage
  localStorage.removeItem('telegram_session_id');
  localStorage.removeItem('telegram_user_info');
  localStorage.removeItem('telegram_user_id');

  // Reset state
  currentSessionId = null;
  currentPhoneCodeHash = null;
  currentPhoneNumber = null;

  // Show login form
  showLoginForm();

  // Update connection status
  updateConnectionStatus('Disconnected - Session Invalid', false);
}

function stopSessionHealthCheck(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log(`🏥 Stopped session health monitoring`);
  }
}

// Connection status functions
function updateConnectionStatus(status: string, isConnected: boolean): void {
  if (connectionStatus && connectionIndicator) {
    connectionStatus.textContent = status;
    if (isConnected) {
      connectionIndicator.className = 'w-2 h-2 rounded-full bg-green-500';
    } else {
      connectionIndicator.className = 'w-2 h-2 rounded-full bg-red-500';
    }
  }

  // Update global connection status
  if (typeof (window as any).updateConnectionStatus === 'function') {
    (window as any).updateConnectionStatus(status, isConnected);
  }
}

// NOTE: This function is also disabled since message handling is done by React components
// function addMessageToList(telegramMessage: any): void {
//   if (!messagesList || !messageCount) return;

//   const messageElement = document.createElement('div');
//   const isFromUser = telegramMessage.fromId === parseInt(localStorage.getItem('telegram_user_id') || '0');

//   messageElement.className = `flex ${isFromUser ? 'justify-end' : 'justify-start'}`;
//   messageElement.innerHTML = `
//     <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
//       isFromUser
//         ? 'bg-blue-600 text-white'
//         : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
//     }">
//       ${!isFromUser ? `
//         <div class="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">
//           ${telegramMessage.chatTitle || telegramMessage.fromName || 'Unknown'}
//         </div>
//       ` : ''}
//       <p class="text-sm">${telegramMessage.text}</p>
//       <p class="text-xs mt-1 ${
//         isFromUser
//           ? 'text-blue-100'
//           : 'text-gray-500 dark:text-gray-400'
//       }">
//         ${new Date(telegramMessage.date).toLocaleTimeString()}
//       </p>
//     </div>
//   `;

//   // Remove "no messages" placeholder if it exists
//   const placeholder = messagesList.querySelector('.text-center');
//   if (placeholder) {
//     placeholder.remove();
//   }

//   messagesList.insertBefore(messageElement, messagesList.firstChild);

//   // Update message count
//   const currentCount = parseInt(messageCount.textContent || '0') || 0;
//   messageCount.textContent = (currentCount + 1).toString();
// }

// Login method switching
function switchToSMSLogin(): void {
  currentLoginMethod = 'sms';

  if (smsLoginTab && qrLoginTab && phoneForm && qrForm && formTitle && formDescription) {
    // Update tab styles
    smsLoginTab.className = 'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm';
    qrLoginTab.className = 'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';

    // Show SMS form, hide QR form
    phoneForm.classList.remove('hidden');
    qrForm.classList.add('hidden');

    // Update title and description
    formTitle.textContent = 'Login to Telegram';
    formDescription.textContent = 'Enter your phone number to receive a verification code';

    // Stop QR polling if active
    stopQRPolling();
    hideError();
  }
}

function switchToQRLogin(): void {
  currentLoginMethod = 'qr';

  if (smsLoginTab && qrLoginTab && phoneForm && qrForm && formTitle && formDescription) {
    // Update tab styles
    qrLoginTab.className = 'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm';
    smsLoginTab.className = 'flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';

    // Show QR form, hide SMS forms
    qrForm.classList.remove('hidden');
    phoneForm.classList.add('hidden');
    if (codeForm) codeForm.classList.add('hidden');

    // Update title and description
    formTitle.textContent = 'QR Code Login';
    formDescription.textContent = 'Scan the QR code with your Telegram app';

    hideError();
    generateAndShowQRCode();
  }
}

// Authentication flow functions
function showPhoneForm(): void {
  if (phoneForm && codeForm && qrForm && formTitle && formDescription) {
    phoneForm.classList.remove('hidden');
    codeForm.classList.add('hidden');
    qrForm.classList.add('hidden');
    formTitle.textContent = 'Login to Telegram';
    formDescription.textContent = 'Enter your phone number to receive a verification code';
    hideError();
  }
}

function showCodeForm(phoneNumber: string): void {
  if (phoneForm && codeForm && formTitle && formDescription && codeInput) {
    phoneForm.classList.add('hidden');
    codeForm.classList.remove('hidden');
    formTitle.textContent = 'Enter Verification Code';
    formDescription.textContent = `We sent a code to ${phoneNumber}`;
    hideError();
    codeInput.focus();
  }
}

function showLoginForm(): void {
  if (loginContainer && dashboardContainer && sessionSelectorContainer) {
    loginContainer.classList.remove('hidden');
    dashboardContainer.classList.add('hidden');
    sessionSelectorContainer.classList.add('hidden');

    // Default to SMS login
    switchToSMSLogin();
  }
}

// QR Code functions
async function generateAndShowQRCode(): Promise<void> {
  if (!qrLoading || !qrCanvas || !qrInstructions || !qrStatus) return;

  try {
    // Show loading state
    qrLoading.classList.remove('hidden');
    qrCanvas.classList.add('hidden');
    qrInstructions.classList.add('hidden');
    qrRefreshBtn?.classList.add('hidden');

    console.log('🔲 Generating QR code...');

    const response = await generateQRCode();

    if (response.success && response.token && response.sessionId) {
      // Generate QR code image with proper Telegram format
      const QRCode = (await import('qrcode')).default;
      // Use the proper Telegram QR login URL format
      await QRCode.toCanvas(qrCanvas, `tg://login?token=${response.token}`, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Update UI
      qrLoading.classList.add('hidden');
      qrCanvas.classList.remove('hidden');
      qrInstructions.classList.remove('hidden');

      // Store session ID and start polling
      currentSessionId = response.sessionId;
      startQRPolling(response.sessionId);

      // Set automatic regeneration based on Telegram's expiry time
      // expires is a Unix timestamp in seconds, convert to Date
      const expiryDate = response.expires ? new Date(response.expires * 1000) : undefined;
      startQRCountdown(expiryDate);
      const expiryTime = response.expires ? (response.expires * 1000) - Date.now() : 30000;
      qrExpiryTimeout = window.setTimeout(() => {
        console.log('⏰ QR code auto-expiry - regenerating');
        if (currentLoginMethod === 'qr' && qrForm && !qrForm.classList.contains('hidden')) {
          generateAndShowQRCode();
        }
      }, Math.max(expiryTime, 5000)); // At least 5 seconds

      console.log(`✅ QR code generated for session ${response.sessionId}`);

    } else {
      throw new Error(response.message || 'Failed to generate QR code');
    }

  } catch (error) {
    console.error('Error generating QR code:', error);
    showError(error instanceof Error ? error.message : 'Failed to generate QR code');

    // Show refresh button
    qrLoading.classList.add('hidden');
    qrRefreshBtn?.classList.remove('hidden');
  }
}

function startQRPolling(sessionId: string): void {
  // Clear any existing polling
  stopQRPolling();

  console.log(`🔄 Starting QR status polling for session ${sessionId}`);

  // Poll every 2 seconds
  qrStatusInterval = window.setInterval(async () => {
    try {
      const statusResponse = await checkQRStatus(sessionId);

      if (statusResponse.success && statusResponse.authenticated) {
        console.log('🎉 QR login successful!');

        // Stop polling
        stopQRPolling();

        // Store session info
        localStorage.setItem('telegram_session_id', statusResponse.sessionId || sessionId);
        localStorage.setItem('telegram_user_info', JSON.stringify(statusResponse.userInfo));

        // Show dashboard
        showDashboard(statusResponse.sessionId || sessionId, statusResponse.userInfo);

      } else if (statusResponse.expired) {
        console.log('❌ QR code expired - regenerating automatically');
        stopQRPolling();

        // Show regenerating status
        if (qrStatus) {
          qrStatus.innerHTML = `
            <div class="flex items-center justify-center">
              <svg class="animate-spin h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm text-blue-700 dark:text-blue-300">
                QR expired - generating new code...
              </span>
            </div>
          `;
        }

        // Automatically regenerate after a short delay
        setTimeout(() => {
          generateAndShowQRCode();
        }, 1000);

      } else {
        // Still waiting
        console.log('⏳ Still waiting for QR scan...');
      }

    } catch (error) {
      console.error('Error checking QR status:', error);
      stopQRPolling();
      showError('Connection error. Please try again.');
    }
  }, 2000);
}

function startQRCountdown(expiryTime?: Date): void {
  // Calculate time left based on expiry time or default to 30 seconds
  const now = Date.now();
  const expiry = expiryTime ? expiryTime.getTime() : now + 30000;
  let timeLeft = Math.max(Math.floor((expiry - now) / 1000), 0);

  // Update status immediately
  updateQRCountdownStatus(timeLeft);

  qrCountdownInterval = window.setInterval(() => {
    const currentTime = Date.now();
    timeLeft = Math.max(Math.floor((expiry - currentTime) / 1000), 0);
    updateQRCountdownStatus(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(qrCountdownInterval!);
      qrCountdownInterval = null;
    }
  }, 1000);
}

function updateQRCountdownStatus(timeLeft: number): void {
  if (qrStatus) {
    qrStatus.innerHTML = `
      <div class="flex items-center justify-center">
        <svg class="animate-pulse h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-sm text-blue-700 dark:text-blue-300">
          Waiting for scan... (${timeLeft}s)
        </span>
      </div>
    `;
  }
}

function stopQRPolling(): void {
  if (qrStatusInterval) {
    clearInterval(qrStatusInterval);
    qrStatusInterval = null;
    console.log('🛑 Stopped QR polling');
  }

  if (qrExpiryTimeout) {
    clearTimeout(qrExpiryTimeout);
    qrExpiryTimeout = null;
    console.log('🛑 Stopped QR expiry timer');
  }

  if (qrCountdownInterval) {
    clearInterval(qrCountdownInterval);
    qrCountdownInterval = null;
    console.log('🛑 Stopped QR countdown');
  }
}

function showDashboard(sessionId: string, userData: any): void {
  if (loginContainer && dashboardContainer && sessionSelectorContainer && userInfo && sessionInfo && userDetails) {
    loginContainer.classList.add('hidden');
    dashboardContainer.classList.remove('hidden');
    sessionSelectorContainer.classList.add('hidden');

    // Update user info
    userInfo.innerHTML = `
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Welcome, ${userData.firstName || 'User'}!
      </h1>
    `;
    sessionInfo.textContent = `Session ID: ${sessionId}`;
    userDetails.textContent = `Logged in as ${userData.firstName} ${userData.lastName || ''}${userData.username ? ` (@${userData.username})` : ''}`;

    // Store user ID for message comparison
    localStorage.setItem('telegram_user_id', userData.id.toString());

    // NOTE: SSE connection is now handled by the React ChatInterface component
    // connectSSE(sessionId); // DISABLED to prevent duplicate connections

    // Start session health monitoring (only for real sessions, not mock ones)
    // Mock sessions have user ID 999
    if (userData.id !== 999) {
      startSessionHealthCheck(sessionId);
    } else {
      console.log(`🎭 Skipping health check for mock session ${sessionId}`);
    }

    // Show chat interface
    showChatInterface(sessionId, userData);
  }
}

function showChatInterface(sessionId: string, _userData: any): void {
  // Hide login form
  const loginContainer = document.getElementById('login-container');
  if (loginContainer) {
    loginContainer.style.display = 'none';
  }

  // Show chat container
  const chatContainer = document.getElementById('chat-container');
  if (chatContainer) {
    chatContainer.style.display = 'block';
  }

  // Load chat list
  loadChatList(sessionId);

  console.log(`🎨 Chat interface shown for session ${sessionId}`);
}

async function loadChatList(sessionId: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${sessionId}`);
    const data = await response.json();

    if (data.success) {
      const chatListContainer = document.getElementById('chat-list');
      if (chatListContainer) {
        chatListContainer.innerHTML = '';

        data.chats.forEach((chat: any) => {
          const chatElement = document.createElement('div');
          chatElement.className = 'p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded-md border border-gray-200 dark:border-gray-600';
          chatElement.innerHTML = `
            <div class="flex items-center space-x-3">
              <div class="flex-1">
                <h3 class="font-medium text-gray-900 dark:text-white">${chat.title}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 truncate">${chat.lastMessage?.text || 'No messages'}</p>
              </div>
              ${chat.unreadCount > 0 ? `<span class="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">${chat.unreadCount}</span>` : ''}
            </div>
          `;

          chatElement.addEventListener('click', () => {
            loadChatMessages(sessionId, chat.id, chat.title);
          });

          chatListContainer.appendChild(chatElement);
        });
      }
    }
  } catch (error) {
    console.error('Error loading chat list:', error);
  }
}

async function loadChatMessages(sessionId: string, chatId: number, chatTitle: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chats/${sessionId}/${chatId}/messages`);
    const data = await response.json();

    if (data.success) {
      const chatViewContainer = document.getElementById('chat-view-container');
      if (chatViewContainer) {
        chatViewContainer.innerHTML = `
          <div class="h-full flex flex-col">
            <div class="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">${chatTitle}</h2>
            </div>
            <div class="flex-1 overflow-y-auto p-4 space-y-4" id="messages-container">
              ${data.messages.map((message: any) => `
                <div class="flex ${message.isOutgoing ? 'justify-end' : 'justify-start'}">
                  <div class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.isOutgoing
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }">
                    <p class="text-sm">${message.text}</p>
                    <p class="text-xs mt-1 opacity-75">${new Date(message.date).toLocaleTimeString()}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading chat messages:', error);
  }
}



// Event handlers
function setupEventListeners(): void {
  // Login method tabs
  smsLoginTab?.addEventListener('click', () => {
    switchToSMSLogin();
  });

  qrLoginTab?.addEventListener('click', () => {
    switchToQRLogin();
  });

  // QR refresh button
  qrRefreshBtn?.addEventListener('click', () => {
    generateAndShowQRCode();
  });

  // Phone form submission
  phoneForm?.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError();

    const phoneNumber = phoneInput?.value.trim() || '';
    if (!phoneNumber) {
      showError('Please enter a phone number');
      return;
    }

    setLoading(sendCodeBtn, true, 'Send Verification Code');

    try {
      const response = await sendCode(phoneNumber);

      if (response.success) {
        currentPhoneCodeHash = response.phoneCodeHash || null;
        currentSessionId = response.sessionId || null;
        currentPhoneNumber = phoneNumber;
        showCodeForm(phoneNumber);
      } else {
        showError(response.message || 'Failed to send verification code');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setLoading(sendCodeBtn, false, 'Send Verification Code');
    }
  });

  // Code form submission
  codeForm?.addEventListener('submit', async function(e) {
    e.preventDefault();
    hideError();

    const code = codeInput?.value.trim() || '';
    if (!code || code.length !== 5) {
      showError('Please enter a valid 5-digit code');
      return;
    }

    if (!currentPhoneNumber || !currentPhoneCodeHash || !currentSessionId) {
      showError('Session expired. Please start over.');
      return;
    }

    setLoading(verifyCodeBtn, true, 'Verify Code');

    try {
      const response = await verifyCode(currentPhoneNumber, code, currentPhoneCodeHash, currentSessionId);

      if (response.success) {
        // Store session info
        localStorage.setItem('telegram_session_id', response.sessionId || '');
        localStorage.setItem('telegram_user_info', JSON.stringify(response.userInfo));

        showDashboard(response.sessionId || '', response.userInfo);
      } else {
        showError(response.message || 'Invalid verification code');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to verify code');
    } finally {
      setLoading(verifyCodeBtn, false, 'Verify Code');
    }
  });

  // Back button
  backBtn?.addEventListener('click', function() {
    showPhoneForm();
    if (codeInput) codeInput.value = '';
  });

  // Logout button
  logoutBtn?.addEventListener('click', async function() {
    try {
      if (currentSessionId) {
        await deleteSession(currentSessionId);
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Stop health monitoring
      stopSessionHealthCheck();

      // Stop QR polling
      stopQRPolling();

      // Clear local storage
      localStorage.removeItem('telegram_session_id');
      localStorage.removeItem('telegram_user_info');
      localStorage.removeItem('telegram_user_id');

      // Close SSE connection
      if (sseConnection) {
        sseConnection.close();
        sseConnection = null;
      }

      // Reset state
      currentSessionId = null;
      currentPhoneCodeHash = null;
      currentPhoneNumber = null;

      // Show login form
      showLoginForm();
    }
  });

  // Only allow numbers in code input
  codeInput?.addEventListener('input', function(e) {
    const target = e.target as HTMLInputElement;
    target.value = target.value.replace(/\D/g, '');
  });

  // Test updates button
  testUpdatesBtn?.addEventListener('click', async function() {
    if (!currentSessionId) {
      console.log('No active session for testing');
      return;
    }

    console.log('🧪 Testing updates...');
    setLoading(testUpdatesBtn, true, 'Test Updates');

    try {
      const response = await fetch(`/api/test-updates/${currentSessionId}`, {
        method: 'POST'
      });

      const result = await response.json();
      console.log('Test result:', result);

      if (result.success) {
        console.log('✅ Test completed successfully');
      } else {
        console.error('❌ Test failed:', result.message);
      }
    } catch (error) {
      console.error('❌ Test error:', error);
    } finally {
      setLoading(testUpdatesBtn, false, 'Test Updates');
    }
  });
}

// Check if user is already logged in
async function checkAuthState(): Promise<void> {
  console.log('🔍 Checking authentication state...');

  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.log('❌ Not in browser environment, skipping auth check');
    return;
  }

  const sessionId = localStorage.getItem('telegram_session_id');
  const userInfo = localStorage.getItem('telegram_user_info');

  console.log('📱 localStorage check:', { sessionId: !!sessionId, userInfo: !!userInfo });

  if (sessionId && userInfo) {
    try {
      const userData = JSON.parse(userInfo);
      currentSessionId = sessionId;

      // Verify session is still valid on the backend
      const healthResponse = await checkSessionHealth(sessionId);
      if (healthResponse.success && healthResponse.healthy) {
        showDashboard(sessionId, userData);
        return;
      } else {
        console.log('🔄 Stored session is no longer valid, clearing localStorage');
        localStorage.removeItem('telegram_session_id');
        localStorage.removeItem('telegram_user_info');
        localStorage.removeItem('telegram_user_id');
      }
    } catch (error) {
      console.error('Error parsing user info:', error);
      localStorage.removeItem('telegram_session_id');
      localStorage.removeItem('telegram_user_info');
      localStorage.removeItem('telegram_user_id');
    }
  }

  // No valid session in localStorage, check if there are any sessions in the database
  await checkForAvailableSessions();
}

// Check for available sessions in the database
async function checkForAvailableSessions(): Promise<void> {
  try {
    console.log('🔍 Checking for available sessions in database...');
    const data = await listSessions();
    console.log('📊 Sessions API response:', data);

    if (data.success && data.sessions && data.sessions.length > 0) {
      console.log(`✅ Found ${data.sessions.length} available sessions`);
      showSessionSelection(data.sessions);
    } else {
      console.log('📝 No available sessions found, showing login form');
      showLoginForm();
    }
  } catch (error) {
    console.error('❌ Error checking for available sessions:', error);
    showLoginForm();
  }
}

// Show session selection interface
function showSessionSelection(sessions: any[]): void {
  console.log('🎯 Showing session selection with', sessions.length, 'sessions');
  console.log('📦 DOM elements:', {
    loginContainer: !!loginContainer,
    dashboardContainer: !!dashboardContainer,
    sessionSelectorContainer: !!sessionSelectorContainer
  });

  if (loginContainer && dashboardContainer && sessionSelectorContainer) {
    // Hide other containers
    loginContainer.classList.add('hidden');
    dashboardContainer.classList.add('hidden');

    // Show session selector
    sessionSelectorContainer.classList.remove('hidden');
    console.log('✅ Session selector container shown');

    // Create session selection UI
    const sessionSelectionHtml = `
      <div class="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div class="text-center mb-6">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
            Select Session
          </h2>
          <p class="text-gray-600 dark:text-gray-400 mt-2">
            Choose an existing session to continue
          </p>
        </div>

        <div class="space-y-3 mb-6">
          ${sessions.map(session => `
            <button
              class="session-select-btn w-full p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              data-session-id="${session.sessionId}"
              data-user-info='${JSON.stringify(session.userInfo)}'
            >
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                  ${session.userInfo.firstName?.charAt(0) || '?'}
                </div>
                <div class="flex-1">
                  <div class="font-medium text-gray-900 dark:text-white">
                    ${session.userInfo.firstName || 'Unknown'} ${session.userInfo.lastName || ''}
                  </div>
                  <div class="text-sm text-gray-500 dark:text-gray-400">
                    ${session.phoneNumber}${session.userInfo.username ? ` • @${session.userInfo.username}` : ''}
                  </div>
                  <div class="text-xs text-gray-400 dark:text-gray-500">
                    Last active: ${new Date(session.lastActive).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </button>
          `).join('')}
        </div>

        <div class="text-center">
          <button
            id="new-session-btn"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            Create New Session
          </button>
        </div>
      </div>
    `;

    if (sessionSelectorContainer) {
      sessionSelectorContainer.innerHTML = sessionSelectionHtml;

      // Add event listeners for session selection
      const sessionButtons = sessionSelectorContainer.querySelectorAll('.session-select-btn');
      sessionButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
          const target = e.currentTarget as HTMLElement;
          const sessionId = target.getAttribute('data-session-id');
          const userInfoStr = target.getAttribute('data-user-info');

          if (sessionId && userInfoStr) {
            try {
              const userInfo = JSON.parse(userInfoStr);
              await restoreSession(sessionId, userInfo);
            } catch (error) {
              console.error('Error restoring session:', error);
              showError('Failed to restore session');
            }
          }
        });
      });

      // Add event listener for new session button
      const newSessionBtn = sessionSelectorContainer.querySelector('#new-session-btn');
      newSessionBtn?.addEventListener('click', () => {
        showLoginForm();
      });
    }
  }
}

// Restore a session from the database
async function restoreSession(sessionId: string, userInfo: any): Promise<void> {
  try {
    console.log(`🔄 Restoring session ${sessionId}...`);

    // Verify session health
    const healthResponse = await checkSessionHealth(sessionId);

    if (healthResponse.success && healthResponse.healthy) {
      // Store session info in localStorage
      localStorage.setItem('telegram_session_id', sessionId);
      localStorage.setItem('telegram_user_info', JSON.stringify(userInfo));
      localStorage.setItem('telegram_user_id', userInfo.id.toString());

      // Set current session
      currentSessionId = sessionId;

      // Show dashboard
      showDashboard(sessionId, userInfo);

      console.log(`✅ Session ${sessionId} restored successfully`);
    } else {
      throw new Error(healthResponse.message || 'Session is not healthy');
    }
  } catch (error) {
    console.error(`❌ Error restoring session ${sessionId}:`, error);
    showError(`Failed to restore session: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Export the initialization function
export function initializeApp(): void {
  console.log('🚀 Initializing MTProto app...');
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 DOM Content Loaded');

    // Clean up any existing SSE connections to prevent duplicates
    if (sseConnection) {
      console.log('🧹 Cleaning up existing SSE connection');
      sseConnection.close();
      sseConnection = null;
    }

    initializeDOMElements();
    setupEventListeners();
    await checkAuthState();
  });
}
