# 🪶 ZenScribe - Note di Rilascio v1.2.0

> Data di rilascio: 18 Novembre 2026  
> Versione: **1.2.0**

Questa versione introduce una radicale evoluzione nell'esperienza di collaborazione con l'Intelligenza Artificiale, trasformando l'assistente in una barra laterale agganciata e integrando la consapevolezza dell'intero manoscritto e la stima economica dei consumi.

---

## 🚀 Novità Principali della v1.2.0

### 1. Barra Laterale AI "ZenScribe Muse" (Docked Sidebar)
- **Zero Finestre Oscuranti:** L'assistente AI non appare più come modale a centro schermo che interrompe la concentrazione. Diventa una **sidebar laterale destra** sempre accessibile.
- **Scrittura & Chat Simultanee:** Puoi continuare a digitare, scorrere i capitoli o evidenziare paragrafi mentre la conversazione con l'editor letterario resta aperta a fianco del testo.
- **Controllo da Toolbar & Scorciatoia:** Pulsante dinamico con stato attivo/inattivo sulla barra degli strumenti superiore e supporto completo per la scorciatoia da tastiera `Ctrl+J`.

### 2. Chat Letteraria sul Libro con Contesto Globale
- **Ambito "Tutto il Libro":** L'AI ha ora accesso simultaneo all'indice completo dei capitoli, a tutti i testi dell'opera, al profilo narrativo (genere, stile, tono, POV, sinossi) e alla Bibbia di Worldbuilding.
- **Relazioni tra Personaggi:** La mappa concettuale include ora le connessioni reciproche tra entità (`Marcus ──(fratello rivale)──> Elena`), prevenendo allucinazioni e garantendo coerenza drammaturgica.
- **5 Ambiti di Contesto Selezionabili:**
  - `📚 Tutto il Libro`: Analisi strategica, tenuta del ritmo complessivo e buchi di trama.
  - `📖 Capitolo`: Focalizzato sul testo integrale del capitolo in lavorazione.
  - `✂️ Selezione`: Lavoro di cesello sul singolo brano selezionato.
  - `🧭 Bibbia`: Solo worldbuilding, schede personaggi e lore.
  - `💬 Libero`: Puro brainstorming concettuale senza testo massivo.

### 3. Prompt Ottimizzati & Spunti per Autori
- **Doppia Modalità Intelligente:** Risposte discorsive e critiche per le domande di analisi letteraria, e blocchi `testo-revisionato` pronti all'uso per le richieste di riscrittura diretta.
- **Pulsanti di Applicazione Immediata:** Con un solo clic puoi applicare la revisione direttamente all'intero capitolo (`Applica a Capitolo`) o sostituire la porzione selezionata (`Sostituisci selezione`).
- **Prompt Creativi "Show, Don't Tell":** La generazione di prose di continuazione ed espansione è calibrata per rispettare la voce del POV ed eliminare formule artificiali introduttive.

### 4. Monitoraggio Token & Documentazione Costi API
- **Contatore Token Dinamico:** Indicatore in tempo reale (`~14.5k token`) con tooltip che mostra la stima di parole e la spesa corrispondente per la richiesta.
- **Guida Ufficiale `COSTI_API.md`:** Guida esaustiva per narratori sul funzionamento dei token in italiano, con tabelle tariffarie comparative tra Google Gemini, OpenAI, Claude, DeepSeek e Motore Locale (100% gratuito).
