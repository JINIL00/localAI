import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  File,
} from 'lucide-react';
import { uploadDocument, getDocuments, deleteDocument } from '../services/api';

/**
 * Document Panel Component
 *
 * Handles document upload and management
 */
function DocumentPanel({ documents, setDocuments }) {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    try {
      const result = await uploadDocument(file);
      setUploadStatus({
        type: 'success',
        message: result.message,
      });
      loadDocuments();
    } catch (err) {
      setUploadStatus({
        type: 'error',
        message: err.message,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId, filename) => {
    if (!confirm(`Delete "${filename}"?`)) return;

    try {
      await deleteDocument(docId);
      loadDocuments();
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType) => {
    return <FileText className="w-4 h-4" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <File className="w-5 h-5" />
          Documents
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Upload files to chat about
        </p>
      </div>

      {/* Upload area */}
      <div className="p-4">
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md"
            onChange={handleFileSelect}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <span className="text-sm text-gray-600">Processing...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <span className="text-sm text-gray-600">
                Drop file or click to upload
              </span>
              <span className="text-xs text-gray-400">
                PDF, TXT, MD (max 50MB)
              </span>
            </div>
          )}
        </div>

        {/* Upload status */}
        {uploadStatus && (
          <div
            className={`mt-3 p-3 rounded-lg flex items-start gap-2 ${
              uploadStatus.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {uploadStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm">{uploadStatus.message}</span>
          </div>
        )}
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto p-4 pt-0">
        {documents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No documents uploaded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-gray-50 rounded-lg p-3 group hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {getFileIcon(doc.file_type)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.filename}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(doc.size_bytes)} • {doc.chunk_count} chunks
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DocumentPanel;
