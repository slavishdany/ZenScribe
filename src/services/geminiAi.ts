import { GoogleGenerativeAI } from "@google/generative-ai";

export async function generateWithGemini(
  apiKey: string,
  prompt: string,
  systemInstruction = "Sei un collaboratore di scrittura creativa. Aiuta l'autore a sviluppare idee, dialoghi, descrizioni o prosecuzioni narrative con voce raffinata ed evocativa."
): Promise<string> {
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("Chiave API di Gemini mancante. Configurala nelle impostazioni.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction,
  });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

export async function continueWritingCreative(apiKey: string, contextText: string): Promise<string> {
  const prompt = `Ecco il testo scritto finora dall'autore:\n"""\n${contextText}\n"""\n\nContinua la narrazione in modo coerente e coinvolgente con 2-3 paragrafi naturali. Fornisci direttamente la continuazione:`;
  return generateWithGemini(apiKey, prompt);
}

export async function expandConceptCreative(apiKey: string, selectedText: string): Promise<string> {
  const prompt = `Espandi e arricchisci questo passaggio narrativo/concettuale con dettagli sensoriali, sfumature psicologiche o un'ambientazione più vivida:\n"""\n${selectedText}\n"""`;
  return generateWithGemini(apiKey, prompt);
}

/**
 * Genera una proposta di trama e struttura narrativa a partire dagli elementi della Bibbia del Romanzo
 */
export async function generatePlotFromBible(
  apiKey: string,
  bibleContent: string,
  userGuidance?: string
): Promise<string> {
  const prompt = `Sei un acclamato consulente letterario e story editor per autori di narrativa.
Analizza con attenzione tutti gli elementi della seguente "Bibbia del Romanzo" (personaggi, luoghi, oggetti e note di trama inseriti dall'autore):

${bibleContent}

${userGuidance && userGuidance.trim() ? `Indicazioni o genere desiderato dall'autore:\n"${userGuidance.trim()}"\n` : ""}

Sulla base di questi personaggi, luoghi e premesse, progetta una proposta di TRAMA avvincente, organica e articolata per il romanzo. Suddividi la risposta in queste sezioni:

1. **Premessa & Conflitto Centrale**: qual è la posta in gioco e cosa mette in moto la vicenda.
2. **Archi e Relazioni dei Personaggi**: come si collegano, le loro motivazioni contrastanti, alleanze o conflitti.
3. **Struttura Narrativa nei Tre Atti**:
   - **Atto I (Inizio & Incidente Scatenante)**: come entriamo nella storia e cosa costringe il protagonista ad agire.
   - **Atto II (Crescita della tensione, Ostacoli & Colpo di scena centrale)**: complicazioni, prove e punto di non ritorno.
   - **Atto III (Climax & Risoluzione)**: la resa dei conti e la conclusione.
4. **Scene Madri & Colpi di Scena Suggeriti**: 2 o 3 momenti di forte impatto emotivo o narrativo.

Rispondi in italiano con uno stile chiaro, evocativo e direttamente spendibile nella scrittura.`;

  return generateWithGemini(
    apiKey,
    prompt,
    "Sei un maestro di sceneggiatura e story editor esperto che aiuta gli scrittori a tessere trame profonde a partire dai personaggi e dalle ambientazioni."
  );
}
