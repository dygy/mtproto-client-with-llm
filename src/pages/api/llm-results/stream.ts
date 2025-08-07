// @ts-nocheck
import type { APIRoute } from 'astro';

// Store for LLM result stream clients
const llmStreamClients = new Map<string, {
  controller: ReadableStreamDefaultController;
  filters: {
    sessionId?: string;
    chatId?: string;
    userId?: string;
    provider?: string;
    model?: string;
  };
  lastPing: Date;
  isClosed: boolean;
}>();

// Cleanup closed connections every 30 seconds
setInterval(() => {
  const now = new Date();
  const toRemove: string[] = [];
  
  llmStreamClients.forEach((client, clientId) => {
    // Remove clients that haven't been pinged in 2 minutes or are closed
    if (client.isClosed || (now.getTime() - client.lastPing.getTime()) > 120000) {
      toRemove.push(clientId);
    }
  });
  
  toRemove.forEach(clientId => {
    llmStreamClients.delete(clientId);
  });
  
  if (toRemove.length > 0) {
    console.log(`🧹 Cleaned up ${toRemove.length} LLM stream clients`);
  }
}, 30000);

export const GET: APIRoute = async ({ url }) => {
  const searchParams = new URL(url).searchParams;
  
  // Extract filters from query parameters
  const filters = {
    sessionId: searchParams.get('sessionId') || undefined,
    chatId: searchParams.get('chatId') || undefined,
    userId: searchParams.get('userId') || undefined,
    provider: searchParams.get('provider') || undefined,
    model: searchParams.get('model') || undefined,
  };

  const clientId = `llm_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`📡 New LLM results stream client: ${clientId}`, filters);

  const stream = new ReadableStream({
    start(controller) {
      // Store client with filters
      llmStreamClients.set(clientId, {
        controller,
        filters,
        lastPing: new Date(),
        isClosed: false
      });

      // Send initial connection message
      const initialMessage = {
        type: 'connected',
        clientId,
        filters,
        timestamp: new Date().toISOString()
      };

      try {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(initialMessage)}\n\n`));
      } catch (error) {
        console.error('Error sending initial message:', error);
      }

      // Send periodic ping to keep connection alive
      const pingInterval = setInterval(() => {
        const client = llmStreamClients.get(clientId);
        if (!client || client.isClosed) {
          clearInterval(pingInterval);
          return;
        }

        try {
          const pingMessage = {
            type: 'ping',
            timestamp: new Date().toISOString()
          };
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(pingMessage)}\n\n`));
          client.lastPing = new Date();
        } catch (error) {
          console.error('Error sending ping:', error);
          client.isClosed = true;
          clearInterval(pingInterval);
        }
      }, 30000); // Ping every 30 seconds
    },

    cancel() {
      console.log(`📡 LLM stream client disconnected: ${clientId}`);
      const client = llmStreamClients.get(clientId);
      if (client) {
        client.isClosed = true;
        llmStreamClients.delete(clientId);
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    }
  });
};

// Function to broadcast LLM result to stream clients
export function broadcastLLMResult(result: {
  id: number;
  messageId: number;
  chatId: number;
  sessionId?: string;
  userId: number;
  provider: string;
  model: string;
  response: string;
  prompt?: string;
  processingTime: number;
  chatTitle?: string;
  createdAt: string;
}) {
  if (llmStreamClients.size === 0) {
    return; // No clients to broadcast to
  }

  const message = {
    type: 'llm_result',
    data: result,
    timestamp: new Date().toISOString()
  };

  const messageData = `data: ${JSON.stringify(message)}\n\n`;
  const failedClients: string[] = [];

  llmStreamClients.forEach((client, clientId) => {
    // Check if result matches client filters
    const { filters } = client;
    
    if (filters.sessionId && result.sessionId !== filters.sessionId) return;
    if (filters.chatId && result.chatId.toString() !== filters.chatId) return;
    if (filters.userId && result.userId.toString() !== filters.userId) return;
    if (filters.provider && result.provider !== filters.provider) return;
    if (filters.model && result.model !== filters.model) return;

    // Skip already closed clients
    if (client.isClosed) {
      failedClients.push(clientId);
      return;
    }

    try {
      client.controller.enqueue(new TextEncoder().encode(messageData));
      client.lastPing = new Date();
    } catch (error) {
      console.error(`Error broadcasting to client ${clientId}:`, error);
      client.isClosed = true;
      failedClients.push(clientId);
    }
  });

  // Remove failed clients
  failedClients.forEach(clientId => {
    llmStreamClients.delete(clientId);
  });

  if (failedClients.length > 0) {
    console.log(`🧹 Removed ${failedClients.length} failed LLM stream clients`);
  }
}

// Export client count for monitoring
export function getLLMStreamClientCount(): number {
  return llmStreamClients.size;
}
