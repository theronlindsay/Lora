// Example Cloudflare Worker with web search capability
// This file shows how to enhance your worker to support web search

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
      
      // Check if web search tools are enabled
      const hasWebSearchTool = requestBody.tools && 
        requestBody.tools.some(tool => tool.type === 'function' && tool.function.name === 'web_search');

      // Function to perform web search
      async function performWebSearch(query) {
        try {
          // Using DuckDuckGo Instant Answer API (free, no API key needed)
          const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
          const searchResponse = await fetch(searchUrl);
          const searchData = await searchResponse.json();
          
          // Extract relevant information
          let searchResults = '';
          if (searchData.AbstractText) {
            searchResults += `Summary: ${searchData.AbstractText}\n`;
          }
          if (searchData.RelatedTopics && searchData.RelatedTopics.length > 0) {
            searchResults += 'Related information:\n';
            searchData.RelatedTopics.slice(0, 3).forEach(topic => {
              if (topic.Text) {
                searchResults += `- ${topic.Text}\n`;
              }
            });
          }
          
          return searchResults || 'No specific search results found for this query.';
        } catch (error) {
          console.error('Web search failed:', error);
          return 'Web search is currently unavailable.';
        }
      }

      // Make the initial request to OpenAI
      let response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      let data = await response.json();
      
      // Handle function calls for web search
      if (data.choices[0].message.tool_calls) {
        const toolCalls = data.choices[0].message.tool_calls;
        const functionResults = [];
        
        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'web_search') {
            const searchQuery = JSON.parse(toolCall.function.arguments).query;
            const searchResults = await performWebSearch(searchQuery);
            
            functionResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: searchResults
            });
          }
        }
        
        // If we have function results, make another request with the results
        if (functionResults.length > 0) {
          const messagesWithResults = [
            ...requestBody.messages,
            data.choices[0].message,
            ...functionResults
          ];
          
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...requestBody,
              messages: messagesWithResults
            }),
          });
          
          data = await response.json();
        }
      }
      
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
