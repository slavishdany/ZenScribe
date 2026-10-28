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
