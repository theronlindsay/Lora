/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");


//OpenAI configuration variables
// REPLACE with your actual Cloudflare Worker URL
const workerURL = "https://9f5642ef-openai.vfncs46hb8.workers.dev/";
const modelString = "o3"; // Use the latest reasoning model
const maxTokens = 800;
const temp = 1;

// Initialize the message ledger array
const messageLedger = [];

// Function to load the system prompt from prompt.txt
async function loadSystemPrompt() {
  // Fetch the prompt text from the file
  const response = await fetch('prompt.txt');
  const promptText = await response.text();
  // Add the system message to the ledger
  messageLedger.push({ role: 'system', content: promptText });
}

// Load the prompt at startup
loadSystemPrompt();

// Function to perform web search (optional - for manual search implementation)
async function performWebSearch(query) {
  try {
    // You can use various search APIs here:
    // 1. Google Custom Search API
    // 2. Bing Search API
    // 3. DuckDuckGo API
    // 4. SerpAPI
    
    // Example using a hypothetical search API
    const searchResponse = await fetch(`https://api.example-search.com/search?q=${encodeURIComponent(query)}`);
    const searchData = await searchResponse.json();
    
    return searchData.results || [];
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
}

// Function to enhance message with search results (optional)
function enhanceMessageWithSearch(userMessage) {
  // Check if the message seems to need current information
  const searchKeywords = ['latest', 'current', 'news', 'today', 'recent', 'what is', 'when did', 'price of'];
  const needsSearch = searchKeywords.some(keyword => 
    userMessage.toLowerCase().includes(keyword)
  );
  
  return needsSearch;
}

// Function to create a message bubble
function createMessageBubble(content, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'message-bubble';
  bubbleDiv.textContent = content;
  
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
addMessage("👋 Hello! How can I help you today?", "assistant");

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
        model: modelString,
        messages: messageLedger,
        max_completion_tokens: maxTokens,
        temperature: temp,
      }),
    })

    // Throw error if response is not ok
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    console.log("Response from Worker:", result); // Log the response for debugging

    const replyText = result.choices[0].message.content;
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
