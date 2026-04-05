const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getInternalApiKey: () => ipcRenderer.invoke('get-internal-api-key'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  showNotification: (opts) => ipcRenderer.invoke('show-notification', opts),
  platform: process.platform,
})
