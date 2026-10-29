pub mod engine;
pub mod model_manager;
pub mod project_io;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Runtime, State};

use crate::engine::NativeEngine;
use crate::model_manager::{
    download_model_file, get_models_dir, get_preset_models_list, resolve_model_file, scan_local_models,
    LocalModelInfo, PresetModel,
};
use crate::project_io::{
    html_to_markdown, open_folder_in_system_explorer, pick_folder_dialog, pick_manifest_file_dialog,
    read_manifest_from_path, sanitize_filename, save_file_dialog, write_full_project_to_directory,
    ChapterExportDto, ProjectProfileDto, WorldNodeExportDto,
};

pub struct AppAiState {
    pub engine: Arc<NativeEngine>,
    pub active_download_cancel: Mutex<Option<Arc<AtomicBool>>>,
}

impl AppAiState {
    pub fn new() -> Self {
        Self {
            engine: Arc::new(NativeEngine::new()),
            active_download_cancel: Mutex::new(None),
        }
    }
}

// ============================================================================
// Comandi Tauri per la Gestione Modelli e Inferenza Nativa
// ============================================================================

/// Restituisce l'elenco dei 4 modelli consigliati preconfigurati
#[tauri::command]
fn get_preset_models() -> Vec<PresetModel> {
    get_preset_models_list()
}

/// Restituisce la lista di tutti i modelli disponibili in AppData/models o resources
#[tauri::command]
fn get_available_models<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppAiState>,
) -> Vec<LocalModelInfo> {
    let active = state.engine.get_active_model_name();
    scan_local_models(&app, active.as_deref())
}

/// Restituisce il nome del modello attualmente attivo
#[tauri::command]
fn get_active_model(state: State<'_, AppAiState>) -> Option<String> {
    state.engine.get_active_model_name()
}

/// Avvia il download asincrono di un modello da Hugging Face
#[tauri::command]
async fn start_download_model<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppAiState>,
    repo_id: String,
    filename: String,
) -> Result<String, String> {
    println!("[ZenScribe] Richiesta download: repo={}, file={}", repo_id, filename);

    let cancel_token = Arc::new(AtomicBool::new(false));
    {
        let mut lock = state.active_download_cancel.lock().map_err(|e| e.to_string())?;
        *lock = Some(cancel_token.clone());
    }

    let download_res = download_model_file(app.clone(), repo_id, filename.clone(), cancel_token).await;

    // Reset token di cancellazione
    if let Ok(mut lock) = state.active_download_cancel.lock() {
        *lock = None;
    }

    match download_res {
        Ok(path_str) => {
            // Se nessun modello è attualmente attivo, carica automaticamente questo
            if state.engine.get_active_model_name().is_none() {
                let model_path = std::path::PathBuf::from(&path_str);
                let _ = state.engine.load_model(&model_path, &filename);
            }
            Ok(path_str)
        }
        Err(e) => Err(e),
    }
}

/// Annulla un download attualmente in corso
#[tauri::command]
fn cancel_download_model(state: State<'_, AppAiState>) -> Result<(), String> {
    if let Ok(mut lock) = state.active_download_cancel.lock() {
        if let Some(token) = lock.take() {
            token.store(true, Ordering::SeqCst);
            println!("[ZenScribe] Segnale di annullamento download inviato.");
            return Ok(());
        }
    }
    Ok(())
}

/// Elimina un file modello locale dalla cartella dei modelli
#[tauri::command]
fn delete_local_model<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppAiState>,
    model_filename: String,
) -> Result<(), String> {
    if let Some(ref active) = state.engine.get_active_model_name() {
        if active.eq_ignore_ascii_case(&model_filename) {
            state.engine.unload_model();
        }
    }

    let models_dir = get_models_dir(&app);
    let target = models_dir.join(&model_filename);
    if target.exists() {
        std::fs::remove_file(&target)
            .map_err(|e| format!("Impossibile eliminare il file del modello: {}", e))?;
    }

    let companion_tok = models_dir.join(format!("{}.tokenizer.json", model_filename));
    if companion_tok.exists() {
        let _ = std::fs::remove_file(&companion_tok);
    }

    Ok(())
}

