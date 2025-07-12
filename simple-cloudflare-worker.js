// Simpler Cloudflare Worker without function calling
// This approach enhances the AI's knowledge with search context

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
      
      // Function to perform web search
      async function performWebSearch(query) {
        try {
          // Using a simple search approach - you can replace with your preferred search API
          const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' L\'Oreal')}&format=json&no_html=1&skip_disambig=1`;
          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();
          
          let searchResults = '';
          if (searchData.AbstractText) {
            searchResults += `Current information: ${searchData.AbstractText}\n`;
          }
          if (searchData.RelatedTopics && searchData.RelatedTopics.length > 0) {
            searchResults += 'Additional details:\n';
            searchData.RelatedTopics.slice(0, 2).forEach(topic => {
              if (topic.Text) {
                searchResults += `- ${topic.Text}\n`;
              }
            });
          }
          
          return searchResults;
        } catch (error) {
          console.error('Web search failed:', error);
          return '';
        }
      }

      // Check if the user message seems to need current information
      const lastMessage = requestBody.messages[requestBody.messages.length - 1];
      const needsSearch = lastMessage && lastMessage.role === 'user' && (
        lastMessage.content.toLowerCase().includes('latest') ||
        lastMessage.content.toLowerCase().includes('current') ||
        lastMessage.content.toLowerCase().includes('price') ||
        lastMessage.content.toLowerCase().includes('new') ||
        lastMessage.content.toLowerCase().includes('recent') ||
        lastMessage.content.toLowerCase().includes('available')
      );

      // If search is needed, add search results to the context
      if (needsSearch) {
        const searchResults = await performWebSearch(lastMessage.content);
        if (searchResults) {
          // Add search context to the system message
          const searchContext = `\n\nCurrent web search results for the user's query: ${searchResults}`;
          
          // Find and update the system message
          const systemMessageIndex = requestBody.messages.findIndex(msg => msg.role === 'system');
          if (systemMessageIndex !== -1) {
            requestBody.messages[systemMessageIndex].content += searchContext;
          } else {
            // Add a new system message if none exists
            requestBody.messages.unshift({
              role: 'system',
              content: 'You are a helpful assistant.' + searchContext
            });
          }
        }
      }

      // Remove the tools parameter to avoid the error
      delete requestBody.tools;
      delete requestBody.tool_choice;

      // Make the request to OpenAI
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
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
