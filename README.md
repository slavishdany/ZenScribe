# 🪶 ZenScribe

> **Un ambiente di videoscrittura minimale, privato e ibrido (Locale + Cloud) progettato per scrittori e narratori.**

ZenScribe nasce per eliminare ogni distrazione visiva e restituire al pensiero lo spazio che merita. Combina un'esperienza di stesura immersiva con una doppia intelligenza artificiale: un **motore locale standalone al 100% privato** per la correzione e lo stile, e la potenza di **Google Gemini** per lo sviluppo creativo e la generazione di trame complesse basate sulle schede del tuo mondo narrativo.

---

## ✨ Caratteristiche Principali

### 🌿 1. Esperienza di Scrittura Zen & Tipografia Curata
- **Modalità Zen (Focus Totale)**: nasconde l'intera interfaccia con un click (o tasto dedicato) lasciando sullo schermo solo le tue parole.
- **Tipografia Personalizzabile**: scelta tra caratteri Serif (*Merriweather*), Sans-serif (*Inter*) e Monospazio (*JetBrains Mono*).
- **Larghezza Foglio Regolabile**: da layout stretto per saggistica e ritmo (65ch) fino a standard (80ch), largo (100ch) o piena larghezza.
- **Tema Chiaro / Scuro**: contrasti calibrati per non affaticare la vista durante lunghe sessioni notturne.
- **Statistiche in Tempo Reale**: conteggio parole, caratteri e stima dei tempi di lettura costantemente aggiornati.

---

### 🛡️ 2. Intelligenza Artificiale Ibrida: Privacy & Creatività

#### 🔒 Fase 1: Motore Locale Standalone (Gratuito, Offline & Privato)
- **Correzione Bozze & Refusi**: corregge grammatica e punteggiatura senza alterare la voce originale dell'autore.
- **Riformulazione & Fluidità**: alleggerisce la sintassi e migliora il ritmo narrativo.
- **100% Standalone**: nessun software esterno da configurare o avviare (zero Ollama, zero server di terze parti). ZenScribe gestisce direttamente il processo in background in modo sicuro e invisibile (grazie al *Job Object Windows Kill-on-Close*).
- **Zero fuga di dati**: i tuoi testi non lasciano mai il computer.

#### ☁️ Fase 2: Cloud Creativo (Google Gemini)
- **Continua la Narrazione**: suggerisce il proseguimento naturale del racconto mantenendo tono e ritmo.
- **Espandi & Arricchisci**: sviluppa descrizioni sensoriali, atmosfere o introspezioni psicologiche.
- **Gratuito con la tua chiave**: utilizza le API di *Google AI Studio* con il modello ultra-veloce Gemini 2.5 Flash. La tua chiave rimane memorizzata esclusivamente in locale.

---

### 📖 3. Database SQLite Integrato & Worldbuilding

Tutti i dati risiedono in un database SQLite locale integrato tramite `tauri-plugin-sql`:

- **Gestione Multi-Capitolo**: sidebar laterale a scomparsa per creare, organizzare, sfogliare, rinominare ed eliminare capitoli del libro con salvataggio automatico debounced.
- **Bibbia del Romanzo (Personaggi & Luoghi)**: archivio per schede di *Personaggi*, *Luoghi*, *Oggetti* e *Note di trama*. Puoi modificare ogni voce al volo, cambiarne la categoria e copiare i testi negli appunti.
- **Generatore di Trama da Personaggi (Gemini)**: genera automaticamente una proposta di trama articolata (Premessa, Archi dei personaggi, Struttura in Tre Atti e Scene Madri) partendo direttamente dalle schede inserite nella Bibbia. Con un click puoi salvarla come nuovo capitolo della storia!
- **Memoria Contestuale**: le schede dei personaggi e delle ambientazioni vengono passate automaticamente come contesto all'AI, evitando allucinazioni e garantendo coerenza narrativa.

---

## 🛠️ Stack Tecnologico

- **Desktop Runtime**: [Tauri v2](https://tauri.app/) (Rust)
- **Frontend**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Editor Rich-Text**: [TipTap](https://tiptap.dev/) (ProseMirror engine)
- **Stili & UI**: [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Database Locale**: SQLite tramite `@tauri-apps/plugin-sql`
- **Motore AI Locale**: [Llamafile](https://github.com/mozilla-ai/llamafile) (OpenAI-compatible server standalone)
- **Cloud AI SDK**: `@google/generative-ai`

---

## 🚀 Prerequisiti e Installazione

### Prerequisiti di Sistema
- **Node.js** (versione 18 o superiore)
- **Rust & Cargo** (necessari per compilare l'harness Tauri): [rustup.rs](https://rustup.rs/)
- **Microsoft C++ Build Tools** (su Windows)

### 1. Clona il Repository
```bash
git clone https://github.com/slavishdany/ZenScribe.git
cd ZenScribe
```

### 2. Installa le Dipendenze
```bash
npm install
```

### 3. Configura il Modello Locale (Standalone)
ZenScribe supporta modelli in formato **Llamafile** o pesi **GGUF** (es. *Meta Llama 3.1 8B*, *Llama 3.2 3B/1B*, *Qwen 2.5 1.5B*).

1. Inserisci il binario runner `llamafile-server.exe` nella cartella `resources/`.
2. Posiziona il tuo modello (es. `Meta-Llama-3.1-8B-Instruct.Q4_K_M.llamafile` o qualsiasi file `.gguf`) all'interno di `resources/` (o nella tua cartella *Download*).
3. All'avvio, ZenScribe rileverà automaticamente il modello e avvierà il motore in background su `127.0.0.1:8080`.

*(Nota: su Windows, i singoli eseguibili `.exe` non possono superare i 4 GB a causa dei limiti del loader PE di sistema. ZenScribe risolve il problema eseguendo `llamafile-server.exe` e passandogli il file del modello tramite il parametro `-m`, permettendo l'uso di modelli di qualsiasi dimensione).*

### 4. Avvia in Modalità Sviluppo
```bash
npm run tauri dev
```

### 5. Compila l'Eseguibile per la Produzione
```bash
npm run tauri build
```
L'eseguibile compilato e il programma di installazione si troveranno in `src-tauri/target/release/bundle/`.

---

## 🔑 Configurazione Gemini API (Opzionale per il Cloud)

1. Ottieni gratuitamente una chiave API su [Google AI Studio](https://aistudio.google.com/app/apikey).
2. All'interno di ZenScribe, apri le **Impostazioni** (icona ingranaggio in basso a destra).
3. Incolla la tua chiave nel campo *Gemini API Key* e clicca su **Salva Impostazioni**.
4. La chiave è archiviata unicamente nel localStorage del tuo dispositivo e non viene mai inviata a server intermediari.

---

## ⌨️ Scorciatoie da Tastiera Rapide

| Tasti | Azione |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>J</kbd> | Apri Assistente AI per il testo selezionato |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Annulla ultima modifica |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> | Ripristina modifica |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> | Grassetto |
| <kbd>Ctrl</kbd> + <kbd>I</kbd> | Corsivo |

---

## 📄 Licenza

Distribuito sotto licenza **MIT**. Consulta il file `LICENSE` per ulteriori dettagli.
