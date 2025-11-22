const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, shell } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');
const fs = require('fs');

// Keep references to prevent garbage collection
let mainWindow = null;
let tray = null;
let backendProcess = null;
let frontendProcess = null;

// Configuration
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;
const OLLAMA_PORT = 11434;

// Paths
const appPath = app.getAppPath();
const resourcesPath = isDev ? path.join(__dirname, '..') : process.resourcesPath;
const backendPath = path.join(resourcesPath, 'backend');
const frontendPath = path.join(resourcesPath, 'frontend');

// Store for user data
const userDataPath = app.getPath('userData');
const logsPath = path.join(userDataPath, 'logs');

// Ensure logs directory exists
if (!fs.existsSync(logsPath)) {
  fs.mkdirSync(logsPath, { recursive: true });
}

// Logging helper
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  fs.appendFileSync(path.join(logsPath, 'app.log'), logMessage);
}

// Check if a service is running on a port
function checkService(port) {
  return new Promise((resolve) => {
    const req = http.request({ host: 'localhost', port, timeout: 2000 }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Wait for service to be ready
async function waitForService(port, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (await checkService(port)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

// Check if Ollama is installed and running
async function checkOllama() {
  const isRunning = await checkService(OLLAMA_PORT);
  if (isRunning) {
    log('Ollama is already running');
    return true;
  }

  // Try to start Ollama
  log('Attempting to start Ollama...');

  return new Promise((resolve) => {
    const ollamaProcess = spawn('ollama', ['serve'], {
      detached: true,
      stdio: 'ignore'
    });

    ollamaProcess.unref();

    // Wait for Ollama to start
    setTimeout(async () => {
      const started = await checkService(OLLAMA_PORT);
      if (started) {
        log('Ollama started successfully');
        resolve(true);
      } else {
        log('Failed to start Ollama');
        resolve(false);
      }
    }, 3000);
  });
}

// Start the Python backend
async function startBackend() {
  if (await checkService(BACKEND_PORT)) {
    log('Backend already running');
    return true;
  }

  log('Starting backend...');

  const pythonCmd = process.platform === 'darwin' ? 'python3' : 'python';

  backendProcess = spawn(pythonCmd, ['-m', 'app.main'], {
    cwd: backendPath,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      CHROMA_DB_PATH: path.join(userDataPath, 'chroma_db'),
      UPLOAD_DIR: path.join(userDataPath, 'uploads')
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProcess.stdout.on('data', (data) => {
    log(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr.on('data', (data) => {
    log(`[Backend Error] ${data.toString().trim()}`);
  });

  backendProcess.on('error', (err) => {
    log(`Backend process error: ${err.message}`);
  });

  backendProcess.on('exit', (code) => {
    log(`Backend exited with code ${code}`);
    backendProcess = null;
  });

  return await waitForService(BACKEND_PORT);
}

// Start the frontend (in dev mode) or serve built files
async function startFrontend() {
  if (isDev) {
    if (await checkService(FRONTEND_PORT)) {
      log('Frontend dev server already running');
      return true;
    }

    log('Starting frontend dev server...');

    frontendProcess = spawn('npm', ['run', 'dev'], {
      cwd: frontendPath,
      shell: true,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    frontendProcess.stdout.on('data', (data) => {
      log(`[Frontend] ${data.toString().trim()}`);
    });

    frontendProcess.stderr.on('data', (data) => {
      log(`[Frontend Error] ${data.toString().trim()}`);
    });

    return await waitForService(FRONTEND_PORT);
  }

  // In production, frontend is built and served by the app
  return true;
}

// Create the main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the frontend
  if (isDev) {
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(frontendPath, 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');

  // Use a default icon if custom one doesn't exist
  if (!fs.existsSync(iconPath)) {
    return;
  }

  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open LocalAI Chat', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Check Services', click: checkAllServices },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('LocalAI Document Chat');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}

// Check all services status
async function checkAllServices() {
  const ollama = await checkService(OLLAMA_PORT);
  const backend = await checkService(BACKEND_PORT);

  if (mainWindow) {
    mainWindow.webContents.send('services-status', {
      ollama,
      backend,
      frontend: true
    });
  }

  return { ollama, backend };
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Ollama Models...',
          click: () => shell.openExternal('https://ollama.ai/library')
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'View Logs',
          click: () => shell.openPath(logsPath)
        },
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(userDataPath)
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC Handlers
ipcMain.handle('get-services-status', checkAllServices);

ipcMain.handle('restart-backend', async () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  return await startBackend();
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['pdf', 'txt', 'md'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('get-user-data-path', () => userDataPath);

// App lifecycle
app.whenReady().then(async () => {
  log('App starting...');

  // Create menu
  createMenu();

  // Show loading window
  createWindow();

  // Start services
  const ollamaReady = await checkOllama();
  if (!ollamaReady) {
    dialog.showErrorBox(
      'Ollama Not Found',
      'Ollama is required but not installed or failed to start.\n\nPlease install Ollama from https://ollama.ai and try again.'
    );
  }

  const backendReady = await startBackend();
  if (!backendReady) {
    dialog.showErrorBox(
      'Backend Error',
      'Failed to start the backend service.\n\nPlease check the logs for more information.'
    );
  }

  if (isDev) {
    await startFrontend();
  }

  // Create tray
  createTray();

  log('App ready');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  log('App quitting...');

  // Kill backend process
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }

  // Kill frontend process
  if (frontendProcess) {
    frontendProcess.kill();
    frontendProcess = null;
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`Uncaught exception: ${error.message}`);
  console.error(error);
});
