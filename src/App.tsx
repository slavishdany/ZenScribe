import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { EditorToolbar } from './components/EditorToolbar';
import { ZenEditor } from './components/ZenEditor';
import { StatusBar } from './components/StatusBar';
import { AIPanel } from './components/AIPanel';
import { SettingsModal, DEFAULT_CLOUD_SETTINGS } from './components/SettingsModal';
import { ChapterSidebar, ChapterItem } from './components/ChapterSidebar';
import { WorldbuildingModal } from './components/WorldbuildingModal';
import { ProjectProfileModal } from './components/ProjectProfileModal';
import {
  EditorSettings,
  ServerStatusInfo,
  EditorFont,
  EditorWidth,
  LocalModelInfo,
  ProjectProfile,
} from './types';
import {
  checkLocalServerStatus,
  fetchAvailableModels,
  fetchActiveModel,
  switchLocalModel,
} from './services/localAi';
import {
  elencaCapitoli,
  creaNuovoCapitolo,
  eliminaCapitolo,
  rinominaCapitolo,
  salvaCapitolo,
  caricaProfiloProgetto,
  ottieniMappaConcettuale,
} from './services/db';
import {
  selectProjectFolder,
  openFolderInExplorer,
  exportChapterToFile,
  exportFullManuscript,
  syncProjectToFolder,
} from './services/projectFiles';

const DEFAULT_SETTINGS: EditorSettings = {
  font: 'serif',
  fontSize: 18,
  lineHeight: 1.85,
  width: 'medium',
  geminiApiKey: '',
  theme: 'light',
  zenMode: false,
  cloud: DEFAULT_CLOUD_SETTINGS,
};

