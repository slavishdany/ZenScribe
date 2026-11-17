import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Cpu,
  Check,
  Copy,
  ArrowRight,
  Loader2,
  X,
  Globe,
  MessageSquare,
  Send,
  Trash2,
  BookOpen,
  FileText,
  Layers,
  Compass,
  CheckCircle2,
  Zap,
  Coins,
  Info,
} from 'lucide-react';
import { correctSpellingLocal, rephraseTextLocal, chatWithLocalAI } from '../services/localAi';
import {
  continueWritingCreative,
  expandConceptCreative,
  generatePlotFromBible,
  chatWithCloudProvider,
  ChatMessage,
} from '../services/cloudAi';
import { ottieniContestoNarrativo } from '../services/db';
import { ServerStatusInfo, EditorSettings, AIChatMessage, ChatContextScope, ProjectProfile } from '../types';
import { ChapterItem } from './ChapterSidebar';

interface AIPanelProps {
  isOpen: boolean;
  selectedText: string;
  serverStatus: ServerStatusInfo;
  activeModelName?: string;
  geminiApiKey: string;
  settings?: EditorSettings;
  currentChapterTitle?: string;
  currentChapterContent?: string;
  chapters?: ChapterItem[];
  projectTitle?: string;
  projectProfile?: ProjectProfile;
  onClose: () => void;
  onReplaceText: (newText: string) => void;
  onReplaceChapterContent?: (newContent: string) => void;
  onInsertAfter: (newText: string) => void;
  onOpenSettings: () => void;
}

function stripHtml(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

/**
 * Estima il numero di token per un testo in lingua italiana.
 * In media in italiano 1 parola equivale a ~1.35 - 1.4 token.
 */
function estimateTokens(text: string): number {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words * 1.35);
}

/**
 * Estrae il testo pulito applicabile dall'output dell'assistente,
 * estraendo blocchi racchiusi in ```testo-revisionato o """ se presenti.
 */
