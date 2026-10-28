import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { EditorToolbar } from './components/EditorToolbar';
import { ZenEditor } from './components/ZenEditor';
import { StatusBar } from './components/StatusBar';
import { AIPanel } from './components/AIPanel';
import { SettingsModal } from './components/SettingsModal';
import { EditorSettings, ServerStatusInfo, EditorFont, EditorWidth, LocalModelInfo } from './types';
import { checkLocalServerStatus, fetchAvailableModels, fetchActiveModel, switchLocalModel } from './services/localAi';

const DEFAULT_SETTINGS: EditorSettings = {
  font: 'serif',
  fontSize: 18,
  lineHeight: 1.85,
  width: 'medium',
  geminiApiKey: '',
  theme: 'light',
  zenMode: false,
};

export const App: React.FC = () => {
  // Impostazioni caricate da localStorage
  const [settings, setSettings] = useState<EditorSettings>(() => {
    const saved = localStorage.getItem('zenscribe_settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);

  // Modelli Locali
  const [availableModels, setAvailableModels] = useState<LocalModelInfo[]>([]);
  const [activeModelName, setActiveModelName] = useState<string | undefined>(undefined);

  // Stato Server AI Locale
  const [serverStatus, setServerStatus] = useState<ServerStatusInfo>({
    isReady: false,
    isChecking: true,
    lastChecked: Date.now(),
  });

  // Modali e Panelli
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiSelectedText, setAiSelectedText] = useState('');

  // Sincronizza tema HTML (dark class)
  useEffect(() => {
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Salva impostazioni su localStorage
  const handleSaveSettings = (newSettings: EditorSettings) => {
    setSettings(newSettings);
    localStorage.setItem('zenscribe_settings', JSON.stringify(newSettings));
  };

  // Caricamento modelli locali e modello attivo
  const refreshModelsList = useCallback(async () => {
    const models = await fetchAvailableModels();
    setAvailableModels(models);
    const active = await fetchActiveModel();
    if (active) {
      setActiveModelName(active);
    } else if (models.length > 0) {
      const activeFromList = models.find((m) => m.is_active);
      if (activeFromList) {
        setActiveModelName(activeFromList.filename);
      }
    }
  }, []);

  // Health check del server Llamafile (Porta 8080)
  const verifyServer = useCallback(async () => {
    setServerStatus((prev) => ({ ...prev, isChecking: true }));
    const ready = await checkLocalServerStatus();
    setServerStatus({
      isReady: ready,
      isChecking: false,
      lastChecked: Date.now(),
      activeModelName,
    });
  }, [activeModelName]);

  // Polling periodico per verificare la disponibilità del motore locale
  useEffect(() => {
    verifyServer();
    refreshModelsList();
    const interval = setInterval(verifyServer, 4000);
    return () => clearInterval(interval);
  }, [verifyServer, refreshModelsList]);

  // Cambio modello locale a runtime
  const handleSwitchModel = async (modelFilename: string) => {
    setServerStatus((prev) => ({ ...prev, isChecking: true, isReady: false }));
    const result = await switchLocalModel(modelFilename);
    setActiveModelName(result.filename);
    handleSaveSettings({ ...settings, selectedLocalModel: result.filename });
    await refreshModelsList();
    // Attendi brevemente che il modello termini di caricarsi in memoria
    setTimeout(() => {
      verifyServer();
    }, 2500);
  };

  // Gestione apertura AI Assistant con selezione
  const handleOpenAIWithSelection = (text: string) => {
    setAiSelectedText(text);
    setIsAIPanelOpen(true);
  };

  // Sostituzione testo nell'editor
  const handleReplaceText = (newText: string) => {
    if (!editorInstance) return;
    const { from, to } = editorInstance.state.selection;
    if (from !== to) {
      editorInstance.chain().focus().deleteRange({ from, to }).insertContent(newText).run();
    } else {
      editorInstance.chain().focus().insertContent(newText).run();
    }
  };

  // Inserimento testo dopo la selezione
  const handleInsertAfter = (newText: string) => {
    if (!editorInstance) return;
    editorInstance.chain().focus().insertContent(`\n\n${newText}`).run();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-zen-bg dark:bg-zen-darkBg text-zen-text dark:text-zen-darkText overflow-hidden select-text">
      {/* Barra degli Strumenti Superiore */}
      <EditorToolbar
        editor={editorInstance}
        font={settings.font}
        width={settings.width}
        theme={settings.theme}
        zenMode={settings.zenMode}
        onFontChange={(font: EditorFont) => handleSaveSettings({ ...settings, font })}
        onWidthChange={(width: EditorWidth) => handleSaveSettings({ ...settings, width })}
        onThemeToggle={() =>
          handleSaveSettings({
            ...settings,
            theme: settings.theme === 'dark' ? 'light' : 'dark',
          })
        }
        onOpenAIPanel={() => {
          if (editorInstance) {
            const { from, to } = editorInstance.state.selection;
            const text = from !== to ? editorInstance.state.doc.textBetween(from, to, ' ') : '';
            handleOpenAIWithSelection(text);
          } else {
            setIsAIPanelOpen(true);
          }
        }}
      />

      {/* Editor Centrale (Focus Principale dell'Harness) */}
      <ZenEditor
        font={settings.font}
        fontSize={settings.fontSize}
        lineHeight={settings.lineHeight}
        width={settings.width}
        zenMode={settings.zenMode}
        onUpdateCounts={(words, characters) => {
          setWordCount(words);
          setCharacterCount(characters);
        }}
        onEditorReady={(editor) => setEditorInstance(editor)}
        onOpenAIWithSelection={handleOpenAIWithSelection}
      />

      {/* Barra di Stato Inferiore */}
      <StatusBar
        wordCount={wordCount}
        characterCount={characterCount}
        serverStatus={serverStatus}
        activeModelName={activeModelName}
        hasGeminiKey={Boolean(settings.geminiApiKey?.trim())}
        zenMode={settings.zenMode}
        onToggleZenMode={() => handleSaveSettings({ ...settings, zenMode: !settings.zenMode })}
        onOpenSettings={() => {
          refreshModelsList();
          setIsSettingsOpen(true);
        }}
        onRefreshServer={verifyServer}
      />

      {/* Pannello Assistente AI (Locale + Cloud) */}
      <AIPanel
        isOpen={isAIPanelOpen}
        selectedText={aiSelectedText}
        serverStatus={serverStatus}
        activeModelName={activeModelName}
        geminiApiKey={settings.geminiApiKey}
        onClose={() => setIsAIPanelOpen(false)}
        onReplaceText={handleReplaceText}
        onInsertAfter={handleInsertAfter}
        onOpenSettings={() => {
          setIsAIPanelOpen(false);
          setIsSettingsOpen(true);
        }}
      />

      {/* Modal Impostazioni con Switch Modelli */}
      <SettingsModal
        isOpen={isSettingsOpen}
        settings={settings}
        serverStatus={serverStatus}
        availableModels={availableModels}
        activeModelName={activeModelName}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={handleSaveSettings}
        onRefreshServer={() => {
          verifyServer();
          refreshModelsList();
        }}
        onSwitchModel={handleSwitchModel}
      />
    </div>
  );
};
