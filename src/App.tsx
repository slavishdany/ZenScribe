import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { EditorToolbar } from './components/EditorToolbar';
import { ZenEditor } from './components/ZenEditor';
import { StatusBar } from './components/StatusBar';
import { AIPanel } from './components/AIPanel';
import { SettingsModal, DEFAULT_CLOUD_SETTINGS } from './components/SettingsModal';
import { ChapterSidebar, ChapterItem } from './components/ChapterSidebar';
import { WorldbuildingModal } from './components/WorldbuildingModal';
import { ProjectsManagerModal } from './components/ProjectsManagerModal';
import {
  EditorSettings,
  ServerStatusInfo,
  EditorFont,
  EditorWidth,
  LocalModelInfo,
  ProjectProfile,
  ProjectItem,
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
  caricaProgetto,
  elencaProgetti,
  salvaProgetto,
  getActiveProjectId,
  setActiveProjectId,
  esportaSnapshotProgetto,
} from './services/db';
import {
  selectProjectFolder,
  openFolderInExplorer,
  exportChapterToFile,
  exportFullManuscript,
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

  // Progetto Attivo (Multi-progetto su SQLite)
  const [activeProjectId, setActiveProjectIdState] = useState<string>(() => getActiveProjectId());
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);

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

  // Cartella di esportazione / backup su disco del progetto
  const [projectFolder, setProjectFolder] = useState<string | null>(null);

  // Capitoli & SQLite
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string>('capitolo-principale');
  const [isChaptersOpen, setIsChaptersOpen] = useState(false);
  const [isWorldbuildingOpen, setIsWorldbuildingOpen] = useState(false);

  // Modale Gestione Multi-Progetto
  const [isProjectsManagerOpen, setIsProjectsManagerOpen] = useState(false);
  const [projectsManagerTab, setProjectsManagerTab] = useState<'library' | 'create' | 'profile' | 'import'>('library');

  // Modelli Locali GGUF
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

  // Caricamento del progetto attivo e dei suoi capitoli da SQLite
  const refreshProjectData = useCallback(async (targetId?: string) => {
    try {
      const pid = targetId || getActiveProjectId();
      let proj = await caricaProgetto(pid);
      if (!proj) {
        const all = await elencaProgetti();
        if (all.length > 0) {
          proj = all[0];
          setActiveProjectId(proj.id);
          setActiveProjectIdState(proj.id);
        }
      }

      if (proj) {
        setActiveProject(proj);
        setActiveProjectIdState(proj.id);
        setActiveProjectId(proj.id);
        setProjectProfile({
          title: proj.title,
          genre: proj.genre,
          description: proj.description,
          styleTone: proj.styleTone,
          narrativeVoice: proj.narrativeVoice,
          targetAudience: proj.targetAudience,
          narrativeNotes: proj.narrativeNotes,
        });
        setProjectFolder(proj.exportFolder || null);

        // Carica i capitoli di questo progetto da SQLite
        const chList = await elencaCapitoli(proj.id);
        if (chList && chList.length > 0) {
          setChapters(chList);
          setActiveChapterId((prev) => (chList.some((c) => c.id === prev) ? prev : chList[0].id));
        } else {
          const initialChapters = [
            {
              id: `cap-${Date.now()}`,
              title: 'Capitolo 1: Inizio',
              content: '<h1>Capitolo 1: Inizio</h1><p></p>',
            },
          ];
          setChapters(initialChapters);
          setActiveChapterId(initialChapters[0].id);
        }
      }
    } catch (e) {
      console.warn('[App] Errore lettura dati progetto da SQLite:', e);
    }
  }, []);

  useEffect(() => {
    refreshProjectData();
  }, [refreshProjectData]);

  // Auto-esportazione periodica di sicurezza (se configurata per il progetto)
  useEffect(() => {
    if (
      !activeProject ||
      !activeProject.exportFolder ||
      !activeProject.autoExportMinutes ||
      activeProject.autoExportMinutes <= 0
    ) {
      return;
    }

    const intervalMs = activeProject.autoExportMinutes * 60 * 1000;
    const timer = setInterval(async () => {
      const timeSince = Date.now() - (activeProject.lastExportedAt || 0);
      if (timeSince >= intervalMs) {
        try {
          console.log(
            `[AutoExport] Avvio snapshot periodico per "${activeProject.title}" ogni ${activeProject.autoExportMinutes} min...`
          );
          const res = await esportaSnapshotProgetto(activeProject.id, activeProject.exportFolder!);
          setActiveProject((prev) => (prev ? { ...prev, lastExportedAt: res.exportedAt } : null));
          console.log('[AutoExport] Snapshot periodico salvato con successo in:', res.folderPath);
        } catch (err) {
          console.warn('[AutoExport] Errore snapshot periodico:', err);
        }
      }
    }, 30000); // Controllo cadenzato ogni 30s

    return () => clearInterval(timer);
  }, [activeProject]);

  // Esportazione snapshot con indice su richiesta ("con un tasto")
  const handleExportSnapshot = async () => {
    if (!activeProject) return;
    try {
      let targetFolder = activeProject.exportFolder;
      if (!targetFolder) {
        const picked = await selectProjectFolder();
        if (!picked) return;
        targetFolder = picked;
        const updated = { ...activeProject, exportFolder: picked };
        await salvaProgetto(updated);
        setActiveProject(updated);
        setProjectFolder(picked);
      }

      const res = await esportaSnapshotProgetto(activeProject.id, targetFolder);
      setActiveProject((prev) => (prev ? { ...prev, lastExportedAt: res.exportedAt } : null));
      alert(
        `✅ Snapshot del progetto salvato con successo!\n\nCartella: ${res.folderPath}\nIndice: zenscribe.manifest.json\n\nTutti i capitoli (.md), la Bibbia e il manoscritto completo sono aggiornati.`
      );
    } catch (e: any) {
      alert(`Errore esportazione snapshot: ${e.message || e}`);
    }
  };

  // Cambio progetto attivo
  const handleSwitchProject = async (newProjId: string) => {
    await refreshProjectData(newProjId);
  };

  // Apertura modale Gestione Progetti
  const handleOpenProjectsManager = (tab: 'library' | 'create' | 'profile' | 'import' = 'library') => {
    setProjectsManagerTab(tab);
    setIsProjectsManagerOpen(true);
  };

  // Creazione capitolo
  const handleCreateChapter = async () => {
    try {
      const newId = await creaNuovoCapitolo(`Capitolo ${chapters.length + 1}`, activeProjectId);
      await refreshProjectData(activeProjectId);
      setActiveChapterId(newId);
    } catch (e) {
      console.error('[DB] Errore creazione capitolo:', e);
    }
  };

  // Eliminazione capitolo
  const handleDeleteChapter = async (id: string) => {
    try {
      await eliminaCapitolo(id);
      await refreshProjectData(activeProjectId);
    } catch (e) {
      console.error('[DB] Errore eliminazione capitolo:', e);
    }
  };

  // Rinomina capitolo
  const handleRenameChapter = async (id: string, newTitle: string) => {
    try {
      await rinominaCapitolo(id, newTitle);
      await refreshProjectData(activeProjectId);
    } catch (e) {
      console.error('[DB] Errore rinomina capitolo:', e);
    }
  };

  // Creazione capitolo dalla trama AI
  const handleCreateChapterFromPlot = async (title: string, content: string) => {
    try {
      const id = `capitolo-trama-${Date.now()}`;
      await salvaCapitolo(id, title, content, activeProjectId);
      await refreshProjectData(activeProjectId);
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

  // Seleziona cartella di backup su disco
  const handleSelectProjectFolder = async () => {
    const selected = await selectProjectFolder();
    if (selected && activeProject) {
      setProjectFolder(selected);
      const updated = { ...activeProject, exportFolder: selected };
      await salvaProgetto(updated);
      setActiveProject(updated);
      await esportaSnapshotProgetto(activeProject.id, selected);
    }
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
        onOpenProjectsManager={handleOpenProjectsManager}
        onOpenProjectProfile={() => handleOpenProjectsManager('profile')}
        onExportSnapshot={handleExportSnapshot}
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

      {/* Barra Laterale Capitoli & Progetto (SQLite Single Source of Truth) */}
      <ChapterSidebar
        isOpen={isChaptersOpen}
        chapters={chapters}
        activeChapterId={activeChapterId}
        projectProfile={projectProfile}
        activeProject={activeProject}
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
          handleOpenProjectsManager('profile');
        }}
        onOpenProjectsManager={(tab) => {
          setIsChaptersOpen(false);
          handleOpenProjectsManager(tab);
        }}
        onSelectProjectFolder={handleSelectProjectFolder}
        onSyncProjectFolder={handleExportSnapshot}
        onExportSnapshot={handleExportSnapshot}
        onOpenFolderInExplorer={handleOpenFolderInExplorer}
        onExportManuscript={handleExportManuscript}
      />

      {/* Editor Centrale: salvataggio istantaneo su SQLite ad ogni battitura */}
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
          // Quando un capitolo viene salvato su SQLite, aggiorna il contatore nella lista
          elencaCapitoli(activeProjectId).then((list) => {
            if (list) setChapters(list);
          });
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

      {/* Modal Bibbia del Romanzo (Personaggi & Luoghi per Progetto) */}
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

      {/* Modal Gestione Multi-Progetto, Libreria, Profilazione & Reimportazione */}
      <ProjectsManagerModal
        isOpen={isProjectsManagerOpen}
        initialTab={projectsManagerTab}
        onClose={() => setIsProjectsManagerOpen(false)}
        onProjectChanged={handleSwitchProject}
        onProjectUpdated={(newProfile) => {
          setProjectProfile(newProfile);
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
