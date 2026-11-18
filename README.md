# 🪶 ZenScribe

> **Un ambiente di videoscrittura minimale, privato e ibrido (Locale + Cloud) progettato per scrittori, romanzieri e narratori.**

ZenScribe nasce per eliminare ogni distrazione visiva e restituire al pensiero lo spazio che merita. Combina un'esperienza di stesura immersiva e pulita con un'architettura a **schede di lavoro a scomparsa**, gestione **multi-romanzo** su SQLite locale, e una **doppia intelligenza artificiale**: un **motore locale nativo integrato in Rust al 100% privato** (con download dinamico dei modelli GGUF e interruzione istantanea senza freeze), e la flessibilità del **Cloud AI** (Gemini, Claude, GPT, OpenRouter, Groq) per lo sviluppo creativo della trama e la coerenza narrativa.

---

## ✨ Caratteristiche Principali

### 🌿 1. Esperienza di Scrittura Zen & Distraction-Free
- **Modalità Zen (Focus Totale)**: nasconde l'intera interfaccia con un click (o tasto dedicato nella barra inferiore) lasciando sullo schermo unicamente il foglio e le tue parole.
- **Barra delle Schede a Scomparsa (`Ctrl+Alt+T`)**: tieni aperte contemporaneamente schede per i vari capitoli e per la **Trama & Struttura**. Puoi nascondere o mostrare la barra delle schede in qualsiasi momento per mantenere lo spazio di lavoro perfettamente pulito.
- **Tipografia Curata**: scelta tra caratteri Serif (*Merriweather*), Sans-serif (*Inter*) e Monospazio (*JetBrains Mono*).
- **Larghezza Foglio Regolabile**: layout Stretto per saggistica e ritmo (65ch), Standard (80ch), Largo (100ch) o Piena Larghezza.
- **Tema Chiaro / Scuro Ottimizzato**: contrasti ad alta leggibilità calibrati per sessioni notturne prolungate, senza abbagliamenti né elementi a basso contrasto.
- **Trova e Sostituisci Integrato (`Ctrl+F`)**: barra fluttuante con navigazione tra occorrenze e sostituzione singola o globale nel capitolo.
- **Statistiche in Tempo Reale**: conteggio parole, caratteri e stima tempi di lettura costantemente sincronizzati con SQLite.

---

### 📑 2. Gestione a Schede Multi-Documento & Glossario a Scomparsa

- **Schede di Lavoro Simultanee**: naviga tra capitoli multipli senza perdere il punto di stesura.
- **Scheda Trama & Struttura Dedicata**: redigi la scaletta della storia, gli atti, i punti di svolta e le sottotrame in una scheda dedicata, memorizzata direttamente nel database SQLite del progetto.
- **Creazione & Chiusura Rapida**:
  - Un clic sul pulsante **`+`** crea e apre istantaneamente un nuovo capitolo.
  - La freccina **`▼`** apre il menu fluttuante per passare subito alla *Trama* o aprire capitoli esistenti.
  - Pulsante **`✕`** sempre attivo su ogni scheda per chiuderla in qualsiasi momento.
  - Clic col **tasto destro** sulla scheda per: *Chiudi scheda*, *Chiudi le altre schede* o *Elimina capitolo dal romanzo*.
- **Glossario a Scomparsa (`Ctrl+G`)**:
  - Cassetto laterale istantaneo per consultare l'indice completo dell'opera.
  - **Schede Attive**: panoramica rapida con indicatore della scheda in uso e pulsante di chiusura.
  - **Trama & Canovaccio**: accesso con 1 clic alla struttura narrativa.
  - **Capitoli del Manoscritto**: elenco con conteggio parole in tempo reale e opzioni per aggiungere o eliminare capitoli.
  - **Glossario del Mondo**: lista ricercabile di personaggi, fazioni, luoghi e lore. Permette di:
    - *Modificare al volo* qualsiasi scheda senza aprire modali ingombranti.
    - *Copiare* la lore negli appunti.
    - *Inserire* il nome dell'entità nell'editor con un solo clic nel punto del cursore.

