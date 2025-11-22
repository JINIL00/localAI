# LocalAI Chat - Mac App

A native Mac application for the LocalAI Document Chat system. This app provides a user-friendly interface for non-technical users to chat with their documents using local AI.

## Prerequisites

Before using this app, you need:

1. **Ollama** - Install from [ollama.ai](https://ollama.ai)
   ```bash
   # After installing, pull the required model:
   ollama pull llama3.2:3b
   ```

2. **Python 3.8+** - Usually pre-installed on Mac
   ```bash
   # Install dependencies
   cd ../backend
   pip3 install -r requirements.txt
   ```

3. **Node.js 18+** - For development

## Development

### Quick Start

```bash
# Install Electron dependencies
cd electron
npm install

# Build the frontend first
cd ../frontend
npm install
npm run build

# Run in development mode
cd ../electron
npm run dev
```

### Development Mode

Development mode runs the frontend dev server alongside Electron:

```bash
# Terminal 1: Start frontend dev server
cd frontend && npm run dev

# Terminal 2: Start Electron in dev mode
cd electron && npm run dev
```

## Building for Distribution

### Build Steps

1. **Build the frontend:**
   ```bash
   cd frontend
   npm run build
   ```

2. **Build the Mac app:**
   ```bash
   cd electron
   npm run build:mac
   ```

The built app will be in `electron/dist/`.

### App Icons

Replace the placeholder icons in `electron/assets/`:
- `icon.icns` - Mac app icon (512x512)
- `icon.png` - Standard icon
- `tray-icon.png` - Menu bar icon (22x22 @2x)

## How It Works

The Electron app:

1. **Checks for Ollama** - Verifies Ollama is installed and running
2. **Starts Backend** - Launches the Python FastAPI server
3. **Serves Frontend** - Displays the React UI
4. **Manages Services** - Automatically stops services on quit

### Service Ports

- Ollama: `localhost:11434`
- Backend API: `localhost:8000`
- Frontend (dev): `localhost:3000`

### Data Storage

User data is stored in:
- **macOS**: `~/Library/Application Support/localai-chat/`
  - `chroma_db/` - Vector database
  - `uploads/` - Uploaded documents
  - `logs/` - Application logs

## Troubleshooting

### "Ollama Not Found"

Install Ollama from https://ollama.ai and ensure it can run:
```bash
ollama serve
```

### "Backend Error"

Check the logs at `~/Library/Logs/localai-chat/app.log`

Common issues:
- Python dependencies not installed
- Port 8000 already in use
- Missing environment variables

### App Won't Start

1. Check Console.app for crash logs
2. Run from terminal to see errors:
   ```bash
   /Applications/LocalAI\ Chat.app/Contents/MacOS/LocalAI\ Chat
   ```

## Architecture

```
┌─────────────────┐
│   Electron      │  ← Main process (Node.js)
│   Main Process  │
└────────┬────────┘
         │
         ├── Spawns Backend (Python FastAPI)
         ├── Checks Ollama Service
         └── Creates Renderer Window
                    │
         ┌─────────┴─────────┐
         │   React Frontend  │  ← Renderer process
         │   (BrowserWindow) │
         └───────────────────┘
```

## License

MIT
