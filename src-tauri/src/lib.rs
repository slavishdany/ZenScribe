use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, RunEvent, Runtime, State, WindowEvent};

// ============================================================================
// Modulo Windows: Job Object per la prevenzione assoluta di processi zombie
// ============================================================================
#[cfg(target_os = "windows")]
mod windows_job {
    use std::mem;
    use std::os::windows::io::AsRawHandle;
    use std::process::Child;
    use std::ptr;

    type HANDLE = *mut std::ffi::c_void;
    type BOOL = i32;

    #[repr(C)]
    struct IO_COUNTERS {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: u32,
        minimum_working_set_size: usize,
        maximum_working_set_size: usize,
        active_process_limit: u32,
        affinity: usize,
        priority_class: u32,
        scheduling_class: u32,
    }

    #[repr(C)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        io_info: IO_COUNTERS,
        process_memory_limit: usize,
        job_memory_limit: usize,
        peak_process_memory_used: usize,
        peak_job_memory_used: usize,
    }

    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x2000;
    const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS: u32 = 9;

    #[link(name = "kernel32")]
    extern "system" {
        fn CreateJobObjectW(lpJobAttributes: *const std::ffi::c_void, lpName: *const u16) -> HANDLE;
        fn SetInformationJobObject(
            hJob: HANDLE,
            JobObjectInformationClass: u32,
            lpJobObjectInformation: *const std::ffi::c_void,
            cbJobObjectInformationLength: u32,
        ) -> BOOL;
        fn AssignProcessToJobObject(hJob: HANDLE, hProcess: HANDLE) -> BOOL;
        fn CloseHandle(hObject: HANDLE) -> BOOL;
    }

    pub struct JobHandle(pub HANDLE);

    unsafe impl Send for JobHandle {}
    unsafe impl Sync for JobHandle {}

    impl Drop for JobHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                unsafe {
                    CloseHandle(self.0);
                }
            }
        }
    }

    /// Assegna il processo figlio a un Job Object di Windows con limite KILL_ON_JOB_CLOSE.
    /// Il kernel Windows garantisce la terminazione del processo figlio nel caso
    /// in cui il processo genitore termini per qualsiasi motivo (anche crash o chiusura da Task Manager).
    pub fn assign_process_to_job(child: &Child) -> Option<JobHandle> {
        unsafe {
            let job = CreateJobObjectW(ptr::null(), ptr::null());
            if job.is_null() {
                eprintln!("[ZenScribe] Impossibile creare il Job Object Windows");
                return None;
            }

            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = mem::zeroed();
            info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let success = SetInformationJobObject(
                job,
                JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS,
                &info as *const _ as *const std::ffi::c_void,
                mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );

            if success == 0 {
                eprintln!("[ZenScribe] Errore configurazione Job Object con SetInformationJobObject");
                CloseHandle(job);
                return None;
            }

            let process_handle = child.as_raw_handle() as HANDLE;
            let assign_success = AssignProcessToJobObject(job, process_handle);
            if assign_success == 0 {
                eprintln!("[ZenScribe] Errore nell'assegnazione del processo al Job Object");
                CloseHandle(job);
                return None;
            }

            Some(JobHandle(job))
        }
    }
}

// ============================================================================
// Informazioni Modello Locale & Stato
// ============================================================================
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct LocalModelInfo {
    pub filename: String,
    pub display_name: String,
    pub size_mb: f64,
    pub is_active: bool,
}

pub struct LlamaProcess {
    pub child: Mutex<Option<Child>>,
    #[cfg(target_os = "windows")]
    pub job: Mutex<Option<windows_job::JobHandle>>,
    pub active_model: Mutex<Option<String>>,
}

impl LlamaProcess {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            #[cfg(target_os = "windows")]
            job: Mutex::new(None),
            active_model: Mutex::new(None),
        }
    }

    /// Arresta immediatamente e pulisce il processo figlio
    pub fn stop(&self) {
        if let Ok(mut lock) = self.child.lock() {
            if let Some(mut child) = lock.take() {
                println!("[ZenScribe] Arresto in corso del server Llamafile (PID: {})...", child.id());
                let _ = child.kill();
                let _ = child.wait();
                println!("[ZenScribe] Processo Llamafile terminato.");
            }
        }
        #[cfg(target_os = "windows")]
        if let Ok(mut job_lock) = self.job.lock() {
            let _ = job_lock.take();
        }
    }
}

impl Drop for LlamaProcess {
    fn drop(&mut self) {
        self.stop();
    }
}

// ============================================================================
// Risoluzione percorsi e gestione modelli
// ============================================================================

