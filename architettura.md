# ARCHITETTURA STRUTTURALE ZENSCRIBE

## 1. VISIONE E FILOSOFIA (README.md)
ZenScribe è un harness di videoscrittura minimale, privato e ibrido (Locale + Cloud).
- **SQLite come Unica Fonte di Verità:** Tutti i romanzi, capitoli, schede Worldbuilding (personaggi/luoghi) e profili narrativi risiedono nel database locale protetto `zenscribe.db`.
- **Fase 1 (Locale - Gratis & 100% Privato):** Motore AI nativo integrato in Rust tramite binding Candle/GGUF con download asincrono in tempo reale direttamente da Hugging Face. Nessun sidecar, nessun server HTTP esterno e zero processi zombie.
- **Fase 2 (Cloud Multi-Provider):** Supporto per Google Gemini, OpenAI, Anthropic Claude, Groq, OpenRouter ed endpoint compatibili con OpenAI.

## 2. GESTIONE MULTI-PROGETTO, SNAPSHOT & REIMPORTAZIONE
- **Multi-Romanzo:** Possibilità di creare, gestire, modificare ed eliminare molteplici progetti/romanzi indipendenti.
- **Profilazione Narrativa per Romanzo:** Ciascun progetto include titolo, genere, premessa/logline, tono, voce narrante/POV e regole del mondo che orientano sia le AI locali che quelle cloud.
- **Snapshot con Indice Manifest (`zenscribe.manifest.json`):** Esportazione strutturata che include l'indice lossless JSON, file Markdown puliti per capitoli (`Capitoli/01 - Titolo.md`), schede Bibbia (`Bibbia/Personaggi.md`, `Luoghi.md`, `Note.md`), manoscritto unificato e `README.md`.
- **Esportazione Periodica Automatica & Su Richiesta:** L'utente può esportare un backup in qualsiasi momento con un pulsante dedicato, oppure configurare un intervallo automatico (ogni 5, 10, 15, 30, 60 minuti) verso la cartella collegata.
- **Reimportazione Lossless:** Possibilità di ripristinare un intero progetto a partire da un file manifest `.json` o da una cartella di progetto esportata, ricostruendo capitoli, testi e Worldbuilding nel database SQLite.

## 3. GESTIONE E DOWNLOAD DINAMICO DEI MODELLI AI (.gguf)
- **Preset Consigliati:**
  1. *Llama 3.2 3B (Consigliato - Veloce):* ~2.0 GB, basso consumo di RAM.
  2. *Gemma 2 2B (Leggerissimo):* ~1.6 GB, ideale per laptop e PC datati.
  3. *Mistral 7B v0.3 (Bilanciato - Alta qualità):* ~4.4 GB, per configurazioni moderne (16GB RAM).
  4. *Phi-3 Medium (Avanzato - Logica):* ~7.9 GB, compiti complessi e GPU dedicate.
- **Opzione Personalizzata:** Inserimento manuale di qualsiasi Repository ID e Nome File `.gguf` da Hugging Face.
- **Streaming Asincrono & Smart Caching:** Download non bloccante con monitoraggio byte per byte e salvataggio nella cartella protetta `AppData/Local/ZenScribe/models`. Se il file esiste già ed è integro, il download viene saltato e il modello è caricato all'istante.
- **Eventi in Tempo Reale:** Emissione evento Tauri `model-download-progress` con percentuale (0%-100%), MB scaricati/totali e velocità di trasferimento.
- **Integrazione Nativa:** Caricamento diretto dei pesi quantizzati del modello GGUF in memoria tramite `candle-core` e `candle-transformers` (`ModelWeights`), eliminando completamente `llamafile-server` in modalità Sidecar.

## 4. CONFIGURAZIONE FRONTEND (package.json)
- `@tauri-apps/api`: v2.0
- `@tiptap/react`: v2.2 (Editor Rich-Text ProseMirror)
- `@google/generative-ai`: v0.21 (Gemini SDK)
- `lucide-react`: Iconografia
- `tailwindcss`: Styling

## 5. DIPENDENZE BACKEND (src-tauri/Cargo.toml)
- `tauri`: v2.0
- `tauri-plugin-sql`: v2 (SQLite integrato)
- `candle-core`: v0.11
- `candle-transformers`: v0.11 (Inferenza modelli GGUF)
- `tokenizers`: v0.21 (Tokenizzazione nativa Hugging Face)
- `reqwest`: v0.12 (Download asincrono con rustls e streaming chunk)
- `tokio`: v1
- `rfd`: v0.15 (Dialoghi nativi file/cartelle OS)