/// Cambia a runtime il modello locale attivo caricandolo in memoria
#[tauri::command]
fn switch_local_model<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppAiState>,
    model_filename: String,
) -> Result<LocalModelInfo, String> {
    println!("[ZenScribe] Cambio modello richiesto verso: {}", model_filename);

    let model_path = resolve_model_file(&app, &model_filename)
        .ok_or_else(|| format!("File modello '{}' non trovato sul disco locale.", model_filename))?;

    state.engine.load_model(&model_path, &model_filename)?;

    let (display_name, is_custom) = crate::model_manager::format_model_display_name(&model_filename);
    let size_mb = std::fs::metadata(&model_path)
        .map(|m| (m.len() as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0)
        .unwrap_or(0.0);

    Ok(LocalModelInfo {
        filename: model_filename,
        display_name,
        size_mb,
        is_active: true,
        path: model_path.to_string_lossy().to_string(),
        is_custom,
    })
}

/// Verifica se il motore nativo AI è pronto con un modello caricato in memoria
#[tauri::command]
fn check_server_ready(state: State<'_, AppAiState>) -> bool {
    state.engine.is_ready()
}

/// Alias per compatibilità con il frontend esistente
#[tauri::command]
fn is_server_ready(state: State<'_, AppAiState>) -> bool {
    state.engine.is_ready()
}

/// Alias per forzare il ricaricamento del modello attivo
#[tauri::command]
fn restart_llama_server<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppAiState>,
) -> Result<String, String> {
    if let Some(active) = state.engine.get_active_model_name() {
        switch_local_model(app, state, active)?;
        Ok("Modello riavviato correttamente".to_string())
    } else {
        Err("Nessun modello attivo da riavviare".to_string())
    }
}

/// Comando nativo di inferenza AI locale
#[tauri::command]
async fn generate_local_ai(
    state: State<'_, AppAiState>,
    prompt: String,
    system_prompt: Option<String>,
    temperature: Option<f64>,
    max_tokens: Option<usize>,
) -> Result<String, String> {
    let engine = state.engine.clone();
    let temp = temperature.unwrap_or(0.3);
    let max_tok = max_tokens.unwrap_or(1024);

    tokio::task::spawn_blocking(move || {
        engine.generate(&prompt, system_prompt.as_deref(), max_tok, temp)
    })
    .await
    .map_err(|e| format!("Errore nel task di inferenza: {}", e))?
}

/// Comando rapido per la correzione bozze e refusi con il motore nativo
#[tauri::command]
async fn correct_spelling_local(
    state: State<'_, AppAiState>,
    text: String,
    context: Option<String>,
) -> Result<String, String> {
    let system_prompt = match context {
        Some(ref ctx) => format!(
            "Sei un correttore bozze esperto per uno scrittore. Ecco il contesto del racconto (personaggi e luoghi):\n{}\n\nCorreggi esclusivamente refusi, ortografia e grammatica mantenendo inalterata la voce dell'autore. Rispondi SOLO con il testo corretto.",
            ctx
        ),
        None => "Sei un editor e correttore di bozze letterario preciso ed essenziale. Rispondi SOLO con il testo corretto, senza commenti.".to_string(),
    };

    let prompt = format!(
        "Correggi esclusivamente errori grammaticali, ortografici e refusi nel seguente testo in italiano, mantenendo intatto lo stile, la punteggiatura narrativa e la voce dell'autore. Rispondi SOLO con il testo corretto, senza spiegazioni o premesse.\n\nTesto:\n\"\"\"\n{}\n\"\"\"",
        text
    );

    generate_local_ai(state, prompt, Some(system_prompt), Some(0.2), Some(2048)).await
}

/// Comando rapido per la riformulazione e miglioramento stilistico
#[tauri::command]
async fn rephrase_text_local(
    state: State<'_, AppAiState>,
    text: String,
    context: Option<String>,
) -> Result<String, String> {
    let system_prompt = match context {
        Some(ref ctx) => format!(
            "Sei un assistente di scrittura letteraria. Ecco il contesto del racconto (personaggi e luoghi):\n{}\n\nRiscrivi migliorando fluidità e ritmo preservando i personaggi e il significato.",
            ctx
        ),
        None => "Sei un assistente di scrittura che perfeziona lo stile senza alterare la voce originale.".to_string(),
    };

    let prompt = format!(
        "Riscrivi il seguente testo migliorandone la fluidità sintattica e il ritmo espressivo, preservando il significato originale. Rispondi ESCLUSIVAMENTE con la nuova versione.\n\nTesto:\n\"\"\"\n{}\n\"\"\"",
        text
    );

    generate_local_ai(state, prompt, Some(system_prompt), Some(0.4), Some(2048)).await
}

// ============================================================================
// Comandi per la Gestione File & Struttura del Progetto su Disco
// ============================================================================

