import { useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { Bot, Send, User } from 'lucide-react';

export default function RagChatbot() {

  // State to store chat messages (user + assistant)
  const [messages, setMessages] = useState([]);

  // State to store current input text
  const [input, setInput] = useState('');

  // State to show loading while waiting for AI response
  const [loading, setLoading] = useState(false);

  // Function to handle sending message
  const handleSend = async () => {

    // Prevent sending empty messages
    if (!input.trim()) return;

    const question = input.trim();

    // Clear input field
    setInput('');

    // Add user message to chat
    setMessages(prev => [
      ...prev,
      { role: 'user', content: question }
    ]);

    setLoading(true); // start loading

    try {
      // API call to backend RAG (AI) system
      const { data } = await api.post('/rag/ask', { question });

      // Add assistant response to chat
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || data.data?.answer || 'No response.'
        }
      ]);

    } catch (err) {

      // Error message if AI fails
      const msg =
        err.response?.data?.message ||
        'AI assistant is not available. Make sure OPENROUTER_API_KEY is configured.';

      // Show error response in chat
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: msg }
      ]);

      // Toast notification
      toast.error('AI request failed');

    } finally {
      setLoading(false); // stop loading
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">

      {/* Header section */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-3">
          <Bot className="w-7 h-7 text-emerald-400" />
          AI Library Assistant
        </h1>
        <p className="text-gray-500 mt-1">
          Ask questions about books in the library catalog
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 glass-card p-4 overflow-y-auto space-y-4 mb-4">

        {/* Empty state (no messages yet) */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Bot className="w-16 h-16 mb-4 text-gray-700" />
            <p className="text-lg font-medium">
              Ask me anything about the library
            </p>
            <p className="text-sm mt-1">
              I can help you find books, get recommendations, and more.
            </p>
          </div>
        )}

        {/* Display chat messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${
              msg.role === 'user'
                ? 'justify-end'
                : 'justify-start'
            }`}
          >

            {/* Assistant icon */}
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-emerald-400" />
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-emerald-500/20 text-emerald-100 rounded-br-md'
                  : 'bg-gray-800/50 text-gray-300 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>

            {/* User icon */}
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-cyan-400" />
              </div>
            )}

          </div>
        ))}

        {/* Loading animation while waiting for AI */}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-gray-800/50">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Input section */}
      <div className="flex gap-3">

        {/* Input field */}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)} // update input state
          onKeyDown={(e) =>
            e.key === 'Enter' && !e.shiftKey && handleSend()
          } // send message on Enter
          placeholder="Ask about books, authors, or recommendations..."
          className="input-field flex-1"
          disabled={loading}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="btn-primary !px-5 flex items-center gap-2"
        >
          <Send className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}
