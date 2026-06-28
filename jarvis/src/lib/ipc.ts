/**
 * Typed bridge to the Tauri Rust commands (PRD §4.2 IPC). Kept thin: the heavy
 * orchestration lives in the TS core sidecar; these are only the privileged OS
 * calls. Falls back to safe no-ops when running in a plain browser (vite dev
 * without the Tauri shell) so the UI renders during front-end development.
 */
type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

interface TauriWindow {
  __TAURI__?: { core: { invoke: InvokeFn } };
}

function invoker(): InvokeFn | null {
  const w = window as unknown as TauriWindow;
  return w.__TAURI__?.core.invoke ?? null;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = invoker();
  if (!fn) throw new Error(`Tauri unavailable (browser dev): ${cmd}`);
  return fn<T>(cmd, args);
}

export const isDesktop = (): boolean => invoker() !== null;

export const osBridge = {
  readFile: (path: string) => invoke<string>('fs_read_file', { path }),
  writeFile: (path: string, content: string) => invoke<void>('fs_write_file', { path, content }),
  list: (path: string) => invoke<{ name: string; is_dir: boolean }[]>('fs_list', { path }),
  shellRun: (command: string, cwd?: string) =>
    invoke<{ stdout: string; stderr: string; code: number }>('shell_run', { req: { command, cwd } }),
  keychainGet: (service: string, account: string) =>
    invoke<string | null>('keychain_get', { service, account }),
  keychainSet: (service: string, account: string, secret: string) =>
    invoke<void>('keychain_set', { service, account, secret }),
};