export const App: React.FC = () => {
  // Impostazioni caricate da localStorage
  const [settings, setSettings] = useState<EditorSettings>(() => {
    const saved = localStorage.getItem('zenscribe_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const cloud = parsed.cloud || DEFAULT_CLOUD_SETTINGS;
        if (parsed.geminiApiKey && !cloud.providers.gemini.apiKey) {
          cloud.providers.gemini.apiKey = parsed.geminiApiKey;
        }
        return { ...DEFAULT_SETTINGS, ...parsed, cloud };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);

  // Profilo Progetto (Stile narrativo, Genere, Premessa)
  const [projectProfile, setProjectProfile] = useState<ProjectProfile>({
    title: '',
    genre: '',
    description: '',
    styleTone: '',
    narrativeVoice: '',
    targetAudience: '',
    narrativeNotes: '',
  });

  // Cartella di sincronizzazione su disco (.md files)
  const [projectFolder, setProjectFolder] = useState<string | null>(() => {
    return localStorage.getItem('zenscribe_project_folder') || null;
  });

  // Capitoli & SQLite
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string>('capitolo-principale');
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  const [isWorldbuildingOpen, setIsWorldbuildingOpen] = useState(false);
  const [isProjectProfileOpen, setIsProjectProfileOpen] = useState(false);

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

  // Caricamento profilo progetto da SQLite
  const refreshProjectProfile = useCallback(async () => {
    try {
      const p = await caricaProfiloProgetto();
      setProjectProfile(p);
    } catch (e) {
      console.warn('[App] Errore lettura profilo progetto:', e);
    }
  }, []);

  useEffect(() => {
    refreshProjectProfile();
  }, [refreshProjectProfile]);

  // Sincronizzazione automatica cartella su disco
  const triggerAutoSync = useCallback(
    async (currentChapters?: ChapterItem[], currentProfile?: ProjectProfile) => {
      if (!projectFolder) return;
      try {
        const chList = currentChapters || chapters;
        const prof = currentProfile || projectProfile;
        const map = await ottieniMappaConcettuale();
        await syncProjectToFolder(projectFolder, prof, chList, map.nodes);
        console.log('[AutoSync] Progetto sincronizzato su:', projectFolder);
      } catch (e) {
        console.warn('[AutoSync] Errore sincronizzazione su disco:', e);
      }
    },
    [projectFolder, chapters, projectProfile]
  );

  // Caricamento capitoli da SQLite
  const refreshChapters = useCallback(async () => {
    try {
      const list = await elencaCapitoli();
      if (list && list.length > 0) {
        setChapters(list);
        setActiveChapterId((prev) => (list.some((c) => c.id === prev) ? prev : list[0].id));
      } else {
        const initialChapters = [
          {
            id: 'capitolo-principale',
            title: 'Capitolo 1: La Chiarezza',
            content: '',
          },
        ];
        setChapters(initialChapters);
      }
    } catch (e) {
      console.warn('[DB] Errore lettura capitoli:', e);
    }
  }, []);

  useEffect(() => {
    refreshChapters();
  }, [refreshChapters]);

  const handleCreateChapter = async () => {
    try {
      const newId = await creaNuovoCapitolo(`Capitolo ${chapters.length + 1}`);
      await refreshChapters();
      setActiveChapterId(newId);
    } catch (e) {
      console.error('[DB] Errore creazione capitolo:', e);
    }
  };

  const handleDeleteChapter = async (id: string) => {
    try {
      await eliminaCapitolo(id);
      await refreshChapters();
    } catch (e) {
      console.error('[DB] Errore eliminazione capitolo:', e);
    }
  };

  const handleRenameChapter = async (id: string, newTitle: string) => {
    try {
      await rinominaCapitolo(id, newTitle);
      await refreshChapters();
    } catch (e) {
      console.error('[DB] Errore rinomina capitolo:', e);
    }
  };

  const handleCreateChapterFromPlot = async (title: string, content: string) => {
    try {
      const id = `capitolo-trama-${Date.now()}`;
      await salvaCapitolo(id, title, content);
      await refreshChapters();
      setActiveChapterId(id);
      setIsWorldbuildingOpen(false);
    } catch (e) {
      console.error('[DB] Errore salvataggio capitolo trama:', e);
    }
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

  // Health check del motore AI locale nativo
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
    setTimeout(() => {
      verifyServer();
    }, 1500);
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

  // Operazioni su File e Cartella di Progetto
  const handleSelectProjectFolder = async () => {
    const selected = await selectProjectFolder();
    if (selected) {
      setProjectFolder(selected);
      localStorage.setItem('zenscribe_project_folder', selected);
      triggerAutoSync(chapters, projectProfile);
    }
  };

  const handleSyncProjectFolder = async () => {
    if (!projectFolder) {
      handleSelectProjectFolder();
      return;
    }
    await triggerAutoSync(chapters, projectProfile);
    alert(`Progetto '${projectProfile.title || 'ZenScribe'}' sincronizzato con successo in:\n${projectFolder}`);
  };

  const handleOpenFolderInExplorer = async () => {
    if (projectFolder) {
      await openFolderInExplorer(projectFolder);
    }
  };

  const handleExportChapter = async (format: 'md' | 'txt') => {
    const activeChap = chapters.find((c) => c.id === activeChapterId);
    const title = activeChap?.title || 'Capitolo';
    const content = editorInstance ? editorInstance.getHTML() : activeChap?.content || '';
    const savedPath = await exportChapterToFile(title, content, format);
    if (savedPath) {
      console.log('Capitolo esportato su:', savedPath);
    }
  };

  const handleExportManuscript = async (format: 'md' | 'txt') => {
    const title = projectProfile.title || 'Manoscritto';
    const savedPath = await exportFullManuscript(title, chapters, format);
    if (savedPath) {
      console.log('Manoscritto completo esportato su:', savedPath);
    }
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
        projectTitle={projectProfile.title}
        onFontChange={(font: EditorFont) => handleSaveSettings({ ...settings, font })}
        onWidthChange={(width: EditorWidth) => handleSaveSettings({ ...settings, width })}
        onThemeToggle={() =>
          handleSaveSettings({
            ...settings,
            theme: settings.theme === 'dark' ? 'light' : 'dark',
          })
        }
        onToggleChapters={() => setIsChaptersOpen(!isChaptersOpen)}
        onOpenWorldbuilding={() => setIsWorldbuildingOpen(true)}
        onOpenProjectProfile={() => setIsProjectProfileOpen(true)}
        onExportChapter={handleExportChapter}
        onExportManuscript={handleExportManuscript}
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

      {/* Barra Laterale Capitoli (SQLite + File Sync) */}
      <ChapterSidebar
        isOpen={isChaptersOpen}
        chapters={chapters}
        activeChapterId={activeChapterId}
        projectProfile={projectProfile}
        projectFolder={projectFolder}
        onSelectChapter={(id) => {
          setActiveChapterId(id);
          setIsChaptersOpen(false);
        }}
        onCreateChapter={handleCreateChapter}
        onDeleteChapter={handleDeleteChapter}
        onRenameChapter={handleRenameChapter}
        onClose={() => setIsChaptersOpen(false)}
        onOpenProjectProfile={() => {
          setIsChaptersOpen(false);
          setIsProjectProfileOpen(true);
        }}
        onSelectProjectFolder={handleSelectProjectFolder}
        onSyncProjectFolder={handleSyncProjectFolder}
        onOpenFolderInExplorer={handleOpenFolderInExplorer}
        onExportManuscript={handleExportManuscript}
      />

      {/* Editor Centrale */}
      <ZenEditor
        activeChapterId={activeChapterId}
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
        onChapterSaved={() => {
          refreshChapters();
          triggerAutoSync();
        }}
      />

      {/* Barra di Stato Inferiore */}
      <StatusBar
        wordCount={wordCount}
        characterCount={characterCount}
        serverStatus={serverStatus}
        activeModelName={activeModelName}
        hasGeminiKey={Boolean(
          settings.cloud?.providers[settings.cloud?.activeProvider || 'gemini']?.apiKey?.trim() ||
            settings.geminiApiKey?.trim()
        )}
        zenMode={settings.zenMode}
        onToggleZenMode={() => handleSaveSettings({ ...settings, zenMode: !settings.zenMode })}
        onOpenSettings={() => {
          refreshModelsList();
          setIsSettingsOpen(true);
        }}
        onRefreshServer={verifyServer}
      />

      {/* Pannello Assistente AI (Locale Nativo + Cloud Multi-Provider) */}
      <AIPanel
        isOpen={isAIPanelOpen}
        selectedText={aiSelectedText}
        serverStatus={serverStatus}
        activeModelName={activeModelName}
        geminiApiKey={settings.geminiApiKey || ''}
        settings={settings}
        onClose={() => setIsAIPanelOpen(false)}
        onReplaceText={handleReplaceText}
        onInsertAfter={handleInsertAfter}
        onOpenSettings={() => {
          setIsAIPanelOpen(false);
          setIsSettingsOpen(true);
        }}
      />

      {/* Modal Bibbia del Romanzo (Personaggi & Luoghi) */}
      <WorldbuildingModal
        isOpen={isWorldbuildingOpen}
        geminiApiKey={settings.geminiApiKey}
        settings={settings}
        onClose={() => setIsWorldbuildingOpen(false)}
        onCreateChapterFromPlot={handleCreateChapterFromPlot}
        onOpenSettings={() => {
          setIsWorldbuildingOpen(false);
          setIsSettingsOpen(true);
        }}
      />

      {/* Modal Profilo Progetto & Stile Narrativo */}
      <ProjectProfileModal
        isOpen={isProjectProfileOpen}
        onClose={() => setIsProjectProfileOpen(false)}
        onProjectUpdated={(newProfile) => {
          setProjectProfile(newProfile);
          triggerAutoSync(chapters, newProfile);
        }}
      />

      {/* Modal Impostazioni Generali, AI Locale GGUF & Multi-Cloud */}
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
