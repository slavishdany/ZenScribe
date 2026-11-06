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
import { ServerStatusInfo, EditorSettings, AIChatMessage, ChatContextScope } from '../types';
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
 * Estrae il testo pulito applicabile dall'output dell'assistente,
 * estraendo blocchi racchiusi in ``` o """ se presenti.
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
  onClose,
  onReplaceText,
  onReplaceChapterContent,
  onInsertAfter,
  onOpenSettings,
}) => {
  // Modalità: 'chat' (predefinita) o 'quickTools' (strumenti istantanei)
  const [activeTab, setActiveTab] = useState<'chat' | 'quickTools'>('chat');

  // ============================================================================
  // STATO CHAT EDITORIALE
  // ============================================================================
  const [chatMessages, setChatMessages] = useState<AIChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [appliedToast, setAppliedToast] = useState<string | null>(null);

  // Ambito di contesto per la chat
  const [contextScope, setContextScope] = useState<ChatContextScope>(() => {
    return selectedText && selectedText.trim() ? 'selection' : 'chapter';
  });

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
    } else {
      setContextScope('chapter');
    }
  }, [selectedText, isOpen]);

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
      ? 'Phi-3 Medium'
      : 'Attivo'
    : 'Offline';

  const cloudNameMap: Record<string, string> = {
    gemini: 'Gemini Flash',
    openai: 'OpenAI GPT',
    anthropic: 'Claude 3.5',
    openrouter: 'OpenRouter',
    groq: 'Groq LPUs',
    custom: 'Custom Server',
  };

  // Adatta intelligentemente il motore chat se la chiave cloud manca ma il motore locale è attivo
  useEffect(() => {
    if (!hasCloudKey && serverStatus.isReady) {
      setChatEngine('local');
    } else if (hasCloudKey && !serverStatus.isReady) {
      setChatEngine('cloud');
    }
  }, [hasCloudKey, serverStatus.isReady]);

  // ============================================================================
  // LOGICA CHAT EDITORIALE
  // ============================================================================

  // Costruisce la porzione di contesto da allegare alla domanda
  const resolveContextPayload = async (scope: ChatContextScope): Promise<string> => {
    let contextStr = '';
    const narrativeBible = await ottieniContestoNarrativo();

    switch (scope) {
      case 'selection':
        if (selectedText.trim()) {
          contextStr = `=== TESTO / PARAGRAFO SELEZIONATO DALL'AUTORE NELL'EDITOR ===\n"""\n${selectedText.trim()}\n"""\n`;
        } else {
          const cleanContent = stripHtml(currentChapterContent || '');
          if (cleanContent.trim()) {
            contextStr = `=== TESTO INTEGRALE DEL CAPITOLO CORRENTE ("${currentChapterTitle || 'Senza titolo'}") ===\n"""\n${cleanContent}\n"""\n`;
          }
        }
        if (narrativeBible.trim()) {
          contextStr += `\n${narrativeBible.trim()}`;
        }
        break;

      case 'chapter':
        const cleanContent = stripHtml(currentChapterContent || '');
        if (cleanContent.trim()) {
          contextStr = `=== TESTO INTEGRALE DEL CAPITOLO CORRENTE ("${currentChapterTitle || 'Senza titolo'}") ===\n"""\n${cleanContent}\n"""\n`;
        } else {
          const validChapters = chapters.filter((c) => stripHtml(c.content).trim());
          if (validChapters.length > 0) {
            contextStr = `=== TESTO DEL MANOSCRITTO (${validChapters.length} CAPITOLI DISPONIBILI) ===\n\n${validChapters.map((c) => `--- ${c.title} ---\n${stripHtml(c.content)}`).join('\n\n')}\n`;
          }
        }
        if (narrativeBible.trim()) {
          contextStr += `\n${narrativeBible.trim()}`;
        }
        break;

      case 'manuscript':
        const manuscriptSections = chapters
          .map((ch, idx) => `--- Capitolo ${idx + 1}: ${ch.title} ---\n${stripHtml(ch.content)}`)
          .join('\n\n');
        contextStr = `=== MANOSCRITTO COMPLETO DELL'OPERA ("${projectTitle || 'Romanzo'}") ===\n\n${manuscriptSections}\n`;
        if (narrativeBible.trim()) {
          contextStr += `\n${narrativeBible.trim()}`;
        }
        break;

      case 'bible':
        contextStr = narrativeBible.trim();
        break;

      case 'none':
      default:
        contextStr = '';
        break;
    }

    return contextStr.trim();
  };

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
      const systemInstruction = `Sei un acclamato editor letterario professionista e co-autore creativo al fianco dello scrittore in ZenScribe.
Il tuo compito è dialogare con l'autore, analizzare brani e capitoli, dare pareri costruttivi sul ritmo, dialoghi, suspense e stile, e risolvere blocchi creativi.
Rispondi in italiano con uno stile stimolante, empatico, analitico e letterario.

REGOLA FONDAMENTALE SULL'ACCESSO AL TESTO:
Tu HAI GIÀ ACCESSO DIRETTO al testo dell'opera e del capitolo fornito qui di seguito nel contesto.
NON dire MAI "non posso accedere ai tuoi file", "non ho accesso alla tua area di testo", "non posso modificare i file" o "è impossibile".
Se l'autore ti chiede di 'correggere', 'revisionare', 'riscrivere', 'ripulire la punteggiatura o l'ortografia' del testo in esame, del capitolo o del manoscritto:
1. Esegui la correzione DIRETTAMENTE sul testo fornito nel contesto.
2. Fornisci SEMPRE il testo corretto/revisionato COMPLETO pronto all'uso.
3. Racchiudi la versione corretta pronta per l'applicazione all'interno di un blocco ben delimitato:
\`\`\`testo-revisionato
[Inserisci qui l'intero testo corretto e pronto per essere salvato nel capitolo dell'autore]
\`\`\`
4. Se desideri spiegare brevemente cosa hai modificato (es. 'Ho corretto la punteggiatura dei dialoghi e rimosso 3 refusi'), aggiungi la tua nota DOPO il blocco.
In questo modo ZenScribe permetterà all'autore di applicare la correzione al manoscritto con un solo click!

Se il testo fornito nel contesto è vuoto, avvisa con cortesia l'autore invitandolo a scrivere qualcosa nel capitolo o a selezionare un paragrafo nell'editor.`;

      const fullSystemPrompt = contextAttached
        ? `${systemInstruction}\n\nECCO IL CONTESTO DELL'OPERA E DEL TESTO SU CUI LAVORARE:\n${contextAttached}`
        : systemInstruction;

      // Costruzione dei messaggi formattati con contesto allegato per la chiamata
      const apiMessages: ChatMessage[] = [];

      // Aggiungi la cronologia dei messaggi scambiati validati
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
      // Rimuoviamo il messaggio utente senza risposta per non corrompere l'alternanza multi-turn
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
    setAppliedToast('Testo corretto sostituito nella selezione dell\'editor!');
    setTimeout(() => setAppliedToast(null), 3500);
  };

  // Inserimento dopo la selezione/cursore
  const handleInsertAfterText = (content: string) => {
    const cleanText = extractApplicableText(content);
    onInsertAfter(cleanText);
    setAppliedToast('Testo aggiunto dopo la posizione corrente nell\'editor!');
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

  // Prompt rapidi per la chat
  const quickPrompts = [
    {
      label: '✍️ Correggi punteggiatura & refusi del capitolo',
      prompt: 'Correggi accuratamente tutti i refusi, la punteggiatura e l\'ortografia dell\'intero capitolo corrente, preservando intatto lo stile e la voce dell\'autore. Fornisci il testo corretto pronto per l\'editor.',
    },
    {
      label: '🧐 Valuta paragrafo',
      prompt: 'Cosa ne pensi di questo passaggio? Quali sono i suoi punti di forza e dove risulta debole o poco efficace?',
    },
    {
      label: '⚖️ Analizza ritmo & suspense',
      prompt: 'Valutami questo capitolo: il ritmo narrativo e la suspense funzionano bene o ci sono cali di tensione?',
    },
    {
      label: '💡 Suggerisci 3 idee di trama',
      prompt: 'Suggeriscimi 3 possibili colpi di scena o sviluppi inaspettati ed emozionanti per continuare questa situazione.',
    },
    {
      label: '🎭 Esamina i dialoghi',
      prompt: 'I dialoghi dei personaggi risultano naturali, credibili e distintivi o suonano artificiosi? Come posso migliorarli?',
    },
    {
      label: '🔍 Verifica incongruenze',
      prompt: 'Noti contraddizioni o incongruenze tra quanto accade in questo brano e i dettagli o regole specificati nella bibbia narrativa?',
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col h-[90vh] sm:h-[85vh]">
        {/* Intestazione Superiore */}
        <div className="px-4 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-950/60 select-none">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                ZenScribe Muse & Assistente Editoriale
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {chatEngine === 'local' ? `Motore Locale: ${modelBadge}` : `Cloud: ${cloudNameMap[activeCloudProvider] || 'Multi-API'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Navigazione Tab */}
            <div className="flex items-center bg-stone-200/60 dark:bg-stone-800/80 p-0.5 rounded-lg text-xs font-medium">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === 'chat'
                    ? 'bg-white dark:bg-stone-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat Editoriale</span>
              </button>
              <button
                onClick={() => setActiveTab('quickTools')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === 'quickTools'
                    ? 'bg-white dark:bg-stone-700 text-indigo-600 dark:text-indigo-300 shadow-2xs font-semibold'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Strumenti Rapidi</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifica di modifica applicata all'editor */}
        {appliedToast && (
          <div className="bg-emerald-500 text-white px-4 py-2 text-xs flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{appliedToast}</span>
            </div>
            <button onClick={() => setAppliedToast(null)} className="text-white/80 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: CHAT EDITORIALE APERTA */}
        {/* ========================================================================= */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-stone-50/30 dark:bg-stone-950/20">
            {/* Barra Superiore Selezione Contesto & Motore */}
            <div className="px-4 py-2 bg-stone-100/70 dark:bg-stone-800/50 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* Pills Contesto */}
              <div className="flex items-center space-x-1 overflow-x-auto max-w-full py-0.5">
                <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mr-1 flex items-center">
                  Contesto:
                </span>

                {selectedText && selectedText.trim() && (
                  <button
                    onClick={() => setContextScope('selection')}
                    className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      contextScope === 'selection'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>Selezione ({selectedText.trim().split(/\s+/).length} parole)</span>
                  </button>
                )}

                <button
                  onClick={() => setContextScope('chapter')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    contextScope === 'chapter'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Capitolo: {currentChapterTitle || 'Attivo'}</span>
                </button>

                <button
                  onClick={() => setContextScope('bible')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    contextScope === 'bible'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <Compass className="w-3 h-3" />
                  <span>Bibbia & Personaggi</span>
                </button>

                <button
                  onClick={() => setContextScope('manuscript')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    contextScope === 'manuscript'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Intero Manoscritto</span>
                </button>

                <button
                  onClick={() => setContextScope('none')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                    contextScope === 'none'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 border border-stone-200 dark:border-stone-700'
                  }`}
                >
                  <span>Libero (Nessun testo)</span>
                </button>
              </div>

              {/* Selettore Motore (Locale vs Cloud) */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setChatEngine(chatEngine === 'cloud' ? 'local' : 'cloud')}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 text-[11px] font-medium transition-colors"
                  title="Cambia tra Motore AI Locale offline e Cloud API"
                >
                  {chatEngine === 'local' ? (
                    <>
                      <Cpu className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">
                        Locale: {modelBadge}
                      </span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                        Cloud: {cloudNameMap[activeCloudProvider] || 'Cloud'}
                      </span>
                    </>
                  )}
                </button>

                {chatMessages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800"
                    title="Nuova conversazione (azzera cronologia)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Area Messaggi */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 max-w-lg mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                      Editor Letterario Interattivo
                    </h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                      Fai qualsiasi domanda o chiedi di correggere il testo. L'AI ha accesso diretto al testo in esame e potrai applicare le correzioni direttamente nell'editor con un solo tocco!
                    </p>
                  </div>

                  {/* Quick Prompts Chips */}
                  <div className="w-full pt-2">
                    <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                      Azioni frequenti:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {quickPrompts.map((qp, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendChatMessage(qp.prompt)}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-stone-700 dark:text-stone-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs border border-stone-200 dark:border-stone-700 hover:border-indigo-300 dark:hover:border-indigo-800 shadow-2xs transition-all text-left"
                        >
                          {qp.label}
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
                      <span>{msg.role === 'user' ? 'Tu (Autore)' : msg.providerUsed || 'Editor AI'}</span>
                      {msg.contextScope && msg.contextScope !== 'none' && (
                        <span className="bg-stone-200/80 dark:bg-stone-800 px-1.5 py-0.2 rounded text-[9px]">
                          rif: {msg.contextScope}
                        </span>
                      )}
                    </div>

                    {/* Bolla messaggio */}
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-2xs ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-xs whitespace-pre-wrap'
                          : 'bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/80 text-stone-800 dark:text-stone-200 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                      {/* Azioni dirette sull'Editor del testo (per l'assistente) */}
                      {msg.role === 'assistant' && (
                        <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-stone-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center space-x-2">
                            {/* Applica al Capitolo */}
                            {onReplaceChapterContent && (
                              <button
                                onClick={() => handleApplyToChapter(msg.content)}
                                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-2xs transition-colors"
                                title="Sostituisce l'intero capitolo corrente con il testo revisionato dall'AI"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Applica al Capitolo</span>
                              </button>
                            )}

                            {/* Sostituisci Selezione */}
                            {selectedText && selectedText.trim() && (
                              <button
                                onClick={() => handleApplyToSelection(msg.content)}
                                className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-stone-100 dark:bg-stone-700 hover:bg-stone-200 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-200 font-medium transition-colors"
                                title="Sostituisce la selezione attiva nell'editor"
                              >
                                <span>Sostituisci Selezione</span>
                              </button>
                            )}

                            {/* Inserisci in Coda */}
                            <button
                              onClick={() => handleInsertAfterText(msg.content)}
                              className="flex items-center space-x-1 px-2 py-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                              title="Aggiunge dopo la posizione corrente"
                            >
                              <span>Aggiungi in coda</span>
                            </button>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="flex items-center space-x-1 text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Indicatore di caricamento risposta */}
              {chatLoading && (
                <div className="flex flex-col items-start space-y-1">
                  <div className="text-[10px] text-stone-400 px-1">Editor AI sta elaborando la correzione...</div>
                  <div className="bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700/80 rounded-2xl rounded-bl-xs p-3 text-xs flex items-center space-x-2 text-stone-500 shadow-2xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                    <span>Elaborazione testo in corso con {chatEngine === 'local' ? modelBadge : 'Cloud AI'}...</span>
                  </div>
                </div>
              )}

              {/* Errore in chat */}
              {chatError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                  <span>{chatError}</span>
                  <button onClick={onOpenSettings} className="font-semibold underline ml-2 hover:text-rose-900">
                    Verifica Impostazioni
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Barra di Input Chat */}
            <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col space-y-2">
              <div className="flex items-end space-x-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder="Chiedi all'editor (es. 'Correggi punteggiatura ed ortografia del capitolo', 'Cosa ne pensi?')..."
                  rows={2}
                  className="flex-1 p-2.5 text-xs font-sans rounded-xl border border-stone-200 dark:border-stone-750 bg-stone-50/70 dark:bg-stone-950/60 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />

                <button
                  disabled={!chatInput.trim() || chatLoading}
                  onClick={() => handleSendChatMessage()}
                  className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center shrink-0"
                  title="Invia domanda (Enter)"
                >
                  {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-stone-400 px-1">
                <span>Premi <strong>Enter</strong> per inviare, <strong>Shift + Enter</strong> per nuova riga</span>
                <span>Contesto attivo: <strong>{contextScope}</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: STRUMENTI RAPIDI ISTANTANEI */}
        {/* ========================================================================= */}
        {activeTab === 'quickTools' && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
            {/* Testo di input */}
            <div>
              <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                Testo in esame (dall'editor o incollato):
              </label>
              <textarea
                value={quickInputText}
                onChange={(e) => setQuickInputText(e.target.value)}
                placeholder="Seleziona del testo nell'editor o incollalo qui..."
                className="w-full h-24 p-2.5 text-xs font-sans rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Bottoni Azioni Rapide */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Azioni Locali (Nativo Rust) */}
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
                    className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span>Correzione Bozze & Refusi</span>
                    {isQuickLoading && activeQuickAction === 'spellcheck' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  </button>
                  <button
                    disabled={isQuickLoading || !serverStatus.isReady}
                    onClick={() => handleQuickAction('rephrase')}
                    className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span>Riformula e alleggerisci</span>
                    {isQuickLoading && activeQuickAction === 'rephrase' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  </button>
                </div>
              </div>

              {/* Azioni Cloud Multi-API */}
              <div className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl space-y-2 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 dark:text-indigo-300">
                  <span className="flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Fase 2: Cloud Creativo</span>
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full font-medium">
                    {cloudNameMap[activeCloudProvider] || 'Cloud API'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <button
                    disabled={isQuickLoading || !hasCloudKey}
                    onClick={() => handleQuickAction('continue')}
                    className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span>Continua la narrazione</span>
                    {isQuickLoading && activeQuickAction === 'continue' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  </button>
                  <button
                    disabled={isQuickLoading || !hasCloudKey}
                    onClick={() => handleQuickAction('expand')}
                    className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                  >
                    <span>Espandi e arricchisci idea</span>
                    {isQuickLoading && activeQuickAction === 'expand' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  </button>
                  <button
                    disabled={isQuickLoading || !hasCloudKey}
                    onClick={() => handleQuickAction('plot')}
                    className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-indigo-200 dark:border-indigo-800/60 disabled:opacity-40 flex items-center justify-between transition-colors text-indigo-700 dark:text-indigo-300 shadow-2xs"
                  >
                    <span>Genera Trama Completa</span>
                    {isQuickLoading && activeQuickAction === 'plot' && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Messaggi di errore */}
            {quickErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                <span>{quickErrorMessage}</span>
                <button onClick={onOpenSettings} className="font-semibold underline ml-2 hover:text-rose-900">
                  Impostazioni
                </button>
              </div>
            )}

            {/* Risultato Generato Strumenti Rapidi */}
            {quickResultText && (
              <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Proposta AI Generata:
                  </span>
                  <button
                    onClick={handleQuickCopy}
                    className="flex items-center space-x-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                  >
                    {quickCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{quickCopied ? 'Copiato!' : 'Copia'}</span>
                  </button>
                </div>
                <div className="p-3 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-stone-800 dark:text-stone-200">
                  {quickResultText}
                </div>

                {/* Bottoni Inserimento nell'editor */}
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    onClick={() => {
                      onInsertAfter(quickResultText);
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors"
                  >
                    Aggiungi dopo
                  </button>
                  <button
                    onClick={() => {
                      onReplaceText(quickResultText);
                      onClose();
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center space-x-1.5 shadow-sm transition-colors"
                  >
                    <span>Sostituisci selezione</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
