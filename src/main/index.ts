import { app, BrowserWindow, session } from 'electron';
import log from 'electron-log/main';
import { Dialer } from './dialer';
import { registerIpc } from './ipc';
import { Updater } from './updater';
import { createWindow, getMainWindow, isDev } from './window';

log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = isDev ? 'info' : false;

let dialer: Dialer | null = null;
let updater: Updater | null = null;
let quitting = false;

function installCsp(): void {
  const policy = isDev
    ? "default-src 'self' http://localhost:5173 ws://localhost:5173; script-src 'self' http://localhost:5173 'unsafe-inline'; style-src 'self' 'unsafe-inline' http://localhost:5173; font-src 'self' data: http://localhost:5173; img-src 'self' data: http://localhost:5173; connect-src 'self' http://localhost:5173 ws://localhost:5173"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] },
    });
  });
}

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
    dialer = new Dialer();
    updater = new Updater(dialer, (state) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) win.webContents.send('dialer:event', { type: 'update', state });
    });
    registerIpc(dialer, getMainWindow, () => updater?.install());
    createWindow();
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
