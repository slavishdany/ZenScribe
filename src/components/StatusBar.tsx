import React from 'react';
import { Sparkles, Cpu, Eye, EyeOff, Settings, RefreshCw } from 'lucide-react';
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
  onToggleZenMode,
  onOpenSettings,
  onRefreshServer,
}) => {
  // Stima tempo di lettura (circa 200 parole al minuto)
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  // Nome abbreviato per la visualizzazione nella barra
  const displayModelLabel = activeModelName
    ? activeModelName.toLowerCase().includes("italiano")
      ? "Italiano (3.2B)"
      : activeModelName.toLowerCase().includes("0.8b")
      ? "Qwen (0.8B)"
      : "Llamafile"
    : "Locale";

  return (
    <footer className={`h-9 px-4 border-t border-stone-200 dark:border-stone-800 bg-zen-surface/90 dark:bg-zen-darkSurface/90 backdrop-blur-sm flex items-center justify-between text-xs text-zen-subtle dark:text-zen-darkSubtle select-none transition-opacity duration-300 ${
      zenMode ? 'opacity-0 hover:opacity-100' : 'opacity-100'
    }`}>
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
        {/* Motore Locale (Llamafile) */}
        <div 
          className="flex items-center space-x-1.5 cursor-pointer py-1 px-2 rounded hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors"
          onClick={onOpenSettings}
          title={
            serverStatus.isReady
              ? `Motore Locale Attivo: ${activeModelName || 'Llamafile'} su porta 8080 (Clicca per cambiare modello)`
              : "Motore Locale Llamafile non raggiungibile. Clicca per aprire le impostazioni o verificare."
          }
        >
          <Cpu className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">Locale ({displayModelLabel}):</span>
          {serverStatus.isChecking ? (
            <RefreshCw className="w-3 h-3 text-amber-500 animate-spin" />
          ) : serverStatus.isReady ? (
            <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Pronto</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1 text-stone-400 dark:text-stone-500">
              <span className="w-2 h-2 rounded-full bg-stone-400 dark:bg-stone-600"></span>
              <span>Offline</span>
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

        <div className="h-3 w-px bg-stone-300 dark:bg-stone-700 mx-1"></div>

        {/* Toggle Modalità Zen */}
        <button
          onClick={onToggleZenMode}
          className={`p-1 rounded transition-colors ${
            zenMode
              ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400'
              : 'hover:text-zen-text dark:hover:text-zen-darkText hover:bg-stone-200/50 dark:hover:bg-stone-800/50'
          }`}
          title={zenMode ? "Disattiva Modalità Zen" : "Attiva Modalità Zen (Focus totale)"}
        >
          {zenMode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Impostazioni */}
        <button
          onClick={onOpenSettings}
          className="p-1 rounded hover:text-zen-text dark:hover:text-zen-darkText hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors"
          title="Impostazioni Modelli, Tipografia e API"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </footer>
  );
};
