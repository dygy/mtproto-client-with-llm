// @ts-nocheck
import type { APIRoute } from 'astro';
import { getSession } from '../../../../lib/session-store.js';

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const { sessionId } = params;
    const { chatId, pin } = await request.json();

    if (!sessionId || !chatId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session ID and Chat ID are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const sessionData = await getSession(sessionId);
    if (!sessionData || !sessionData.isAuthenticated || !sessionData.client) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Session not found or not authenticated'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { client } = sessionData;

    try {
      // Get the chat entity
      const dialogs = await client.getDialogs({ limit: 100 });
      const targetDialog = dialogs.find((dialog: any) =>
        dialog.entity.id?.toJSNumber()?.toString() === chatId
      );

      if (!targetDialog) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Chat not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { Api } = await import('telegram');
      const { utils } = await import('telegram');

      // Create proper InputPeer based on entity type
      let inputPeer;
      const entity = targetDialog.entity;

      if (entity.className === 'User') {
        inputPeer = new Api.InputPeerUser({
          userId: entity.id,
          accessHash: entity.accessHash || 0n
        });
      } else if (entity.className === 'Channel') {
        inputPeer = new Api.InputPeerChannel({
          channelId: entity.id,
          accessHash: entity.accessHash || 0n
        });
      } else if (entity.className === 'Chat') {
        inputPeer = new Api.InputPeerChat({
          chatId: entity.id
        });
      } else {
        // Fallback: try to get InputPeer using utils
        inputPeer = utils.getInputPeer(entity);
      }

      console.log(`📌 Toggling pin for ${entity.className}: ${targetDialog.title}`);

      // Pin or unpin the dialog using Telegram API
      await client.invoke(
        new Api.messages.ToggleDialogPin({
          peer: inputPeer,
          pinned: pin
        })
      );

      console.log(`📌 ${pin ? 'Pinned' : 'Unpinned'} chat ${targetDialog.title}`);

      return new Response(JSON.stringify({
        success: true,
        message: `Chat ${pin ? 'pinned' : 'unpinned'} successfully`,
        isPinned: pin
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('❌ Error toggling pin:', error);
      return new Response(JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to toggle pin'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Error in pin endpoint:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

