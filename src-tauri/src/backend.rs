use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU16, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

/// Default port the backend tries first (kept in sync with backend/src/config/env.ts).
const DEFAULT_PORT: u16 = 3000;

/// The port the backend actually bound, discovered after it starts. 0 = unknown.
static BACKEND_PORT: AtomicU16 = AtomicU16::new(0);

/// File the backend writes after binding (see backend/src/server.ts). Reading it
/// lets us learn the port even before the first /health probe succeeds.
fn backend_port_file_path() -> std::path::PathBuf {
    std::path::Path::new(&data_dir()).join("backend-port")
}

/// Candidate data dirs the backend may have written its port file into. The
/// backend's bootstrap resolves `~/.config/LedgerFlow` on non-Windows while the
/// shell's `data_dir()` prefers `~/Library/Application Support/LedgerFlow`, so
/// we check both on macOS.
fn backend_port_file_candidates() -> Vec<std::path::PathBuf> {
    let dirs = vec![backend_port_file_path()];
    #[cfg(target_os = "macos")]
    if let Ok(home) = std::env::var("HOME") {
        dirs.push(std::path::PathBuf::from(format!("{home}/.config/LedgerFlow")));
    }
    dirs
}

fn read_backend_port_file() -> Option<u16> {
    for path in backend_port_file_candidates() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(port) = content.trim().parse::<u16>() {
                if port > 0 {
                    return Some(port);
                }
            }
        }
    }
    None
}

fn remember_backend_port(port: u16) {
    BACKEND_PORT.store(port, Ordering::SeqCst);
}

/// The port the backend is (or will be) on: an already-discovered value, else
/// the port file, else the default.
fn resolved_backend_port() -> u16 {
    let known = BACKEND_PORT.load(Ordering::SeqCst);
    if known != 0 {
        return known;
    }
    read_backend_port_file().unwrap_or(DEFAULT_PORT)
}

/// Report the port the backend is listening on, for the frontend. Exposed as a
/// Tauri command so the webview can point its API calls at the real port.
#[tauri::command]
pub fn backend_port() -> u16 {
    resolved_backend_port()
}

/// Path of the sidecar process log (stdout + stderr) inside the user data dir.
/// Kept separate from `tauri-backend.log` (which holds Rust-side diagnostics).
fn process_log_path() -> std::path::PathBuf {
    std::path::Path::new(&data_dir()).join("backend-process.log")
}

/// Append a line to the sidecar process log.
fn process_log_line(message: &str) {
    if let Ok(mut f) =
        std::fs::OpenOptions::new().create(true).append(true).open(process_log_path())
    {
        let _ = writeln!(f, "{} {message}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
    }
}

/// Returns the last ~100 lines of the sidecar process log, or a short
/// placeholder when nothing has been written yet. Exposed to the frontend so
/// the startup error screen can show the real reason the backend failed.
#[tauri::command]
pub fn backend_log_tail() -> String {
    match std::fs::read_to_string(process_log_path()) {
        Ok(content) => {
            let lines: Vec<&str> = content.lines().collect();
            let tail = if lines.len() > 100 { &lines[lines.len() - 100..] } else { &lines[..] };
            tail.join("\n")
        }
        Err(_) => "(no backend process log written yet)".to_string(),
    }
}

static BACKEND_ALIVE: AtomicBool = AtomicBool::new(false);
static CHILD: Mutex<Option<Child>> = Mutex::new(None);

/// Per-user data directory. On Windows this is `%APPDATA%\LedgerFlow`; on
/// macOS `~/Library/Application Support/LedgerFlow` (must match the backend's
/// own bootstrap resolution).
fn data_dir() -> String {
    if let Ok(dir) = std::env::var("LEDGERFLOW_DATA_DIR") {
        return dir;
    }
    #[cfg(windows)]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            return format!("{appdata}\\LedgerFlow");
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{home}/Library/Application Support/LedgerFlow");
        }
    }
    ".".to_string()
}

fn log_line(message: &str) {
    use std::io::Write;
    let dir = data_dir();
    let path = std::path::Path::new(&dir).join("tauri-backend.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(f, "{} {message}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
    }
}

