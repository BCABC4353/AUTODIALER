import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { csvEscape, loadCsv } from './csv';
import { allResults, listPatients, listResults, replacePatients, toggleDnc } from './db';
import type { Dialer } from './dialer';
import type { DialerEvent } from '../shared/types';

export function registerIpc(dialer: Dialer, getWindow: () => BrowserWindow | null, restartNow: () => void): void {
  const send = (event: DialerEvent) => {
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('dialer:event', event);
  };
  dialer.subscribe(send);

  ipcMain.handle('patients:list', () => listPatients(dialer.db));

  ipcMain.handle('patients:import', async () => {
    const win = getWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'Open patient list',
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile'],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    const file = result.filePaths[0];
    if (result.canceled || !file) return null;
    let rows;
    let duplicates = 0;
    try {
      ({ rows, duplicates } = loadCsv(file));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      dialer.logLine(`csv: ${message}`, 'err');
      throw new Error(message);
    }
    const { added, dropped } = replacePatients(dialer.db, rows);
    const invalid = rows.filter((r) => !r.phone).length;
    const notes = [`${added} new`, `${dropped} removed`, `${invalid} without a dialable number`];
    if (duplicates) notes.push(`${duplicates} repeated run${duplicates === 1 ? '' : 's'} collapsed to the last row`);
    const summary = notes.join(', ');
    dialer.logLine(`loaded ${rows.length} patients from ${path.basename(file)} (${summary})`, 'ok');
    dialer.requestTick();
    send({ type: 'patients' });
    return { file: path.basename(file), rows: rows.length, invalid };
  });

  ipcMain.handle('patients:toggle-dnc', (_e, run: string) => {
    toggleDnc(dialer.db, run);
    dialer.requestTick();
    send({ type: 'patients' });
  });

  ipcMain.handle('dialer:start', () => dialer.start());
  ipcMain.handle('dialer:stop', () => dialer.stop());
  ipcMain.handle('dialer:status', () => dialer.status());
  ipcMain.handle('dialer:log', () => dialer.logLines());

  ipcMain.handle('results:list', () => listResults(dialer.db));
  ipcMain.handle('results:session', () => dialer.sessionStats());
  ipcMain.handle('results:detail', (_e, id: number) => dialer.resultDetail(id));
  ipcMain.handle('results:recording', (_e, id: number) => dialer.recordingBytes(id));
  ipcMain.handle('results:agents', () => dialer.agentReport());
  ipcMain.handle('results:insights', (_e, scope: 'today' | 'week' | 'all') => dialer.insights(scope));

  ipcMain.handle('results:export', async () => {
    const win = getWindow();
    const options: Electron.SaveDialogOptions = {
      title: 'Export results',
      defaultPath: `autodialer-results-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return null;
    const rows = allResults(dialer.db);
    const header = ['attempted_at', 'run', 'patient', 'phone', 'balance', 'outcome', 'talk_seconds', 'dial_seconds', 'answer_seconds', 'cost_usd', 'cost_estimated', 'agent_note', 'contact_id'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [r.attempted_at, r.run, r.patient, r.phone, r.balance, r.outcome, r.talk_seconds, r.dial_seconds, r.answer_seconds, r.outcome ? r.cost.toFixed(4) : '', r.outcome ? (r.cost_estimated ? 'yes' : 'no') : '', r.agent_note, r.contact_id]
          .map(csvEscape)
          .join(','),
      );
    }
    fs.writeFileSync(result.filePath, lines.join('\r\n') + '\r\n', 'utf8');
    dialer.logLine(`exported ${rows.length} rows to ${path.basename(result.filePath)}`, 'ok');
    return { file: path.basename(result.filePath), rows: rows.length };
  });

  ipcMain.handle('results:clear', async () => {
    const win = getWindow();
    const options: Electron.MessageBoxOptions = {
      type: 'warning',
      buttons: ['Clear history', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'Delete every attempt record?',
      detail: 'Patients become eligible to dial again immediately.',
    };
    const choice = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    if (choice.response !== 0) return 0;
    return dialer.clearHistory();
  });

  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:restart-now', () => restartNow());
}
