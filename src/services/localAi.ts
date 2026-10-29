import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { LocalModelInfo, PresetModel, DownloadProgress } from "../types";

/**
 * Interroga il backend Tauri per verificare se il motore AI nativo è pronto e ha un modello caricato
 */
export async function checkLocalServerStatus(): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      return await invoke<boolean>("check_server_ready");
    }
  } catch (err) {
    // Non siamo in ambiente desktop o il bridge Tauri non è ancora inizializzato
  }
  return false;
}

/**
 * Recupera l'elenco dei 4 modelli preset ufficiali
 */
export async function fetchPresetModels(): Promise<PresetModel[]> {
  try {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      return await invoke<PresetModel[]>("get_preset_models");
    }
  } catch (err) {
    console.warn("[LocalAI] Errore recupero preset modelli:", err);
  }

  // Fallback con i 4 modelli specificati nei requisiti
  return [
    {
      id: "llama-3.2-3b",
      name: "Llama 3.2 3B",
      badge: "Consigliato - Veloce",
      description: "Circa 2.0 GB. Ottimo per PC standard, basso consumo di RAM.",
      repo_id: "bartowski/Llama-3.2-3B-Instruct-GGUF",
      filename: "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
      size_label: "2.02 GB",
      approx_bytes: 2170000000,
    },
    {
      id: "gemma-2-2b",
      name: "Gemma 2 2B",
      badge: "Leggerissimo",
      description: "Circa 1.6 GB. Ideale per computer datati o laptop.",
      repo_id: "bartowski/gemma-2-2b-it-GGUF",
      filename: "gemma-2-2b-it-Q4_K_M.gguf",
      size_label: "1.75 GB",
      approx_bytes: 1880000000,
    },
    {
      id: "mistral-7b-v0.3",
      name: "Mistral 7B v0.3",
      badge: "Bilanciato - Alta qualità",
      description: "Circa 4.4 GB. Più intelligente, richiede configurazioni moderne (almeno 16GB RAM).",
      repo_id: "bartowski/Mistral-7B-Instruct-v0.3-GGUF",
      filename: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
      size_label: "4.37 GB",
      approx_bytes: 4690000000,
    },
    {
      id: "phi-3-medium",
      name: "Phi-3 Medium",
      badge: "Avanzato - Logica",
      description: "Circa 7.9 GB. Consigliato per compiti complessi e PC dotati di GPU dedicata.",
      repo_id: "bartowski/Phi-3-medium-4k-instruct-GGUF",
      filename: "Phi-3-medium-4k-instruct-Q4_K_M.gguf",
      size_label: "7.90 GB",
      approx_bytes: 8480000000,
    },
  ];
}

/**
 * Recupera la lista di tutti i modelli disponibili sul disco locale
 */
export async function fetchAvailableModels(): Promise<LocalModelInfo[]> {
  try {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      return await invoke<LocalModelInfo[]>("get_available_models");
    }
  } catch (err) {
    console.warn("[LocalAI] Errore recupero modelli disponibili:", err);
  }

  return [];
}

/**
 * Recupera il nome del modello attualmente attivo in memoria
 */
export async function fetchActiveModel(): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      return await invoke<string | null>("get_active_model");
    }
  } catch (err) {
    console.warn("[LocalAI] Errore recupero modello attivo:", err);
  }
  return null;
}

/**
 * Avvia il download asincrono di un modello da Hugging Face
 */
export async function startModelDownload(repoId: string, filename: string): Promise<string> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string>("start_download_model", { repoId, filename });
  }
  throw new Error("Il download dei modelli richiede l'applicazione desktop ZenScribe.");
}

/**
 * Annulla il download in corso
 */
export async function cancelModelDownload(): Promise<void> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    await invoke("cancel_download_model");
  }
}

/**
 * Elimina un file modello locale
 */
export async function deleteLocalModel(modelFilename: string): Promise<void> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    await invoke("delete_local_model", { modelFilename });
  }
}

/**
 * Cambia il modello locale a runtime caricandolo nella memoria del motore nativo
 */
export async function switchLocalModel(modelFilename: string): Promise<LocalModelInfo> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<LocalModelInfo>("switch_local_model", { modelFilename });
  }
  throw new Error("Il caricamento del modello richiede l'applicazione desktop ZenScribe.");
}

/**
 * Si iscrive agli eventi di avanzamento download emessi in tempo reale dal backend Rust
 */
export async function listenDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await listen<DownloadProgress>("model-download-progress", (event) => {
      callback(event.payload);
    });
  }
  return () => {};
}

/**
 * Invia una richiesta di correzione bozze ed errori al motore AI nativo in Rust
 */
export async function correctSpellingLocal(text: string, context?: string): Promise<string> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string>("correct_spelling_local", { text, context: context || null });
  }
  throw new Error("Il motore AI nativo richiede l'ambiente desktop ZenScribe.");
}

/**
 * Riformula o migliora la fluidità del testo con il motore AI nativo in Rust
 */
export async function rephraseTextLocal(text: string, context?: string): Promise<string> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string>("rephrase_text_local", { text, context: context || null });
  }
  throw new Error("Il motore AI nativo richiede l'ambiente desktop ZenScribe.");
}
