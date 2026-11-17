# 💰 Guida alla Stima dei Costi delle API in ZenScribe

> **Documento di riferimento per scrittori e autori.**  
> Questa guida illustra come funzionano i token nella narrativa in lingua italiana, quanto costa dialogare con l'assistente AI per capitolo o sull'intero libro, e come ottimizzare la spesa o scrivere a costo zero.

---

## 🧭 1. Architettura Economica & Filosofia BYOK

ZenScribe adotta il modello **BYOK (Bring Your Own Key)** e l'architettura **Ibrida (Locale + Cloud)**:
1. **Nessun intermediario o abbonamento:** ZenScribe non applica alcun ricarico, commissione o canone mensile. La tua chiave API comunica direttamente con i server del provider scelto (Google, OpenAI, Anthropic, OpenRouter, Groq).
2. **Paghi solo ciò che usi al millesimo di centesimo:** I provider cloud fatturano su base "Pay-as-you-go" calcolata sui token effettivi scambiati.
3. **Motore Locale a 0,00 €:** I modelli nativi GGUF (Llama 3.2, Mistral, Gemma, Phi-3) vengono eseguiti offline sul tuo computer tramite Rust e la libreria Candle, senza alcuna spesa o limite per sempre.
4. **Piano Gratuito Google AI Studio:** Google offre un generoso piano gratuito per Gemini 1.5 Flash e 2.0 Flash che consente a un autore di usare l'assistente per mesi a costo zero.

---

## 🔤 2. Come Funzionano i Token nella Narrativa in Italiano

I modelli di intelligenza artificiale non contano i caratteri o le parole, ma i **token** (frammenti di parole o sillabe).

### Rapporto Parole / Token in Lingua Italiana
- In inglese, 1 parola equivale mediamente a ~0,75 token (75 token ogni 100 parole).
- In **italiano**, a causa della ricca morfologia flessiva (coniugazioni verbali, desinenze di genere/numero, articoli e preposizioni articolate), **1 parola italiana equivale a circa 1,35 - 1,45 token**.

### Tabella di Equivalenza per Narratori:

| Elemento Narrativo | Numero Parole (circa) | Token Stimati (~1,35x) |
| :--- | :--- | :--- |
| **Paragrafo / Battuta di dialogo** | 80 – 120 parole | ~110 – 160 token |
| **Scena singola** | 800 – 1.200 parole | ~1.100 – 1.600 token |
| **Capitolo standard** | 2.000 – 3.500 parole | ~2.700 – 4.700 token |
| **Profilo Opera + Bibbia Personaggi & Luoghi** | 1.500 – 3.000 parole | ~2.000 – 4.000 token |
| **Romanzo Breve / Novella** | 35.000 – 45.000 parole | ~47.000 – 60.000 token |
| **Romanzo Standard** | 65.000 – 80.000 parole | ~88.000 – 110.000 token |
| **Romanzo Epico / Saga Fantasy** | 120.000 – 150.000 parole | ~160.000 – 205.000 token |

---

## 🏷️ 3. Tariffe Ufficiali dei Provider (per 1 Milione di Token)

*Tariffe aggiornate di riferimento dei principali provider supportati in ZenScribe:*

