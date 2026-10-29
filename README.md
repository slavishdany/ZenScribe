# 🪶 ZenScribe

> **Un ambiente di videoscrittura minimale, privato e ibrido (Locale + Cloud) progettato per scrittori e narratori.**

ZenScribe nasce per eliminare ogni distrazione visiva e restituire al pensiero lo spazio che merita. Combina un'esperienza di stesura immersiva con una doppia intelligenza artificiale: un **motore locale nativo integrato in Rust al 100% privato** per la correzione bozze e lo stile (con download dinamico dei modelli GGUF), e la potenza di **Google Gemini** per lo sviluppo creativo e la generazione di trame complesse basate sulle schede del tuo mondo narrativo.

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

#### 🔒 Fase 1: Motore Locale Nativo (.gguf) — Gratuito, Offline & Privato
- **Download Dinamico & One-Click**: seleziona e scarica qualsiasi modello direttamente dall'interfaccia grafica con barra di avanzamento e velocità in tempo reale.
- **Preset Ottimizzati Inclusi**:
  - *Llama 3.2 3B (Consigliato - Veloce)*: ~2.0 GB, basso consumo di RAM.
  - *Gemma 2 2B (Leggerissimo)*: ~1.6 GB, ideale per laptop e PC datati.
  - *Mistral 7B v0.3 (Bilanciato - Alta qualità)*: ~4.4 GB, per configurazioni moderne (almeno 16GB RAM).
  - *Phi-3 Medium (Avanzato - Logica)*: ~7.9 GB, per compiti complessi e GPU dedicate.
- **Opzione Personalizzata**: puoi scaricare qualsiasi modello `.gguf` presente su Hugging Face inserendo semplicemente Repository ID e Nome File.
- **Motore Nativo Rust (Zero Sidecar)**: i pesi quantizzati vengono eseguiti nativamente in memoria nel codice Rust tramite la libreria Candle di Hugging Face, eliminando del tutto file binari esterni separati (es. `llamafile-server`) e qualsiasi processo zombie in background.
- **Smart Caching**: i modelli scaricati vengono archiviati nella cartella protetta locale (`AppData` su Windows). Se il modello è già presente, il download viene saltato e l'attivazione è istantanea.
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
- **Motore AI Locale**: [Candle](https://github.com/huggingface/candle) (Inference engine nativo in Rust per modelli quantizzati GGUF)
- **Cloud AI SDK**: `@google/generative-ai`

---

## 🚀 Prerequisiti e Avvio

### Prerequisiti di Sistema
- **Node.js** (versione 18 o superiore)
- **Rust & Cargo** (versione 1.75+): [rustup.rs](https://rustup.rs/)

### 1. Clona il Repository e seleziona il branch
```bash
git clone https://github.com/slavishdany/ZenScribe.git
cd ZenScribe
git checkout develop
```

### 2. Installa le Dipendenze
```bash
npm install
```

### 3. Avvia in Modalità Sviluppo
```bash
npm run tauri dev
```
All'avvio, apri il menu Impostazioni (icona in basso o in alto) per selezionare e scaricare in un click il modello AI locale desiderato tra i 4 preset suggeriti o inserire un modello personalizzato.

### 4. Compila l'Eseguibile per la Produzione
```bash
npm run tauri build
```
L'eseguibile compilato e il programma di installazione si troveranno in `src-tauri/target/release/bundle/`.

---

## 🔑 Configurazione Gemini API (Opzionale per il Cloud)

1. Ottieni gratuitamente una chiave API su [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Apri le **Impostazioni** di ZenScribe (icona ingranaggio nella barra di stato in basso).
3. Incolla la chiave nella sezione *Google Gemini (Cloud)* e salva.