fn get_candidate_resource_dirs<R: Runtime>(app_handle: &AppHandle<R>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // 1. Directory risorse ufficiale di Tauri v2 (bundle di produzione)
    if let Ok(p) = app_handle.path().resource_dir() {
        dirs.push(p.join("resources"));
        dirs.push(p);
    }

    // 2. Directory di lavoro corrente
    if let Ok(cwd) = std::env::current_dir() {
        dirs.push(cwd.join("resources"));
        dirs.push(cwd.join("src-tauri").join("resources"));
        if let Some(parent) = cwd.parent() {
            dirs.push(parent.join("resources"));
        }
    }

    // 3. Fallback percorsi relativi comuni
    dirs.push(PathBuf::from("resources"));
    dirs.push(PathBuf::from("../resources"));
    dirs.push(PathBuf::from("src-tauri/resources"));

    // 4. Directory dell'eseguibile compilato
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            dirs.push(exe_dir.join("resources"));
            dirs.push(exe_dir.to_path_buf());
            if let Some(p) = exe_dir.parent() {
                dirs.push(p.join("resources"));
            }
        }
    }

    dirs
}

fn format_model_display_name(filename: &str) -> String {
    let lower = filename.to_lowercase();
    if lower.contains("modello-italiano") {
        "Modello Italiano (Llama 3.2 3B)".to_string()
    } else if lower.contains("qwen3.5-0.8b") || (lower.contains("qwen") && lower.contains("0.8b")) {
        "Qwen 3.5 0.8B (Ultra Veloce)".to_string()
    } else if lower.contains("qwen-2.5-1.5b") || (lower.contains("qwen") && lower.contains("1.5b")) {
        "Qwen 2.5 1.5B (Bilanciato)".to_string()
    } else {
        filename
            .replace(".llamafile.exe", "")
            .replace(".llamafile", "")
            .replace(".exe", "")
            .replace("_", " ")
            .replace("-", " ")
    }
}

