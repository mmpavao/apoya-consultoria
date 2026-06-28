/**
 * Privileged system operations. In production these are serviced by the Rust
 * Tauri commands (minimal, auditable attack surface — PRD §4.1); the core
 * sidecar talks to them through this interface. A Node-based implementation
 * (LocalOSBridge) lets the core run/test standalone on any OS.
 */
export interface ShellResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ShellOptions {
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface OSBridge {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  list(path: string): Promise<{ name: string; isDir: boolean }[]>;
  move(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Runs an allowlisted binary; see ShellSandbox for the policy layer. */
  runShell(command: string, options?: ShellOptions): Promise<ShellResult>;
  /** macOS osascript (AppleScript). Throws on non-macOS LocalOSBridge. */
  runAppleScript(script: string): Promise<string>;
  /** Native notification. Falls back to a log line off-macOS. */
  notify(title: string, body: string): Promise<void>;
  /** Secret read; production-backed by macOS Keychain, never logged. */
  keychainGet(service: string, account: string): Promise<string | null>;
  keychainSet(service: string, account: string, secret: string): Promise<void>;
}
