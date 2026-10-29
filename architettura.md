# ARCHITETTURA STRUTTURALE ZENSCRIBE

## 1. VISIONE E FILOSOFIA (README.md)
ZenScribe è un harness di videoscrittura minimale, privato e ibrido (Locale + Cloud).
- **Fase 1 (Locale - Gratis & 100% Privato):** Motore AI nativo integrato in Rust tramite binding Candle/GGUF con download asincrono in tempo reale direttamente da Hugging Face. Nessun sidecar, nessun server HTTP esterno e zero processi zombie.
- **Fase 2 (Cloud - Gratis tramite Google AI Studio):** Assistenza creativa con Gemini 2.5/3.8 Flash tramite chiave API privata dell'utente.

## 2. GESTIONE E DOWNLOAD DINAMICO DEI MODELLI AI (.gguf)
- **Preset Consigliati:**
  1. *Llama 3.2 3B (Consigliato - Veloce):* ~2.0 GB, basso consumo di RAM.
  2. *Gemma 2 2B (Leggerissimo):* ~1.6 GB, ideale per laptop e PC datati.
  3. *Mistral 7B v0.3 (Bilanciato - Alta qualità):* ~4.4 GB, per configurazioni moderne (16GB RAM).
  4. *Phi-3 Medium (Avanzato - Logica):* ~7.9 GB, compiti complessi e GPU dedicate.
- **Opzione Personalizzata:** Inserimento manuale di qualsiasi Repository ID e Nome File `.gguf` da Hugging Face.
- **Streaming Asincrono & Smart Caching:** Download non bloccante con monitoraggio byte per byte e salvataggio nella cartella protetta `AppData/Local/ZenScribe/models`. Se il file esiste già ed è integro, il download viene saltato e il modello è caricato all'istante.
- **Eventi in Tempo Reale:** Emissione evento Tauri `model-download-progress` con percentuale (0%-100%), MB scaricati/totali e velocità di trasferimento.
- **Integrazione Nativa:** Caricamento diretto dei pesi quantizzati del modello GGUF in memoria tramite `candle-core` e `candle-transformers` (`ModelWeights`), eliminando completamente `llamafile-server` in modalità Sidecar.

## 3. CONFIGURAZIONE FRONTEND (package.json)
- `@tauri-apps/api`: v2.0
- `@tiptap/react`: v2.2 (Editor Rich-Text ProseMirror)
- `@google/generative-ai`: v0.21 (Gemini SDK)
- `lucide-react`: Iconografia
- `tailwindcss`: Styling

## 4. DIPENDENZE BACKEND (src-tauri/Cargo.toml)
- `tauri`: v2.0
- `tauri-plugin-sql`: v2 (SQLite integrato)
- `candle-core`: v0.11
- `candle-transformers`: v0.11 (Inferenza modelli GGUF)
- `tokenizers`: v0.21 (Tokenizzazione nativa Hugging Face)
- `reqwest`: v0.12 (Download asincrono con rustls e streaming chunk)
- `tokio`: v1