| Provider & Modello | Costo Input (per 1M token) | Costo Output (per 1M token) | Tier Gratuito (Free Tier) | Note & Consigli d'Uso |
| :--- | :---: | :---: | :---: | :--- |
| **Motore Locale (GGUF / Candle)** | **0,00 €** | **0,00 €** | **Illimitato** | 100% offline, privacy totale, ideale per refusi e bozze. |
| **Google Gemini 1.5 Flash** | **\$0,075** (~0,07 €) | **\$0,30** (~0,28 €) | **Sì (15 RPM / 1M TPM)** | **Scelta consigliata per narrativa:** velocissimo, finestra di 1M token. |
| **Google Gemini 2.0 Flash** | **\$0,075** | **\$0,30** | **Sì (10-15 RPM)** | Modello di nuova generazione ad altissima reattività. |
| **Google Gemini 1.5 Pro** | **\$1,25** (~1,15 €) | **\$5,00** (~4,60 €) | **Sì (2 RPM)** | Per analisi letterarie molto complesse e sfumate. |
| **OpenAI GPT-4o-mini** | **\$0,15** (~0,14 €) | **\$0,60** (~0,55 €) | No (crediti a pagamento) | Molto economico ed equilibrato, finestra 128k token. |
| **OpenAI GPT-4o** | **\$2,50** (~2,30 €) | **\$10,00** (~9,20 €) | No | Modello ammiraglia OpenAI. Ottima prosa, costo più elevato. |
| **Anthropic Claude 3.5 Haiku** | **\$0,80** (~0,74 €) | **\$4,00** (~3,70 €) | No | Veloce, eccellente padronanza stilistica. |
| **Anthropic Claude 3.5 Sonnet** | **\$3,00** (~2,75 €) | **\$15,00** (~13,80 €) | No | Qualità letteraria e sfumature ai massimi livelli del settore. |
| **DeepSeek V3 (via OpenRouter)** | **\$0,14** (~0,13 €) | **\$0,28** (~0,26 €) | No | Estremamente conveniente, capacità di ragionamento eccellenti. |
| **Groq (Llama 3.3 70B)** | **\$0,59** (~0,54 €) | **\$0,79** (~0,72 €) | **Sì (generoso rate limit)** | Velocità fulminea grazie all'hardware LPU dedicato. |

---

## 📊 4. Scenari d'Uso Reali per uno Scrittore

Vediamo esattamente quanto costa in euro un'interazione con l'assistente nelle situazioni quotidiane di un romanziere.

### Scenario A: Lavoro sul Singolo Capitolo
> **Caso d'uso:** L'autore sta lavorando al Capitolo 3 (~2.500 parole). Nella barra laterale seleziona il contesto `Capitolo` e chiede: *"Analizza il ritmo di questo capitolo e dimmi dove la tensione narrativa cala"*.
- **Input:** Testo capitolo + Profilo opera + Bibbia essenziale = **~4.000 token**
- **Output stimato:** ~600 token di risposta approfondita

| Modello Utilizzato | Costo della Singola Domanda | Quante domande fai con 1 €? |
| :--- | :---: | :---: |
| **Motore Locale Nativo** | **0,00 €** | Infinite |
| **Google Gemini Flash (Free Tier)** | **0,00 €** | Migliaia (fino a 1.500 al giorno!) |
| **Google Gemini 1.5 Flash (Pay-as-you-go)** | **0,00048 \$** (~0,00044 €) | **Oltre 2.200 domande con 1 €** |
| **OpenAI GPT-4o-mini** | **0,00096 \$** (~0,00088 €) | **Oltre 1.100 domande con 1 €** |
| **DeepSeek V3** | **0,00073 \$** (~0,00067 €) | **Oltre 1.400 domande con 1 €** |
| **Anthropic Claude 3.5 Haiku** | **0,0056 \$** (~0,0051 €) | ~195 domande con 1 € |
| **Anthropic Claude 3.5 Sonnet** | **0,021 \$** (~0,019 €) | ~52 domande con 1 € |

---

### Scenario B: Discussione con Contesto dell'Intero Libro (Manoscritto Completo)
> **Caso d'uso:** L'autore ha scritto 18 capitoli (~70.000 parole). Nella barra laterale seleziona `Tutto il Libro` e chiede: *"Valuta la coerenza del personaggio di Marcus: il suo movente nel capitolo 15 contrasta con ciò che fa nei capitoli 2 e 7? Ci sono buchi di trama?"*.
- **Input:** Tutti i 18 capitoli del manoscritto + Indice + Profilo opera + Bibbia completa con relazioni = **~100.000 token**
- **Output stimato:** ~1.200 token di analisi critica dettagliata

