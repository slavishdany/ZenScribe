# ZenScribe v1.1.0 — Motore AI Locale Nativo, Multi-Cloud, Multi-Progetto & Backup Snapshot

Siamo felici di annunciare il rilascio di **ZenScribe v1.1.0**, una release fondamentale che trasforma l'architettura dell'applicazione eliminando qualsiasi dipendenza da processi esterni, estendendo la connettività cloud a tutti i principali modelli di intelligenza artificiale sul mercato e introducendo la gestione multi-romanzo con backup periodici e reimportazione fedele al 100%.

---

## 📋 Titolo della Release per GitHub
```text
v1.1.0 — Motore AI Locale Nativo, Multi-Cloud, Multi-Progetto & Backup Snapshot
```

---

## 🌟 Novità Principali di Questa Versione

### 🦙 1. Motore AI Locale Nativo (.gguf) & Download Dinamico
* **Nessun Sidecar Esterno:** Rimosso completamente l'eseguibile esterno `llamafile-server`. L'inferenza locale viene ora eseguita nativamente in-process nel backend in Rust tramite la libreria Hugging Face `candle` (`candle-core`, `candle-transformers`).
* **Download Manager con Avanzamento in Tempo Reale:** Scarica modelli GGUF direttamente dall'interfaccia con visualizzazione di percentuale, Megabyte scaricati e velocità di download in tempo reale.
* **4 Preset Ottimizzati:**
  * ⚡ **Llama 3.2 3B** (~2.0 GB) — Velocissimo, ideale per la maggior parte dei PC.
  * 🪶 **Gemma 2 2B** (~1.6 GB) — Leggerissimo, ideale per notebook e PC datati.
  * 🧠 **Mistral 7B v0.3** (~4.4 GB) — Eccellente intelligenza e qualità di prosa.
  * 🔬 **Phi-3 Medium** (~7.9 GB) — Logica avanzata per compiti complessi.
* **Modelli Personalizzati:** Possibilità di inserire qualsiasi *Repository ID* e nome file `.gguf` di Hugging Face.
* **Smart Caching:** I modelli scaricati vengono salvati in locale (`AppData/Local/ZenScribe/models`) con rilevamento automatico per evitare download ridondanti.

---

### 🌐 2. Intelligenza Artificiale Cloud Multi-Provider
* Supporto per i principali provider di AI generativa con selezione modello e salvataggio chiavi API:
  * **Google Gemini** (Gemini 3.8 Flash con auto-fallback anti-sovraccarico a Gemini 1.5 Flash / Pro)
  * **OpenAI** (GPT-4o, GPT-4o-mini)
  * **Anthropic Claude** (Claude 3.5 Sonnet, Claude 3.5 Haiku)
  * **Groq** (Inferenza ultra-rapida con Llama 3.3 70B)
  * **OpenRouter** (Accesso a oltre 100 modelli aperti e proprietari)
  * **Endpoint Personalizzato** (Compatibile con le API OpenAI per server locali come LM Studio, Ollama o vLLM)
* **Generazione Trama Completa a 8192 Token:** Esteso il limite di output fino a 8192 token per evitare interruzioni a metà testo durante la pianificazione narrativa in 3 atti.

---

### 🏛️ 3. SQLite come Unica Fonte di Verità & Libreria Multi-Romanzo
* **Persistenza Locale e Privata:** Tutti i progetti, i capitoli e le schede del Worldbuilding risiedono in locale nel database SQLite `zenscribe.db` con salvataggio istantaneo ad ogni battitura.
* **Pannello Gestione Multi-Progetto (`ProjectsManagerModal`):**
  * Visualizza la libreria di tutti i romanzi con statistiche e capitoli.
  * Crea nuovi progetti o cambia romanzo all'istante dalla sidebar o dalla barra degli strumenti.
  * Isolamento completo: ogni libro possiede i propri capitoli e la propria bibbia narrativa.

---

### 🎭 4. Profilazione Narrativa & Contesto Dinamico
* Configura per ogni romanzo: *Titolo, Genere, Premessa rapida / Logline, Tono e Stile, Voce Narrante (POV) e Regole del Mondo*.
* Questi metadati vengono concatenati automaticamente ai personaggi e luoghi della Bibbia e iniettati come contesto in tutte le richieste all'AI (locali e cloud).

---

### 💾 5. Backup Snapshot con Indice Manifest & Reimportazione Lossless
* **Esportazione su Richiesta ("con un tasto"):** Salva in qualsiasi momento uno snapshot completo del progetto.
* **Auto-Esportazione Periodica ("ogni tot di tempo"):** Configura salvataggi automatici ogni 5, 10, 15, 30 o 60 minuti verso la cartella desiderata su disco.
* **Indice Manifest (`zenscribe.manifest.json`):** Genera una copia lossless dell'intero progetto affiancata da file Markdown puliti e leggibili (`Capitoli/*.md`, `Bibbia/*.md`, `Manoscritto/*_Completo.md`, `README.md`).
* **Reimportazione Totale:** Ripristina qualsiasi romanzo a partire dal file manifest `.json` o dalla cartella esportata, ricostruendo l'intera opera in SQLite.

---

## 🛠️ Note di Rilascio Tecniche
* Aggiornamento dipendenze Rust: `candle-core 0.11`, `candle-transformers 0.11`, `tokenizers 0.21`, `reqwest 0.12` con TLS rustls, `rfd 0.15`.
* Eliminazione totale della dipendenza da toolchain C++ CMake per la compilazione su Windows.
* Migrazioni automatiche del database SQLite con aggiunta colonne `project_id` senza perdita di dati.

---

*ZenScribe — Il tuo rifugio di scrittura privato, minimale e potenziato dall'AI.*