function extractApplicableText(raw: string): string {
  if (!raw) return '';
  const codeBlockMatch = raw.match(/```(?:testo-revisionato|markdown|text|it)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch && codeBlockMatch[1] && codeBlockMatch[1].trim()) {
    return codeBlockMatch[1].trim();
  }
  const tripleQuotesMatch = raw.match(/"""\s*([\s\S]*?)"""/);
  if (tripleQuotesMatch && tripleQuotesMatch[1] && tripleQuotesMatch[1].trim()) {
    return tripleQuotesMatch[1].trim();
  }
  return raw.trim();
}

export const AIPanel: React.FC<AIPanelProps> = ({
  isOpen,
  selectedText,
  serverStatus,
  activeModelName,
  geminiApiKey,
  settings,
  currentChapterTitle,
  currentChapterContent,
  chapters = [],
  projectTitle,
  projectProfile,
  onClose,
  onReplaceText,
  onReplaceChapterContent,
  onInsertAfter,
  onOpenSettings,
}) => {
  // Modalità: 'chat' (predefinita - discussione del libro) o 'quickTools' (strumenti istantanei)
  const [activeTab, setActiveTab] = useState<'chat' | 'quickTools'>('chat');

  // ============================================================================
  // STATO CHAT DEL LIBRO (CO-AUTORE & EDITOR)
  // ============================================================================
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  // Ambito di contesto per la chat: default sul capitolo attivo o sulla selezione se presente
  const [contextScope, setContextScope] = useState<ChatContextScope>(() => {
    return selectedText && selectedText.trim() ? 'selection' : 'chapter';
  });

  // Stima token attivi in memoria
  const [estimatedContextTokens, setEstimatedContextTokens] = useState<number>(0);

  // Motore di default per la chat: 'cloud' o 'local'
  const [chatEngine, setChatEngine] = useState<'cloud' | 'local'>('cloud');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ============================================================================
  // STATO STRUMENTI RAPIDI
  // ============================================================================
  const [quickInputText, setQuickInputText] = useState(selectedText);
  const [quickResultText, setQuickResultText] = useState('');
  const [isQuickLoading, setIsQuickLoading] = useState(false);
  const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
  const [quickErrorMessage, setQuickErrorMessage] = useState<string | null>(null);
  const [quickCopied, setQuickCopied] = useState(false);

  // Aggiorna contesto quando cambia selezione o apertura
  useEffect(() => {
    if (selectedText && selectedText.trim()) {
      setQuickInputText(selectedText);
      setContextScope('selection');
    }
  }, [selectedText]);

  // Scroll automatico in fondo alla chat
  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab, chatLoading]);

  // Risolve impostazioni cloud correnti
  const resolvedSettings: EditorSettings = settings || {
    font: 'serif',
    fontSize: 18,
    lineHeight: 1.85,
    width: 'medium',
    theme: 'light',
    zenMode: false,
    cloud: {
      activeProvider: 'gemini',
      providers: {
        gemini: { apiKey: geminiApiKey, model: 'gemini-1.5-flash' },
        openai: { apiKey: '', model: 'gpt-4o-mini' },
        anthropic: { apiKey: '', model: 'claude-3-5-haiku-20241022' },
        openrouter: { apiKey: '', model: 'deepseek/deepseek-chat' },
        groq: { apiKey: '', model: 'llama-3.3-70b-versatile' },
        custom: { apiKey: '', model: 'llama3' },
      },
    },
  };

  const activeCloudProvider = resolvedSettings.cloud?.activeProvider || 'gemini';
  const hasCloudKey = Boolean(
    resolvedSettings.cloud?.providers[activeCloudProvider]?.apiKey?.trim() ||
      activeCloudProvider === 'custom'
  );

  const modelBadge = activeModelName
    ? activeModelName.toLowerCase().includes('llama-3.2-3b')
      ? 'Llama 3.2 3B'
      : activeModelName.toLowerCase().includes('llama-3.2-1b')
      ? 'Llama 3.2 1B'
      : activeModelName.toLowerCase().includes('gemma-2-2b')
      ? 'Gemma 2 2B'
      : activeModelName.toLowerCase().includes('mistral-7b')
      ? 'Mistral 7B'
      : activeModelName.toLowerCase().includes('phi-3')
      ? 'Phi-3 Med'
      : 'Locale'
    : 'Offline';

  const cloudNameMap: Record<string, string> = {
    gemini: 'Gemini Flash',
    openai: 'GPT-4o-mini',
    anthropic: 'Claude 3.5',
    openrouter: 'OpenRouter',
    groq: 'Groq LPUs',
    custom: 'Custom Server',
  };

  // Switch automatico se il cloud non è configurato ma il motore locale è attivo
  useEffect(() => {
    if (!hasCloudKey && serverStatus.isReady) {
      setChatEngine('local');
    } else if (hasCloudKey && !serverStatus.isReady) {
      setChatEngine('cloud');
    }
  }, [hasCloudKey, serverStatus.isReady]);

  // ============================================================================
  // LOGICA COSTRUZIONE CONTESTO NARRATIVO INTEGRALE
  // ============================================================================
  const resolveContextPayload = async (scope: ChatContextScope): Promise<string> => {
    let contextStr = '';
    const narrativeBible = await ottieniContestoNarrativo();

    // Dati di profilazione narrativa (Stile, Genere, POV, Regole)
    const p = projectProfile || (projectTitle ? { title: projectTitle } : null) as any;
    let profileBlock = '';
    if (p) {
      const parts: string[] = [];
      if (p.title) parts.push(`• Titolo Opera: "${p.title}"`);
      if (p.genre) parts.push(`• Genere Letterario: ${p.genre}`);
      if (p.styleTone) parts.push(`• Tono & Registro Stilistico: ${p.styleTone}`);
      if (p.narrativeVoice) parts.push(`• Voce Narrante & POV: ${p.narrativeVoice}`);
      if (p.targetAudience) parts.push(`• Target & Atmosfera: ${p.targetAudience}`);
      if (p.description) parts.push(`• Premessa / Sinossi: ${p.description}`);
      if (p.narrativeNotes) parts.push(`• Regole del Mondo & Direttive: ${p.narrativeNotes}`);
      if (parts.length > 0) {
        profileBlock = `=== PROFILO NARRATIVO DELL'OPERA ===\n${parts.join('\n')}\n`;
      }
    }

    switch (scope) {
      case 'selection': {
        const cleanSel = selectedText.trim();
        if (cleanSel) {
          contextStr = `=== PASSAGGIO / SELEZIONE ATTIVA NELL'EDITOR (dal Capitolo "${currentChapterTitle || 'Attivo'}") ===\n"""\n${cleanSel}\n"""\n`;
        } else {
          const cleanContent = stripHtml(currentChapterContent || '');
          if (cleanContent) {
            contextStr = `=== TESTO INTEGRALE DEL CAPITOLO ATTIVO ("${currentChapterTitle || 'Senza titolo'}") ===\n"""\n${cleanContent}\n"""\n`;
          }
        }
        if (profileBlock) contextStr = `${profileBlock}\n${contextStr}`;
        if (narrativeBible.trim()) contextStr += `\n${narrativeBible.trim()}`;
        break;
      }

      case 'chapter': {
        const cleanContent = stripHtml(currentChapterContent || '');
        contextStr = `=== TESTO DEL CAPITOLO ATTIVO: "${currentChapterTitle || 'Senza titolo'}" ===\n"""\n${cleanContent || '[Capitolo vuoto o in fase di scrittura]'}\n"""\n`;
        if (profileBlock) contextStr = `${profileBlock}\n${contextStr}`;
        if (narrativeBible.trim()) contextStr += `\n${narrativeBible.trim()}`;
        break;
      }

      case 'manuscript': {
        // Indice strutturato con conteggio parole
        const toc = chapters.length > 0
          ? chapters.map((ch, idx) => `${idx + 1}. "${ch.title}" (~${stripHtml(ch.content).split(/\s+/).filter(Boolean).length} parole)`).join('\n')
          : '[Nessun capitolo presente]';

        // Testo integrale dei capitoli con aggiornamento in tempo reale del capitolo attivo
        const manuscriptSections = chapters
          .map((ch, idx) => {
            const isCurrent = ch.title === currentChapterTitle || (currentChapterTitle && ch.title.toLowerCase() === currentChapterTitle.toLowerCase());
            const text = isCurrent && currentChapterContent ? stripHtml(currentChapterContent) : stripHtml(ch.content);
            return `--- CAPITOLO ${idx + 1}: ${ch.title} ---\n${text || '[Capitolo ancora vuoto]'}`;
          })
          .join('\n\n');

        contextStr = `${profileBlock ? profileBlock + '\n' : ''}${narrativeBible ? narrativeBible + '\n\n' : ''}=== INDICE GENERALE DEI CAPITOLI (${chapters.length} capitoli) ===\n${toc}\n\n=== TESTO INTEGRALE DI TUTTI I CAPITOLI DELL'OPERA ===\n\n${manuscriptSections}\n`;
        break;
      }

      case 'bible': {
        contextStr = `${profileBlock ? profileBlock + '\n' : ''}${narrativeBible.trim()}`;
        break;
      }

      case 'none':
      default: {
        contextStr = profileBlock ? profileBlock.trim() : '';
        break;
      }
    }

    return contextStr.trim();
  };

  // Calcolo e aggiornamento stima token del contesto selezionato
  useEffect(() => {
    let isMounted = true;
    resolveContextPayload(contextScope).then((payload) => {
      if (isMounted) {
        setEstimatedContextTokens(estimateTokens(payload));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [contextScope, selectedText, currentChapterContent, currentChapterTitle, chapters, projectTitle, isOpen]);

  // ============================================================================
  // INVIO MESSAGGIO NELLA CHAT DEL LIBRO
  // ============================================================================
  const handleSendChatMessage = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt || chatInput).trim();
    if (!textToSend || chatLoading) return;

    setChatLoading(true);
    setChatError(null);

    const userMessageId = `msg-user-${Date.now()}`;
    const contextAttached = await resolveContextPayload(contextScope);

    const newUserMessage: AIChatMessage = {
      id: userMessageId,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
      contextScope,
      contextSnippet: contextAttached ? contextAttached.slice(0, 160) + '...' : undefined,
    };

    const updatedHistory = [...chatMessages, newUserMessage];
    setChatMessages(updatedHistory);
    setChatInput('');

    try {
      let assistantReply = '';
      
      // Prompt di sistema ottimizzato per la conversazione sul libro ed editing
      const systemInstruction = `Sei l'Editor Letterario Professionista e Co-Autore Creativo in ZenScribe.
Collabori a stretto contatto con l'autore per analizzare, sviluppare, affinare e discutere il suo romanzo/opera narrativa ("${projectTitle || 'Opera narrativa'}").

IL TUO RUOLO & COMPITI PRINCIPALI:
1. DIALOGO EDITORIALE & BRAINSTORMING (MODALITÀ CONVERSAZIONE):
   - Rispondi come un editor e partner letterario empatico, stimolante, acuto, analitico e costruttivo.
   - Discuti liberamente della trama, del ritmo narrativo, della gestione della suspense, dei colpi di scena e degli archi di trasformazione dei personaggi.
   - Valuta la coerenza: se noti buchi di trama, discrepanze temporali o comportamenti dei personaggi che contrastano con quanto stabilito nella Bibbia del mondo o nei capitoli precedenti, segnalalo con garbo e proponi alternative brillanti.
   - Se l'autore ti fa domande aperte ("Cosa ne pensi?", "Come risolveresti il blocco del capitolo 3?", "Idee per il twist finale?", "Come evolvono i personaggi?"), rispondi in modo discorsivo, profondo e articolato, SENZA forzare blocchi di testo-revisionato non richiesti.

2. EDITING, STILE & VOCE NARRATIVA:
   - Mantieni sempre la massima fedeltà al Genere, al Tono, al Registro Stilistico e alla Voce Narrante (POV) definiti nel Profilo dell'Opera fornito nel contesto.
   - Fornisci consigli pratici ("show, don't tell", eliminazione di ridondanze o avverbi deboli, cura dei sottotesti nei dialoghi).

3. STESURA, REVISIONE DIRETTA & APPLICAZIONE NELL'EDITOR:
   - Quando l'autore ti chiede espressamente di correggere bozze, riscrivere, perfezionare, continuare o espandere una scena o un capitolo:
     a) Fornisci SEMPRE il testo revisionato/scritto COMPLETO e pronto all'uso, racchiuso nell'apposito blocco delimitato:
\`\`\`testo-revisionato
[Testo integrale revisionato o scritto, pronto per essere inserito nell'editor]
\`\`\`
     b) Aggiungi DOPO il blocco una breve nota sulle scelte editoriali adottate (es. "Ho velocizzato il ritmo del dialogo e rimosso 3 refusi di punteggiatura").
     In questo modo ZenScribe permetterà all'autore di applicare la revisione direttamente al manoscritto con un solo click!

REGOLA DI ACCESSO AL CONTESTO:
Tu HAI ACCESSO DIRETTO E COMPLETO a tutte le informazioni dell'opera (profilo, bibbia personaggi, relazioni, capitoli del manoscritto e selezione dell'editor) allegate qui di seguito.
Trattale come il tuo tavolo di lavoro comune con l'autore. Non dire MAI "non posso accedere ai tuoi file" o "non ho accesso al manoscritto".`;

      const fullSystemPrompt = contextAttached
        ? `${systemInstruction}\n\nECCO IL CONTESTO ATTUALE DELL'OPERA SU CUI LAVORIAMO:\n${contextAttached}`
        : systemInstruction;

      const apiMessages: ChatMessage[] = [];
      for (const msg of updatedHistory) {
        if ((msg.role === 'user' || msg.role === 'assistant') && msg.content && msg.content.trim()) {
          apiMessages.push({
            role: msg.role,
            content: msg.content.trim(),
          });
        }
      }

      if (chatEngine === 'local') {
        if (!serverStatus.isReady) {
          throw new Error(
            'Nessun modello AI locale attivo in memoria. Apri le impostazioni e attiva un modello GGUF oppure passa alla modalità Cloud.'
          );
        }
        assistantReply = await chatWithLocalAI(apiMessages, fullSystemPrompt, 0.4, 2048);
      } else {
        if (!hasCloudKey) {
          throw new Error(
            `Chiave API per ${activeCloudProvider.toUpperCase()} non configurata. Inseriscila nelle impostazioni o seleziona il modello Locale.`
          );
        }
        assistantReply = await chatWithCloudProvider(
          resolvedSettings.cloud,
          apiMessages,
          fullSystemPrompt,
          { temperature: 0.7, maxTokens: 4096 }
        );
      }

      const assistantMessage: AIChatMessage = {
        id: `msg-ai-${Date.now()}`,
        role: 'assistant',
        content: assistantReply,
        timestamp: Date.now(),
        providerUsed: chatEngine === 'local' ? modelBadge : cloudNameMap[activeCloudProvider] || 'Cloud',
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('[AIPanel Chat Error]', err);
      setChatMessages((prev) => prev.filter((m) => m.id !== userMessageId));
      setChatInput(textToSend);
      setChatError(err.message || 'Si è verificato un errore durante la risposta.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    const textToCopy = extractApplicableText(content);
    navigator.clipboard.writeText(textToCopy);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Applicazione diretta all'intero Capitolo corrente nell'editor
  const handleApplyToChapter = (content: string) => {
    const cleanText = extractApplicableText(content);
    if (onReplaceChapterContent) {
      onReplaceChapterContent(cleanText);
      setAppliedToast(`Modifiche applicate con successo all'intero capitolo "${currentChapterTitle || 'Attivo'}"!`);
      setTimeout(() => setAppliedToast(null), 3500);
    }
  };

  // Applicazione alla Selezione attiva
  const handleApplyToSelection = (content: string) => {
    const cleanText = extractApplicableText(content);
    onReplaceText(cleanText);
    setAppliedToast('Testo sostituito nella selezione dell\'editor!');
    setTimeout(() => setAppliedToast(null), 3500);
  };

  // Inserimento dopo la selezione/cursore
  const handleInsertAfterText = (content: string) => {
    const cleanText = extractApplicableText(content);
    onInsertAfter(cleanText);
    setAppliedToast('Testo aggiunto dopo la posizione corrente!');
    setTimeout(() => setAppliedToast(null), 3500);
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setChatError(null);
  };

  // ============================================================================
  // LOGICA STRUMENTI RAPIDI
  // ============================================================================
  const handleQuickAction = async (actionType: 'spellcheck' | 'rephrase' | 'continue' | 'expand' | 'plot') => {
    if (actionType !== 'plot' && !quickInputText.trim()) {
      setQuickErrorMessage('Inserisci o seleziona una porzione di testo prima di procedere.');
      return;
    }

    setIsQuickLoading(true);
    setQuickErrorMessage(null);
    setActiveQuickAction(actionType);

    try {
      let output = '';
      const context = await ottieniContestoNarrativo();

      if (actionType === 'spellcheck') {
        if (!serverStatus.isReady) {
          throw new Error('Nessun modello AI locale attivo in memoria. Apri le impostazioni e attiva un modello .gguf.');
        }
        output = await correctSpellingLocal(quickInputText, context);
      } else if (actionType === 'rephrase') {
        if (!serverStatus.isReady) {
          throw new Error('Nessun modello AI locale attivo in memoria.');
        }
        output = await rephraseTextLocal(quickInputText, context);
      } else if (actionType === 'continue') {
        if (!hasCloudKey) {
          throw new Error(`Chiave API per ${activeCloudProvider.toUpperCase()} non configurata.`);
        }
        output = await continueWritingCreative(resolvedSettings, quickInputText, context);
      } else if (actionType === 'expand') {
        if (!hasCloudKey) {
          throw new Error(`Chiave API per ${activeCloudProvider.toUpperCase()} non configurata.`);
        }
        output = await expandConceptCreative(resolvedSettings, quickInputText, context);
      } else if (actionType === 'plot') {
        if (!hasCloudKey) {
          throw new Error(`Chiave API per ${activeCloudProvider.toUpperCase()} non configurata.`);
        }
        output = await generatePlotFromBible(resolvedSettings, context, quickInputText);
      }
      setQuickResultText(output);
    } catch (err: any) {
      setQuickErrorMessage(err.message || "Si è verificato un errore durante l'elaborazione.");
    } finally {
      setIsQuickLoading(false);
      setActiveQuickAction(null);
    }
  };

  const handleQuickCopy = () => {
    if (quickResultText) {
      navigator.clipboard.writeText(quickResultText);
      setQuickCopied(true);
      setTimeout(() => setQuickCopied(false), 2000);
    }
  };

  // Prompt rapidi per la discussione del libro
  const quickPrompts = [
    {
      label: '💬 Parere sul libro',
      prompt: 'Analizza il manoscritto nel suo insieme: ritmo, coerenza stilistica e tenuta della narrazione. Quali sono i maggiori punti di forza e le aree di debolezza su cui dovrei lavorare?',
    },
    {
      label: '🎭 Coerenza personaggi',
      prompt: 'Verifica la coerenza psicologica e le motivazioni dei personaggi tra quanto narrato nei capitoli e quanto definito nella Bibbia del romanzo.',
    },
    {
      label: '🔮 Idee prossimo capitolo',
      prompt: 'In base a come si sono evoluti gli eventi finora, proponi 3 possibili sviluppi avvincenti ed emozionanti per continuare la storia.',
    },
    {
      label: '🕵️ Trova buchi di trama',
      prompt: 'Esamina attentamente la narrazione alla ricerca di buchi di trama, discrepanze temporali o passaggi poco credibili.',
    },
    {
      label: '✍️ Revisiona capitolo attivo',
      prompt: 'Revisiona attentamente il testo del capitolo attivo: correggi refusi, migliora la punteggiatura e raffina la fluidità del ritmo preservando il mio stile.',
    },
    {
      label: '⏩ Continua la narrazione',
      prompt: 'Continua la narrazione da dove siamo rimasti nel capitolo attivo per 2-3 paragrafi organici e coerenti con il punto di vista e il tono dell\'opera.',
    },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-full sm:w-[420px] xl:w-[480px] h-full shrink-0 border-l border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-xl flex flex-col z-20 animate-fade-in select-text transition-all duration-300">
      {/* Intestazione Superiore della Barra Laterale */}
      <div className="px-3.5 py-2.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/90 dark:bg-stone-950/70 select-none">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate">
              ZenScribe Muse
            </h3>
            <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
              {chatEngine === 'local' ? `Locale: ${modelBadge}` : `Cloud: ${cloudNameMap[activeCloudProvider] || 'Multi-API'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Selettore Tab */}
          <div className="flex items-center bg-stone-200/60 dark:bg-stone-800/80 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all text-xs ${
                activeTab === 'chat'
                  ? 'bg-white dark:bg-stone-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Chat del Libro & Editor Co-Autore"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('quickTools')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md transition-all text-xs ${
                activeTab === 'quickTools'
                  ? 'bg-white dark:bg-stone-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Strumenti Rapidi di Correzione & Riformulazione"
            >
              <Sparkles className="w-3 h-3" />
              <span>Strumenti</span>
            </button>
          </div>

          {/* Chiudi Barra Laterale */}
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            title="Chiudi barra laterale"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toast notifica applicazione modifiche all'editor */}
      {appliedToast && (
        <div className="bg-emerald-500 text-white px-3.5 py-1.5 text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-2 truncate">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{appliedToast}</span>
          </div>
          <button onClick={() => setAppliedToast(null)} className="text-white/80 hover:text-white shrink-0 ml-2">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: CHAT SUL LIBRO (CO-AUTORE LETTERARIO) */}
      {/* ========================================================================= */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-stone-50/30 dark:bg-stone-950/20">
          {/* Barra Contesto & Stima Token/Costi */}
          <div className="px-3 py-2 bg-stone-100/70 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 flex flex-col space-y-1.5 text-xs">
            {/* Pills di Scelta Contesto */}
            <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mr-1 shrink-0">
                Contesto:
              </span>

              <button
                onClick={() => setContextScope('manuscript')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition-all ${
                  contextScope === 'manuscript'
                    ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                }`}
                title="Include tutti i capitoli del libro, l'indice, il profilo e la bibbia narrativa"
              >
                <Layers className="w-3 h-3" />
                <span>Tutto il Libro</span>
              </button>

              <button
                onClick={() => setContextScope('chapter')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition-all ${
                  contextScope === 'chapter'
                    ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                }`}
                title={`Capitolo attivo in esame: "${currentChapterTitle || 'Attivo'}"`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Capitolo</span>
              </button>

              {selectedText && selectedText.trim() && (
                <button
                  onClick={() => setContextScope('selection')}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition-all ${
                    contextScope === 'selection'
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                  }`}
                  title="Focalizza l'assistente sulla selezione attiva nell'editor"
                >
                  <FileText className="w-3 h-3" />
                  <span>Selezione</span>
                </button>
              )}

              <button
                onClick={() => setContextScope('bible')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition-all ${
                  contextScope === 'bible'
                    ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                }`}
                title="Solo schede Personaggi, Luoghi e Relazioni di Worldbuilding"
              >
                <Compass className="w-3 h-3" />
                <span>Bibbia</span>
              </button>

              <button
                onClick={() => setContextScope('none')}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium shrink-0 transition-all ${
                  contextScope === 'none'
                    ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                    : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                }`}
                title="Nessun testo del manoscritto inviato (puro brainstorming rapido)"
              >
                <span>Libero</span>
              </button>
            </div>

            {/* Seconda riga: Badge Token & Switch Motore */}
            <div className="flex items-center justify-between gap-1 text-[11px] pt-0.5">
              {/* Pill stima Token & Costo indicativo */}
              <div
                className="flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-stone-200/60 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-mono text-[10px]"
                title={`Contesto stimato: ~${estimatedContextTokens.toLocaleString('it-IT')} token (~${Math.round(estimatedContextTokens / 1.35).toLocaleString('it-IT')} parole). Stima costo API per richiesta:\n• Gemini Flash: ~${((estimatedContextTokens / 1000000) * 0.075).toFixed(4)}$ (o gratis con Free Tier)\n• GPT-4o-mini: ~${((estimatedContextTokens / 1000000) * 0.15).toFixed(4)}$\n• Motore Locale: 0,00€`}
              >
                <Zap className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                <span>~{estimatedContextTokens > 1000 ? `${(estimatedContextTokens / 1000).toFixed(1)}k` : estimatedContextTokens} token</span>
              </div>

              {/* Switch Locale vs Cloud & Clear Chat */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setChatEngine(chatEngine === 'cloud' ? 'local' : 'cloud')}
                  className="flex items-center space-x-1 px-2 py-0.5 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-[11px] font-medium transition-colors"
                  title="Cambia tra Motore AI Locale offline e Cloud API"
                >
                  {chatEngine === 'local' ? (
                    <>
                      <Cpu className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                        {modelBadge}
                      </span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-indigo-700 dark:text-indigo-300 font-medium">
                        {cloudNameMap[activeCloudProvider] || 'Cloud'}
                      </span>
                    </>
                  )}
                </button>

                {chatMessages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800"
                    title="Nuova conversazione (azzera cronologia)"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Area Messaggi della Chat */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-semibold text-stone-800 dark:text-stone-200">
                    Parla del tuo libro con l'Editor
                  </h4>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    Fai qualsiasi domanda su trama, ritmo, coerenza dei personaggi o chiedi revisioni dirette. L'AI ha piena visibilità dell'opera!
                  </p>
                </div>

                {/* Chips di suggerimento rapido */}
                <div className="w-full pt-1">
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                    Spunti di discussione:
                  </p>
                  <div className="flex flex-col space-y-1.5 text-left">
                    {quickPrompts.map((qp, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendChatMessage(qp.prompt)}
                        className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-stone-700 dark:text-stone-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs border border-stone-200 dark:border-stone-700 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-2xs transition-all flex items-center justify-between"
                      >
                        <span>{qp.label}</span>
                        <ArrowRight className="w-3 h-3 opacity-40 shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
                >
                  {/* Badge mittente */}
                  <div className="flex items-center space-x-1.5 text-[10px] text-stone-400 px-1">
                    <span>{msg.role === 'user' ? 'Tu' : msg.providerUsed || 'Editor Muse'}</span>
                    {msg.contextScope && msg.contextScope !== 'none' && (
                      <span className="bg-stone-200/80 dark:bg-stone-800 px-1.5 py-0.2 rounded text-[9px]">
                        {msg.contextScope}
                      </span>
                    )}
                  </div>

                  {/* Bolla del messaggio */}
                  <div
                    className={`max-w-[92%] rounded-2xl p-3 text-xs leading-relaxed shadow-2xs ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs whitespace-pre-wrap'
                        : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/80 text-stone-800 dark:text-stone-200 rounded-bl-xs'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                    {/* Azioni rapide sull'editor se l'assistente propone testo */}
                    {msg.role === 'assistant' && (
                      <div className="mt-2.5 pt-2 border-t border-stone-100 dark:border-stone-700/60 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                        <div className="flex items-center flex-wrap gap-1">
                          {/* Applica al Capitolo */}
                          {onReplaceChapterContent && (
                            <button
                              onClick={() => handleApplyToChapter(msg.content)}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-2xs transition-colors text-[10px]"
                              title="Sostituisce il capitolo corrente con il testo revisionato dall'AI"
                            >
                              <Zap className="w-2.5 h-2.5" />
                              <span>Applica a Capitolo</span>
                            </button>
                          )}

                          {/* Sostituisci Selezione */}
                          {selectedText && selectedText.trim() && (
                            <button
                              onClick={() => handleApplyToSelection(msg.content)}
                              className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 font-medium transition-colors text-[10px]"
                              title="Sostituisce la selezione attiva nell'editor"
                            >
                              <span>Sostituisci selezione</span>
                            </button>
                          )}

                          {/* Inserisci in coda */}
                          <button
                            onClick={() => handleInsertAfterText(msg.content)}
                            className="flex items-center space-x-1 px-2 py-0.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors text-[10px]"
                            title="Aggiunge dopo la posizione corrente"
                          >
                            <span>Aggiungi in coda</span>
                          </button>
                        </div>

                        {/* Copia negli appunti */}
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="flex items-center space-x-1 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] transition-colors"
                          title="Copia testo negli appunti"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-medium">Copiato!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copia</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Spinner di caricamento */}
            {chatLoading && (
              <div className="flex flex-col items-start space-y-1">
                <div className="text-[10px] text-stone-400 px-1">Editor AI in ascolto...</div>
                <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/80 rounded-2xl rounded-bl-xs p-2.5 text-xs flex items-center space-x-2 text-stone-500 shadow-2xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Elaborazione risposta con {chatEngine === 'local' ? modelBadge : 'Cloud AI'}...</span>
                </div>
              </div>
            )}

            {/* Errore in chat */}
            {chatError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <span>{chatError}</span>
                <button onClick={onOpenSettings} className="font-semibold underline ml-2 hover:text-rose-900 shrink-0">
                  Impostazioni
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Barra Input di Invio Messaggio */}
          <div className="p-2.5 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col space-y-1.5">
            <div className="flex items-end space-x-1.5">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder="Parla del libro, chiedi pareri o revisioni..."
                rows={2}
                className="flex-1 p-2 text-xs font-sans rounded-xl border border-stone-200 dark:border-stone-750 bg-stone-50/70 dark:bg-stone-950/60 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />

              <button
                disabled={!chatInput.trim() || chatLoading}
                onClick={() => handleSendChatMessage()}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center shrink-0"
                title="Invia messaggio (Enter)"
              >
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-stone-400 px-1">
              <span><strong>Enter</strong> invia • <strong>Shift+Enter</strong> a capo</span>
              <span>Rif: <strong>{contextScope}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STRUMENTI RAPIDI ISTANTANEI */}
      {/* ========================================================================= */}
      {activeTab === 'quickTools' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
          {/* Testo in esame */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
              Testo in esame (selezionato o incollato):
            </label>
            <textarea
              value={quickInputText}
              onChange={(e) => setQuickInputText(e.target.value)}
              placeholder="Seleziona del testo nell'editor o incollalo qui..."
              className="w-full h-24 p-2.5 text-xs font-sans rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Azioni Rapide */}
          <div className="space-y-2.5">
            {/* Azioni Locali (Offline Privato) */}
            <div className="p-3 bg-stone-100/60 dark:bg-stone-800/40 rounded-xl space-y-2 border border-stone-200/60 dark:border-stone-700/40">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                <span className="flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Fase 1: Locale & Privato</span>
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    serverStatus.isReady
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-stone-200 text-stone-600 dark:bg-stone-700 dark:text-stone-400'
                  }`}
                >
                  {serverStatus.isReady ? modelBadge : 'Offline'}
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  disabled={isQuickLoading || !serverStatus.isReady}
                  onClick={() => handleQuickAction('spellcheck')}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Correzione Bozze & Refusi</span>
                  {isQuickLoading && activeQuickAction === 'spellcheck' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                </button>
                <button
                  disabled={isQuickLoading || !serverStatus.isReady}
                  onClick={() => handleQuickAction('rephrase')}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Riformula e alleggerisci</span>
                  {isQuickLoading && activeQuickAction === 'rephrase' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                </button>
              </div>
            </div>

            {/* Azioni Cloud */}
            <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl space-y-2 border border-indigo-100 dark:border-indigo-900/30">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                <span className="flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Fase 2: Cloud Creativo</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                  {cloudNameMap[activeCloudProvider] || 'Cloud API'}
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  disabled={isQuickLoading || !hasCloudKey}
                  onClick={() => handleQuickAction('continue')}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Continua la narrazione (2-3 paragrafi)</span>
                  {isQuickLoading && activeQuickAction === 'continue' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                </button>
                <button
                  disabled={isQuickLoading || !hasCloudKey}
                  onClick={() => handleQuickAction('expand')}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Espandi con dettagli & atmosfera</span>
                  {isQuickLoading && activeQuickAction === 'expand' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                </button>
                <button
                  disabled={isQuickLoading || !hasCloudKey}
                  onClick={() => handleQuickAction('plot')}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Progetta Trama dai Personaggi</span>
                  {isQuickLoading && activeQuickAction === 'plot' && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Errore Strumenti */}
          {quickErrorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {quickErrorMessage}
            </div>
          )}

          {/* Risultato elaborazione rapida */}
          {quickResultText && (
            <div className="space-y-2 pt-1 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                <span>Risultato Elaborazione:</span>
                <button
                  onClick={handleQuickCopy}
                  className="flex items-center space-x-1 text-xs text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {quickCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{quickCopied ? 'Copiato' : 'Copia'}</span>
                </button>
              </div>
              <div className="p-3 bg-stone-50 dark:bg-stone-950/60 rounded-xl border border-stone-200 dark:border-stone-800 text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {quickResultText}
              </div>
              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={() => {
                    onInsertAfter(quickResultText);
                  }}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors"
                >
                  Aggiungi dopo
                </button>
                <button
                  onClick={() => {
                    onReplaceText(quickResultText);
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1 shadow-sm transition-colors"
                >
                  <span>Sostituisci selezione</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
