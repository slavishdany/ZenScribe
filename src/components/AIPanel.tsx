import React, { useState } from 'react';
import { Sparkles, Cpu, Check, Copy, ArrowRight, Loader2, X, Globe } from 'lucide-react';
import { correctSpellingLocal, rephraseTextLocal } from '../services/localAi';
import { continueWritingCreative, expandConceptCreative, generatePlotFromBible } from '../services/cloudAi';
import { ottieniContestoNarrativo } from '../services/db';
import { ServerStatusInfo, EditorSettings } from '../types';

interface AIPanelProps {
  isOpen: boolean;
  selectedText: string;
  serverStatus: ServerStatusInfo;
  activeModelName?: string;
  geminiApiKey: string;
  settings?: EditorSettings;
  onClose: () => void;
  onReplaceText: (newText: string) => void;
  onInsertAfter: (newText: string) => void;
  onOpenSettings: () => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({
  isOpen,
  selectedText,
  serverStatus,
  activeModelName,
  geminiApiKey,
  settings,
  onClose,
  onReplaceText,
  onInsertAfter,
  onOpenSettings,
}) => {
  const [inputText, setInputText] = useState(selectedText);
  const [resultText, setResultText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Aggiorna inputText quando cambia il testo selezionato
  React.useEffect(() => {
    if (selectedText) {
      setInputText(selectedText);
      setResultText('');
      setErrorMessage(null);
    }
  }, [selectedText, isOpen]);

  if (!isOpen) return null;

  // Risolve impostazioni cloud correnti o fallback
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
        gemini: { apiKey: geminiApiKey, model: 'gemini-2.5-flash' },
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
      (activeCloudProvider === 'custom')
  );

  const handleAction = async (actionType: 'spellcheck' | 'rephrase' | 'continue' | 'expand' | 'plot') => {
    if (actionType !== 'plot' && !inputText.trim()) {
      setErrorMessage("Inserisci o seleziona una porzione di testo prima di procedere.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setActiveAction(actionType);

    try {
      let output = '';
      const context = await ottieniContestoNarrativo();

      if (actionType === 'spellcheck') {
        if (!serverStatus.isReady) {
          throw new Error("Nessun modello AI locale attivo in memoria. Apri le impostazioni e scarica o attiva un modello .gguf.");
        }
        output = await correctSpellingLocal(inputText, context);
      } else if (actionType === 'rephrase') {
        if (!serverStatus.isReady) {
          throw new Error("Nessun modello AI locale attivo in memoria. Apri le impostazioni e attiva un modello.");
        }
        output = await rephraseTextLocal(inputText, context);
      } else if (actionType === 'continue') {
        if (!hasCloudKey) {
          throw new Error(`Chiave API per ${activeCloudProvider.toUpperCase()} non configurata. Inseriscila nelle impostazioni.`);
        }
        output = await continueWritingCreative(resolvedSettings, inputText, context);
      } else if (actionType === 'expand') {
        if (!hasCloudKey) {
          throw new Error(`Chiave API per ${activeCloudProvider.toUpperCase()} non configurata. Inseriscila nelle impostazioni.`);
        }
        output = await expandConceptCreative(resolvedSettings, inputText, context);
      } else if (actionType === 'plot') {
        if (!hasCloudKey) {
          throw new Error(`Chiave API per ${activeCloudProvider.toUpperCase()} non configurata. Inseriscila nelle impostazioni.`);
        }
        output = await generatePlotFromBible(resolvedSettings, context, inputText);
      }
      setResultText(output);
    } catch (err: any) {
      setErrorMessage(err.message || "Si è verificato un errore durante l'elaborazione.");
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  };

  const handleCopy = () => {
    if (resultText) {
      navigator.clipboard.writeText(resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const modelBadge = activeModelName
    ? activeModelName.toLowerCase().includes("llama-3.2-3b")
      ? "Llama 3.2 3B"
      : activeModelName.toLowerCase().includes("gemma-2-2b")
      ? "Gemma 2 2B"
      : activeModelName.toLowerCase().includes("mistral-7b")
      ? "Mistral 7B"
      : activeModelName.toLowerCase().includes("phi-3")
      ? "Phi-3 Medium"
      : "Attivo"
    : "Offline";

  const cloudNameMap: Record<string, string> = {
    gemini: 'Gemini Flash',
    openai: 'OpenAI GPT',
    anthropic: 'Claude 3.5',
    openrouter: 'OpenRouter',
    groq: 'Groq LPUs',
    custom: 'Custom Server',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Intestazione */}
        <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/60 dark:bg-stone-950/40">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
              Assistente alla Scrittura (Locale + Cloud Multi-API)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo modale */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* Testo di input */}
          <div>
            <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
              Testo in esame (dall'editor o incollato):
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
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
                  disabled={isLoading || !serverStatus.isReady}
                  onClick={() => handleAction('spellcheck')}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Correzione Bozze & Refusi</span>
                  {isLoading && activeAction === 'spellcheck' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
                <button
                  disabled={isLoading || !serverStatus.isReady}
                  onClick={() => handleAction('rephrase')}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Riformula e alleggerisci</span>
                  {isLoading && activeAction === 'rephrase' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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
                  disabled={isLoading || !hasCloudKey}
                  onClick={() => handleAction('continue')}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Continua la narrazione</span>
                  {isLoading && activeAction === 'continue' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
                <button
                  disabled={isLoading || !hasCloudKey}
                  onClick={() => handleAction('expand')}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700 disabled:opacity-40 flex items-center justify-between transition-colors shadow-2xs"
                >
                  <span>Espandi e arricchisci idea</span>
                  {isLoading && activeAction === 'expand' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
                <button
                  disabled={isLoading || !hasCloudKey}
                  onClick={() => handleAction('plot')}
                  className="w-full text-left px-2.5 py-2 text-xs font-medium rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700 border border-indigo-200 dark:border-indigo-800/60 disabled:opacity-40 flex items-center justify-between transition-colors text-indigo-700 dark:text-indigo-300 shadow-2xs"
                >
                  <span>Genera Trama Completa</span>
                  {isLoading && activeAction === 'plot' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
              </div>
            </div>
          </div>

          {/* Messaggi di errore o istruzioni configurazione */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span>{errorMessage}</span>
              <button
                onClick={onOpenSettings}
                className="font-semibold underline ml-2 hover:text-rose-900"
              >
                Impostazioni
              </button>
            </div>
          )}

          {/* Risultato Generato */}
          {resultText && (
            <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  Proposta AI Generata:
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "Copiato!" : "Copia"}</span>
                </button>
              </div>
              <div className="p-3 bg-stone-50 dark:bg-stone-950/70 border border-stone-200 dark:border-stone-800 rounded-xl text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-stone-800 dark:text-stone-200">
                {resultText}
              </div>

              {/* Bottoni Inserimento nell'editor */}
              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  onClick={() => {
                    onInsertAfter(resultText);
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 transition-colors"
                >
                  Aggiungi dopo
                </button>
                <button
                  onClick={() => {
                    onReplaceText(resultText);
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
      </div>
    </div>
  );
};
