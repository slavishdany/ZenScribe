# 📜 Changelog — ZenScribe

Tutte le modifiche rilevanti apportate a **ZenScribe** sono documentate in questo file.
Il formato è ispirato a [Keep a Changelog](https://keepachangelog.com/it/1.0.0/) e aderisce al [Semantic Versioning](https://semver.org/lang/it/).

---

## [1.2.1] - 2026-11-18

### 🚀 Nuove Funzionalità
- **Gestione a Schede Multi-Documento (`TabBar`)**:
  - Supporto per lavorare contemporaneamente su più capitoli del manoscritto e su una scheda dedicata per **Trama & Struttura**.
  - Scheda Trama memorizzata direttamente nel database SQLite del progetto come canovaccio persistente.
  - Creazione rapida di nuovi capitoli con un solo clic sul pulsante **`+`**.
  - Menu a discesa fluttuante (`▼`) per aprire o passare alla *Trama* e per aprire capitoli esistenti.
  - Tasto destro contestuale su ogni scheda: *Chiudi scheda*, *Chiudi le altre schede* ed *Elimina capitolo dal romanzo*.
  - Scorciatoia da tastiera **`Ctrl+Alt+T`** per nascondere o mostrare la barra delle schede a piacimento.
  - Schermata Zen pulita quando tutte le schede vengono chiuse.
- **Glossario delle Schede & Indice Narrativo (`GlossaryDrawer`)**:
  - Cassetto a scomparsa laterale accessibile tramite scorciatoia **`Ctrl+G`** o icona dedicata nella barra strumenti.
  - Sezione *Schede Attive* con chiusura rapida delle schede in uso.
  - Sezione *Struttura & Canovaccio* per aprire la scaletta narrativa con un clic.
  - Sezione *Capitoli Manoscritto* con conteggio parole in tempo reale e opzioni per creare o eliminare capitoli.
  - Sezione *Glossario del Mondo*: elenco filtrabile di personaggi, fazioni, luoghi e lore con opzioni per:
    - Modificare al volo la scheda tramite mini-modale senza uscire dal flusso di scrittura.
    - Copiare la descrizione negli appunti.
    - Inserire il nome del personaggio direttamente nel testo al punto del cursore.
    - Eliminare la scheda dal database.
- **Modifica Schede Worldbuilding Dedicata**:
  - Supporto per il **doppio clic** su qualsiasi card della Bibbia del romanzo per aprire istantaneamente la finestra di modifica.
  - Modale galleggiante centrata con campi per *Nome Entità*, *Categoria* e *Descrizione/Lore*, con salvataggio atomico su SQLite.
  - Chiusura rapida con tasto `Esc` o clic esterno sullo sfondo sfumato.

### 🐛 Correzioni & Ottimizzazioni
- **Motore AI Locale — Eliminazione Freeze WebView2**:
  - Riscritto il controllo di stato `is_ready` in Rust come operazione atomica lock-free (`AtomicBool`), eliminando i blocchi del thread IPC Tauri che congelavano l'interfaccia.
  - Aggiunto flag atomico `abort_signal` per consentire l'interruzione immediata in qualsiasi momento.
- **Chunked Prefill & Interruzione Istantanea Sub-100ms**:
  - Sostituita la valutazione monolitica del prompt con un'elaborazione in blocchi da 64 token (`chunked prefill`), permettendo al pulsante **"Interrompi"** di fermare il motore anche prima della generazione del primo token.
  - Supporto ad `AbortController` esteso anche a tutti i provider AI Cloud.
- **Pulizia KV Cache & Anti-Loop**:
  - Inserito `engine.model.clear_kv_cache()` all'inizio e al termine di ogni richiesta locale, azzerando perdite di memoria RAM e corruzione degli embedding posizionali RoPE.
  - Introdotto algoritmo anti-loop che arresta la generazione in caso di token ripetuti consecutivi.
- **Ottimizzazione Dark Mode ad Alto Contrasto**:
  - Registrate le tonalità `stone.750` e `stone.850` in Tailwind, risolvendo il bug di visualizzazione che causava sfondi bianchi con testo invisibile in tema scuro.
  - Contrasti cromatici perfezionati per le schede del Glossario, i capitoli attivi, i badge di categoria e i pulsanti d'azione.
- **Pulsante `+` non Clippato**:
  - Risolto il problema del menu opzioni del pulsante `+` che veniva tagliato dall'overflow orizzontale della barra schede, posizionandolo con coordinate `fixed`.

---

## [1.2.0] - 2026-11-18

### 🚀 Nuove Funzionalità
- **Barra Laterale Assistente AI (Docked)**:
  - Assistente posizionato come pannello laterale a destra dell'editor, sempre consultabile durante la stesura senza finestre popup ostacolanti.
- **Chat dell'Opera con Contesto Globale**:
  - L'assistente analizza il capitolo attivo, l'indice dei capitoli, la Bibbia narrativa (personaggi e luoghi) e il profilo del romanzo.
- **Contatore Token & Stima Costi in Tempo Reale**:
  - Monitoraggio dinamico dei token attivi nel contesto per una gestione economica ottimale delle API Cloud.
- **Revisioni One-Click**:
  - Applicazione diretta delle correzioni e riscritture suggerite dall'AI alla selezione o all'intero capitolo.
- **Gestione Multi-Progetto & Profilo Narrativo**:
  - Libreria per gestire molteplici romanzi indipendenti nel database SQLite.
  - Definizione per ogni opera di: Genere, Tono & Registro, Voce Narrante & POV, Target Audience e Note di Regia.
  - Iniezione automatica del profilo stilistico nei prompt dell'AI.
- **Auto-Esportazione Programmabile con Indice (`Manifest`)**:
  - Salvataggio periodico di sicurezza (ogni 5, 10, 15, 30 min) su cartella fisica a scelta su disco.
  - Esportazione snapshot con `zenscribe.manifest.json`, manoscritto completo unificato (`.md` / `.txt`), capitoli singoli e bibbia del romanzo.
- **Supporto Multi-Provider Cloud**:
  - Aggiunto supporto configurabile per Google Gemini (`gemini-2.5-flash`), Anthropic Claude, OpenAI (GPT-4o), OpenRouter e Groq.

---

## [1.1.0] - 2026-11-17

### 🚀 Nuove Funzionalità
- **Motore AI Locale Nativo in Rust (Candle)**:
  - Esecuzione diretta in memoria di modelli quantizzati `.gguf` tramite la libreria Candle di Hugging Face, eliminando del tutto file binari o runtime esterni.
- **Download Dinamico Modelli GGUF**:
  - Download integrato con monitoraggio velocità e percentuale in tempo reale per 4 preset: *Llama 3.2 3B*, *Gemma 2 2B*, *Mistral 7B v0.3*, *Phi-3 Medium* o qualsiasi modello personalizzato da Hugging Face.
- **Mappa Concettuale del Worldbuilding**:
  - Gestione nodi per Personaggi, Fazioni, Luoghi, Oggetti e Note con creazione di relazioni e collegamenti orientati.
- **Generatore di Trama da Bibbia (Gemini)**:
  - Generazione di una scaletta in Tre Atti basata sulle relazioni e sui conflitti dei personaggi presenti nella Bibbia.
- **Barra Trova e Sostituisci (`Ctrl+F`)**:
  - Ricerca per occorrenza, navigazione precedente/successivo e sostituzione singola o multipla.

---

## [1.0.0] - 2026-11-15

### 🚀 Release Iniziale
- **Editor Minimalista TipTap**: foglio di scrittura pulito con supporto a titoli (H1-H3), elenchi, citazioni e stili di formattazione.
- **Modalità Zen**: occultamento dell'intera interfaccia con un clic per massima concentrazione.
- **Database Locale SQLite**: persistenza locale dei documenti tramite plugin nativo Tauri.
- **Tipografia Personalizzabile**: caratteri Serif (*Merriweather*), Sans (*Inter*) e Mono (*JetBrains Mono*).
- **Esportazione Capitoli**: salvataggio rapido in formato Markdown (`.md`) o Testo Puro (`.txt`).
- **Tema Chiaro / Scuro**: selezione manuale o automatica basata sul sistema.
