# ZenScribe v1.2.1 - Release Notes

## 🚀 Novità Principali della Versione 1.2.1

Siamo passati alla versione **v1.2.1**! Questo aggiornamento introduce importanti migliorie all'editor di testo, al sistema di Worldbuilding e Concept Map, alla velocità dell'assistente AI e alla sincronizzazione dei profili di progetto.

---

### 1. ✍️ Editor di Testo Arricchito (Rich Editor & TipTap)
- **Trova e Sostituisci (`Ctrl + F`)**: Nuova barra di ricerca e sostituzione flottante, con conteggio occorrenze in tempo reale, navigazione successiva/precedente, sostituzione singola o massiva.
- **Sottolineato (`Ctrl + U`)**: Supporto nativo al testo sottolineato.
- **Evidenziatore**: Strumento per evidenziare porzioni di testo per revisioni veloci.
- **Allineamento Paragrafi**: Allineamento a sinistra, centrato, a destra e giustificato direttamente dalla barra degli strumenti.
- **Interruzione di Scena Narrativa**: Separatore decorativo letterario (`♦ ♦ ♦`) con scorciatoia rapida dalla toolbar.

### 2. 🗺️ Worldbuilding Studio & Mappa Concettuale
- **Interfaccia a 3 Schede**:
  - **Schede del Mondo**: Gestione entità categorizzate in Personaggi (👤), Fazioni & Clan (🛡️), Luoghi (📍), Oggetti (🔮), Note di Trama (📜). Ricerca, filtri e anteprima immediata dei collegamenti attivi.
  - **Mappa Relazioni & Connessioni**: Collegamento bidirezionale/diretto tra entità con preset rapidi narrativi (*Alleato, Nemico, Parente, Amante, Mentore, Rivalità, Debito di sangue, Patto segreto*), filtro per entità ed eliminazione diretta.
  - **Generatore Trama AI**: Generazione di archi narrativi, conflitti e svolte di trama contestualizzati sulle schede ed entità create.

### 3. ⚡ AI Ultra-Rapida (Gemini 2.5 Flash / Risposta < 1s)
- **Risolto il problema di latenza estrema ("ci mette una vita")**:
  - Aggiornamento dei modelli Google Gemini da versioni obsolete/deprecate (`gemini-1.5-flash` che restituiva 404) a **`gemini-2.5-flash`** (e `gemini-2.5-flash-lite`).
  - Ottimizzazione del tempo di risposta da oltre 25-30 secondi a **meno di 1 secondo**.
  - Timeout di sicurezza con `AbortSignal` a 35s per prevenire blocchi indefiniti.
  - Migrazione automatica delle impostazioni salvate nel profilo utente.

### 4. 🔄 Sincronizzazione Real-Time dei Profili di Progetto
- **Risolto il bug del profilo non recepito**:
  - Modificando o salvando il profilo del romanzo (sinossi, genere, tono, ambientazione), i dati vengono salvati su SQLite, impostati come progetto attivo e propagati istantaneamente all'intero stato dell'applicazione e al contesto AI senza bisogno di riavviare o ricaricare la pagina.

---

## 📦 File di Installazione Generati
- Installer NSIS: `ZenScribe_1.2.1_x64-setup.exe`
- Pacchetto MSI: `ZenScribe_1.2.1_x64_it-IT.msi`
