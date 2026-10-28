import { invoke } from "@tauri-apps/api/core";
import { LocalModelInfo } from "../types";

const LOCAL_SERVER_URL = "http://127.0.0.1:8080";

/**
 * Interroga il backend Tauri (o direttamente la porta locale via HTTP se eseguito in browser)
 * per verificare se il server Llamafile è pronto
 */
export async function checkLocalServerStatus(): Promise<boolean> {
  try {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      return await invoke<boolean>("check_server_ready");
    }
  } catch (err) {
    // Non siamo in ambiente Tauri o il bridge non è ancora pronto
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 600);
    const res = await fetch(`${LOCAL_SERVER_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * Recupera la lista dei modelli Llamafile eseguibili presenti in resources/
 */
export async function fetchAvailableModels(): Promise<LocalModelInfo[]> {
  try {
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      return await invoke<LocalModelInfo[]>("get_available_models");
    }
  } catch (err) {
    console.warn("[LocalAI] Errore recupero modelli disponibili:", err);
  }

  // Fallback se in browser web
  return [
    {
      filename: "modello-italiano.llamafile.exe",
      display_name: "Modello Italiano (Llama 3.2 3B)",
      size_mb: 1961.5,
      is_active: true,
    },
    {
      filename: "Qwen3.5-0.8B-Q8_0.llamafile.exe",
      display_name: "Qwen 3.5 0.8B (Ultra Veloce)",
      size_mb: 1172.6,
      is_active: false,
    },
  ];
}

/**
 * Recupera il nome del modello attualmente attivo
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
 * Cambia il modello locale a runtime, riavviando il processo con il nuovo eseguibile
 */
export async function switchLocalModel(modelFilename: string): Promise<LocalModelInfo> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<LocalModelInfo>("switch_local_model", { modelFilename });
  }
  throw new Error("Il cambio runtime del modello richiede l'applicazione desktop Tauri.");
}

/**
 * Rimuove i token speciali (es. <|eot_id|>) e le frasi introduttive tipo
 * "La correzione è:" che i modelli piccoli aggiungono nonostante il prompt
 */
function cleanModelOutput(raw: string): string {
  return raw
    .replace(/<\|[^|>]*\|>/g, "")
    .replace(/^\s*(?:ecco[^:\n]{0,60}|la correzione è|il testo corretto è|testo corretto|versione corretta|nuova versione)\s*:\s*/i, "")
    .trim();
}

/**
 * Invia una richiesta di correzione ortografica/grammaticale al modello locale
 */
export async function correctSpellingLocal(text: string, context?: string): Promise<string> {
  const systemPrompt = context
    ? `Sei un correttore bozze esperto per uno scrittore. Ecco il contesto del racconto (personaggi e luoghi):\n${context}\n\nCorreggi esclusivamente refusi, ortografia e grammatica mantenendo inalterata la voce dell'autore. Rispondi SOLO con il testo corretto.`
    : "Sei un editor e correttore di bozze letterario preciso ed essenziale. Rispondi SOLO con il testo corretto, senza commenti.";

  const prompt = `Correggi esclusivamente errori grammaticali, ortografici e refusi nel seguente testo in italiano, mantenendo intatto lo stile, la punteggiatura narrativa e la voce dell'autore. Rispondi SOLO con il testo corretto, senza spiegazioni o premesse.\n\nTesto:\n"""\n${text}\n"""`;

  const response = await fetch(`${LOCAL_SERVER_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "default",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`Errore dal server locale: ${response.statusText}`);
  }

  const data = await response.json();
  const content = cleanModelOutput(data.choices?.[0]?.message?.content ?? "");
  return content || text;
}

/**
 * Riformula o migliora la fluidità del testo localmente
 */
export async function rephraseTextLocal(text: string, context?: string): Promise<string> {
  const systemPrompt = context
    ? `Sei un assistente di scrittura letteraria. Ecco il contesto del racconto (personaggi e luoghi):\n${context}\n\nRiscrivi migliorando fluidità e ritmo preservando i personaggi e il significato.`
    : "Sei un assistente di scrittura che perfeziona lo stile senza alterare la voce originale.";

  const prompt = `Riscrivi il seguente testo migliorandone la fluidità sintattica e il ritmo espressivo, preservando il significato originale. Rispondi ESCLUSIVAMENTE con la nuova versione.\n\nTesto:\n"""\n${text}\n"""`;

  const response = await fetch(`${LOCAL_SERVER_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "default",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    throw new Error(`Errore dal server locale: ${response.statusText}`);
  }

  const data = await response.json();
  return cleanModelOutput(data.choices?.[0]?.message?.content ?? "") || text;
}
