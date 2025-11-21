import React, { useState, useEffect } from 'react';
import { FileText, MessageSquare, Settings, AlertCircle } from 'lucide-react';
import DocumentPanel from './components/DocumentPanel';
import ChatPanel from './components/ChatPanel';
import { checkHealth } from './services/api';

/**
 * Main Application Component
 *
 * A privacy-first document chat assistant
 */
function App() {
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [error, setError] = useState(null);

  // Check system health on mount
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await checkHealth();
        setHealth(data);
        setError(null);
      } catch (err) {
        setError('Cannot connect to backend. Make sure the server is running.');
      }
    };

    fetchHealth();
    // Poll health every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                LocalAI Document Chat
              </h1>
              <p className="text-sm text-gray-500">
                Private AI-powered document assistant
              </p>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-4">
            {health && (
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.ollama_connected ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-gray-600">
                  {health.ollama_connected ? 'Ollama Connected' : 'Ollama Offline'}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Warning if Ollama not connected */}
      {health && !health.ollama_connected && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="w-5 h-5" />
            <span>
              Ollama is not running. Start it with: <code className="bg-yellow-100 px-1 rounded">ollama serve</code>
            </span>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Document sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <DocumentPanel
            documents={documents}
            setDocuments={setDocuments}
          />
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <ChatPanel
            documentsCount={documents.length}
            ollamaConnected={health?.ollama_connected}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
