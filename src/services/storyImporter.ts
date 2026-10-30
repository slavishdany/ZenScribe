import { ProjectManifest, ProjectItem } from '../types';
import { generateLocalAI } from './localAi';
import { importaProgettoCompleto } from './db';

export interface ParsedStoryCharacter {
  name: string;
  type: string; // 'personaggio' | 'luogo' | 'fazione' | 'oggetto'
  description: string;
}

export interface ParsedStoryChapter {
  title: string;
  content: string; // HTML TipTap
}

export interface ParsedStory {
  title: string;
  genre: string;
  description: string;
  styleTone: string;
  narrativeVoice: string;
  targetAudience: string;
  narrativeNotes: string;
  characters: ParsedStoryCharacter[];
  chapters: ParsedStoryChapter[];
  sourceFileName?: string;
}

/**
 * Converte testo semplice o Markdown grezzo in blocchi HTML sicuri per l'editor TipTap
 */
function textToHtmlParagraphs(text: string): string {
  if (!text || text.trim() === '') return '<p></p>';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;

  const lines = text.split(/\r?\n/);
  const parts: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      parts.push(`<p>${buffer.join('<br/>')}</p>`);
      buffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
    } else if (trimmed.startsWith('### ')) {
      flush();
      parts.push(`<h3>${trimmed.slice(4)}</h3>`);
    } else if (trimmed.startsWith('## ')) {
      flush();
      parts.push(`<h2>${trimmed.slice(3)}</h2>`);
    } else if (trimmed.startsWith('# ')) {
      flush();
      parts.push(`<h1>${trimmed.slice(2)}</h1>`);
    } else if (trimmed.startsWith('> ')) {
      flush();
      parts.push(`<blockquote><p>${trimmed.slice(2)}</p></blockquote>`);
    } else {
      const formatted = trimmed
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      buffer.push(formatted);
    }
  }
  flush();

  return parts.join('') || '<p></p>';
}

/**
 * Analizza e disseziona deterministicamente una trama o bozza di testo (esportata da ZenScribe o scritta liberamente)
 * estraendone profilo, metadati, personaggi e capitoli/atti.
 */
