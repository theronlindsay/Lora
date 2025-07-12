/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");


//OpenAI configuration variables
// REPLACE with your actual Cloudflare Worker URL
const workerURL = "https://openaibyid.vfncs46hb8.workers.dev/";
const modelString = "pmpt_6871dcca943c8196b38a42c8fdad9841006ebcaad859cfda"; // Use your premade model

// Initialize the message ledger array (no system prompt needed - it's in the model)
const messageLedger = [];

// Function to format text with rich formatting
function formatRichText(text) {
  console.log('Original text:', text); // Debug log
  
  // First, convert **bold** and *italic* BEFORE processing links
  // This prevents formatting from interfering with link structure
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  console.log('After bold/italic:', text); // Debug log
  
  // Now convert markdown-style links [text](url) to clickable links with bold formatting
  // Hide links that only go to lorealparisusa.com without a product path
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(match, linkText, url) {
    // Check if it's a lorealparisusa.com link without a product path
    if (url.includes('lorealparisusa.com') && !url.match(/lorealparisusa\.com\/[^?\s]+/)) {
      // Return just the text without the link for base domain links
      return `<strong>${linkText}</strong>`;
    }
    // For all other links (including product links), make them clickable with product-link styling
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="product-link"><strong>${linkText}</strong></a>`;
  });
  
  console.log('After markdown links:', text); // Debug log
  
  // Convert line breaks to <br>
  text = text.replace(/\n/g, '<br>');
  
  // Convert bullet points (- item) to proper lists
  text = text.replace(/^- (.+)$/gm, '• $1');
  
  // Handle URLs with parenthetical domain info like: https://example.com (example.com)
  // Remove the parenthetical part and format as a product link button
  text = text.replace(/(https?:\/\/[^\s]+)\s*\([^)]+\)/g, function(match, url) {
    // Clean up the URL (remove any trailing punctuation that might have been captured)
    url = url.replace(/[.,;!?]*$/, '');
    
    // Check if it's a lorealparisusa.com link with a product path
    if (url.includes('lorealparisusa.com') && url.match(/lorealparisusa\.com\/[^?\s]+/)) {
      // Extract product name from URL for button text
      const pathParts = url.split('/');
      const productSlug = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
      const buttonText = productSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="product-link"><strong>Shop ${buttonText}</strong></a>`;
    } else if (url.includes('lorealparisusa.com')) {
      // Base domain link - just show as bold text
      return '<strong>L\'Oréal Paris</strong>';
    } else {
      // Other domains - make clickable
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="product-link"><strong>Visit Link</strong></a>`;
    }
  });
  
  // Finally, convert any remaining plain URLs that aren't already in links
  // Split by existing HTML tags to avoid processing URLs inside tags
  const parts = text.split(/(<[^>]+>)/);
  for (let i = 0; i < parts.length; i++) {
    // Only process parts that are not HTML tags
    if (!parts[i].startsWith('<')) {
      parts[i] = parts[i].replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }
  }
  text = parts.join('');
  
  console.log('Final formatted text:', text); // Debug log
  
  return text;
}

// Function to create a message bubble
function createMessageBubble(content, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  
  // Format the content with rich text formatting
  const formattedContent = formatRichText(content);
  bubbleDiv.innerHTML = formattedContent; // Use innerHTML to render HTML formatting
  
  // Add timestamp
  const timeDiv = document.createElement('div');
  timeDiv.className = 'message-time';
  const now = new Date();
  timeDiv.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageDiv.appendChild(bubbleDiv);
  messageDiv.appendChild(timeDiv);
  
  return messageDiv;
}

// Function to add a message to the chat window
function addMessage(content, sender) {
  const messageBubble = createMessageBubble(content, sender);
  chatWindow.appendChild(messageBubble);
  
  // Scroll to bottom to show latest message
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Function to show typing indicator
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message assistant typing-indicator';
  typingDiv.id = 'typing-indicator';
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble typing-bubble';
  
  // Create three dots for typing animation
  const dotsDiv = document.createElement('div');
  dotsDiv.className = 'typing-dots';
  dotsDiv.innerHTML = '<span></span><span></span><span></span>';
  
  bubbleDiv.appendChild(dotsDiv);
  typingDiv.appendChild(bubbleDiv);
  
  chatWindow.appendChild(typingDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Function to remove typing indicator
function removeTypingIndicator() {
  const typingIndicator = document.getElementById('typing-indicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Set initial welcome message
addMessage("👋 Hello gorgeous! ✨ I'm **Lora**, your L'Oréal beauty advisor! 💄 How can I help you glow up today? 🌟", "assistant");

/* Handle form submit */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Get user input and clear the field
  const userMessage = userInput.value.trim();
  if (!userMessage) return;
  
  userInput.value = '';
  
  // Add user message to chat
  addMessage(userMessage, "user");
  
  // Show typing indicator
  showTypingIndicator();
  
  // Add user message to message ledger
  messageLedger.push({
    role: "user",
    content: userMessage,
  });

  try {
    const response = await fetch(workerURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: {
          id: modelString,
          version: "6"
        },
        messages: messageLedger,
        tools: [ { type: "web_search_preview" } ],
      }),
    })

    // Throw error if response is not ok
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Response from Worker:", result); // Log the response for debugging

    // Extract the message from OpenAI's responses.create API format
    let replyText = "Sorry, I couldn't generate a response.";
    
    if (result.output && Array.isArray(result.output)) {
      // Find the message object in the output array
      const messageObj = result.output.find(item => item.type === "message" && item.status === "completed");
      if (messageObj && messageObj.content && messageObj.content[0] && messageObj.content[0].text) {
        let fullText = messageObj.content[0].text;
        
        // Remove reasoning section if it exists
        // Look for "Reasoning:" at the start and "Conclusion:" pattern
        if (fullText.includes("Reasoning:") && fullText.includes("Conclusion:")) {
          // Extract everything after "Conclusion:" 
          const conclusionIndex = fullText.indexOf("Conclusion:");
          if (conclusionIndex !== -1) {
            // Get text after "Conclusion:" and clean it up
            replyText = fullText.substring(conclusionIndex + 11).trim(); // 11 = length of "Conclusion:"
            
            // Remove any remaining "Queen," or similar prefixes at the start
            replyText = replyText.replace(/^(Queen,?\s*|Sis,?\s*)/i, '');
          } else {
            replyText = fullText;
          }
        } else {
          replyText = fullText;
        }
      }
    }
    
    // Fallback to old format if needed
    if (replyText === "Sorry, I couldn't generate a response." && result.response) {
      replyText = result.response;
    }
    
    messageLedger.push({ role: 'assistant', content: replyText });

    // Remove typing indicator and add AI response
    removeTypingIndicator();
    addMessage(replyText, "assistant");

  } catch (error) {
    console.error("Error:", error);
    removeTypingIndicator();
    addMessage("Sorry, something went wrong. Please try again.", "assistant");
  }
});
