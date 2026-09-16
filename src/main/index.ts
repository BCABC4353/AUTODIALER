import { app, BrowserWindow, session, shell } from 'electron';
import log from 'electron-log/main';
import { Dialer } from './dialer';
import { registerIpc } from './ipc';
import { Updater } from './updater';
import { createWindow, getMainWindow, isDev } from './window';
import { CCP_PARTITION, CCP_URL, isConnectHost } from '../shared/ccp';

log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'info' : false;

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let dialer: Dialer | null = null;
let updater: Updater | null = null;
let quitting = false;

function ownPage(url: string): boolean {
  return url.startsWith('file:') || (isDev && url.startsWith('http://localhost:5173'));
}

function installCsp(): void {
  const policy = isDev
    ? "default-src 'self' http://localhost:5173 ws://localhost:5173; script-src 'self' http://localhost:5173 'unsafe-inline'; style-src 'self' 'unsafe-inline' http://localhost:5173; font-src 'self' data: http://localhost:5173; img-src 'self' data: http://localhost:5173; connect-src 'self' http://localhost:5173 ws://localhost:5173; frame-src https:"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'; frame-src https:";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    if (!ownPage(details.url) || details.resourceType !== 'mainFrame') {
      callback({ responseHeaders: details.responseHeaders });
      return;
    }
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } });
  });
}

function installCcpSession(): void {
  const ccp = session.fromPartition(CCP_PARTITION);
  ccp.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    const allowed = isConnectHost(url) && (permission === 'media' || permission === 'notifications' || permission === 'display-capture');
    callback(allowed);
  });
  ccp.setPermissionCheckHandler((_webContents, permission, origin) => {
    return isConnectHost(origin) && (permission === 'media' || permission === 'notifications');
  });
}

app.on('web-contents-created', (_event, contents) => {
  if (contents.getType() !== 'webview') return;
  contents.setWindowOpenHandler(({ url }) => {
    if (isConnectHost(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          backgroundColor: '#020617',
          webPreferences: { partition: CCP_PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    try {
      if (new URL(url).protocol === 'https:') void shell.openExternal(url);
    } catch {
      /* ignore */
    }
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!isConnectHost(url)) event.preventDefault();
  });
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    installCsp();
    installCcpSession();
    dialer = new Dialer();
    updater = new Updater(dialer, (state) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) win.webContents.send('dialer:event', { type: 'update', state });
    });
    registerIpc(dialer, getMainWindow, () => updater?.install());
    const win = createWindow();
    win.webContents.on('will-attach-webview', (event, webPreferences, params) => {
      if (!params.src || !params.src.startsWith(CCP_URL.slice(0, CCP_URL.lastIndexOf('/')))) {
        event.preventDefault();
        return;
      }
      delete webPreferences.preload;
      webPreferences.nodeIntegration = false;
      webPreferences.contextIsolation = true;
      webPreferences.sandbox = true;
    });
    dialer.startLoops();
    updater.setup();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', (event) => {
  if (quitting || !dialer) return;
  event.preventDefault();
  quitting = true;
  dialer.stopLoops();
  const finish = () => app.quit();
  dialer.pauseForShutdown().then(finish, finish);
  setTimeout(finish, 4000);
});
