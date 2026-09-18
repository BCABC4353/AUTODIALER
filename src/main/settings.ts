import fs from 'node:fs';
import { userDataFile } from './db';

export interface Settings {
  allowRepeats: boolean;
}

const DEFAULTS: Settings = { allowRepeats: false };

export function readSettings(): Settings {
  try {
    const parsed = JSON.parse(fs.readFileSync(userDataFile('settings.json'), 'utf8')) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSettings(settings: Settings): void {
  fs.writeFileSync(userDataFile('settings.json'), JSON.stringify(settings), 'utf8');
}