/// Perform a single HTTP GET against the backend's `/health` endpoint on one
/// port and return true only when the body reports `{"status":"ok"}`.
fn probe_health_on(port: u16) -> bool {
    let addr: std::net::SocketAddr = match format!("127.0.0.1:{port}").parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    if let Ok(mut stream) = std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(600)) {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(1200)));
        let _ = stream.write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
        let mut buf = [0u8; 1024];
        if let Ok(n) = stream.read(&mut buf) {
            if n > 0 {
                let text = String::from_utf8_lossy(&buf[..n]);
                if text.contains("\"status\":\"ok\"") {
                    return true;
                }
            }
        }
    }
    false
}

/// Probe the discovered port first, then fall back to the default in case the
/// port file is stale (e.g. a previous session on 3001, but the live backend
/// now runs on 3000).
fn probe_health() -> bool {
    let primary = resolved_backend_port();
    if probe_health_on(primary) {
        remember_backend_port(primary);
        return true;
    }
    if primary != DEFAULT_PORT && probe_health_on(DEFAULT_PORT) {
        remember_backend_port(DEFAULT_PORT);
        return true;
    }
    false
}

/// True when something on 127.0.0.1:3000 answers /health with `{"status":"ok"}`
/// — i.e. a healthy LedgerFlow backend is already serving this device.
fn port_has_healthy_backend() -> bool {
    // Probe a few times: a backend that is mid-startup could otherwise be
    // misjudged as dead, which would make us wrongly clear its process.
    for _ in 0..3 {
        if probe_health() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(400));
    }
    false
}

