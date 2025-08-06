// @ts-nocheck
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url }) => {
  const sessionId = url.searchParams.get('sessionId');
  const chatId = url.searchParams.get('chatId');
  const messageId = url.searchParams.get('messageId');

  if (!sessionId || !chatId) {
    return new Response(JSON.stringify({
      success: false,
      message: 'sessionId and chatId are required'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Test 1: Check if LLM results API works
    const llmResultsResponse = await fetch(`http://localhost:3001/api/llm-results/${sessionId}/${chatId}`);
    const llmResultsData = await llmResultsResponse.json();

    // Test 2: Check if specific message has result
    let messageHasResult = false;
    let messageResult = null;
    if (messageId && llmResultsData.success && llmResultsData.results) {
      messageHasResult = !!llmResultsData.results[messageId];
      messageResult = llmResultsData.results[messageId];
    }

    // Test 3: Get LLM status
    const statusResponse = await fetch(`http://localhost:3001/api/llm-status/${sessionId}/${chatId}`);
    const statusData = await statusResponse.json();

    return new Response(JSON.stringify({
      success: true,
      tests: {
        llmResultsAPI: {
          working: llmResultsResponse.ok,
          status: llmResultsResponse.status,
          hasResults: llmResultsData.success && Object.keys(llmResultsData.results || {}).length > 0,
          resultCount: Object.keys(llmResultsData.results || {}).length,
          messageIds: Object.keys(llmResultsData.results || {})
        },
        specificMessage: messageId ? {
          messageId,
          hasResult: messageHasResult,
          result: messageResult
        } : null,
        llmStatus: {
          working: statusResponse.ok,
          status: statusResponse.status,
          llmEnabled: statusData.success ? statusData.data.chatSettings?.llmEnabled : false,
          totalProcessed: statusData.success ? statusData.data.statistics?.totalProcessed : 0
        }
      },
      rawData: {
        llmResults: llmResultsData,
        llmStatus: statusData
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: error instanceof Error ? error.message : 'Test failed',
      error: error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
