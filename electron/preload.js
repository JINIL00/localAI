const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Service management
  getServicesStatus: () => ipcRenderer.invoke('get-services-status'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),

  // File operations
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // App info
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // Event listeners
  onServicesStatus: (callback) => {
    ipcRenderer.on('services-status', (event, status) => callback(status));
  },

  // Platform info
  platform: process.platform,
  isElectron: true
});
