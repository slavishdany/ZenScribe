import React, { useState } from 'react';
import { X, Sliders, Cpu, ExternalLink, Check, RefreshCw, Loader2, CheckCircle2 } from 'lucide-react';
import { EditorSettings, ServerStatusInfo, LocalModelInfo } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  settings: EditorSettings;
  serverStatus: ServerStatusInfo;
  availableModels: LocalModelInfo[];
  activeModelName?: string;
  onClose: () => void;
  onSaveSettings: (settings: EditorSettings) => void;
  onRefreshServer: () => void;
  onSwitchModel: (modelFilename: string) => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  settings,
  serverStatus,
  availableModels,
  activeModelName,
  onClose,
  onSaveSettings,
  onRefreshServer,
  onSwitchModel,
}) => {
  const [localSettings, setLocalSettings] = useState<EditorSettings>(settings);
  const [showKey, setShowKey] = useState(false);
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  React.useEffect(() => {
    setLocalSettings(settings);
    setSwitchFeedback(null);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings(localSettings);
    onClose();
  };

  const handleModelSelect = async (filename: string) => {
    if (filename === activeModelName) return;

    setIsSwitchingModel(true);
    setSwitchFeedback(null);
    try {
      await onSwitchModel(filename);
      setSwitchFeedback("Modello avviato con successo!");
      setTimeout(() => setSwitchFeedback(null), 3000);
    } catch (e: any) {
      setSwitchFeedback(`Errore: ${e.message || e}`);
    } finally {
      setIsSwitchingModel(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/40">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-stone-700 dark:text-stone-300" />
            <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
              Impostazioni ZenScribe
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto max-h-[75vh]">
          {/* Sezione Selezione Modello Locale */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider text-[11px] text-stone-500">
                Fase 1: Configurazione Modello Locale
              </h4>
              <button
                onClick={onRefreshServer}
                disabled={serverStatus.isChecking || isSwitchingModel}
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
                title="Ricarica lista ed esegui test di connessione"
              >
                <RefreshCw className={`w-3 h-3 ${serverStatus.isChecking ? 'animate-spin' : ''}`} />
                <span>Aggiorna</span>
              </button>
            </div>

            <p className="text-stone-500 text-[11px] leading-relaxed">
              Scegli quale modello locale eseguire per la correzione bozze e il perfezionamento del testo. Vengono rilevati automaticamente tutti i file in <code className="text-indigo-600 dark:text-indigo-400">resources/</code>.
            </p>

            {/* Lista Modelli Disponibili */}
            <div className="space-y-2">
              {availableModels.length === 0 ? (
                <div className="p-3 bg-stone-50 dark:bg-stone-950/40 rounded border border-dashed border-stone-300 dark:border-stone-700 text-stone-500 text-center">
                  Nessun modello rilevato in resources/. Inserisci un file .llamafile.exe per iniziare.
                </div>
              ) : (
                availableModels.map((m) => {
                  const isActive = m.filename === activeModelName || m.is_active;
                  return (
                    <div
                      key={m.filename}
                      onClick={() => !isSwitchingModel && handleModelSelect(m.filename)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-600'
                          : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50/50 dark:bg-stone-950/30'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                          <span>{m.display_name}</span>
                          {isActive && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-1.5 py-0.2 rounded font-semibold">
                              Attivo
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono">
                          {m.filename} · {(m.size_mb / 1024).toFixed(2)} GB
                        </div>
                      </div>

                      <div>
                        {isSwitchingModel && !isActive ? (
                          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                        ) : isActive ? (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="px-2.5 py-1 text-[11px] rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium"
                          >
                            Seleziona
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {switchFeedback && (
              <div className="p-2 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{switchFeedback}</span>
              </div>
            )}
          </div>

          <div className="h-px bg-stone-200 dark:bg-stone-800"></div>

          {/* Sezione Tipografia */}
          <div className="space-y-3">
            <h4 className="font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider text-[11px] text-stone-500">
              Tipografia & Foglio di Scrittura
            </h4>

            {/* Dimensione Carattere */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-stone-700 dark:text-stone-300">Dimensione Carattere:</span>
                <span className="font-mono text-stone-500">{localSettings.fontSize}px</span>
              </div>
              <input
                type="range"
                min="14"
                max="26"
                step="1"
                value={localSettings.fontSize}
                onChange={(e) => setLocalSettings({ ...localSettings, fontSize: Number(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>

            {/* Interlinea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-stone-700 dark:text-stone-300">Interlinea (Spaziatura riga):</span>
                <span className="font-mono text-stone-500">{localSettings.lineHeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="1.4"
                max="2.4"
                step="0.05"
                value={localSettings.lineHeight}
                onChange={(e) => setLocalSettings({ ...localSettings, lineHeight: Number(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          </div>

          <div className="h-px bg-stone-200 dark:bg-stone-800"></div>

          {/* Sezione Gemini Cloud */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider text-[11px] text-stone-500">
                Fase 2: Gemini API Key (Cloud Creativo)
              </h4>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
              >
                <span>Ottieni gratis</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              La chiave è salvata esclusivamente sul tuo dispositivo nel browser locale e non lascia mai il tuo computer.
            </p>
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={localSettings.geminiApiKey}
                onChange={(e) => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full p-2 text-xs font-mono rounded border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-16"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-2 text-[10px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                {showKey ? "Nascondi" : "Mostra"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-end space-x-2 bg-stone-50/50 dark:bg-stone-950/40">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium"
          >
            Chiudi
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm"
          >
            Salva Impostazioni
          </button>
        </div>
      </div>
    </div>
  );
};
