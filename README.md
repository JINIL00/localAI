# LocalAI Document Chat

A privacy-first, AI-powered document chat assistant that runs entirely on your local machine. Upload PDFs and text files, then have natural conversations about their contents - all without sending any data to external servers.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-green.svg)
![React](https://img.shields.io/badge/react-18+-blue.svg)

## Features

- **Complete Privacy**: All AI processing happens locally using Ollama - your documents never leave your machine
- **Smart Document Search**: Uses RAG (Retrieval Augmented Generation) with semantic search to find relevant information
- **Source Citations**: See exactly which parts of your documents the AI used to generate answers
- **Modern UI**: Clean, intuitive React interface with drag-and-drop uploads
- **Multiple Formats**: Support for PDF, TXT, and Markdown files
- **Conversation History**: Maintains context across multiple questions in a session

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   React UI      │────▶│   FastAPI        │────▶│   Ollama    │
│   (Frontend)    │     │   (Backend)      │     │   (LLM)     │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐        ┌──────▼──────┐
              │ ChromaDB  │        │ Sentence    │
              │ (Vectors) │        │ Transformers│
              └───────────┘        └─────────────┘
```

**Tech Stack:**
- **Backend**: Python, FastAPI, LangChain, ChromaDB, Sentence Transformers
- **Frontend**: React, Vite, Tailwind CSS
- **LLM**: Ollama with Llama 3.2 3B (modular - easy to swap models)

## Quick Start

### Prerequisites

1. **Python 3.9+**
2. **Node.js 18+**
3. **Ollama** - Install from [ollama.ai](https://ollama.ai)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/localai-document-chat.git
   cd localai-document-chat
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Pull the LLM model**
   ```bash
   ollama pull llama3.2:3b
   ```

### Running the Application

1. **Start Ollama** (in a terminal)
   ```bash
   ollama serve
   ```

2. **Start the backend** (in another terminal)
   ```bash
   cd backend
   source venv/bin/activate
   python -m app.main
   ```
   Backend runs at: http://localhost:8000

3. **Start the frontend** (in another terminal)
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs at: http://localhost:3000

4. **Open your browser** to http://localhost:3000

## Usage

1. **Upload Documents**: Drag and drop or click to upload PDF, TXT, or MD files
2. **Ask Questions**: Type your question in the chat box
3. **View Sources**: Click on "sources" to see which document sections were used
4. **Manage Documents**: Delete documents you no longer need

### Example Questions

- "What are the main points of this document?"
- "Summarize the conclusions"
- "What does this say about [specific topic]?"
- "Compare the findings in section 2 with section 5"

## Project Structure

```
localai-document-chat/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── models/        # Pydantic schemas
│   │   ├── services/      # Core services (RAG, LLM, document processing)
│   │   ├── config.py      # Configuration
│   │   └── main.py        # FastAPI application
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── services/      # API client
│   │   └── App.jsx        # Main application
│   └── package.json
└── README.md
```

## Configuration

Copy `.env.example` to `.env` in the backend folder and customize:

```env
# Ollama settings
OLLAMA_BASE_URL=http://localhost:11434
DEFAULT_MODEL=llama3.2:3b

# Document processing
CHUNK_SIZE=1000
CHUNK_OVERLAP=200

# Upload limits
MAX_FILE_SIZE_MB=50
```

## How RAG Works

1. **Document Processing**: When you upload a document, it's split into overlapping chunks
2. **Embedding**: Each chunk is converted to a vector embedding using a local model
3. **Storage**: Embeddings are stored in ChromaDB (a vector database)
4. **Retrieval**: When you ask a question, the system finds the most similar chunks
5. **Generation**: The LLM generates an answer using the retrieved chunks as context

## Future Enhancements

The architecture is designed for easy extension:

- [ ] Multiple model selection (let users choose between LLMs)
- [ ] More file types (DOCX, code files)
- [ ] Voice input/output
- [ ] Export conversations
- [ ] Multi-document comparison
- [ ] Custom embedding models

## Troubleshooting

### "Ollama is not running"
Make sure Ollama is running: `ollama serve`

### "Model not found"
Pull the model: `ollama pull llama3.2:3b`

### Slow responses
- The 3B model is optimized for speed but responses may take 10-30 seconds
- Consider hardware acceleration if available (GPU)
- Reduce `CHUNK_SIZE` for faster retrieval

### Empty search results
- Make sure documents are uploaded and processed
- Try rephrasing your question
- Check if the document contains searchable text (not just images)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Ollama](https://ollama.ai) - Local LLM inference
- [LangChain](https://langchain.com) - LLM application framework
- [ChromaDB](https://www.trychroma.com) - Vector database
- [Sentence Transformers](https://www.sbert.net) - Embeddings