/// Apre la finestra di dialogo nativa per selezionare una cartella di progetto sul computer
#[tauri::command]
async fn select_project_folder() -> Result<Option<String>, String> {
    Ok(pick_folder_dialog().await)
}

/// Apre una cartella nel file explorer nativo di sistema (Windows Explorer)
#[tauri::command]
fn open_folder_in_explorer(folder_path: String) -> Result<(), String> {
    open_folder_in_system_explorer(&folder_path)
}

/// Esporta il capitolo corrente su file tramite dialogo Salva con Nome
#[tauri::command]
async fn export_chapter_file(
    title: String,
    content: String,
    format: Option<String>,
) -> Result<Option<String>, String> {
    let ext = format.unwrap_or_else(|| "md".to_string());
    let default_name = format!("{}.{}", sanitize_filename(&title), ext);
    if let Some(path) = save_file_dialog(&default_name, &ext).await {
        let text_content = if ext == "txt" {
            html_to_markdown(&content)
        } else {
            format!("# {}\n\n{}", title, html_to_markdown(&content))
        };
        std::fs::write(&path, text_content).map_err(|e| format!("Errore scrittura file: {}", e))?;
        Ok(Some(path))
    } else {
        Ok(None)
    }
}

/// Esporta il manoscritto completo unificato con tutti i capitoli
#[tauri::command]
async fn export_full_manuscript(
    title: String,
    chapters: Vec<ChapterExportDto>,
    format: Option<String>,
) -> Result<Option<String>, String> {
    let ext = format.unwrap_or_else(|| "md".to_string());
    let default_name = format!("{}_Completo.{}", sanitize_filename(&title), ext);
    if let Some(path) = save_file_dialog(&default_name, &ext).await {
        let mut manuscript = String::new();
        manuscript.push_str(&format!("# {}\n\n---\n\n", title));
        for ch in chapters {
            manuscript.push_str(&format!(
                "## {}\n\n{}\n\n---\n\n",
                ch.title,
                html_to_markdown(&ch.content)
            ));
        }
        std::fs::write(&path, manuscript).map_err(|e| format!("Errore scrittura manoscritto: {}", e))?;
        Ok(Some(path))
    } else {
        Ok(None)
    }
}

/// Sincronizza l'intero progetto su una cartella fisica strutturata con indice manifest
#[tauri::command]
fn sync_project_to_folder(
    folder_path: String,
    manifest_json: String,
    project: ProjectProfileDto,
    chapters: Vec<ChapterExportDto>,
    nodes: Vec<WorldNodeExportDto>,
) -> Result<String, String> {
    write_full_project_to_directory(&folder_path, &manifest_json, project, chapters, nodes)
}

/// Apre la finestra di dialogo nativa per selezionare un file manifest (.json)
#[tauri::command]
async fn select_manifest_file() -> Result<Option<String>, String> {
    Ok(pick_manifest_file_dialog().await)
}

/// Legge il contenuto JSON di un indice manifest da un file o da una cartella
#[tauri::command]
fn read_manifest_file(path: String) -> Result<String, String> {
    read_manifest_from_path(&path)
}

// ============================================================================
// Punto di ingresso dell'applicazione Tauri v2
// ============================================================================
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_ai_state = AppAiState::new();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(app_ai_state)
        .setup(|app| {
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let state = app_handle.state::<AppAiState>();
                let available = scan_local_models(&app_handle, None);
                if let Some(first) = available.first() {
                    println!(
                        "[ZenScribe] Trovato modello locale disponibile: {}. Caricamento automatico...",
                        first.filename
                    );
                    if let Some(path) = resolve_model_file(&app_handle, &first.filename) {
                        if let Err(e) = state.engine.load_model(&path, &first.filename) {
                            eprintln!("[ZenScribe] Errore precaricamento modello iniziale: {}", e);
                        }
                    }
                } else {
                    println!("[ZenScribe] Nessun modello locale presente in cache. L'utente potrà scaricarlo dai preset.");
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_preset_models,
            get_available_models,
            get_active_model,
            start_download_model,
            cancel_download_model,
            delete_local_model,
            switch_local_model,
            check_server_ready,
            is_server_ready,
            restart_llama_server,
            generate_local_ai,
            correct_spelling_local,
            rephrase_text_local,
            select_project_folder,
            select_manifest_file,
            read_manifest_file,
            open_folder_in_explorer,
            export_chapter_file,
            export_full_manuscript,
            sync_project_to_folder
        ])
        .build(tauri::generate_context!())
        .expect("Errore durante l'inizializzazione dell'applicazione Tauri");

    app.run(|_app_handle, _event| {});
}
