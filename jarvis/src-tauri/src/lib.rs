//! JARVIS Tauri application library.
//!
//! Wires the privileged OSBridge commands into the Tauri runtime and starts the
//! TypeScript orchestration core as a sidecar (PRD §4.1). The webview talks to
//! the core over IPC; only the commands registered here can touch the system.

mod osbridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            osbridge::fs_read_file,
            osbridge::fs_write_file,
            osbridge::fs_list,
            osbridge::fs_move,
            osbridge::fs_delete,
            osbridge::shell_run,
            osbridge::run_applescript,
            osbridge::keychain_get,
            osbridge::keychain_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running JARVIS");
}
