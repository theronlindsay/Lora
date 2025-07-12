// Updated Cloudflare Worker for OpenAI Prompt/Response API
export default {
  async fetch(request, env, ctx) {
    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const requestBody = await request.json();
      
      // Construct the request for OpenAI's responses.create API
      const openaiRequest = {
        prompt: {
          id: requestBody.prompt.id,
          version: requestBody.prompt.version || "3"
        }
      };

      // For prompt-based models, we need to format the conversation history differently
      // Convert messages to a single input string that the prompt can work with
      if (requestBody.messages && requestBody.messages.length > 0) {
        // Format conversation history as a string
        const conversationHistory = requestBody.messages
          .filter(msg => msg.role === 'user') // Only include user messages for input
          .map(msg => msg.content)
          .join('\n\n'); // Join multiple user messages if any
        
        // Add the latest user message as input
        const latestUserMessage = requestBody.messages
          .filter(msg => msg.role === 'user')
          .pop(); // Get the most recent user message
        
        if (latestUserMessage) {
          openaiRequest.input = latestUserMessage.content;
        }
      }

      console.log('Sending to OpenAI:', JSON.stringify(openaiRequest, null, 2)); // Debug log

      // Make the request to OpenAI's responses.create endpoint
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openaiRequest),
      });

      const data = await response.json();
      console.log('OpenAI Response:', JSON.stringify(data, null, 2)); // Debug log
      
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
};
