import React from 'react';
import { Sparkles, Cpu, RefreshCw } from 'lucide-react';
import { ServerStatusInfo } from '../types';

interface StatusBarProps {
  wordCount: number;
  characterCount: number;
  serverStatus: ServerStatusInfo;
  activeModelName?: string;
  hasGeminiKey: boolean;
  zenMode: boolean;
  onToggleZenMode: () => void;
  onOpenSettings: () => void;
  onRefreshServer: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  wordCount,
  characterCount,
  serverStatus,
  activeModelName,
  hasGeminiKey,
  zenMode,
  onOpenSettings,
}) => {
  // Stima tempo di lettura (circa 200 parole al minuto)
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // Nome abbreviato per la visualizzazione nella barra
  const displayModelLabel = activeModelName
    ? activeModelName.toLowerCase().includes("llama-3.2-3b")
      ? "Llama 3.2 3B"
      : activeModelName.toLowerCase().includes("gemma-2-2b")
      ? "Gemma 2 2B"
      : activeModelName.toLowerCase().includes("mistral-7b")
      ? "Mistral 7B"
      : activeModelName.toLowerCase().includes("phi-3")
      ? "Phi-3 Medium"
      : activeModelName.replace(/\.gguf$/i, "").replace(/\.llamafile(\.exe)?$/i, "").slice(0, 16)
    : "Nessun modello";

  return (
    <footer
      className={`h-9 px-4 border-t border-stone-200 dark:border-stone-800 bg-zen-surface/90 dark:bg-zen-darkSurface/90 backdrop-blur-sm flex items-center justify-between text-xs text-zen-subtle dark:text-zen-darkSubtle select-none transition-opacity duration-300 ${
        zenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'
      }`}
    >
      {/* Contatori statistiche scrittura */}
      <div className="flex items-center space-x-4">
        <span>
          <strong className="text-zen-text dark:text-zen-darkText">{wordCount}</strong> parole
        </span>
        <span className="hidden sm:inline">
          <strong className="text-zen-text dark:text-zen-darkText">{characterCount}</strong> caratteri
        </span>
        <span className="hidden md:inline">
          ~{readingTimeMin} min lettura
        </span>
      </div>

      {/* Indicatori Motori AI (Locale + Cloud) & Controlli */}
      <div className="flex items-center space-x-3">
        {/* Motore AI Locale Nativo */}
        <div
          className="flex items-center space-x-1.5 cursor-pointer py-1 px-2 rounded hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors"
          onClick={onOpenSettings}
          title={
            serverStatus.isReady
              ? `Motore Nativo Attivo: ${activeModelName || 'Modello'} (Clicca per cambiare o scaricare modelli)`
              : "Nessun modello locale attivo. Clicca per scaricare un modello (.gguf)."
          }
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">AI Locale:</span>
          {serverStatus.isChecking ? (
            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
          ) : serverStatus.isReady ? (
            <span className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{displayModelLabel}</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-stone-400 dark:text-stone-500">
              <span className="w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-600"></span>
              <span>Scarica Modello</span>
            </span>
          )}
        </div>

        {/* Motore Cloud (Gemini) */}
        <div
          className="flex items-center space-x-1.5 cursor-pointer py-1 px-2 rounded hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors"
          onClick={onOpenSettings}
          title={hasGeminiKey ? "Gemini Cloud: Chiave API attiva" : "Clicca per inserire la chiave API di Google AI Studio"}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">Gemini:</span>
          {hasGeminiKey ? (
            <span className="text-indigo-600 dark:text-indigo-400 font-medium">Attivo</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">Non configurato</span>
          )}
        </div>
      </div>
    </footer>
  );
};