---

### 📚 3. Gestione Multi-Progetto & Profilazione Narrativa

- **Libreria Multi-Romanzo**: crea, gestisci ed esporta più progetti letterari indipendenti all'interno dello stesso database SQLite locale.
- **Profilo Narrativo Completo**: definisci per ciascun romanzo:
  - Genere Letterario & Titolo Opera
  - Premessa Narrativa / Logline
  - Tono & Registro Stilistico (es. *Evocativo & Cupo*, *Leggero & Brillante*)
  - Voce Narrante & Punto di Vista (es. *Terza persona limitata*, *Prima persona*)
  - Atmosfera / Target Audience
  - Note di Regia e Vincoli Stilistici
- **Iniezione Contestuale Automatica**: il profilo narrativo viene fornito all'Assistente AI per garantire che riscritture, dialoghi e consigli mantengano sempre la voce e lo stile dell'autore.
- **Backup & Auto-Esportazione con Indice (`Manifest`)**:
  - Auto-salvataggio periodico programmabile (ogni 5, 10, 15, 30 min) su una cartella fisica a scelta su disco.
  - Snapshot completo con indice `zenscribe.manifest.json`, manoscritto unificato (`.md` / `.txt`), capitoli singoli e bibbia del worldbuilding.
  - Re-importazione sicura da disco per backup o cambio postazione.

---

### 🗺️ 4. Bibbia del Romanzo (Worldbuilding & Relazioni)

- **Mappa Concettuale delle Entità**: gestisci schede dettagliate per *Personaggi*, *Fazioni / Clan*, *Luoghi*, *Oggetti / Artefatti* e *Note di trama*.
- **Modifica Schede Dedicata**: apri la finestra di modifica con un clic sull'icona o con un semplice **doppio clic** sulla card.
- **Grafico Relazionale**: collega entità tra loro tramite relazioni orientate ed etichettate (es. *Alleato di*, *Nemico giurato*, *Mentore di*, *Custode di*).
- **Generatore di Trama AI da Bibbia**: genera una struttura in Tre Atti articolata partendo dall'intreccio dei personaggi e salvala direttamente come capitolo o canovaccio.

---

### 🛡️ 5. Intelligenza Artificiale Ibrida: Privacy & Potenza Creativa

#### 🔒 Motore Locale Nativo (.gguf) — 100% Offline, Gratuito & Privato
- **Motore Rust Diretto (Candle)**: i modelli quantizzati GGUF girano direttamente nel processo Rust di Tauri, eliminando runtime esterni (zero sidecar o processi zombie).
- **Zero Freeze & Prestazioni Fluide**: architettura atomica lock-free per evitare deadlocks tra il backend Rust e la WebView.
- **Chunked Prefill & Interruzione Istantanea Sub-100ms**: il prompt viene valutato in blocchi da 64 token con controllo costante del segnale di abort. Premendo **"Interrompi"**, la generazione si ferma all'istante senza bloccare l'interfaccia.
- **Pulizia KV Cache Automatica**: azzeramento della cache memoria tra una generazione e l'altra per evitare accumuli di RAM e corruzione posizionale RoPE.
- **Rilevamento Anti-Loop**: blocca tempestivamente generazioni ripetitive.
- **Preset One-Click & Modelli Personalizzati**:
  - *Llama 3.2 3B* (Consigliato - Veloce, basso consumo RAM)
  - *Gemma 2 2B* (Leggerissimo, ideale per laptop)
  - *Mistral 7B v0.3* (Bilanciato - Alta qualità letteraria)
  - *Phi-3 Medium* (Avanzato - Logica e complessità)
  - Download di qualsiasi GGUF da Hugging Face inserendo Repo ID e nome file.

