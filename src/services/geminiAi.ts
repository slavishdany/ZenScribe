import { EditorSettings } from "../types";
import {
  continueWritingCreative as continueWritingCloud,
  expandConceptCreative as expandConceptCloud,
  generatePlotFromBible as generatePlotCloud,
  generateWithCloudProvider,
} from "./cloudAi";

export async function generateWithGemini(
  apiKey: string,
  prompt: string,
  systemInstruction = "Sei un collaboratore di scrittura creativa. Aiuta l'autore a sviluppare idee, dialoghi o prosecuzioni narrative con voce raffinata ed evocativa."
): Promise<string> {
  const dummySettings: any = {
    activeProvider: "gemini",
    providers: {
      gemini: { apiKey, model: "gemini-2.5-flash" },
    },
  };
  return generateWithCloudProvider(dummySettings, prompt, { systemInstruction });
}

export async function continueWritingCreative(
  apiKeyOrSettings: string | EditorSettings,
  contextText: string,
  narrativeContext?: string
): Promise<string> {
  if (typeof apiKeyOrSettings === "string") {
    const dummySettings: any = {
      cloud: {
        activeProvider: "gemini",
        providers: {
          gemini: { apiKey: apiKeyOrSettings, model: "gemini-2.5-flash" },
        },
      },
    };
    return continueWritingCloud(dummySettings, contextText, narrativeContext);
  }
  return continueWritingCloud(apiKeyOrSettings, contextText, narrativeContext);
}

export async function expandConceptCreative(
  apiKeyOrSettings: string | EditorSettings,
  selectedText: string,
  narrativeContext?: string
): Promise<string> {
  if (typeof apiKeyOrSettings === "string") {
    const dummySettings: any = {
      cloud: {
        activeProvider: "gemini",
        providers: {
          gemini: { apiKey: apiKeyOrSettings, model: "gemini-2.5-flash" },
        },
      },
    };
    return expandConceptCloud(dummySettings, selectedText, narrativeContext);
  }
  return expandConceptCloud(apiKeyOrSettings, selectedText, narrativeContext);
}

export async function generatePlotFromBible(
  apiKeyOrSettings: string | EditorSettings,
  bibleContent: string,
  userGuidance?: string
): Promise<string> {
  if (typeof apiKeyOrSettings === "string") {
    const dummySettings: any = {
      cloud: {
        activeProvider: "gemini",
        providers: {
          gemini: { apiKey: apiKeyOrSettings, model: "gemini-2.5-flash" },
        },
      },
    };
    return generatePlotCloud(dummySettings, bibleContent, userGuidance);
  }
  return generatePlotCloud(apiKeyOrSettings, bibleContent, userGuidance);
}
