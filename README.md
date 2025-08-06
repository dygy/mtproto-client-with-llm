# MTProto Telegram Client

A modern Telegram client built with **Astro**, **React**, **Node.js**, and **TypeScript** using the **GramJS** MTProto library. Features real-time message updates, SMS authentication, and a responsive dark mode interface.

## Features

- 🔐 **SMS Authentication** - Login with phone number and verification code
- 📱 **Real-time Updates** - Live message updates via WebSocket
- 🌙 **Dark Mode** - Automatic theme switching with system preference
- 🌍 **i18n Ready** - Built with internationalization support
- ↔️ **RTL Support** - Right-to-left language support
- 📱 **Responsive Design** - Works on desktop and mobile
- 🔒 **Session Management** - Persistent login sessions
- ⚡ **Server-Side Rendering** - Fast initial page loads with Astro

## Tech Stack

### Frontend
- **Astro** - Static site generator with SSR
- **React** - UI components
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling and responsive design

### Backend
- **Astro API Routes** - Server-side API endpoints
- **GramJS** - MTProto Telegram client library
- **Node.js** - Runtime environment

## Prerequisites

- Node.js 18+ 
- Telegram API credentials (API ID and API Hash)

## Setup Instructions

### 1. Get Telegram API Credentials

1. Go to [https://my.telegram.org/apps](https://my.telegram.org/apps)
2. Log in with your Telegram account
3. Create a new application
4. Note down your `API ID` and `API Hash`

### 2. Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd mtproto-telegram-client

# Install dependencies
npm install
```

### 3. Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your credentials
nano .env
```

Update the `.env` file with your Telegram API credentials:

```env
TELEGRAM_API_ID=your_api_id_here
TELEGRAM_API_HASH=your_api_hash_here
PORT=4000
PUBLIC_API_URL=http://localhost:4000/api
PUBLIC_WS_URL=ws://localhost:4000/ws
FRONTEND_URL=http://localhost:3000
```

### 4. Development

```bash
# Start the Astro development server (includes API routes)
npm run dev
```

The application will be available at http://localhost:3001

### 5. Production Build

```bash
# Build both frontend and backend
npm run build

# Start production server
npm start
```

## Usage

1. **Open your browser** and navigate to `http://localhost:3000`
2. **Enter your phone number** (include country code, e.g., +1234567890)
3. **Check your phone** for the verification code from Telegram
4. **Enter the verification code** to complete authentication
5. **View your messages** in real-time on the dashboard

## Project Structure

```
├── src/
│   ├── components/          # React components only
│   │   ├── AuthManager.tsx  # Authentication management
│   │   ├── ChatInterface.tsx # Chat interface component
│   │   ├── LoginForm.tsx    # SMS authentication form
│   │   └── MessageList.tsx  # Real-time message display
│   ├── layouts/            # Astro layout components
│   │   ├── Layout.astro    # Base layout with theme toggle
│   │   └── ChatLayout.astro # Full-screen chat layout
│   ├── lib/                # Utility libraries
│   │   ├── api.ts          # API client and storage helpers
│   │   └── websocket.ts    # WebSocket client
│   ├── pages/              # Astro pages
│   │   ├── index.astro     # Main page with session selection
│   │   └── chat.astro      # Chat interface page
│   ├── server/             # Backend server code
│   │   ├── index.ts        # Express server setup
│   │   ├── telegram-client.ts # GramJS wrapper
│   │   ├── session-manager.ts # Session storage
│   │   ├── websocket.ts    # WebSocket server
│   │   └── types.ts        # TypeScript interfaces
│   └── styles/
│       └── global.css      # Global styles with dark mode
├── sessions/               # Session storage directory
├── package.json
├── tsconfig.json
├── astro.config.mjs
└── tailwind.config.mjs
```

## API Endpoints

### Authentication
- `POST /api/auth/send-code` - Send SMS verification code
- `POST /api/auth/verify-code` - Verify SMS code and authenticate

### Session Management
- `GET /api/session/:sessionId` - Get session information
- `DELETE /api/session/:sessionId` - Delete session

### Messages
- `GET /api/messages/:sessionId` - Get recent messages

### Health Check
- `GET /api/health` - Server health status

## WebSocket Events

### Client → Server
```json
{ "type": "subscribe", "sessionId": "session_id" }
{ "type": "unsubscribe", "sessionId": "session_id" }
{ "type": "ping" }
```

### Server → Client
```json
{ "type": "message", "data": { "id": 1, "text": "Hello", ... }, "timestamp": "..." }
{ "type": "auth", "data": { "isAuthenticated": true, "userInfo": {...} }, "timestamp": "..." }
{ "type": "status", "data": { "status": "connected" }, "timestamp": "..." }
{ "type": "error", "data": { "message": "Error message" }, "timestamp": "..." }
```

## Features in Detail

### Authentication Flow
1. User enters phone number
2. Server sends verification code via Telegram
3. User enters received code
4. Server validates and creates session
5. Session stored locally and on server

### Real-time Updates
- WebSocket connection established after authentication
- Server listens for Telegram updates via GramJS
- New messages broadcast to connected clients
- Automatic reconnection on connection loss

### Session Management
- Sessions stored in JSON files
- Telegram session strings preserved for reconnection
- Automatic session validation
- Graceful logout and cleanup

### Dark Mode
- System preference detection
- Manual toggle available
- Persistent user preference
- Smooth transitions

### Responsive Design
- Mobile-first approach
- Flexible layouts
- Touch-friendly interactions
- Optimized for various screen sizes

## Troubleshooting

### Common Issues

**"Invalid phone number" error:**
- Ensure you include the country code (e.g., +1 for US)
- Use the international format

**"Session not found" error:**
- Check if the session files exist in the `sessions/` directory
- Verify the session ID in localStorage

**WebSocket connection fails:**
- Check if the backend server is running on port 4000
- Verify firewall settings
- Check browser console for detailed errors

**Messages not loading:**
- Ensure you're authenticated with a valid session
- Check network connectivity
- Verify Telegram API credentials

### Development Tips

- Use browser developer tools to monitor WebSocket connections
- Check server logs for detailed error information
- Session files are stored in the `sessions/` directory
- Clear localStorage to reset authentication state

## Security Considerations

- API credentials should never be committed to version control
- Session files contain sensitive authentication data
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Validate all user inputs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [GramJS](https://gram.js.org/) - MTProto implementation
- [Astro](https://astro.build/) - Static site generator
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
