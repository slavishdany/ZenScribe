import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Cpu,
  ExternalLink,
  Check,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Download,
  Trash2,
  AlertCircle,
  HardDrive,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Globe,
  Server,
  Zap,
} from 'lucide-react';
import {
  EditorSettings,
  ServerStatusInfo,
  LocalModelInfo,
  PresetModel,
  DownloadProgress,
  CloudProviderType,
  CloudSettings,
} from '../types';
import {
  fetchPresetModels,
  startModelDownload,
  cancelModelDownload,
  deleteLocalModel,
  listenDownloadProgress,
} from '../services/localAi';

export const DEFAULT_CLOUD_SETTINGS: CloudSettings = {
  activeProvider: 'gemini',
  providers: {
    gemini: { apiKey: '', model: 'gemini-3.8-flash' },
    openai: { apiKey: '', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' },
    anthropic: { apiKey: '', model: 'claude-3-5-haiku-20241022', baseUrl: 'https://api.anthropic.com/v1' },
    openrouter: { apiKey: '', model: 'deepseek/deepseek-chat', baseUrl: 'https://openrouter.ai/api/v1' },
    groq: { apiKey: '', model: 'llama-3.3-70b-versatile', baseUrl: 'https://api.groq.com/openai/v1' },
    custom: { apiKey: '', model: 'llama3', baseUrl: 'http://localhost:11434/v1' },
  },
};

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
  onOpenProjectProfile?: () => void;
}

const PROVIDER_METADATA: Record<
  CloudProviderType,
  {
    name: string;
    description: string;
    badge: string;
    keyUrl?: string;
    keyPlaceholder: string;
    models: string[];
    isCustomUrl?: boolean;
  }