| Modello Utilizzato | Costo della Query su Tutto il Libro | Note sul Limite di Contesto |
| :--- | :---: | :--- |
| **Google Gemini Flash (Free Tier)** | **0,00 €** | Finestra di 1.000.000 token: l'intero libro entra con estrema facilità! |
| **Google Gemini 1.5 Flash (Pay-as-you-go)** | **0,0079 \$** (~0,0073 €) | **Meno di 1 centesimo di euro** per analizzare un intero romanzo! |
| **DeepSeek V3** | **0,0143 \$** (~0,013 €) | Poco più di 1 centesimo. |
| **OpenAI GPT-4o-mini** | **0,0157 \$** (~0,014 €) | Circa 1,4 centesimi (finestra 128k token). |
| **Anthropic Claude 3.5 Sonnet** | **0,318 \$** (~0,29 €) | Circa 29 centesimi per un'analisi editoriale di qualità da casa editrice. |
| **OpenAI GPT-4o** | **0,262 \$** (~0,24 €) | Circa 24 centesimi. |

---

### Scenario C: Budget Totale per la Scrittura di un Intero Romanzo (1 Mese di Lavoro Quotidiano)
Ipotizziamo una sessione intensiva di stesura e revisione di un mese per un romanzo completo di 70.000 parole:
- **160 domande sul singolo capitolo** (revisione frasi, battute di dialogo, ritmo di scena)
- **35 discussioni sull'intero manoscritto** (coerenza della trama, evoluzione dei personaggi, pianificazione finali)
- **15 generazioni di trame e schede personaggio** da Worldbuilding

| Provider & Strategia | Spesa Totale Mensile Stimata |
| :--- | :---: |
| **Strategia 1: 100% Locale (Offline / GGUF)** | **0,00 €** |
| **Strategia 2: Google Gemini (Free Tier con API Key personale)** | **0,00 €** |
| **Strategia 3: Google Gemini 1.5 Flash (Pay-as-you-go a consumo)** | **~ 0,38 €** *(Meno di mezzo caffè per l'intero libro!)* |
| **Strategia 4: OpenAI GPT-4o-mini** | **~ 0,75 €** |
| **Strategia 5: DeepSeek V3 (via OpenRouter)** | **~ 0,65 €** |
| **Strategia 6: Anthropic Claude 3.5 Sonnet (Uso intensivo alta gamma)** | **~ 14,00 € – 18,00 €** |

---

## 💡 5. Come Ottimizzare i Costi in ZenScribe

### 1. Usa la Nuova Barra Laterale con i Selettori di Contesto Mirati
Nella barra laterale dell'assistente AI puoi scegliere l'ambito di contesto:
- Usa **`Capitolo`** o **`Selezione`** per il lavoro quotidiano di rifinitura, dialoghi, refusi e ritmo di scena. Invia solo poche migliaia di token e costa frazioni infinitesimali di centesimo.
- Usa **`Tutto il Libro`** quando vuoi un confronto strategico sull'arco narrativo, buchi di trama, coerenza cronologica o pianificazione di capitoli futuri.
- Usa **`Libero`** per brainstorming concettuale rapido (nessun testo massivo viene inviato).

### 2. Monitora la Pillola dei Token in Tempo Reale
Nella barra laterale di ZenScribe è presente il contatore dinamico:
> `~14.5k token`  
Passandovi sopra il mouse, visualizzerai l'esatto numero di parole stimate e il costo corrispondente per il provider attivo.

### 3. Sfrutta il Piano Gratuito di Google AI Studio
1. Visita [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) e genera la tua chiave API gratuita.
2. Inseriscila nelle **Impostazioni di ZenScribe** sotto *Google Gemini*.
3. Ottieni fino a **15 richieste al minuto gratuite** con Gemini 1.5 Flash, sufficienti per coprire il 100% dell'attività di uno scrittore senza mai ricevere un addebito.

### 4. Modalità Ibrida Furba: Locale + Cloud
- **Offline / Locale:** Usa il motore locale (Llama 3.2 o Mistral) per correzioni ortografiche immediate e rifinitura stilistica quando sei in viaggio o senza connessione (0,00 € e zero fuga di dati).
- **Cloud:** Attiva Gemini Flash quando desideri una conversazione creativa approfondita sull'intero romanzo o generare colpi di scena.