/// Wait (up to `timeout_ms`) for the spawned child to answer `/health` with
/// `{"status":"ok"}`. Returns false immediately if the process exits early.
fn wait_for_health(child: &mut Child, timeout_ms: u64) -> bool {
    let start = Instant::now();
    loop {
        if let Some(status) = child.try_wait().ok().flatten() {
            process_log_line(&format!(
                "backend child exited early (code {:?}) — this usually means the port is in use by another program",
                status.code()
            ));
            return false;
        }
        if probe_health() {
            process_log_line("backend health check passed");
            return true;
        }
        if Instant::now().duration_since(start).as_millis() as u64 >= timeout_ms {
            process_log_line(&format!(
                "backend did not answer /health within {}ms (still alive, giving up this attempt)",
                timeout_ms
            ));
            return false;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

/// Launches the packaged backend executable (sidecar) once.
///
/// In development the backend is started by `beforeDevCommand`, so this is a
/// no-op. In production we resolve the bundled sidecar and spawn it detached,
/// then wait until its `/health` endpoint answers so we never report a ready
/// backend that is actually still migrating or crashed.
pub fn spawn_backend(app: AppHandle) {
    // If a healthy backend is already listening (e.g. a second app window, or a
    // leftover process from a previous install), reuse it instead of spawning a
    // second one that would fail to bind the port.
    if port_has_healthy_backend() {
        log_line("existing healthy backend on :3000 — reusing it");
        return;
    }

    // No healthy backend is up. A stale (broken) LedgerFlow backend from an
    // earlier install/reinstall may be squatting on the port and answering
    // nothing; clear those before starting a fresh instance. Give the OS a
    // moment to release the socket afterwards.
    #[cfg(windows)]
    if let Ok(out) = Command::new("taskkill")
        .args(["/IM", "ledgerflow-backend*.exe", "/F"])
        .output()
    {
        log_line(&format!("cleaned stale backends (exit: {:?})", out.status.code()));
    }
    std::thread::sleep(std::time::Duration::from_millis(1000));

    let resource_dir = match app.path().resource_dir() {
        Ok(d) => d,
        Err(err) => {
            log_line(&format!("resource_dir failed: {err}"));
            return;
        }
    };
    // The sidecar filename is platform-specific: `ledgerflow-backend` on
    // macOS/Linux, `ledgerflow-backend.exe` on Windows. Tauri renames the
    // externalBin sidecar to exactly this name inside the resource dir.
    let backend_name = if cfg!(windows) { "ledgerflow-backend.exe" } else { "ledgerflow-backend" };
    let backend_exe = resource_dir.join(backend_name);
    log_line(&format!("resource_dir: {}", resource_dir.display()));
    log_line(&format!("candidate sidecar: {}", backend_exe.display()));

    if !backend_exe.exists() {
        log_line("sidecar NOT found — backend will not be started");
        process_log_line("sidecar NOT found — backend will not be started");
        return;
    }
    log_line("sidecar found");

    // Capture the backend's own stdout/stderr into a per-user log file so a
    // startup failure on a fresh machine leaves an actionable trace instead of
    // being silently discarded.
    let out_log = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(process_log_path());
    if let Err(err) = &out_log {
        log_line(&format!("could not open process log: {err}"));
    }
    process_log_line("=== LedgerFlow backend session start ===");

    // Spawn the sidecar and wait for a real /health response. Retry a few
    // times: the first boot runs migrations + seed and can be slow, and a
    // transient port conflict right after boot is worth one clean retry.
    let mut spawned_child: Option<Child> = None;
    for attempt in 1..=3 {
        let mut cmd = Command::new(&backend_exe);
        cmd.stdin(Stdio::null());
        if let Ok(file) = &out_log {
            if let Ok(out) = file.try_clone() {
                cmd.stdout(Stdio::from(out));
            }
            if let Ok(err) = file.try_clone() {
                cmd.stderr(Stdio::from(err));
            }
        }

        // The backend always binds 0.0.0.0 so the host (super admin) device is
        // reachable by other machines on the same WiFi when a workspace is created.
        // Client devices point their frontend at this device's IP instead.
        cmd.env("LAN_MODE", "host");

        // On Windows the backend is a console executable; without this flag Windows
        // opens a separate console window next to the app window. Tell Windows to
        // create the process without any window so the server runs silently in the
        // background.
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }

        let mut child = match cmd.spawn() {
            Ok(c) => c,
            Err(err) => {
                log_line(&format!("spawn failed (attempt {attempt}): {err}"));
                process_log_line(&format!("spawn failed (attempt {attempt}): {err}"));
                return;
            }
        };
        log_line(&format!("spawned (attempt {attempt})"));
        process_log_line(&format!("spawned (attempt {attempt})"));

        if wait_for_health(&mut child, 20_000) {
            spawned_child = Some(child);
            break;
        }

        // Kill the half-started process before retrying so a fresh one can bind
        // the port. `wait_for_health` already logged the exit/diagnostic.
        let _ = child.kill();
        for _ in 0..25 {
            if child.try_wait().ok().flatten().is_some() {
                break;
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        process_log_line(&format!("backend did not become healthy (attempt {attempt}); retrying"));
    }

    match spawned_child {
        Some(child) => {
            let mut guard = CHILD.lock().unwrap();
            *guard = Some(child);
            BACKEND_ALIVE.store(true, Ordering::SeqCst);
            log_line("backend ready");
        }
        None => {
            log_line("gave up starting backend after 3 attempts");
            process_log_line("gave up starting backend after 3 attempts");
        }
    }
}

/// Terminates the backend child process tree on app exit.
pub fn kill_backend() {
    if !BACKEND_ALIVE.swap(false, Ordering::SeqCst) {
        return;
    }
    let mut guard = CHILD.lock().unwrap();
    if let Some(mut child) = guard.take() {
        #[cfg(windows)]
        {
            let _ = terminate_tree(child.id());
        }
        let _ = child.kill();
        for _ in 0..50 {
            if child.try_wait().ok().flatten().is_some() {
                break;
            }
            std::thread::sleep(std::time::Duration::from_millis(20));
        }
    }
}

#[cfg(windows)]
fn terminate_tree(parent_pid: u32) -> std::io::Result<()> {
    use windows_sys::Win32::Foundation::HANDLE;
    use windows_sys::Win32::System::Threading::OpenProcess;
    use windows_sys::Win32::System::Threading::TerminateProcess;
    use windows_sys::Win32::System::Threading::PROCESS_TERMINATE;

    let handle = unsafe { OpenProcess(PROCESS_TERMINATE, 0, parent_pid) } as HANDLE;
    if handle.is_null() {
        return Ok(());
    }
    unsafe {
        let _ = TerminateProcess(handle, 1);
        windows_sys::Win32::Foundation::CloseHandle(handle);
    }
    Ok(())
}