> = {
  gemini: {
    name: 'Google Gemini',
    description: 'Modelli ultra-veloci ed economici di Google AI Studio (Gemini 3.8 Flash)',
    badge: 'Consigliato',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyPlaceholder: 'AIzaSy...',
    models: ['gemini-3.8-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
  openai: {
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini e modelli di ragionamento avanzato',
    badge: 'Ufficiale',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyPlaceholder: 'sk-proj-...',
    models: ['gpt-4o-mini', 'gpt-4o', 'o3-mini'],
  },
  anthropic: {
    name: 'Anthropic Claude',
    description: 'La migliore prosa letteraria e sfumature creative (Claude 3.5 Sonnet & Haiku)',
    badge: 'Scrittura Top',
    keyUrl: 'https://console.anthropic.com/',
    keyPlaceholder: 'sk-ant-api03-...',
    models: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
  },
  openrouter: {
    name: 'OpenRouter',
    description: 'Piattaforma unificata: DeepSeek V3/R1, Llama 3.3, Claude e centinaia di modelli',
    badge: 'Flessibile',
    keyUrl: 'https://openrouter.ai/keys',
    keyPlaceholder: 'sk-or-v1-...',
    models: ['deepseek/deepseek-chat', 'deepseek/deepseek-r1', 'meta-llama/llama-3.3-70b-instruct', 'anthropic/claude-3.5-sonnet'],
  },
  groq: {
    name: 'Groq Cloud',
    description: 'Inferenza hardware LPUs a velocità istantanea (centinaia di token al secondo)',
    badge: 'Ultra Rapido',
    keyUrl: 'https://console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
  },
  custom: {
    name: 'Server Personalizzato (OpenAI-Compatible)',
    description: 'Collega Ollama, vLLM, LM Studio, Together AI o qualsiasi server locale o cloud',
    badge: 'Avanzato',
    keyPlaceholder: 'Opzionale (se richiesta dal server)...',
    models: ['llama3', 'mistral', 'qwen2.5', 'custom-model'],
    isCustomUrl: true,
  },
};

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
  // Inizializza impostazioni con fallback per cloud multi-provider
  const [localSettings, setLocalSettings] = useState<EditorSettings>(() => {
    const cloud: CloudSettings = settings.cloud || DEFAULT_CLOUD_SETTINGS;
    // Migra eventuale geminiApiKey preesistente
    if (settings.geminiApiKey && !cloud.providers.gemini.apiKey) {
      cloud.providers.gemini.apiKey = settings.geminiApiKey;
    }
    return { ...settings, cloud };
  });

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSwitchingModel, setIsSwitchingModel] = useState(false);
  const [switchFeedback, setSwitchFeedback] = useState<string | null>(null);

  // Preset & Download State
  const [presets, setPresets] = useState<PresetModel[]>([]);
  const [downloadProgressMap, setDownloadProgressMap] = useState<Record<string, DownloadProgress>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeDownloadFile, setActiveDownloadFile] = useState<string | null>(null);

  // Custom Model Form State
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customRepoId, setCustomRepoId] = useState('');
  const [customFilename, setCustomFilename] = useState('');
  const [customFormError, setCustomFormError] = useState<string | null>(null);

  // Tabs di configurazione
  const [activeTab, setActiveTab] = useState<'models' | 'cloud' | 'editor'>('models');

  // Provider cloud attualmente visualizzato nella scheda
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<CloudProviderType>(
    localSettings.cloud?.activeProvider || 'gemini'
  );

  useEffect(() => {
    if (isOpen) {
      fetchPresetModels().then(setPresets);
    }
  }, [isOpen]);

  useEffect(() => {
    const cloud: CloudSettings = settings.cloud || DEFAULT_CLOUD_SETTINGS;
    if (settings.geminiApiKey && !cloud.providers.gemini.apiKey) {
      cloud.providers.gemini.apiKey = settings.geminiApiKey;
    }
    setLocalSettings({ ...settings, cloud });
    setSelectedCloudProvider(cloud.activeProvider || 'gemini');
    setSwitchFeedback(null);
  }, [settings, isOpen]);

  // Iscrizione in tempo reale agli eventi di progresso download
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listenDownloadProgress((progress: DownloadProgress) => {
      setDownloadProgressMap((prev) => ({
        ...prev,
        [progress.filename]: progress,
      }));

      if (progress.status === 'downloading') {
        setIsDownloading(true);
        setActiveDownloadFile(progress.filename);
      } else if (progress.status === 'completed' || progress.status === 'cached') {
        setIsDownloading(false);
        setActiveDownloadFile(null);
        onRefreshServer();
        setSwitchFeedback(`Modello ${progress.filename} pronto all'uso!`);
        setTimeout(() => setSwitchFeedback(null), 4000);
      } else if (progress.status === 'error' || progress.status === 'cancelled') {
        setIsDownloading(false);
        setActiveDownloadFile(null);
      }
    }).then((unsub) => {
      unlisten = unsub;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [onRefreshServer]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Sincronizza anche legacy geminiApiKey
    const currentGeminiKey = localSettings.cloud.providers.gemini.apiKey;
    onSaveSettings({
      ...localSettings,
      geminiApiKey: currentGeminiKey,
    });
    onClose();
  };

  const handleModelSelect = async (filename: string) => {
    if (filename === activeModelName) return;

    setIsSwitchingModel(true);
    setSwitchFeedback(null);
    try {
      await onSwitchModel(filename);
      setSwitchFeedback("Modello caricato in memoria con successo!");
      setTimeout(() => setSwitchFeedback(null), 3000);
    } catch (e: any) {
      setSwitchFeedback(`Errore caricamento: ${e.message || e}`);
    } finally {
      setIsSwitchingModel(false);
    }
  };

  const handleStartDownload = async (repoId: string, filename: string) => {
    try {
      setIsDownloading(true);
      setActiveDownloadFile(filename);
      setSwitchFeedback(`Avvio del download di ${filename}...`);
      await startModelDownload(repoId, filename);
    } catch (e: any) {
      setSwitchFeedback(`Errore download: ${e.message || e}`);
      setIsDownloading(false);
      setActiveDownloadFile(null);
    }
  };

  const handleCancelDownload = async () => {
    try {
      await cancelModelDownload();
      setIsDownloading(false);
      setActiveDownloadFile(null);
      setSwitchFeedback("Download annullato.");
      setTimeout(() => setSwitchFeedback(null), 3000);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleDeleteModel = async (filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Vuoi davvero eliminare il modello '${filename}' dal disco locale?`)) {
      return;
    }

    try {
      await deleteLocalModel(filename);
      onRefreshServer();
      setSwitchFeedback(`Modello '${filename}' eliminato.`);
      setTimeout(() => setSwitchFeedback(null), 3000);
    } catch (err: any) {
      setSwitchFeedback(`Errore eliminazione: ${err.message || err}`);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomFormError(null);

    const repo = customRepoId.trim();
    const file = customFilename.trim();

    if (!repo) {
      setCustomFormError("Inserisci l'ID del repository Hugging Face (es. autore/modello-GGUF).");
      return;
    }
    if (!repo.includes('/')) {
      setCustomFormError("Il repository Hugging Face deve contenere uno slash (es. autore/modello).");
      return;
    }
    if (!file) {
      setCustomFormError("Inserisci il nome del file del modello con estensione .gguf.");
      return;
    }
    if (!file.toLowerCase().endsWith('.gguf')) {
      setCustomFormError("Il nome del file deve terminare con '.gguf'.");
      return;
    }

    handleStartDownload(repo, file);
    setCustomRepoId('');
    setCustomFilename('');
    setShowCustomForm(false);
  };

  const updateCloudConfig = (
    provider: CloudProviderType,
    field: 'apiKey' | 'model' | 'baseUrl',
    value: string
  ) => {
    setLocalSettings((prev) => {
      const currentCloud = prev.cloud || DEFAULT_CLOUD_SETTINGS;
      const currentProviderConfig = currentCloud.providers[provider] || { apiKey: '', model: '' };

      return {
        ...prev,
        cloud: {
          ...currentCloud,
          providers: {
            ...currentCloud.providers,
            [provider]: {
              ...currentProviderConfig,
              [field]: value,
            },
          },
        },
      };
    });
  };

  const setActiveCloudProvider = (provider: CloudProviderType) => {
    setLocalSettings((prev) => ({
      ...prev,
      cloud: {
        ...(prev.cloud || DEFAULT_CLOUD_SETTINGS),
        activeProvider: provider,
      },
    }));
  };

  const activeProvider = localSettings.cloud?.activeProvider || 'gemini';
  const activeProviderMeta = PROVIDER_METADATA[selectedCloudProvider];
  const activeProviderConfig = localSettings.cloud?.providers[selectedCloudProvider] || { apiKey: '', model: '' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                Impostazioni ZenScribe
              </h3>
              <p className="text-xs text-stone-500">Gestisci i modelli AI (locali e cloud) e l'editor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 px-6 bg-stone-50/30 dark:bg-stone-950/30">
          <button
            onClick={() => setActiveTab('models')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'models'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Locale (.gguf)</span>
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'cloud'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Cloud AI Multi-API</span>
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'editor'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                : 'border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tipografia</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-6 text-xs overflow-y-auto flex-1">
          {/* TAB 1: MODELLI AI LOCALI GGUF */}
          {activeTab === 'models' && (
            <div className="space-y-6">
              {/* Stato motore nativo */}
              <div className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      serverStatus.isReady ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-stone-900 dark:text-stone-100">
                      {serverStatus.isReady
                        ? `Motore AI Nativo Pronto (${activeModelName || 'Modello attivo'})`
                        : 'Nessun modello attivo in memoria'}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {serverStatus.isReady
                        ? 'Inferenza in memoria (Candle pure Rust, zero sidecar esterno)'
                        : 'Seleziona o scarica un modello per abilitare la correzione offline.'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onRefreshServer}
                  disabled={serverStatus.isChecking || isSwitchingModel}
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center space-x-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${serverStatus.isChecking ? 'animate-spin' : ''}`} />
                  <span>Aggiorna</span>
                </button>
              </div>

              {/* Sezione Preset Ufficiali */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider text-[11px] text-stone-500 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Modelli Consigliati (Preset Ottimizzati)</span>
                  </h4>
                  <span className="text-[11px] text-stone-400">Download diretto da Hugging Face</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {presets.map((preset) => {
                    const localMatch = availableModels.find((m) =>
                      m.filename.toLowerCase() === preset.filename.toLowerCase()
                    );
                    const isDownloaded = Boolean(localMatch);
                    const isActive = localMatch?.is_active || activeModelName === preset.filename;
                    const progress = downloadProgressMap[preset.filename];
                    const isThisDownloading = isDownloading && activeDownloadFile === preset.filename;

                    return (
                      <div
                        key={preset.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                          isActive
                            ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 dark:border-indigo-600 shadow-sm'
                            : isDownloaded
                            ? 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300 dark:hover:border-stone-700'
                            : 'border-dashed border-stone-300 dark:border-stone-800 bg-stone-50/30 dark:bg-stone-950/20'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between mb-1.5">
                            <div>
                              <div className="font-semibold text-sm text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                                <span>{preset.name}</span>
                              </div>
                              <span className="inline-block mt-0.5 text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                                {preset.badge}
                              </span>
                            </div>
                            <span className="font-mono text-xs text-stone-500 bg-stone-100/70 dark:bg-stone-800/70 px-2 py-0.5 rounded">
                              {preset.size_label}
                            </span>
                          </div>
                          <p className="text-stone-500 text-[11px] leading-relaxed mt-2 mb-3">
                            {preset.description}
                          </p>
                        </div>

                        {/* Azioni e Stato Download */}
                        <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80">
                          {isThisDownloading && progress ? (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Download in corso...</span>
                                </span>
                                <span className="font-mono text-stone-500">
                                  {(progress.downloaded_bytes / (1024 * 1024)).toFixed(0)} MB /{' '}
                                  {(progress.total_bytes / (1024 * 1024)).toFixed(0)} MB ({progress.percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-stone-200 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-indigo-600 h-full transition-all duration-200"
                                  style={{ width: `${progress.percentage}%` }}
                                />
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-stone-400">
                                <span>Velocità: {progress.speed_mbps.toFixed(1)} MB/s</span>
                                <button
                                  type="button"
                                  onClick={handleCancelDownload}
                                  className="text-rose-500 hover:underline"
                                >
                                  Annulla
                                </button>
                              </div>
                            </div>
                          ) : isDownloaded ? (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Scaricato</span>
                              </span>

                              {isActive ? (
                                <span className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center space-x-1">
                                  <Check className="w-3 h-3" />
                                  <span>In uso</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isSwitchingModel}
                                  onClick={() => handleModelSelect(preset.filename)}
                                  className="px-3 py-1 text-[11px] rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center space-x-1 shadow-sm"
                                >
                                  {isSwitchingModel ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <span>Attiva</span>
                                  )}
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-stone-400">Non presente in locale</span>
                              <button
                                type="button"
                                disabled={isDownloading}
                                onClick={() => handleStartDownload(preset.repo_id, preset.filename)}
                                className="px-3 py-1.5 text-[11px] rounded-lg bg-stone-900 hover:bg-black dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 font-medium transition-colors flex items-center space-x-1.5 shadow-sm"
                              >
                                <Download className="w-3 h-3" />
                                <span>Scarica ({preset.size_label})</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sezione Opzione Personalizzata */}
              <div className="border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden bg-stone-50/40 dark:bg-stone-950/30">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(!showCustomForm)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-stone-100/50 dark:hover:bg-stone-900/50 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-4 h-4 text-stone-500" />
                    <div>
                      <h4 className="font-semibold text-stone-900 dark:text-stone-100 text-xs">
                        Opzione Personalizzata (Utenti Avanzati)
                      </h4>
                      <p className="text-[11px] text-stone-500">
                        Scarica qualsiasi modello GGUF inserendo Repository ID e Nome File di Hugging Face
                      </p>
                    </div>
                  </div>
                  {showCustomForm ? (
                    <ChevronUp className="w-4 h-4 text-stone-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-stone-400" />
                  )}
                </button>

                {showCustomForm && (
                  <form onSubmit={handleCustomSubmit} className="p-4 border-t border-stone-200 dark:border-stone-800 space-y-3 bg-white dark:bg-stone-900">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                          Hugging Face Repository ID
                        </label>
                        <input
                          type="text"
                          value={customRepoId}
                          onChange={(e) => setCustomRepoId(e.target.value)}
                          placeholder="es. bartowski/Llama-3.2-3B-Instruct-GGUF"
                          className="w-full p-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                          Nome File (.gguf)
                        </label>
                        <input
                          type="text"
                          value={customFilename}
                          onChange={(e) => setCustomFilename(e.target.value)}
                          placeholder="es. Llama-3.2-3B-Instruct-Q4_K_M.gguf"
                          className="w-full p-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {customFormError && (
                      <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-[11px] flex items-center space-x-1.5">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{customFormError}</span>
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={isDownloading}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors flex items-center space-x-1.5 shadow-sm"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Avvia Download da Hugging Face</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Sezione Tutti i Modelli Presenti sul Disco Locale */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider text-[11px] text-stone-500">
                    Modelli Installati nel Sistema ({availableModels.length})
                  </h4>
                  <span className="text-[11px] text-stone-400">Cartella protetta AppData</span>
                </div>

                {availableModels.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-stone-300 dark:border-stone-800 text-stone-500 text-center">
                    Nessun modello presente sul disco locale. Scarica uno dei modelli consigliati sopra per iniziare.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {availableModels.map((m) => {
                      const isActive = m.filename === activeModelName || m.is_active;
                      return (
                        <div
                          key={m.filename}
                          onClick={() => !isSwitchingModel && handleModelSelect(m.filename)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                            isActive
                              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-600'
                              : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-white dark:bg-stone-900'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="font-medium text-stone-900 dark:text-stone-100 flex items-center space-x-2">
                              <span>{m.display_name}</span>
                              {isActive && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.2 rounded font-semibold">
                                  In Memoria
                                </span>
                              )}
                              {m.is_custom && (
                                <span className="text-[10px] bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 px-1.5 py-0.2 rounded">
                                  Personalizzato
                                </span>
                              )}
                              {m.filename.toLowerCase().includes('gemma') && (
                                <span className="text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 px-1.5 py-0.2 rounded font-semibold flex items-center gap-1">
                                  <AlertCircle className="w-2.5 h-2.5" /> Non supportato (Gemma 2)
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              {m.filename} · {(m.size_mb / 1024).toFixed(2)} GB
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {isSwitchingModel && !isActive ? (
                              <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                            ) : isActive ? (
                              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="px-2.5 py-1 text-[11px] rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-medium transition-colors"
                              >
                                Attiva
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) => handleDeleteModel(m.filename, e)}
                              title="Elimina modello dal disco"
                              className="p-1 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CLOUD AI MULTI-PROVIDER */}
          {activeTab === 'cloud' && (
            <div className="space-y-6">
              {/* Selezione Provider Attivo */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider text-[11px] text-stone-500 flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Seleziona il Provider Cloud Predefinito</span>
                  </h4>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Attivo: {PROVIDER_METADATA[activeProvider].name}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {(Object.keys(PROVIDER_METADATA) as CloudProviderType[]).map((key) => {
                    const meta = PROVIDER_METADATA[key];
                    const isCurrentActive = activeProvider === key;
                    const isViewing = selectedCloudProvider === key;

                    return (
                      <div
                        key={key}
                        onClick={() => {
                          setSelectedCloudProvider(key);
                          setActiveCloudProvider(key);
                        }}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                          isCurrentActive
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500 shadow-sm'
                            : isViewing
                            ? 'border-stone-400 dark:border-stone-600 bg-stone-50 dark:bg-stone-850'
                            : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-stone-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-stone-900 dark:text-stone-100">
                              {meta.name}
                            </span>
                            {isCurrentActive && (
                              <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            )}
                          </div>
                          <p className="text-[10px] text-stone-500 line-clamp-2 leading-tight">
                            {meta.description}
                          </p>
                        </div>
                        <div className="mt-2.5 pt-1.5 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                            {meta.badge}
                          </span>
                          {isCurrentActive ? (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                              In uso
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400 hover:text-stone-600">
                              Usa
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dettagli di configurazione del provider visualizzato */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-4 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
                  <div>
                    <h5 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                      Configura {activeProviderMeta.name}
                    </h5>
                    <p className="text-[11px] text-stone-500">
                      Inserisci la chiave API e seleziona il modello da utilizzare
                    </p>
                  </div>
                  {activeProviderMeta.keyUrl && (
                    <a
                      href={activeProviderMeta.keyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
                    >
                      <span>Ottieni API Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                    API Key {selectedCloudProvider === 'custom' ? '(Opzionale)' : ''}
                  </label>
                  <div className="relative">
                    <input
                      type={showKeys[selectedCloudProvider] ? 'text' : 'password'}
                      value={activeProviderConfig.apiKey || ''}
                      onChange={(e) =>
                        updateCloudConfig(selectedCloudProvider, 'apiKey', e.target.value)
                      }
                      placeholder={activeProviderMeta.keyPlaceholder}
                      className="w-full p-2.5 text-xs font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 pr-16"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKeys({
                          ...showKeys,
                          [selectedCloudProvider]: !showKeys[selectedCloudProvider],
                        })
                      }
                      className="absolute right-2.5 top-2.5 text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 font-medium"
                    >
                      {showKeys[selectedCloudProvider] ? 'Nascondi' : 'Mostra'}
                    </button>
                  </div>
                  <p className="text-[10px] text-stone-400 mt-1">
                    Le chiavi API sono memorizzate unicamente in locale nel tuo archivio privato e non lasciano mai il computer.
                  </p>
                </div>

                {/* Modello */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                      Modello Selezionato
                    </label>
                    <input
                      type="text"
                      value={activeProviderConfig.model || ''}
                      onChange={(e) =>
                        updateCloudConfig(selectedCloudProvider, 'model', e.target.value)
                      }
                      placeholder={activeProviderMeta.models[0]}
                      className="w-full p-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Endpoint URL (per custom o se personalizzabile) */}
                  {activeProviderMeta.isCustomUrl && (
                    <div>
                      <label className="block text-[11px] font-medium text-stone-700 dark:text-stone-300 mb-1">
                        Base URL API
                      </label>
                      <input
                        type="text"
                        value={activeProviderConfig.baseUrl || ''}
                        onChange={(e) =>
                          updateCloudConfig(selectedCloudProvider, 'baseUrl', e.target.value)
                        }
                        placeholder="http://localhost:11434/v1"
                        className="w-full p-2 text-xs font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* Suggerimenti Modelli Rapidi */}
                <div>
                  <span className="text-[10px] text-stone-400 block mb-1.5">
                    Modelli suggeriti con un click:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeProviderMeta.models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateCloudConfig(selectedCloudProvider, 'model', m)}
                        className={`text-[10px] font-mono px-2 py-1 rounded-md border transition-colors ${
                          activeProviderConfig.model === m
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TIPOGRAFIA EDITOR */}
          {activeTab === 'editor' && (
            <div className="space-y-5">
              <div className="space-y-4">
                <h4 className="font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wider text-[11px] text-stone-500">
                  Tipografia & Foglio di Scrittura
                </h4>

                {/* Dimensione Carattere */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-stone-700 dark:text-stone-300">Dimensione Carattere:</span>
                    <span className="font-mono text-stone-500 font-semibold">{localSettings.fontSize}px</span>
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
                    <span className="text-stone-700 dark:text-stone-300">Interlinea (Spaziatura):</span>
                    <span className="font-mono text-stone-500 font-semibold">{localSettings.lineHeight.toFixed(2)}</span>
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
            </div>
          )}

          {switchFeedback && (
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 text-[11px] text-indigo-700 dark:text-indigo-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span>{switchFeedback}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-950/60">
          <span className="text-[11px] text-stone-400">
            ZenScribe • Motore Nativo Rust + Multi-API Cloud
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors"
            >
              Chiudi
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-colors"
            >
              Salva Impostazioni
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
