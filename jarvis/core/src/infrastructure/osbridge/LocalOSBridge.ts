import { readFile, writeFile, readdir, rename, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import type { OSBridge, ShellOptions, ShellResult } from './OSBridge.js';

/**
 * Node-backed OSBridge so the core runs standalone (and on Linux CI). The
 * macOS-only operations degrade gracefully off-macOS. In the packaged app the
 * Rust bridge replaces this for privileged ops.
 */
export class LocalOSBridge implements OSBridge {
  private readonly isMac = platform() === 'darwin';

  readFile(path: string): Promise<string> {
    return readFile(path, 'utf8');
  }

  writeFile(path: string, content: string): Promise<void> {
    return writeFile(path, content, 'utf8');
  }

  async list(path: string): Promise<{ name: string; isDir: boolean }[]> {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.map((e) => ({ name: e.name, isDir: e.isDirectory() }));
  }

  move(from: string, to: string): Promise<void> {
    return rename(from, to);
  }

  remove(path: string): Promise<void> {
    return rm(path, { recursive: true, force: true });
  }

  runShell(command: string, options: ShellOptions = {}): Promise<ShellResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd: options.cwd,
        signal: options.signal,
      });
      let stdout = '';
      let stderr = '';
      const timer = options.timeoutMs
        ? setTimeout(() => child.kill('SIGKILL'), options.timeoutMs)
        : null;
      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', (e) => {
        if (timer) clearTimeout(timer);
        reject(e);
      });
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        resolve({ stdout, stderr, code: code ?? -1 });
      });
    });
  }

  async runAppleScript(script: string): Promise<string> {
    if (!this.isMac) throw new Error('AppleScript is only available on macOS');
    const res = await this.runShell(`osascript -e ${JSON.stringify(script)}`);
    if (res.code !== 0) throw new Error(res.stderr || 'osascript failed');
    return res.stdout.trim();
  }

  async notify(title: string, body: string): Promise<void> {
    if (this.isMac) {
      await this.runAppleScript(`display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`);
      return;
    }
    // Off-macOS: best-effort console notification; never blocks the flow.
    console.info(`[notify] ${title}: ${body}`);
  }

  async keychainGet(service: string, account: string): Promise<string | null> {
    if (!this.isMac) return null;
    const res = await this.runShell(
      `security find-generic-password -s ${JSON.stringify(service)} -a ${JSON.stringify(account)} -w`,
    );
    return res.code === 0 ? res.stdout.trim() : null;
  }

  async keychainSet(service: string, account: string, secret: string): Promise<void> {
    if (!this.isMac) throw new Error('Keychain is only available on macOS');
    const res = await this.runShell(
      `security add-generic-password -U -s ${JSON.stringify(service)} -a ${JSON.stringify(account)} -w ${JSON.stringify(secret)}`,
    );
    if (res.code !== 0) throw new Error(res.stderr || 'keychain set failed');
  }
}
