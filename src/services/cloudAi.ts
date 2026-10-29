import { GoogleGenerativeAI } from "@google/generative-ai";
import { CloudProviderType, CloudSettings, EditorSettings } from "../types";

export interface AICompletionOptions {
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Esegue una chiamata unificata verso il Cloud Provider attivo (Gemini, OpenAI, Anthropic, OpenRouter, Groq o Custom)
 */
export async function generateWithCloudProvider(
  cloudSettings: CloudSettings,
  prompt: string,
  options: AICompletionOptions = {}
): Promise<string> {
  const providerType = cloudSettings.activeProvider;
  const config = cloudSettings.providers[providerType];

  const systemInstruction =
    options.systemInstruction ||
    "Sei un assistente editoriale e creativo per scrittori di narrativa. Aiuta l'autore a sviluppare la storia rispettando fedelmente il genere, il tono, il punto di vista e le regole del mondo fornite.";

  if (!config.apiKey && providerType !== "custom") {
    throw new Error(
      `Chiave API mancante per il provider selezionato (${providerType.toUpperCase()}). Configurala nelle impostazioni.`
    );
  }

  switch (providerType) {
    case "gemini": {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const modelName = config.model || "gemini-2.5-flash";
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
      });

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
        },
      });

      const response = await result.response;
      return response.text();
    }

    case "openai":
    case "openrouter":
    case "groq":
    case "custom": {
      let baseUrl = config.baseUrl;
      if (!baseUrl) {
        if (providerType === "openai") baseUrl = "https://api.openai.com/v1";
        else if (providerType === "openrouter") baseUrl = "https://openrouter.ai/api/v1";
        else if (providerType === "groq") baseUrl = "https://api.groq.com/openai/v1";
        else baseUrl = "http://localhost:11434/v1";
      }

      // Rimuovi trailing slash
      baseUrl = baseUrl.replace(/\/+$/, "");
      const endpoint = `${baseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (config.apiKey) {
        headers["Authorization"] = `Bearer ${config.apiKey}`;
      }

      if (providerType === "openrouter") {
        headers["HTTP-Referer"] = "https://zenscribe.app";
        headers["X-Title"] = "ZenScribe";
      }

      let defaultModel = "gpt-4o-mini";
      if (providerType === "openrouter") defaultModel = "deepseek/deepseek-chat";
      if (providerType === "groq") defaultModel = "llama-3.3-70b-versatile";

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model || defaultModel,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt },
          ],
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 2048,
        }),
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errJson = await response.json();
          errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
        } catch {}
        throw new Error(`Errore da ${providerType.toUpperCase()} (${response.status}): ${errorDetail}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`Risposta vuota ricevuta da ${providerType.toUpperCase()}`);
      }
      return content.trim();
    }

    case "anthropic": {
      const baseUrl = config.baseUrl || "https://api.anthropic.com/v1";
      const endpoint = `${baseUrl.replace(/\/+$/, "")}/messages`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: config.model || "claude-3-5-haiku-20241022",
          max_tokens: options.maxTokens ?? 2048,
          temperature: options.temperature ?? 0.7,
          system: systemInstruction,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        let errorDetail = response.statusText;
        try {
          const errJson = await response.json();
          errorDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
        } catch {}
        throw new Error(`Errore da Anthropic Claude (${response.status}): ${errorDetail}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text;
      if (!content) {
        throw new Error("Risposta vuota ricevuta da Claude");
      }
      return content.trim();
    }

    default:
      throw new Error(`Provider non supportato: ${providerType}`);
  }
}

/**
 * Continua la narrazione basandosi sul testo scritto e sul contesto del progetto
 */
export async function continueWritingCreative(
  settings: EditorSettings,
  contextText: string,
  narrativeContext?: string
): Promise<string> {
  const prompt = `${
    narrativeContext && narrativeContext.trim()
      ? `Ecco le indicazioni e il contesto del romanzo:\n${narrativeContext.trim()}\n\n`
      : ""
  }Ecco il testo scritto finora dall'autore:\n"""\n${contextText}\n"""\n\nContinua la narrazione in modo coerente e coinvolgente con 2-3 paragrafi naturali. Fornisci direttamente la continuazione:`;

  return generateWithCloudProvider(settings.cloud, prompt, {
    systemInstruction:
      "Sei un romanziere e ghostwriter professionista. Mantieni rigorosamente lo stile narrativo, la voce del protagonista, il registro e il genere specificati nel contesto del romanzo.",
  });
}

/**
 * Espande un passaggio narrativo o descrittivo
 */
export async function expandConceptCreative(
  settings: EditorSettings,
  selectedText: string,
  narrativeContext?: string
): Promise<string> {
  const prompt = `${
    narrativeContext && narrativeContext.trim()
      ? `Contesto e stile del romanzo:\n${narrativeContext.trim()}\n\n`
      : ""
  }Espandi e arricchisci questo passaggio narrativo/concettuale con dettagli sensoriali, sfumature psicologiche o un'ambientazione più vivida, rispettando lo stile e le regole del mondo:\n"""\n${selectedText}\n"""`;

  return generateWithCloudProvider(settings.cloud, prompt);
}

/**
 * Genera una proposta di trama e struttura narrativa dai personaggi e dal profilo del progetto
 */
export async function generatePlotFromBible(
  settings: EditorSettings,
  bibleContent: string,
  userGuidance?: string
): Promise<string> {
  const prompt = `Sei un acclamato consulente letterario e story editor per autori di narrativa.
Analizza con attenzione tutti gli elementi del seguente contesto (profilo dell'opera, premessa, personaggi, luoghi e note di trama inseriti dall'autore):

${bibleContent}

${userGuidance && userGuidance.trim() ? `Indicazioni aggiuntive dall'autore:\n"${userGuidance.trim()}"\n` : ""}

Sulla base di questi personaggi, luoghi e premesse, progetta una proposta di TRAMA avvincente, organica e articolata per il romanzo. Suddividi la risposta in queste sezioni:

1. **Premessa & Conflitto Centrale**: qual è la posta in gioco e cosa mette in moto la vicenda nel rispetto del genere.
2. **Archi e Relazioni dei Personaggi**: motivazioni contrastanti, alleanze o conflitti tra i personaggi della Bibbia.
3. **Struttura Narrativa nei Tre Atti**:
   - **Atto I (Inizio & Incidente Scatenante)**: come entriamo nella storia e cosa costringe il protagonista ad agire.
   - **Atto II (Crescita della tensione, Ostacoli & Colpo di scena centrale)**: prove, complicazioni e punto di non ritorno.
   - **Atto III (Climax & Risoluzione)**: la resa dei conti finale e l'epilogo.
4. **Scene Madri & Colpi di Scena Suggeriti**: 2 o 3 momenti di forte impatto emotivo o narrativo.

Rispondi in italiano con uno stile chiaro, evocativo e direttamente spendibile nella stesura.`;

  return generateWithCloudProvider(settings.cloud, prompt, {
    systemInstruction:
      "Sei un maestro di sceneggiatura e story editor esperto che aiuta gli scrittori a tessere trame profonde a partire dai personaggi, dalle ambientazioni e dalla premessa del libro.",
  });
}
