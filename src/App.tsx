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
import { TabBar } from './components/TabBar';
import { GlossaryDrawer } from './components/GlossaryDrawer';
import {
  EditorSettings,
  ServerStatusInfo,
  EditorFont,
  EditorWidth,
  LocalModelInfo,
  ProjectProfile,
  ProjectItem,
  TabItem,
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
  markdownToEditorHtml,
  ottieniTramaProgetto,
  salvaTramaProgetto,
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
        if (cloud.providers?.gemini) {
          const m = cloud.providers.gemini.model;
          if (!m || m === 'gemini-1.5-flash' || m === 'gemini-2.0-flash' || m === 'gemini-1.5-pro') {
            cloud.providers.gemini.model = 'gemini-2.5-flash';
          }
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

  // Gestione Schede di Lavoro Multi-Documento & Glossario
  const [tabs, setTabs] = useState<TabItem[]>([
    { id: 'capitolo-principale', title: 'Capitolo 1', type: 'chapter' },
  ]);
  const [isTabBarVisible, setIsTabBarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('zenscribe_tabbar_visible');
    return saved !== null ? saved === 'true' : true;
  });
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
          const firstChap = chList[0];
          if (targetId) {
            setActiveChapterId(firstChap.id);
            setTabs([{ id: firstChap.id, title: firstChap.title, type: 'chapter' }]);
          } else {
            setActiveChapterId((prev) => (chList.some((c) => c.id === prev) ? prev : firstChap.id));
            setTabs((prevTabs) => {
              const valid = prevTabs.filter(
                (t) => t.type === 'plot' || chList.some((c) => c.id === t.id)
              );
              if (valid.length > 0) {
                return valid.map((t) => {
                  if (t.type === 'chapter') {
                    const m = chList.find((c) => c.id === t.id);
                    return m ? { ...t, title: m.title } : t;
                  }
                  return t;
                });
              }
              return [{ id: firstChap.id, title: firstChap.title, type: 'chapter' }];
            });
          }
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
          setTabs([{ id: initialChapters[0].id, title: initialChapters[0].title, type: 'chapter' }]);
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
      const chapterTitle = `Capitolo ${chapters.length + 1}`;
      const newId = await creaNuovoCapitolo(chapterTitle, activeProjectId);
      await refreshProjectData(activeProjectId);
      setTabs((prev) => [...prev, { id: newId, title: chapterTitle, type: 'chapter' }]);
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
      handleCloseTab(id);
    } catch (e) {
      console.error('[DB] Errore eliminazione capitolo:', e);
    }
  };

  // Rinomina capitolo
  const handleRenameChapter = async (id: string, newTitle: string) => {
    try {
      await rinominaCapitolo(id, newTitle);
      await refreshProjectData(activeProjectId);
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
      );
    } catch (e) {
      console.error('[DB] Errore rinomina capitolo:', e);
    }
  };

  // Gestione Schede di Scrittura (Tabs)
  const handleToggleTabBar = () => {
    setIsTabBarVisible((prev) => {
      const next = !prev;
      localStorage.setItem('zenscribe_tabbar_visible', String(next));
      return next;
    });
  };

  const handleSelectTab = (tabId: string) => {
    setActiveChapterId(tabId);
  };

  const handleCloseTab = (tabId: string) => {
    const index = tabs.findIndex((t) => t.id === tabId);
    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeChapterId === tabId) {
      if (newTabs.length > 0) {
        const newActiveIndex = Math.max(0, index - 1);
        const nextTab = newTabs[newActiveIndex] || newTabs[0];
        setActiveChapterId(nextTab.id);
      } else {
        setActiveChapterId('');
      }
    }
  };

  const handleCloseOtherTabs = (keepTabId: string) => {
    const kept = tabs.filter((t) => t.id === keepTabId);
    setTabs(kept);
    setActiveChapterId(keepTabId);
  };

  const handleOpenPlotTab = async () => {
    try {
      const plotDoc = await ottieniTramaProgetto(activeProjectId);
      const plotId = plotDoc.id;
      if (!tabs.some((t) => t.id === plotId)) {
        setTabs((prev) => [...prev, { id: plotId, title: 'Trama & Struttura', type: 'plot' }]);
      }
      setActiveChapterId(plotId);
    } catch (err) {
      console.warn('[App] Errore apertura scheda trama:', err);
    }
  };

  const handleOpenChapterInTab = (chapterId: string) => {
    const chap = chapters.find((c) => c.id === chapterId);
    const title = chap?.title || 'Capitolo';
    if (!tabs.some((t) => t.id === chapterId)) {
      setTabs((prev) => [...prev, { id: chapterId, title, type: 'chapter' }]);
    }
    setActiveChapterId(chapterId);
  };

  const handleInsertTextIntoEditor = (text: string) => {
    if (!editorInstance) return;
    editorInstance.chain().focus().insertContent(text).run();
  };

  // Scorciatoie tastiera globali per Schede (Ctrl+Alt+T) e Glossario (Ctrl+G)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleToggleTabBar();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        setIsGlossaryOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const isVerifyingRef = useRef(false);

  // Health check del motore AI locale nativo
  const verifyServer = useCallback(async () => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;
    try {
      const ready = await checkLocalServerStatus();
      setServerStatus((prev) => {
        if (prev.isReady === ready && prev.activeModelName === activeModelName && !prev.isChecking) {
          return prev;
        }
        return {
          isReady: ready,
          isChecking: false,
          lastChecked: Date.now(),
          activeModelName,
        };
      });
    } catch (err) {
      setServerStatus((prev) => ({
        ...prev,
        isReady: false,
        isChecking: false,
        lastChecked: Date.now(),
      }));
    } finally {
      isVerifyingRef.current = false;
    }
  }, [activeModelName]);

  useEffect(() => {
    verifyServer();
    refreshModelsList();
    const interval = setInterval(verifyServer, 10000);
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

  // Sostituisce l'intero contenuto del capitolo attivo nell'editor e nel database SQLite
  const handleReplaceChapterContent = async (newContent: string) => {
    if (!editorInstance) return;
    const htmlContent = markdownToEditorHtml(newContent);
    editorInstance.commands.setContent(htmlContent, true);

    const activeChap = chapters.find((c) => c.id === activeChapterId);
    if (activeChap) {
      const firstLine = editorInstance.getText().split('\n').find((l) => l.trim() !== '') ?? '';
      const title = activeChap.title || firstLine.trim().slice(0, 80) || 'Capitolo';
      await salvaCapitolo(activeChap.id, title, htmlContent);
      setChapters((prev) =>
        prev.map((c) => (c.id === activeChap.id ? { ...c, content: htmlContent } : c))
      );
    }
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
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
        isTabBarVisible={isTabBarVisible}
        onToggleTabBar={handleToggleTabBar}
        isGlossaryOpen={isGlossaryOpen}
        onToggleGlossary={() => setIsGlossaryOpen((prev) => !prev)}
        isAIPanelOpen={isAIPanelOpen}
        onOpenAIPanel={() => {
          if (isAIPanelOpen) {
            setIsAIPanelOpen(false);
          } else {
            if (editorInstance) {
              const { from, to } = editorInstance.state.selection;
              const text = from !== to ? editorInstance.state.doc.textBetween(from, to, ' ') : '';
              if (text) setAiSelectedText(text);
            }
            setIsAIPanelOpen(true);
          }
        }}
      />

      {/* Barra delle Schede di Scrittura (Trama, Capitoli, Note) - A Scomparsa */}
      {!settings.zenMode && (
        <TabBar
          tabs={tabs}
          activeTabId={activeChapterId}
          isVisible={isTabBarVisible}
          isGlossaryOpen={isGlossaryOpen}
          allChapters={chapters}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onCloseOtherTabs={handleCloseOtherTabs}
          onDeleteChapter={handleDeleteChapter}
          onOpenPlotTab={handleOpenPlotTab}
          onOpenNewChapter={handleCreateChapter}
          onOpenChapter={handleOpenChapterInTab}
          onToggleGlossary={() => setIsGlossaryOpen((prev) => !prev)}
          onToggleVisibility={handleToggleTabBar}
        />
      )}

      {/* Glossario a Scomparsa (Schede, Indice Capitoli, Bibbia Personaggi) */}
      {!settings.zenMode && (
        <GlossaryDrawer
          isOpen={isGlossaryOpen}
          activeProjectId={activeProjectId}
          projectTitle={projectProfile.title}
          tabs={tabs}
          activeTabId={activeChapterId}
          allChapters={chapters}
          onClose={() => setIsGlossaryOpen(false)}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onDeleteChapter={handleDeleteChapter}
          onOpenPlotTab={handleOpenPlotTab}
          onOpenChapter={handleOpenChapterInTab}
          onCreateChapter={handleCreateChapter}
          onOpenWorldbuilding={() => {
            setIsGlossaryOpen(false);
            setIsWorldbuildingOpen(true);
          }}
          onInsertTextIntoEditor={handleInsertTextIntoEditor}
        />
      )}

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

      {/* Area di Lavoro: Editor Centrale affiancato alla Barra Laterale AI */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        <ZenEditor
          activeChapterId={activeChapterId}
          font={settings.font}
          fontSize={settings.fontSize}
          lineHeight={settings.lineHeight}
          width={settings.width}
          zenMode={settings.zenMode}
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen((prev) => !prev)}
          onCloseSearch={() => setIsSearchOpen(false)}
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

        {/* Barra Laterale Assistente AI (Docked a destra, sempre consultabile durante la stesura) */}
        {isAIPanelOpen && !settings.zenMode && (
          <AIPanel
            isOpen={isAIPanelOpen}
            selectedText={aiSelectedText}
            serverStatus={serverStatus}
            activeModelName={activeModelName}
            geminiApiKey={settings.geminiApiKey || ''}
            currentChapterTitle={chapters.find((c) => c.id === activeChapterId)?.title}
            currentChapterContent={editorInstance ? editorInstance.getHTML() : chapters.find((c) => c.id === activeChapterId)?.content}
            chapters={chapters}
            activeProjectId={activeProjectId}
            projectTitle={projectProfile.title}
            projectProfile={projectProfile}
            settings={settings}
            onClose={() => setIsAIPanelOpen(false)}
            onReplaceText={handleReplaceText}
            onReplaceChapterContent={handleReplaceChapterContent}
            onInsertAfter={handleInsertAfter}
            onOpenSettings={() => {
              setIsSettingsOpen(true);
            }}
          />
        )}
      </div>

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

      {/* Modal Bibbia del Romanzo (Personaggi & Luoghi per Progetto) */}
      <WorldbuildingModal
        isOpen={isWorldbuildingOpen}
        geminiApiKey={settings.geminiApiKey}
        settings={settings}
        activeProjectId={activeProjectId}
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
        onClose={() => {
          setIsProjectsManagerOpen(false);
          refreshProjectData();
        }}
        onProjectChanged={handleSwitchProject}
        onProjectUpdated={(newProfile) => {
          setProjectProfile(newProfile);
          refreshProjectData();
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
