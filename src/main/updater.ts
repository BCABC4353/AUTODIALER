import { app } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';
import type { Dialer } from './dialer';
import type { ForceUpdateState } from '../shared/types';

const GITHUB_OWNER = 'BCABC4353';
const GITHUB_REPO = 'AUTODIALER';
const FORCE_POLICY_URL = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/main/update-policy.json`;

const ROUTINE_CHECK_MS = 2 * 60 * 60 * 1000;
const FORCE_POLL_MS = 10 * 60 * 1000;
const FORCE_GRACE_S = 30;
const FORCE_HOLD_LIMIT_MS = 5 * 60 * 1000;

interface Policy {
  forceMinVersion?: string;
  message?: string;
}

export function isNewerVersion(a: string, b: string): boolean {
  const parse = (v: string): number[] =>
    (v.replace(/^v/i, '').split('-')[0] ?? '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da > db;
  }
  return false;
}

export class Updater {
  private state: ForceUpdateState = { active: false, secondsLeft: FORCE_GRACE_S, holding: false, message: '', version: '' };
  private forced = false;
  private downloaded = false;
  private installing = false;
  private countdown: NodeJS.Timeout | null = null;
  private holdStarted = 0;
  private checkInFlight = false;
  private token = process.env.AUTODIALER_GH_TOKEN ?? '';

  constructor(
    private dialer: Dialer,
    private send: (state: ForceUpdateState) => void,
  ) {}

  setup(): void {
    if (!app.isPackaged) return;
    try {
      autoUpdater.logger = log;
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.allowDowngrade = false;
      autoUpdater.allowPrerelease = false;
      if (this.token) {
        autoUpdater.setFeedURL({ provider: 'github', owner: GITHUB_OWNER, repo: GITHUB_REPO, private: true, token: this.token });
      }
      autoUpdater.on('error', (err) => log.warn('[updater] error:', err));
      autoUpdater.on('update-downloaded', (info) => {
        this.downloaded = true;
        this.state.version = info.version ?? '';
        if (this.forced) this.beginForce();
      });
      void this.routineCheck();
      void this.forceCheck();
      setInterval(() => void this.routineCheck(), ROUTINE_CHECK_MS);
      setInterval(() => void this.forceCheck(), FORCE_POLL_MS);
    } catch (err) {
      log.warn('[updater] setup failed:', err);
    }
  }

  private async routineCheck(): Promise<void> {
    if (this.checkInFlight) return;
    this.checkInFlight = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      log.warn('[updater] check failed:', err);
    } finally {
      this.checkInFlight = false;
    }
  }

  private async fetchPolicy(): Promise<Policy | null> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'bcabc-autodialer-updater',
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
      };
      if (this.token) headers.Authorization = `token ${this.token}`;
      const res = await fetch(`${FORCE_POLICY_URL}?t=${Date.now()}`, { headers });
      if (!res.ok) return null;
      return (await res.json()) as Policy;
    } catch {
      return null;
    }
  }

  private async forceCheck(): Promise<void> {
    if (this.forced) {
      if (this.downloaded && !this.installing && !this.countdown) this.beginForce();
      return;
    }
    const policy = await this.fetchPolicy();
    const min = policy?.forceMinVersion;
    if (!min || min.includes('-') || !isNewerVersion(min, app.getVersion())) return;
    this.forced = true;
    this.state.message = policy?.message ?? '';
    this.state.version = min;
    if (this.downloaded) this.beginForce();
    else void this.routineCheck();
  }

  private beginForce(): void {
    if (this.countdown || this.installing) return;
    void this.dialer.stop();
    this.state = { ...this.state, active: true, secondsLeft: FORCE_GRACE_S, holding: false };
    this.holdStarted = 0;
    this.send(this.state);
    this.countdown = setInterval(() => this.step(), 1000);
  }

  private step(): void {
    const live = this.dialer.isLiveWithAgent();
    if (live) {
      if (!this.holdStarted) this.holdStarted = Date.now();
      if (Date.now() - this.holdStarted < FORCE_HOLD_LIMIT_MS) {
        this.state = { ...this.state, holding: true };
        this.send(this.state);
        return;
      }
    }
    this.state = { ...this.state, holding: false, secondsLeft: Math.max(0, this.state.secondsLeft - 1) };
    this.send(this.state);
    if (this.state.secondsLeft <= 0) this.install();
  }

  install(): void {
    if (this.installing) return;
    this.installing = true;
    if (this.countdown) clearInterval(this.countdown);
    this.countdown = null;
    try {
      autoUpdater.quitAndInstall();
    } catch (err) {
      log.warn('[updater] quitAndInstall failed:', err);
      this.installing = false;
    }
  }
}
