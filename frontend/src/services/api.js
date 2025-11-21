/**
 * API service for communicating with the backend
 */

const API_BASE = '/api';

/**
 * Check system health and Ollama connection
 */
export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) throw new Error('Health check failed');
  return response.json();
}

/**
 * Upload a document for processing
 */
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Upload failed');
  }
  return data;
}

/**
 * Get list of all uploaded documents
 */
export async function getDocuments() {
  const response = await fetch(`${API_BASE}/documents`);
  if (!response.ok) throw new Error('Failed to fetch documents');
  return response.json();
}

/**
 * Delete a document
 */
export async function deleteDocument(docId) {
  const response = await fetch(`${API_BASE}/documents/${docId}`, {
    method: 'DELETE',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Delete failed');
  }
  return data;
}

/**
 * Send a chat message and get response
 */
export async function sendMessage(message, conversationHistory = []) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_history: conversationHistory,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || 'Chat failed');
  }
  return data;
}

/**
 * Get available models
 */
export async function getModels() {
  const response = await fetch(`${API_BASE}/models`);
  if (!response.ok) throw new Error('Failed to fetch models');
  return response.json();
}