#### ☁️ Assistente AI Docked & Multi-Cloud (Gemini, Claude, GPT, OpenRouter, Groq)
- **Barra Laterale Affiancata (Zero Popup)**: dialoga con l'assistente visualizzando contemporaneamente il testo.
- **Chat dell'Opera con Contesto Globale**: l'assistente conosce il manoscritto, il capitolo attivo, la bibbia dei personaggi e il profilo narrativo.
- **Contatore Token Dinamico**: monitoraggio in tempo reale dei token di contesto e stima dei costi.
- **Pulsante Interrompi Cloud**: stop immediato anche per le chiamate API Cloud tramite `AbortController`.
- **Revisioni Rapide**: correzione ortografica, riscrittura, espansione o sintesi applicabili con un clic alla selezione o all'intero capitolo.

---

## ⌨️ Scorciatoie da Tastiera Principali

| Scorciatoia | Funzione |
|---|---|
| **`Ctrl + Alt + T`** | Mostra / Nascondi la barra delle schede di lavoro |
| **`Ctrl + G`** | Apri / Chiudi il Glossario a scomparsa delle schede e del mondo |
| **`Ctrl + F`** | Apri / Chiudi la barra Trova e Sostituisci |
| **`Ctrl + Z` / `Ctrl + Y`** | Annulla / Ripristina modifiche nel testo |
| **`Esc`** | Chiudi modali, popover o cassetto del Glossario |
| **Doppio Clic su Card** | Modifica istantanea della scheda del Worldbuilding |
| **Tasto Destro su Scheda** | Menu opzioni scheda (*Chiudi*, *Chiudi altre*, *Elimina capitolo*) |

---

## 🛠️ Stack Tecnologico

- **Desktop Framework**: [Tauri v2](https://tauri.app/) (Rust)
- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Bundler & Build Tool**: [Vite](https://vitejs.dev/)
- **Editor Rich-Text**: [TipTap](https://tiptap.dev/) (ProseMirror engine)
- **Stili & UI**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Database Locale**: SQLite tramite `@tauri-apps/plugin-sql`
- **Motore AI Locale**: [Hugging Face Candle](https://github.com/huggingface/candle) (Inference engine nativo in Rust per quantizzazioni GGUF)
- **Integrazioni Cloud**: Google Gemini API, OpenAI, Anthropic Claude, OpenRouter, Groq

---

## 🚀 Installazione e Avvio

### Prerequisiti
- **Node.js** (v18 o superiore)
- **Rust & Cargo** (v1.75+): installabile da [rustup.rs](https://rustup.rs/)

### 1. Clonazione Repository
```bash
git clone https://github.com/slavishdany/ZenScribe.git
cd ZenScribe
```

### 2. Installazione Dipendenze
```bash
npm install
```

### 3. Avvio in Modalità Sviluppo
```bash
npm run tauri dev
```

### 4. Compilazione Build Finale (Release Desktop)
```bash
npm run tauri build
```
I binari eseguibili e gli installer autoinstallanti (`.msi` / `.exe` su Windows) verranno generati nella cartella `src-tauri/target/release/bundle/`.

---

## 🔑 Configurazione Cloud API & Stima dei Costi

1. Per utilizzare Google Gemini: ottieni gratuitamente una chiave su [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Apri le **Impostazioni** di ZenScribe (icona ingranaggio nella barra di stato in basso).
3. Seleziona il provider preferito (Gemini, Claude, OpenAI, OpenRouter o Groq), inserisci la tua API Key e seleziona il modello.

> 💰 **Valutazione Economica & Token:** Consulta la guida [COSTI_API.md](COSTI_API.md) per l'analisi dettagliata dei costi per capitolo, stima token in italiano e confronto tra provider.

---

## 📜 Cronologia Modifiche

Consulta il file [CHANGELOG.md](CHANGELOG.md) per l'elenco dettagliato delle novità, miglioramenti e correzioni introdotte in ciascuna versione.

---

## 📄 Licenza

Distribuito sotto licenza **MIT**. Consulta il file `LICENSE` per ulteriori dettagli.
