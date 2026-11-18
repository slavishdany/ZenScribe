# 📌 Backlog di Progetto — ZenScribe

Questo documento traccia le funzionalità, ottimizzazioni architetturali e idee pianificate per le prossime iterazioni di sviluppo.

---

## 🎯 Prossima Sessione: Sovrastruttura di Contesto & Memoria AI (Layered Context Engine)

> **Obiettivo**: Superare la natura *stateless* delle API LLM (Cloud e Locali), evitando lo spreco esponenziale di token, prevenendo l'effetto *"Lost in the Middle"* e offrendo all'autore una memoria editoriale persistente e coerente con la storia.

### 1. Persistenza della Chat su SQLite (`ai_chat_messages`)
- [ ] Creazione della tabella SQLite per memorizzare le conversazioni dell'assistente:
  - Campi: `id`, `project_id`, `chapter_id`, `role`, `content`, `context_scope`, `timestamp`.
  - Ripristino automatico della chat quando si riapre un progetto o si seleziona un capitolo.
  - Pulsante per "Nuova discussione / Archivia sessione" nella barra laterale AI.

### 2. Sliding Memory Window & Auto-Condensazione
- [ ] Mantenere intatti gli ultimi $N$ scambi (es. 4-6 messaggi recenti).
- [ ] Quando la cronologia supera una soglia definita, attivare una micro-sintesi che riassume i punti fermi concordati in un blocco compatto (*"Punti fermi della discussione precedente"*), azzerando la moltiplicazione dei token.

### 3. Smart Entity & Lore Retrieval (Bibbia Dinamica Mirata)
- [ ] Scansione automatica del capitolo attivo e del messaggio dell'autore per individuare i nomi delle entità (Personaggi, Luoghi, Fazioni).
- [ ] Iniezione selettiva nel contesto solo delle schede dei personaggi effettivamente in scena, riducendo drasticamente il prompt di sistema e massimizzando l'attenzione del modello.
- [ ] Supporto a tag espliciti dell'autore (es. `@NomePersonaggio`) per forzare l'inclusione di una scheda specifica nel contesto.

### 4. Integrazione con la Scheda "Trama & Struttura"
- [ ] Utilizzare la scaletta della Trama (memorizzata in SQLite) come bussola narrativa fissa nel prompt di sistema, in modo che l'AI conosca sempre l'arco narrativo generale, i punti di svolta e il climax.

### 5. Budgeting Token Differenziato (Cloud vs Locale GGUF)
- [ ] Adattamento dinamico dei payload:
  - **Cloud (Gemini, Claude, GPT)**: prompt dettagliato, capitolo intero, profili e stile.
  - **Locale GGUF (CPU Candle)**: payload compresso e mirato per rispettare i limiti di 2K-4K token, garantendo velocità elevata e zero saturazione di memoria.

---

## 📋 Idee Future & Ottimizzazioni
- [ ] **Riordino delle Schede**: possibilità di trascinare o riordinare l'ordine delle schede nella `TabBar`.
- [ ] **Esportazione in Formato EPUB / PDF**: motore di esportazione impaginato per l'intero manoscritto.
- [ ] **Ricerca Semantica Locale (Embeddings)**: sfruttare la colonna `embedding` già predisposta nella tabella `documents` per la ricerca di passaggi rilevanti nel testo.
