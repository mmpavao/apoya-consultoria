//! Privileged OS operations exposed to the webview as Tauri commands.
//!
//! This is the minimal, auditable attack surface (PRD §4.1, §4.5). Every
//! command here is the only way the front-end can touch the filesystem, the
//! shell, AppleScript, or the Keychain. The TypeScript core's `OSBridge`
//! interface mirrors these one-to-one.

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

#[derive(Debug, thiserror::Error)]
pub enum BridgeError {
    #[error("io error: {0}")]
    Io(String),
    #[error("blocked by policy: {0}")]
    Policy(String),
    #[error("unsupported on this platform: {0}")]
    Unsupported(String),
}

impl serde::Serialize for BridgeError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

type BridgeResult<T> = Result<T, BridgeError>;

/// Paths the bridge refuses to touch regardless of caller (PRD §4.5).
const BLOCKED: &[&str] = &["/.ssh/", "/System", "/private/etc", "id_rsa"];

fn guard_path(path: &str) -> BridgeResult<()> {
    if BLOCKED.iter().any(|b| path.contains(b)) {
        return Err(BridgeError::Policy(format!("sensitive path: {path}")));
    }
    Ok(())
}

#[derive(Serialize)]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
}

#[derive(Serialize)]
pub struct ShellOutput {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

#[derive(Deserialize)]
pub struct ShellRequest {
    pub command: String,
    pub cwd: Option<String>,
}

#[tauri::command]
pub fn fs_read_file(path: String) -> BridgeResult<String> {
    guard_path(&path)?;
    std::fs::read_to_string(&path).map_err(|e| BridgeError::Io(e.to_string()))
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> BridgeResult<()> {
    guard_path(&path)?;
    std::fs::write(&path, content).map_err(|e| BridgeError::Io(e.to_string()))
}

#[tauri::command]
pub fn fs_list(path: String) -> BridgeResult<Vec<DirEntry>> {
    guard_path(&path)?;
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&path).map_err(|e| BridgeError::Io(e.to_string()))? {
        let entry = entry.map_err(|e| BridgeError::Io(e.to_string()))?;
        out.push(DirEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            is_dir: entry.path().is_dir(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub fn fs_move(from: String, to: String) -> BridgeResult<()> {
    guard_path(&from)?;
    guard_path(&to)?;
    std::fs::rename(&from, &to).map_err(|e| BridgeError::Io(e.to_string()))
}

#[tauri::command]
pub fn fs_delete(path: String) -> BridgeResult<()> {
    guard_path(&path)?;
    let p = Path::new(&path);
    let res = if p.is_dir() {
        std::fs::remove_dir_all(p)
    } else {
        std::fs::remove_file(p)
    };
    res.map_err(|e| BridgeError::Io(e.to_string()))
}

/// Allowlisted, operator-free shell. The TypeScript ShellSandbox enforces the
/// policy first; this is the privileged executor of last resort.
#[tauri::command]
pub fn shell_run(req: ShellRequest) -> BridgeResult<ShellOutput> {
    if req.command.contains("sudo") {
        return Err(BridgeError::Policy("sudo is not permitted".into()));
    }
    let mut cmd = Command::new("/bin/sh");
    cmd.arg("-c").arg(&req.command);
    if let Some(cwd) = req.cwd {
        cmd.current_dir(cwd);
    }
    let out = cmd.output().map_err(|e| BridgeError::Io(e.to_string()))?;
    Ok(ShellOutput {
        stdout: String::from_utf8_lossy(&out.stdout).to_string(),
        stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        code: out.status.code().unwrap_or(-1),
    })
}

/// AppleScript via osascript. macOS only.
#[tauri::command]
pub fn run_applescript(script: String) -> BridgeResult<String> {
    #[cfg(target_os = "macos")]
    {
        let out = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output()
            .map_err(|e| BridgeError::Io(e.to_string()))?;
        if !out.status.success() {
            return Err(BridgeError::Io(String::from_utf8_lossy(&out.stderr).to_string()));
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = script;
        Err(BridgeError::Unsupported("AppleScript".into()))
    }
}

/// Read a secret from the macOS Keychain. Never logged; never returned to the LLM.
#[tauri::command]
pub fn keychain_get(service: String, account: String) -> BridgeResult<Option<String>> {
    #[cfg(target_os = "macos")]
    {
        let out = Command::new("security")
            .args(["find-generic-password", "-s", &service, "-a", &account, "-w"])
            .output()
            .map_err(|e| BridgeError::Io(e.to_string()))?;
        if out.status.success() {
            Ok(Some(String::from_utf8_lossy(&out.stdout).trim().to_string()))
        } else {
            Ok(None)
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (service, account);
        Err(BridgeError::Unsupported("Keychain".into()))
    }
}

#[tauri::command]
pub fn keychain_set(service: String, account: String, secret: String) -> BridgeResult<()> {
    #[cfg(target_os = "macos")]
    {
        let out = Command::new("security")
            .args(["add-generic-password", "-U", "-s", &service, "-a", &account, "-w", &secret])
            .output()
            .map_err(|e| BridgeError::Io(e.to_string()))?;
        if out.status.success() {
            Ok(())
        } else {
            Err(BridgeError::Io(String::from_utf8_lossy(&out.stderr).to_string()))
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (service, account, secret);
        Err(BridgeError::Unsupported("Keychain".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn guard_blocks_sensitive_paths() {
        assert!(guard_path("/Users/x/.ssh/id_rsa").is_err());
        assert!(guard_path("/System/Library").is_err());
        assert!(guard_path("/Users/x/Documents/notes.md").is_ok());
    }

    #[test]
    fn shell_rejects_sudo() {
        let req = ShellRequest { command: "sudo rm -rf /".into(), cwd: None };
        assert!(shell_run(req).is_err());
    }
}
