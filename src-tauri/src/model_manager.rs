use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PresetModel {
    pub id: String,
    pub name: String,
    pub badge: String,
    pub description: String,
    pub repo_id: String,
    pub filename: String,
    pub size_label: String,
    pub approx_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LocalModelInfo {
    pub filename: String,
    pub display_name: String,
    pub size_mb: f64,
    pub is_active: bool,
    pub path: String,
    pub is_custom: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DownloadProgress {
    pub repo_id: String,
    pub filename: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f64,
    pub speed_mbps: f64,
    pub status: String, // "downloading" | "completed" | "error" | "cached" | "cancelled"
    pub error: Option<String>,
}

pub fn get_preset_models_list() -> Vec<PresetModel> {
    vec![
        PresetModel {
            id: "llama-3.2-3b".to_string(),
            name: "Llama 3.2 3B".to_string(),
            badge: "Consigliato - Veloce".to_string(),
            description: "Circa 2.0 GB. Ottimo per PC standard, basso consumo di RAM.".to_string(),
            repo_id: "bartowski/Llama-3.2-3B-Instruct-GGUF".to_string(),
            filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf".to_string(),
            size_label: "2.02 GB".to_string(),
            approx_bytes: 2_170_000_000,
        },
        PresetModel {
            id: "gemma-2-2b".to_string(),
            name: "Gemma 2 2B".to_string(),
            badge: "Leggerissimo".to_string(),
            description: "Circa 1.6 GB. Ideale per computer datati o laptop.".to_string(),
            repo_id: "bartowski/gemma-2-2b-it-GGUF".to_string(),
            filename: "gemma-2-2b-it-Q4_K_M.gguf".to_string(),
            size_label: "1.75 GB".to_string(),
            approx_bytes: 1_880_000_000,
        },
        PresetModel {
            id: "mistral-7b-v0.3".to_string(),
            name: "Mistral 7B v0.3".to_string(),
            badge: "Bilanciato - Alta qualità".to_string(),
            description: "Circa 4.4 GB. Più intelligente, richiede configurazioni moderne (almeno 16GB RAM).".to_string(),
            repo_id: "bartowski/Mistral-7B-Instruct-v0.3-GGUF".to_string(),
            filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf".to_string(),
            size_label: "4.37 GB".to_string(),
            approx_bytes: 4_690_000_000,
        },
        PresetModel {
            id: "phi-3-medium".to_string(),
            name: "Phi-3 Medium".to_string(),
            badge: "Avanzato - Logica".to_string(),
            description: "Circa 7.9 GB. Consigliato per compiti complessi e PC dotati di GPU dedicata.".to_string(),
            repo_id: "bartowski/Phi-3-medium-4k-instruct-GGUF".to_string(),
            filename: "Phi-3-medium-4k-instruct-Q4_K_M.gguf".to_string(),
            size_label: "7.90 GB".to_string(),
            approx_bytes: 8_480_000_000,
        },
    ]
}

/// Restituisce la directory protetta per la memorizzazione dei modelli scaricati (es. AppData/Local/ZenScribe/models)
pub fn get_models_dir<R: Runtime>(app_handle: &AppHandle<R>) -> PathBuf {
    let base_dir = if let Ok(dir) = app_handle.path().app_local_data_dir() {
        dir
    } else if let Ok(dir) = app_handle.path().app_data_dir() {
        dir
    } else {
        PathBuf::from("models")
    };

    let models_dir = base_dir.join("models");
    let _ = fs::create_dir_all(&models_dir);
    models_dir
}

/// Helper per trovare directory risorse o fallback
pub fn get_search_dirs<R: Runtime>(app_handle: &AppHandle<R>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    dirs.push(get_models_dir(app_handle));

    if let Ok(p) = app_handle.path().resource_dir() {
        dirs.push(p.join("resources"));
        dirs.push(p);
    }

    if let Ok(cwd) = std::env::current_dir() {
        dirs.push(cwd.join("models"));
        dirs.push(cwd.join("resources"));
        dirs.push(cwd.join("src-tauri").join("resources"));
    }

    dirs
}

pub fn format_model_display_name(filename: &str) -> (String, bool) {
    let presets = get_preset_models_list();
    for p in presets {
        if p.filename.eq_ignore_ascii_case(filename) {
            return (format!("{} ({})", p.name, p.badge), false);
        }
    }

    let lower = filename.to_lowercase();
    if lower.contains("meta-llama-3.1-8b") {
        ("Meta Llama 3.1 8B Instruct".to_string(), false)
    } else if lower.contains("llama-3.2-3b") {
        ("Llama 3.2 3B Instruct".to_string(), false)
    } else if lower.contains("llama-3.2-1b") {
        ("Llama 3.2 1B Instruct".to_string(), false)
    } else if lower.contains("gemma-2-2b") {
        ("Gemma 2 2B Instruct".to_string(), false)
    } else if lower.contains("mistral-7b") {
        ("Mistral 7B v0.3 Instruct".to_string(), false)
    } else if lower.contains("phi-3-medium") {
        ("Phi-3 Medium Instruct".to_string(), false)
    } else if lower.contains("qwen") {
        ("Qwen Model".to_string(), true)
    } else {
        let clean = filename
            .replace(".llamafile.exe", "")
            .replace(".llamafile", "")
            .replace(".gguf", "")
            .replace(".exe", "")
            .replace("_", " ")
            .replace("-", " ");
        (clean, true)
    }
}

/// Scansiona tutti i modelli disponibili sia in AppData/models che nelle cartelle resources
pub fn scan_local_models<R: Runtime>(
    app_handle: &AppHandle<R>,
    active_filename: Option<&str>,
) -> Vec<LocalModelInfo> {
    let search_dirs = get_search_dirs(app_handle);
    let mut models = Vec::new();
    let mut seen_filenames = std::collections::HashSet::new();

    for dir in &search_dirs {
        if !dir.exists() {
            continue;
        }

        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                    let lower = file_name.to_lowercase();

                    // Ignora file temporanei o eseguibili runner
                    if lower.ends_with(".part")
                        || lower.ends_with(".tmp")
                        || lower.ends_with(".tokenizer.json")
                        || lower.starts_with("llamafile-server")
                        || lower == "llamafile.exe"
                        || lower == "llamafile"
                    {
                        continue;
                    }

                    let is_model_file = lower.ends_with(".gguf")
                        || lower.ends_with(".llamafile")
                        || lower.ends_with(".llamafile.exe");

                    if is_model_file && !seen_filenames.contains(file_name) {
                        if let Ok(meta) = fs::metadata(&path) {
                            if meta.len() > 10 * 1024 * 1024 {
                                seen_filenames.insert(file_name.to_string());
                                let is_active = match active_filename {
                                    Some(active) => active.eq_ignore_ascii_case(file_name),
                                    None => false,
                                };
                                let (display_name, is_custom) = format_model_display_name(file_name);
                                models.push(LocalModelInfo {
                                    filename: file_name.to_string(),
                                    display_name,
                                    size_mb: (meta.len() as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0,
                                    is_active,
                                    path: path.to_string_lossy().to_string(),
                                    is_custom,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    models.sort_by(|a, b| a.filename.cmp(&b.filename));
    models
}

/// Risolve il percorso locale assoluto di un file modello
pub fn resolve_model_file<R: Runtime>(app_handle: &AppHandle<R>, target_filename: &str) -> Option<PathBuf> {
    let search_dirs = get_search_dirs(app_handle);
    for dir in &search_dirs {
        let p = dir.join(target_filename);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Scarica asincronamente un modello da Hugging Face emettendo eventi di progresso
pub async fn download_model_file<R: Runtime>(
    app: AppHandle<R>,
    repo_id: String,
    filename: String,
    cancel_token: Arc<AtomicBool>,
) -> Result<String, String> {
    let models_dir = get_models_dir(&app);
    let target_path = models_dir.join(&filename);
    let part_path = models_dir.join(format!("{}.part", filename));

    // 1. Verifica se il file esiste già ed è integro
    if target_path.exists() {
        if let Ok(meta) = fs::metadata(&target_path) {
            if meta.len() > 50 * 1024 * 1024 {
                println!(
                    "[ZenScribe] Modello {} già presente in cache ({} bytes)",
                    filename,
                    meta.len()
                );
                let _ = app.emit(
                    "model-download-progress",
                    DownloadProgress {
                        repo_id: repo_id.clone(),
                        filename: filename.clone(),
                        downloaded_bytes: meta.len(),
                        total_bytes: meta.len(),
                        percentage: 100.0,
                        speed_mbps: 0.0,
                        status: "cached".to_string(),
                        error: None,
                    },
                );
                return Ok(target_path.to_string_lossy().to_string());
            }
        }
    }

    // 2. Costruisci URL ufficiale di risoluzione Hugging Face
    let url = format!("https://huggingface.co/{}/resolve/main/{}", repo_id, filename);
    println!("[ZenScribe] Avvio download modello da: {}", url);

    let client = reqwest::Client::builder()
        .user_agent("ZenScribe/0.1.0")
        .build()
        .map_err(|e| format!("Impossibile inizializzare il client HTTP: {}", e))?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Errore connessione a Hugging Face: {}", e))?;

    if !response.status().is_success() {
        let err_msg = format!(
            "Hugging Face ha risposto con codice di stato: {} (Verifica che Repo ID e Nome File siano corretti)",
            response.status()
        );
        let _ = app.emit(
            "model-download-progress",
            DownloadProgress {
                repo_id: repo_id.clone(),
                filename: filename.clone(),
                downloaded_bytes: 0,
                total_bytes: 0,
                percentage: 0.0,
                speed_mbps: 0.0,
                status: "error".to_string(),
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    let total_bytes = response.content_length().unwrap_or(0);

    // Emetti evento iniziale
    let _ = app.emit(
        "model-download-progress",
        DownloadProgress {
            repo_id: repo_id.clone(),
            filename: filename.clone(),
            downloaded_bytes: 0,
            total_bytes,
            percentage: 0.0,
            speed_mbps: 0.0,
            status: "downloading".to_string(),
            error: None,
        },
    );

    // Rimuovi file parziale precedente se rimasto interrotto
    if part_path.exists() {
        let _ = fs::remove_file(&part_path);
    }

    use std::io::Write;
    let mut file = fs::File::create(&part_path)
        .map_err(|e| format!("Impossibile creare il file temporaneo: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut downloaded_bytes: u64 = 0;
    let start_time = Instant::now();
    let mut last_emit = Instant::now();

    while let Some(chunk_result) = stream.next().await {
        if cancel_token.load(Ordering::SeqCst) {
            drop(file);
            let _ = fs::remove_file(&part_path);
            let _ = app.emit(
                "model-download-progress",
                DownloadProgress {
                    repo_id: repo_id.clone(),
                    filename: filename.clone(),
                    downloaded_bytes,
                    total_bytes,
                    percentage: 0.0,
                    speed_mbps: 0.0,
                    status: "cancelled".to_string(),
                    error: Some("Download annullato".to_string()),
                },
            );
            return Err("Download annullato dall'utente".to_string());
        }

        let chunk = chunk_result.map_err(|e| format!("Errore durante la lettura dello stream: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("Errore scrittura su disco: {}", e))?;

        downloaded_bytes += chunk.len() as u64;

        if last_emit.elapsed().as_millis() > 200 || (total_bytes > 0 && downloaded_bytes >= total_bytes) {
            let elapsed_sec = start_time.elapsed().as_secs_f64().max(0.001);
            let speed_mbps = (downloaded_bytes as f64 / elapsed_sec) / (1024.0 * 1024.0);
            let percentage = if total_bytes > 0 {
                ((downloaded_bytes as f64 / total_bytes as f64) * 100.0).min(100.0)
            } else {
                0.0
            };

            let _ = app.emit(
                "model-download-progress",
                DownloadProgress {
                    repo_id: repo_id.clone(),
                    filename: filename.clone(),
                    downloaded_bytes,
                    total_bytes,
                    percentage: (percentage * 10.0).round() / 10.0,
                    speed_mbps: (speed_mbps * 10.0).round() / 10.0,
                    status: "downloading".to_string(),
                    error: None,
                },
            );
            last_emit = Instant::now();
        }
    }

    file.flush()
        .map_err(|e| format!("Errore flush file su disco: {}", e))?;
    drop(file);

    // Rinomina da .part a nome finale
    if target_path.exists() {
        let _ = fs::remove_file(&target_path);
    }
    fs::rename(&part_path, &target_path)
        .map_err(|e| format!("Impossibile finalizzare il file scaricato: {}", e))?;

    // Tentativo opzionale di scaricare tokenizer.json companion se presente
    let tokenizer_url = format!("https://huggingface.co/{}/resolve/main/tokenizer.json", repo_id);
    let companion_tokenizer = models_dir.join(format!("{}.tokenizer.json", filename));
    if let Ok(tok_resp) = client.get(&tokenizer_url).send().await {
        if tok_resp.status().is_success() {
            if let Ok(bytes) = tok_resp.bytes().await {
                let _ = fs::write(&companion_tokenizer, bytes);
                println!("[ZenScribe] Tokenizer.json companion salvato con successo.");
            }
        }
    }

    let _ = app.emit(
        "model-download-progress",
        DownloadProgress {
            repo_id,
            filename: filename.clone(),
            downloaded_bytes,
            total_bytes: downloaded_bytes,
            percentage: 100.0,
            speed_mbps: 0.0,
            status: "completed".to_string(),
            error: None,
        },
    );

    println!("[ZenScribe] Download completato con successo: {}", target_path.display());
    Ok(target_path.to_string_lossy().to_string())
}
