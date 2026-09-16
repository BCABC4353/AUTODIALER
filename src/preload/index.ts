import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { DialerApi, DialerEvent } from '../shared/types';

const api: DialerApi = {
  patients: {
    list: () => ipcRenderer.invoke('patients:list'),
    importCsv: () => ipcRenderer.invoke('patients:import'),
    toggleDnc: (run) => ipcRenderer.invoke('patients:toggle-dnc', run),
  },
  dialer: {
    start: () => ipcRenderer.invoke('dialer:start'),
    stop: () => ipcRenderer.invoke('dialer:stop'),
    status: () => ipcRenderer.invoke('dialer:status'),
    log: () => ipcRenderer.invoke('dialer:log'),
  },
  results: {
    list: () => ipcRenderer.invoke('results:list'),
    exportCsv: () => ipcRenderer.invoke('results:export'),
    clear: () => ipcRenderer.invoke('results:clear'),
    session: () => ipcRenderer.invoke('results:session'),
  },
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    restartNow: () => ipcRenderer.invoke('app:restart-now'),
  },
  onEvent: (handler) => {
    const listener = (_e: IpcRendererEvent, event: DialerEvent) => handler(event);
    ipcRenderer.on('dialer:event', listener);
    return () => ipcRenderer.removeListener('dialer:event', listener);
  },
};

contextBridge.exposeInMainWorld('dialer', api);
