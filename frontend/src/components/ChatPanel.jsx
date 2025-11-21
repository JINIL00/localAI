import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  Bot,
  User,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendMessage } from '../services/api';

/**
 * Chat Panel Component
 *
 * Handles the chat interface and message history
 */
function ChatPanel({ documentsCount, ollamaConnected }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message to chat
    const newUserMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    // Prepare conversation history for API
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));

    setLoading(true);

    try {
      const response = await sendMessage(userMessage, history);

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.response,
          sources: response.sources,
          processingTime: response.processing_time_ms,
          model: response.model_used,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message}`,
          isError: true,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const canChat = documentsCount > 0 && ollamaConnected;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Start a Conversation
              </h3>
              <p className="text-gray-500 mb-4">
                {documentsCount === 0
                  ? 'Upload some documents first, then ask questions about them.'
                  : 'Ask me anything about your uploaded documents. I\'ll find the relevant information and cite my sources.'}
              </p>
              {documentsCount > 0 && (
                <div className="text-sm text-gray-400">
                  {documentsCount} document{documentsCount !== 1 ? 's' : ''} loaded
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}
            {loading && (
              <div className="flex items-center gap-3 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                canChat
                  ? 'Ask a question about your documents...'
                  : documentsCount === 0
                  ? 'Upload documents first'
                  : 'Waiting for Ollama...'
              }
              disabled={!canChat || loading}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!canChat || loading || !input.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            All processing happens locally. Your data never leaves your machine.
          </p>
        </form>
      </div>
    </div>
  );
}

/**
 * Individual message bubble component
 */
function MessageBubble({ message }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-blue-600" />
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
        <div
          className={`rounded-lg px-4 py-3 ${
            isUser
              ? 'bg-blue-600 text-white'
              : message.isError
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-white border border-gray-200'
          }`}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sources section */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <FileText className="w-4 h-4" />
              {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
              {showSources ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded p-3 text-sm border border-gray-200"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-700">
                        {source.document_name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {Math.round(source.relevance_score * 100)}% match
                      </span>
                    </div>
                    <p className="text-gray-600 text-xs line-clamp-3">
                      {source.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Processing time */}
        {message.processingTime && (
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            <Clock className="w-3 h-3" />
            {(message.processingTime / 1000).toFixed(1)}s
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-gray-600" />
        </div>
      )}
    </div>
  );
}

export default ChatPanel;