export function parseStoryText(text: string, fallbackFileName = 'Nuovo Romanzo'): ParsedStory {
  const cleanText = text.replace(/\r\n/g, '\n');

  let title = '';
  let genre = 'Narrativa';
  let description = '';
  let styleTone = '';
  let narrativeVoice = '';
  let targetAudience = '';
  let narrativeNotes = '';
  const characters: ParsedStoryCharacter[] = [];
  const chapters: ParsedStoryChapter[] = [];

  // 1. Estrazione Titolo
  const titleMatch =
    cleanText.match(/per \*\*"?([^"*\n]+)"?\*\*/i) ||
    cleanText.match(/#\s+(.+)/) ||
    cleanText.match(/Titolo:\s*(.+)/i) ||
    cleanText.match(/\*\*Titolo:\*\*\s*(.+)/i);

  if (titleMatch) {
    title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
  } else {
    // Ricava dal nome file senza estensione
    title = fallbackFileName.replace(/\.[^/.]+$/, '').trim();
    if (title.toLowerCase().startsWith('racconto_')) {
      title = title.replace(/_/g, ' ').replace(/\s+\d+$/, '');
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
  }

  // 2. Rilevamento Genere & Stile
  if (/noir/i.test(cleanText)) {
    genre = 'Noir metropolitano / Thriller psicologico';
    styleTone = 'Cupo, carnalità disturbante, erotico psicologico, intimo e voyeuristico';
  } else if (/fantasy|magia|regno/i.test(cleanText)) {
    genre = 'Fantasy Epico';
    styleTone = 'Evocativo, avventuroso ed immersivo';
  } else if (/fantascienza|spazio|cyber|alien/i.test(cleanText)) {
    genre = 'Fantascienza';
    styleTone = 'Tecnologico, speculativo e cerebrale';
  } else if (/giallo|indagine|delitto|ispettore/i.test(cleanText)) {
    genre = 'Giallo / Poliziesco';
    styleTone = 'Teso, analitico e claustrofobico';
  }

  // 3. Premessa & Conflitto
  const premessaMatch = cleanText.match(/\*\*Premessa:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Conflitto|\n\n###|\n---|$)/i);
  if (premessaMatch) {
    description = premessaMatch[1].trim();
  } else {
    const firstPara = cleanText.split(/\n\s*\n/)[0];
    if (firstPara && firstPara.length > 20) {
      description = firstPara.trim().slice(0, 500);
    }
  }

  const conflittoMatch = cleanText.match(/\*\*Conflitto Centrale:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Espediente|\n\n###|\n---|$)/i);
  if (conflittoMatch) {
    narrativeNotes = `Conflitto Centrale:\n${conflittoMatch[1].trim()}`;
  }

  const epistolareMatch = cleanText.match(/\*\*Espediente Epistolare[^:]*:\*\*\s*([\s\S]*?)(?=\n\n###|\n---|$)/i);
  if (epistolareMatch) {
    narrativeVoice = 'Polifonia epistolare contemporanea (lettere, registrazioni vocali, note di diario)';
    if (narrativeNotes) {
      narrativeNotes += `\n\nEspediente Narrativo:\n${epistolareMatch[1].trim()}`;
    } else {
      narrativeNotes = epistolareMatch[1].trim();
    }
  }

  // 4. Personaggi (Worldbuilding)
  const charLines = cleanText.split('\n');
  let inCharSection = false;
  let currentChar: ParsedStoryCharacter | null = null;

  for (const line of charLines) {
    if (/### 2\. Archi e Relazioni dei Personaggi|### Personaggi/i.test(line)) {
      inCharSection = true;
      continue;
    }
    if (inCharSection && /^### [3-9]\.|^---$/i.test(line)) {
      if (currentChar) characters.push(currentChar);
      currentChar = null;
      inCharSection = false;
      break;
    }
    if (inCharSection) {
      // Cattura righe tipo "*   **Nome Personaggio (Ruolo):**" o "* **Nome:**"
      const match = line.match(/^\*\s+\*\*([^*:]+)(?::)?\*\*(?::)?\s*(.*)/);
      if (match) {
        if (currentChar) characters.push(currentChar);
        currentChar = {
          name: match[1].trim(),
          type: 'personaggio',
          description: match[2].trim(),
        };
      } else if (currentChar) {
        const clean = line.replace(/^\s*\*\s*/, '').trim();
        if (clean) {
          currentChar.description += (currentChar.description ? ' ' : '') + clean;
        }
      }
    }
  }
  if (currentChar) characters.push(currentChar);

  // 5. Atti e Capitoli Strutturati
  const attiSection = cleanText.match(/### 3\. Struttura Narrativa nei Tre Atti[\s\S]*?(?=\n### 4|\n---|$)/i);
  if (attiSection) {
    const actRegex = /####\s+\*\*([^*]+)\*\*([\s\S]*?)(?=\n####|\n###|$)/g;
    let match;
    while ((match = actRegex.exec(attiSection[0])) !== null) {
      const actTitle = match[1].trim();
      const actContentRaw = match[2].trim();

      let html = `<h1>${actTitle}</h1>`;
      const paragraphs = actContentRaw.split(/\n\s*\*\s+/);
      for (const p of paragraphs) {
        if (!p.trim()) continue;
        const formatted = p
          .trim()
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/\n+/g, '<br/>');
        html += `<p>${formatted}</p>`;
      }

      chapters.push({
        title: actTitle.replace(/\s*\(.*\)$/, '').trim(),
        content: html,
      });
    }
  }

  // 6. Scene Madri & Colpi di Scena
  const sceneSection = cleanText.match(/### 4\. Scene Madri & Colpi di Scena Suggeriti[\s\S]*?$/i);
  if (sceneSection) {
    let html = `<h1>Scene Madri & Colpi di Scena Chiave</h1>`;
    const sceneRegex = /\d+\.\s+\*\*([^*]+)\*\*:\s*([\s\S]*?)(?=\n\d+\.|\n\n###|$)/g;
    let match;
    while ((match = sceneRegex.exec(sceneSection[0])) !== null) {
      const sceneTitle = match[1].trim();
      const sceneDesc = match[2]
        .trim()
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n+/g, '<br/>');
      html += `<h2>${sceneTitle}</h2><p>${sceneDesc}</p>`;
    }
    chapters.push({
      title: 'Scene Madri & Colpi di Scena',
      content: html,
    });
  }

  // Fallback per file Markdown o testo libero senza sezioni standard ZenScribe
  if (chapters.length === 0) {
    // Verifica se ci sono intestazioni di capitolo (# o ## Capitolo)
    const chapterSplits = cleanText.split(/\n(?=#\s+|\bCapitolo\s+\d+|\bChapter\s+\d+)/i);
    if (chapterSplits.length > 1) {
      for (let i = 0; i < chapterSplits.length; i++) {
        const chunk = chapterSplits[i].trim();
        if (!chunk) continue;
        const firstLine = chunk.split('\n')[0].replace(/^#+\s*/, '').trim();
        const chTitle = firstLine.slice(0, 60) || `Capitolo ${i + 1}`;
        chapters.push({
          title: chTitle,
          content: textToHtmlParagraphs(chunk),
        });
      }
    } else {
      chapters.push({
        title: 'Capitolo 1: Inizio',
        content: textToHtmlParagraphs(cleanText),
      });
    }
  }

  return {
    title: title || 'Nuovo Romanzo',
    genre,
    description,
    styleTone,
    narrativeVoice,
    targetAudience,
    narrativeNotes,
    characters,
    chapters,
    sourceFileName: fallbackFileName,
  };
}

/**
 * Arricchisce o estrae una bozza narrativa non strutturata tramite il modello AI Locale (Candle GGUF)
 */
export async function enhanceStoryWithLocalAI(
  rawText: string,
  current: ParsedStory
): Promise<ParsedStory> {
  const sample = rawText.slice(0, 6000); // Finestra di contesto sicura per modelli locali 3B/7B
  const systemPrompt = `Sei un esperto editor letterario e analista narrativo per il software ZenScribe.
Analizza il testo della trama o racconto fornito e restituisci la scheda del progetto in formato JSON rigoroso.
I campi richiesti sono:
{
  "title": "Titolo del romanzo",
  "genre": "Genere narrativo (es. Noir, Fantasy, Fantascienza)",
  "description": "Sinossi e premessa narrativa principale",
  "styleTone": "Tono ed atmosfera stilistica",
  "narrativeVoice": "Punto di vista e voce narrante (POV)",
  "characters": [
    { "name": "Nome Personaggio (Ruolo)", "type": "personaggio", "description": "Arco, personalità e motivazioni" }
  ],
  "chapters": [
    { "title": "Titolo Atto o Capitolo", "content": "Riassunto o testo del capitolo formattato" }
  ]
}
Rispondi ESCLUSIVAMENTE con il blocco JSON valido. Nessun commento introduttivo o markdown superfluo.`;

  const userPrompt = `Analizza la seguente bozza ed estrai la struttura in JSON:\n\n${sample}`;

  try {
    const rawAiOutput = await generateLocalAI(userPrompt, systemPrompt, 0.2, 2048);
    const jsonMatch = rawAiOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[StoryImporter] Risposta AI locale senza blocco JSON valido, mantengo parsing euristico.');
      return current;
    }

    const aiParsed = JSON.parse(jsonMatch[0]);

    return {
      title: (aiParsed.title || current.title).trim(),
      genre: aiParsed.genre || current.genre,
      description: aiParsed.description || current.description,
      styleTone: aiParsed.styleTone || current.styleTone,
      narrativeVoice: aiParsed.narrativeVoice || current.narrativeVoice,
      targetAudience: current.targetAudience,
      narrativeNotes: current.narrativeNotes,
      characters: Array.isArray(aiParsed.characters) && aiParsed.characters.length > 0
        ? aiParsed.characters.map((c: any) => ({
            name: c.name || 'Senza Nome',
            type: c.type || 'personaggio',
            description: c.description || '',
          }))
        : current.characters,
      chapters: Array.isArray(aiParsed.chapters) && aiParsed.chapters.length > 0
        ? aiParsed.chapters.map((ch: any) => ({
            title: ch.title || 'Capitolo',
            content: textToHtmlParagraphs(ch.content || ''),
          }))
        : current.chapters,
      sourceFileName: current.sourceFileName,
    };
  } catch (err) {
    console.warn('[StoryImporter] Errore elaborazione AI Locale:', err);
    return current;
  }
}

/**
 * Trasforma un oggetto ParsedStory in un ProjectManifest compatibile al 100% con il motore SQLite di ZenScribe
 */
export function storyToProjectManifest(story: ParsedStory): ProjectManifest {
  const now = Date.now();
  const projId = `proj-${now}`;

  return {
    version: '1.1.0',
    appName: 'ZenScribe',
    exportDate: new Date(now).toISOString(),
    project: {
      id: projId,
      title: story.title,
      genre: story.genre,
      description: story.description,
      styleTone: story.styleTone,
      narrativeVoice: story.narrativeVoice,
      targetAudience: story.targetAudience,
      narrativeNotes: story.narrativeNotes,
      exportFolder: null,
      autoExportMinutes: 0,
      createdAt: now,
      updatedAt: now,
    },
    chapters: story.chapters.map((ch, idx) => ({
      id: `cap-${now}-${idx + 1}`,
      title: ch.title,
      content: ch.content,
    })),
    worldbuilding: {
      nodes: story.characters.map((char, idx) => ({
        id: `node-${now}-${idx + 1}`,
        type: char.type || 'personaggio',
        name: char.name,
        description: char.description,
        metadata: {},
      })),
      edges: [],
    },
  };
}

/**
 * Salva la storia parsata direttamente nel database SQLite di ZenScribe
 */
export async function importParsedStoryToDatabase(story: ParsedStory): Promise<ProjectItem> {
  const manifest = storyToProjectManifest(story);
  return await importaProgettoCompleto(manifest);
}