/// Restituisce la lista di tutti i modelli Llamafile eseguibili presenti in `resources/`
fn scan_available_models<R: Runtime>(app_handle: &AppHandle<R>, active_name: Option<&str>) -> Vec<LocalModelInfo> {
    let search_dirs = get_candidate_resource_dirs(app_handle);
    let mut models = Vec::new();
    let mut seen_filenames = std::collections::HashSet::new();

    for dir in &search_dirs {
        if !dir.exists() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let mut path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    let lower = file_name.to_lowercase();

                    // Su Windows auto-rinomina .llamafile in .llamafile.exe se mancante
                    #[cfg(target_os = "windows")]
                    if lower.ends_with(".llamafile") && !lower.ends_with(".exe") {
                        let new_path = path.with_extension("llamafile.exe");
                        if !new_path.exists() {
                            if let Ok(_) = std::fs::rename(&path, &new_path) {
                                println!("[ZenScribe] Ridenominato in: {}", new_path.display());
                                path = new_path;
                            }
                        }
                    }

                    let final_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                    let final_lower = final_name.to_lowercase();

                    let is_candidate = final_lower.ends_with(".llamafile.exe")
                        || final_lower.contains("llamafile")
                        || (final_lower.ends_with(".exe") && (final_lower.contains("qwen") || final_lower.contains("llama") || final_lower.contains("modello")));

                    let is_placeholder = final_lower.contains("msvc");

                    if is_candidate && !is_placeholder {
                        if !seen_filenames.contains(&final_name) {
                            if let Ok(meta) = std::fs::metadata(&path) {
                                if meta.len() > 1024 * 1024 { // Almeno 1MB
                                    seen_filenames.insert(final_name.clone());
                                    let is_active = match active_name {
                                        Some(active) => active == final_name,
                                        None => false,
                                    };
                                    models.push(LocalModelInfo {
                                        display_name: format_model_display_name(&final_name),
                                        filename: final_name,
                                        size_mb: (meta.len() as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0,
                                        is_active,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Ordina: prima quello con 'italiano', poi per dimensione o nome
    models.sort_by(|a, b| {
        let a_it = a.filename.to_lowercase().contains("italiano");
        let b_it = b.filename.to_lowercase().contains("italiano");
        if a_it && !b_it {
            std::cmp::Ordering::Less
        } else if !a_it && b_it {
            std::cmp::Ordering::Greater
        } else {
            a.filename.cmp(&b.filename)
        }
    });

    models
}

/// Individua il percorso del file corrispondente al nome richiesto (o sceglie il preferito)
fn resolve_model_binary<R: Runtime>(app_handle: &AppHandle<R>, target_filename: Option<&str>) -> Option<(PathBuf, String)> {
    let search_dirs = get_candidate_resource_dirs(app_handle);

    // 1. Se è stato richiesto un file specifico
    if let Some(target) = target_filename {
        for dir in &search_dirs {
            let p = dir.join(target);
            if p.exists() {
                return Some((p, target.to_string()));
            }
            // Prova con estensione .exe se omessa
            let p_exe = dir.join(format!("{}.exe", target));
            if p_exe.exists() {
                return Some((p_exe, format!("{}.exe", target)));
            }
        }
    }

    // 2. Fallback: primo modello disponibile dalla scansione
    let available = scan_available_models(app_handle, None);
    if let Some(first) = available.first() {
        for dir in &search_dirs {
            let p = dir.join(&first.filename);
            if p.exists() {
                return Some((p, first.filename.clone()));
            }
        }
    }

    None
}

/// Rileva facoltativamente un modello GGUF esterno se presente
fn find_gguf_model<R: Runtime>(app_handle: &AppHandle<R>) -> Option<PathBuf> {
    let search_dirs = get_candidate_resource_dirs(app_handle);

    for dir in &search_dirs {
        if !dir.exists() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    if let Some(ext) = path.extension() {
                        if ext.to_string_lossy().to_lowercase() == "gguf" {
                            if let Ok(meta) = entry.metadata() {
                                if meta.len() > 1024 * 1024 {
                                    println!("[ZenScribe] Trovato modello GGUF esterno: {}", path.display());
                                    return Some(path);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    None
}

fn spawn_llamafile_server<R: Runtime>(
    app_handle: &AppHandle<R>,
    target_filename: Option<&str>,
) -> Result<(Child, String), String> {
    let (server_path, chosen_name) = resolve_model_binary(app_handle, target_filename).ok_or_else(|| {
        "Nessun eseguibile Llamafile valido (> 1 MB) trovato nella cartella 'resources/'".to_string()
    })?;

    let maybe_model_path = find_gguf_model(app_handle);

    println!("[ZenScribe] Avvio processo Llamafile: {}", server_path.display());
    if let Some(ref m) = maybe_model_path {
        println!("[ZenScribe] Modello GGUF associato: {}", m.display());
    } else {
        println!("[ZenScribe] Utilizzo dei pesi del modello integrati nel pacchetto Llamafile.");
    }

    let mut cmd = Command::new(&server_path);

    // Parametri server universali compatibili con tutte le versioni di Llamafile:
    // --server: modalità server HTTP OpenAI-compatible
    // --port 8080: porta locale per ZenScribe
    // --host 127.0.0.1: limitato a localhost per privacy e sicurezza
    // -c 4096: contesto ridotto, il default del modello (131072) richiede ~14 GB di KV cache
    let mut args = vec![
        "--server".to_string(),
        "--port".to_string(),
        "8080".to_string(),
        "--host".to_string(),
        "127.0.0.1".to_string(),
        "-c".to_string(),
        "4096".to_string(),
    ];

    if let Some(ref m) = maybe_model_path {
        args.push("--model".to_string());
        args.push(m.to_string_lossy().to_string());
    }

    cmd.args(&args);

    // Windows: imposta il flag CREATE_NO_WINDOW per eseguire il processo in background in modo totalmente invisibile
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    // stdout/stderr su file di log (sovrascritto ad ogni avvio): evita deadlock di I/O e
    // lascia traccia degli errori di avvio del server
    let log_dir = app_handle
        .path()
        .app_log_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let _ = std::fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("llamafile.log");
    match std::fs::File::create(&log_path).and_then(|f| f.try_clone().map(|c| (f, c))) {
        Ok((out, err)) => {
            println!("[ZenScribe] Log del server Llamafile: {}", log_path.display());
            cmd.stdout(Stdio::from(out));
            cmd.stderr(Stdio::from(err));
        }
        Err(e) => {
            eprintln!("[ZenScribe] Impossibile creare il log {}: {}", log_path.display(), e);
            cmd.stdout(Stdio::null());
            cmd.stderr(Stdio::null());
        }
    }

    let child = cmd.spawn().map_err(|e| format!("Impossibile avviare il processo Llamafile: {}", e))?;
    Ok((child, chosen_name))
}

// ============================================================================
// Health check del server Llamafile (Porta 8080)
// ============================================================================
fn check_llamafile_health(addr_str: &str) -> bool {
    use std::io::{Read, Write};

    let Ok(addr) = addr_str.parse::<SocketAddr>() else {
        return false;
    };

    let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(500)) else {
        return false;
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(800)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));

    let request = b"GET /health HTTP/1.1\r\nHost: 127.0.0.1:8080\r\nConnection: close\r\n\r\n";
    if stream.write_all(request).is_err() {
        return false;
    }

    let mut response = [0u8; 512];
    match stream.read(&mut response) {
        Ok(n) if n > 0 => {
            let res = String::from_utf8_lossy(&response[..n]);
            res.contains("200 OK") || res.contains("\"status\":\"ok\"") || res.contains("\"status\": \"ok\"")
        }
        _ => false,
    }
}

// ============================================================================
// Comandi Tauri esportati al frontend
// ============================================================================

/// Verifica se il server locale Llamafile sulla porta 8080 è attivo e pronto a ricevere richieste.
#[tauri::command]
fn check_server_ready() -> bool {
    is_server_ready()
}

/// Alias per compatibilità con differenti convenzioni di invocazione frontend
#[tauri::command]
fn is_server_ready() -> bool {
    check_llamafile_health("127.0.0.1:8080")
}

/// Restituisce la lista di tutti i modelli Llamafile disponibili in resources/
#[tauri::command]
fn get_available_models<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LlamaProcess>,
) -> Vec<LocalModelInfo> {
    let active_name = state.active_model.lock().ok().and_then(|guard| guard.clone());
    scan_available_models(&app, active_name.as_deref())
}

/// Restituisce il nome del modello attualmente attivo
#[tauri::command]
fn get_active_model(state: State<'_, LlamaProcess>) -> Option<String> {
    state.active_model.lock().ok().and_then(|guard| guard.clone())
}

/// Cambia a runtime il modello locale attivo riavviando il processo con il nuovo eseguibile
#[tauri::command]
fn switch_local_model<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LlamaProcess>,
    model_filename: String,
) -> Result<LocalModelInfo, String> {
    println!("[ZenScribe] Cambio modello richiesto: {}", model_filename);

    // 1. Arresta il processo precedente
    state.stop();

    // 2. Avvia il nuovo modello
    match spawn_llamafile_server(&app, Some(&model_filename)) {
        Ok((child, name)) => {
            #[cfg(target_os = "windows")]
            {
                let job = windows_job::assign_process_to_job(&child);
                *state.job.lock().unwrap() = job;
            }
            *state.child.lock().unwrap() = Some(child);
            *state.active_model.lock().unwrap() = Some(name.clone());

            let display = format_model_display_name(&name);
            Ok(LocalModelInfo {
                filename: name,
                display_name: display,
                size_mb: 0.0,
                is_active: true,
            })
        }
        Err(err) => Err(err),
    }
}

/// Comando per forzare il riavvio del server locale attivo
#[tauri::command]
fn restart_llama_server<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LlamaProcess>,
) -> Result<String, String> {
    let current = state.active_model.lock().ok().and_then(|guard| guard.clone());
    state.stop();

    match spawn_llamafile_server(&app, current.as_deref()) {
        Ok((child, name)) => {
            let pid = child.id();
            #[cfg(target_os = "windows")]
            {
                let job = windows_job::assign_process_to_job(&child);
                *state.job.lock().unwrap() = job;
            }
            *state.child.lock().unwrap() = Some(child);
            *state.active_model.lock().unwrap() = Some(name.clone());
            Ok(format!("Server avviato correttamente con PID: {}", pid))
        }
        Err(err) => Err(err),
    }
}

// ============================================================================
// Punto di ingresso dell'applicazione Tauri v2
// ============================================================================
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(LlamaProcess::new())
        .setup(|app| {
            let state = app.state::<LlamaProcess>();
            match spawn_llamafile_server(app.handle(), None) {
                Ok((child, chosen_name)) => {
                    let pid = child.id();
                    println!(
                        "[ZenScribe] Server Llamafile avviato con successo (PID: {}, Modello: {})",
                        pid, chosen_name
                    );

                    #[cfg(target_os = "windows")]
                    {
                        let job = windows_job::assign_process_to_job(&child);
                        if job.is_some() {
                            println!("[ZenScribe] Processo associato al Job Object Windows (Kill-on-Close attivo)");
                        }
                        *state.job.lock().unwrap() = job;
                    }

                    *state.child.lock().unwrap() = Some(child);
                    *state.active_model.lock().unwrap() = Some(chosen_name);
                }
                Err(err) => {
                    eprintln!("[ZenScribe] Avviso avvio motore locale: {}", err);
                    eprintln!("[ZenScribe] L'interfaccia sarà avviata normalmente.");
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_server_ready,
            is_server_ready,
            get_available_models,
            get_active_model,
            switch_local_model,
            restart_llama_server
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                println!("[ZenScribe] Finestra chiusa/distrutta, arresto del server AI locale...");
                let state = window.state::<LlamaProcess>();
                state.stop();
            }
        })
        .build(tauri::generate_context!())
        .expect("Errore durante l'inizializzazione dell'applicazione Tauri");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } | RunEvent::Exit = event {
            println!("[ZenScribe] Chiusura applicazione richiesta, pulizia processi...");
            let state = app_handle.state::<LlamaProcess>();
            state.stop();
        }
    });
}
