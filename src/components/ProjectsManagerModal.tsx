import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  FolderArchive,
  Plus,
  Trash2,
  Folder,
  Download,
  Upload,
  Clock,
  Sparkles,
  Check,
  ExternalLink,
  AlertCircle,
  FileText,
  Sliders,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { ProjectItem, ProjectProfile, ProjectManifest } from '../types';
import {
  elencaProgetti,
  caricaProgetto,
  creaNuovoProgetto,
  salvaProgetto,
  eliminaProgetto,
  getActiveProjectId,
  setActiveProjectId,
  esportaSnapshotProgetto,
  importaProgettoCompleto,
} from '../services/db';
import {
  selectProjectFolder,
  selectManifestFile,
  readManifestFile,
  openFolderInExplorer,
} from '../services/projectFiles';

interface ProjectsManagerModalProps {
  isOpen: boolean;
  initialTab?: 'library' | 'create' | 'profile' | 'import';
  onClose: () => void;
  onProjectChanged: (projectId: string) => void;
  onProjectUpdated?: (profile: ProjectProfile) => void;
}

const GENRE_SUGGESTIONS = [
  'Fantasy',
  'Dark Fantasy',
  'Fantascienza',
  'Giallo / Noir',
  'Thriller psicologico',
  'Horror',
  'Romanzo Storico',
  'Distopico',
  'Cyberpunk',
  'Grimdark',
  'Narrativa contemporanea',
];

const TONE_SUGGESTIONS = [
  'Cupo ed Epico',
  'Introspettivo & Psicologico',
  'Incalzante & Teso',
  'Poetico & Evocativo',
  'Crudo & Realista',
  'Ironico & Brillante',
  'Onirico & Misterioso',
];

const POV_SUGGESTIONS = [
  'Prima Persona (Io narrante)',
  'Terza Persona Limitata (Focalizzazione interna)',
  'Terza Persona Onnisciente',
  'Seconda Persona (Tu)',
  'Punti di vista alternati (POV multiplo)',
];

export const ProjectsManagerModal: React.FC<ProjectsManagerModalProps> = ({
  isOpen,
  initialTab = 'library',
  onClose,
  onProjectChanged,
  onProjectUpdated,
}) => {
  const [tab, setTab] = useState<'library' | 'create' | 'profile' | 'import'>(initialTab);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeId, setActiveId] = useState<string>(getActiveProjectId());
  const [currentProject, setCurrentProject] = useState<ProjectItem | null>(null);

  // Form Nuovo Progetto
  const [newTitle, setNewTitle] = useState('');
  const [newGenre, setNewGenre] = useState('Fantasy');
  const [newDesc, setNewDesc] = useState('');
  const [newTone, setNewTone] = useState('');
  const [newVoice, setNewVoice] = useState('');
  const [newFolder, setNewFolder] = useState<string | null>(null);
  const [newAutoExport, setNewAutoExport] = useState<number>(0);

  // Form Modifica Profilo
  const [profileForm, setProfileForm] = useState<ProjectItem | null>(null);

  // Importazione
  const [importManifestText, setImportManifestText] = useState<string | null>(null);
  const [importParsedManifest, setImportParsedManifest] = useState<ProjectManifest | null>(null);
  const [importPathInfo, setImportPathInfo] = useState<string | null>(null);

  // Feedback & Stati
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Caricamento progetti all'apertura
  const refreshProjectsList = async () => {
    try {
      const list = await elencaProgetti();
      setProjects(list);
      const currId = getActiveProjectId();
      setActiveId(currId);
      const curr = list.find((p) => p.id === currId) || list[0] || null;
      setCurrentProject(curr);
      if (curr) {
        setProfileForm({ ...curr });
      }
    } catch (e) {
      console.warn('[ProjectsManager] Errore caricamento:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      refreshProjectsList();
      setStatusMessage(null);
      setDeleteConfirmId(null);
      setImportManifestText(null);
      setImportParsedManifest(null);
      setImportPathInfo(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  // Seleziona e attiva un progetto
  const handleSelectProject = (projId: string) => {
    setActiveProjectId(projId);
    setActiveId(projId);
    onProjectChanged(projId);
    showToast('Progetto attivato!');
    setTimeout(() => {
      onClose();
    }, 500);
  };

  // Salva nuovo progetto
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast('Inserisci un titolo per il romanzo.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      const created = await creaNuovoProgetto({
        title: newTitle.trim(),
        genre: newGenre,
        description: newDesc.trim(),
        styleTone: newTone.trim(),
        narrativeVoice: newVoice.trim(),
        exportFolder: newFolder,
        autoExportMinutes: newAutoExport,
      });

      // Se è stata scelta una cartella di esportazione iniziale, genera subito il primo snapshot
      if (newFolder) {
        try {
          await esportaSnapshotProgetto(created.id, newFolder);
        } catch (syncErr) {
          console.warn('[CreateProject] Sync iniziale non completata:', syncErr);
        }
      }

      await refreshProjectsList();
      onProjectChanged(created.id);
      showToast(`Progetto "${created.title}" creato con successo!`);
      // Reset form
      setNewTitle('');
      setNewDesc('');
      setNewTone('');
      setNewVoice('');
      setNewFolder(null);
      setNewAutoExport(0);
      setTab('library');
    } catch (err: any) {
      showToast(`Errore creazione: ${err.message || err}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Salva profilo progetto attivo
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm) return;
    setIsProcessing(true);
    try {
      await salvaProgetto(profileForm);
      await refreshProjectsList();
      if (onProjectUpdated) {
        onProjectUpdated({
          title: profileForm.title,
          genre: profileForm.genre,
          description: profileForm.description,
          styleTone: profileForm.styleTone,
          narrativeVoice: profileForm.narrativeVoice,
          targetAudience: profileForm.targetAudience,
          narrativeNotes: profileForm.narrativeNotes,
        });
      }
      showToast('Profilo del progetto aggiornato nel database SQLite!');
    } catch (err: any) {
      showToast(`Errore salvataggio: ${err.message || err}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Esporta snapshot manuale
  const handleManualExport = async (proj: ProjectItem) => {
    setIsProcessing(true);
    try {
      let targetFolder = proj.exportFolder;
      if (!targetFolder) {
        const picked = await selectProjectFolder();
        if (!picked) {
          setIsProcessing(false);
          return;
        }
        targetFolder = picked;
        proj.exportFolder = picked;
        await salvaProgetto(proj);
      }

      const res = await esportaSnapshotProgetto(proj.id, targetFolder);
      await refreshProjectsList();
      showToast(`Backup con indice salvato con successo in:\n${res.folderPath}`);
    } catch (err: any) {
      showToast(`Errore esportazione snapshot: ${err.message || err}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Elimina progetto
  const handleDeleteProject = async (id: string) => {
    try {
      await eliminaProgetto(id);
      setDeleteConfirmId(null);
      await refreshProjectsList();
      const newActive = getActiveProjectId();
      onProjectChanged(newActive);
      showToast('Progetto eliminato dal database.');
    } catch (err: any) {
      showToast(`Errore eliminazione: ${err.message || err}`, 'error');
    }
  };

  // Selezione file o cartella per importazione
  const handlePickManifestFile = async () => {
    try {
      const filePath = await selectManifestFile();
      if (!filePath) return;
      const jsonContent = await readManifestFile(filePath);
      const parsed: ProjectManifest = JSON.parse(jsonContent);
      setImportPathInfo(filePath);
      setImportManifestText(jsonContent);
      setImportParsedManifest(parsed);
    } catch (e: any) {
      showToast(`Impossibile leggere il file manifest: ${e.message}`, 'error');
    }
  };

  const handlePickManifestFolder = async () => {
    try {
      const folderPath = await selectProjectFolder();
      if (!folderPath) return;
      const jsonContent = await readManifestFile(folderPath);
      const parsed: ProjectManifest = JSON.parse(jsonContent);
      setImportPathInfo(folderPath);
      setImportManifestText(jsonContent);
      setImportParsedManifest(parsed);
    } catch (e: any) {
      showToast(`Impossibile leggere l'indice dalla cartella: ${e.message}`, 'error');
    }
  };

  const handleExecuteImport = async () => {
    if (!importManifestText) return;
    setIsProcessing(true);
    try {
      const imported = await importaProgettoCompleto(importManifestText);
      await refreshProjectsList();
      onProjectChanged(imported.id);
      showToast(`Progetto "${imported.title}" importato con successo con ${imported.chaptersCount} capitoli!`);
      setImportManifestText(null);
      setImportParsedManifest(null);
      setImportPathInfo(null);
      setTimeout(() => {
        setTab('library');
      }, 1000);
    } catch (err: any) {
      showToast(`Errore importazione: ${err.message || err}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Principale */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/80 dark:bg-stone-950/70">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                Gestione Progetti Letterari
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  SQLite Single Source of Truth
                </span>
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tutti i romanzi, capitoli e worldbuilding sono conservati in locale nel database nativo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra Navigazione Schede */}
        <div className="flex border-b border-stone-200 dark:border-stone-800 bg-stone-100/50 dark:bg-stone-950/40 px-6 gap-2 pt-2">
          <button
            onClick={() => setTab('library')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'library'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-500 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            I Miei Progetti ({projects.length})
          </button>

          <button
            onClick={() => setTab('create')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'create'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-500 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            Nuovo Progetto
          </button>

          <button
            onClick={() => setTab('profile')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'profile'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-500 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Profilo & Regole ({currentProject?.title || 'Attivo'})
          </button>

          <button
            onClick={() => setTab('import')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition-colors ${
              tab === 'import'
                ? 'border-amber-600 text-amber-700 dark:text-amber-400 dark:border-amber-500 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Importa Backup
          </button>
        </div>

        {/* Notifica Toast */}
        {statusMessage && (
          <div
            className={`mx-6 mt-3 p-3 rounded-xl text-xs flex items-center justify-between border ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span className="whitespace-pre-line">{statusMessage.text}</span>
            </div>
            <button onClick={() => setStatusMessage(null)} className="text-stone-400 hover:text-stone-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Contenuto Schede */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: I MIEI PROGETTI */}
          {tab === 'library' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-stone-500">
                  Seleziona un romanzo per aprirlo nell'editor o esporta un backup di sicurezza con indice.
                </p>
                <button
                  onClick={() => setTab('create')}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crea Nuovo Progetto
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj) => {
                  const isActive = proj.id === activeId;
                  const lastModDate = new Date(proj.updatedAt).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={proj.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isActive
                          ? 'border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 shadow-sm'
                          : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/60 hover:border-stone-300 dark:hover:border-stone-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                                {proj.title}
                              </h4>
                              {isActive && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-medium">
                                  Attivo
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                              {proj.genre || 'Genere non specificato'}
                            </span>
                          </div>
                        </div>

                        {proj.description && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 line-clamp-2 italic">
                            "{proj.description}"
                          </p>
                        )}

                        <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800/60 text-[11px] text-stone-500 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-stone-400" />
                              {proj.chaptersCount || 0} capitoli
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-stone-400" />
                              {lastModDate}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-stone-400">
                            <span>
                              {proj.autoExportMinutes > 0
                                ? `Backup auto: ogni ${proj.autoExportMinutes}m`
                                : 'Backup auto: disattivato'}
                            </span>
                            {proj.exportFolder && (
                              <button
                                onClick={() => openFolderInExplorer(proj.exportFolder!)}
                                className="text-indigo-600 hover:underline flex items-center gap-0.5"
                              >
                                Cartella <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Azioni Progetto */}
                      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between gap-2">
                        {deleteConfirmId === proj.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-rose-600 font-medium">Confermi eliminazione?</span>
                            <button
                              onClick={() => handleDeleteProject(proj.id)}
                              className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-medium"
                            >
                              Elimina
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200 text-[10px]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            {!isActive ? (
                              <button
                                onClick={() => handleSelectProject(proj.id)}
                                className="px-3 py-1 rounded-lg bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-medium transition-colors"
                              >
                                Apri
                              </button>
                            ) : (
                              <span className="text-xs text-stone-400 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-500" /> Aperto ora
                              </span>
                            )}

                            <button
                              onClick={() => {
                                setCurrentProject(proj);
                                setProfileForm({ ...proj });
                                setTab('profile');
                              }}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs"
                              title="Modifica profilo e regole"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleManualExport(proj)}
                              disabled={isProcessing}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs"
                              title="Esporta Snapshot adesso con indice"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {projects.length > 1 && deleteConfirmId !== proj.id && (
                          <button
                            onClick={() => setDeleteConfirmId(proj.id)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Elimina progetto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: NUOVO PROGETTO */}
          {tab === 'create' && (
            <form onSubmit={handleCreateProject} className="space-y-4 max-w-2xl mx-auto">
              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Titolo dell'Opera *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Il Ritorno del Male"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Genere Letterario
                </label>
                <input
                  type="text"
                  placeholder="Es. Fantasy, Fantascienza, Thriller..."
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 mb-2"
                />
                <div className="flex flex-wrap gap-1.5">
                  {GENRE_SUGGESTIONS.slice(0, 7).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setNewGenre(g)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                        newGenre === g
                          ? 'bg-amber-100 dark:bg-amber-900/50 border-amber-400 text-amber-800 dark:text-amber-300'
                          : 'bg-stone-50 dark:bg-stone-950 border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:border-stone-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Premessa Rapida / Logline
                </label>
                <textarea
                  rows={2}
                  placeholder="Breve sinossi che orienterà le AI di assistenza nella generazione e suggerimenti di trama..."
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Tono & Stile Narrativo
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Cupo ed Epico, Cinico..."
                    value={newTone}
                    onChange={(e) => setNewTone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Voce Narrante & Punto di Vista (POV)
                  </label>
                  <input
                    type="text"
                    placeholder="Es. Terza persona limitata, Prima persona..."
                    value={newVoice}
                    onChange={(e) => setNewVoice(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              {/* Cartella di esportazione & Backup su disco */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-600" />
                    <div>
                      <h5 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                        Cartella di Backup & Esportazione su Disco (Opzionale)
                      </h5>
                      <p className="text-[11px] text-stone-500">
                        Salva copie strutturate in Markdown con indice di reimportazione
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const f = await selectProjectFolder();
                      if (f) setNewFolder(f);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    {newFolder ? 'Cambia Cartella' : 'Seleziona Cartella'}
                  </button>
                </div>

                {newFolder && (
                  <p className="text-[11px] font-mono bg-white dark:bg-stone-900 p-2 rounded-lg border border-stone-200 dark:border-stone-800 break-all text-stone-700 dark:text-stone-300">
                    {newFolder}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2 border-t border-stone-200 dark:border-stone-800/60">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span className="text-xs text-stone-600 dark:text-stone-400">
                    Auto-esportazione periodica di sicurezza:
                  </span>
                  <select
                    value={newAutoExport}
                    onChange={(e) => setNewAutoExport(Number(e.target.value))}
                    className="px-2 py-1 text-xs rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value={0}>Disattivata (Solo su richiesta)</option>
                    <option value={5}>Ogni 5 minuti</option>
                    <option value={10}>Ogni 10 minuti</option>
                    <option value={15}>Ogni 15 minuti</option>
                    <option value={30}>Ogni 30 minuti</option>
                    <option value={60}>Ogni 60 minuti</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTab('library')}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-sm transition-colors"
                >
                  {isProcessing ? 'Creazione in corso...' : 'Crea Progetto ed Inizia a Scrivere'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: PROFILO & REGOLE DEL PROGETTO ATTIVO */}
          {tab === 'profile' && profileForm && (
            <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Titolo del Romanzo
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.title}
                    onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Genere Letterario
                  </label>
                  <input
                    type="text"
                    value={profileForm.genre}
                    onChange={(e) => setProfileForm({ ...profileForm, genre: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Premessa Narrativa / Logline
                </label>
                <textarea
                  rows={2}
                  value={profileForm.description}
                  onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Tono & Registro Stilistico
                  </label>
                  <input
                    type="text"
                    value={profileForm.styleTone}
                    onChange={(e) => setProfileForm({ ...profileForm, styleTone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                    Voce Narrante & Punto di Vista (POV)
                  </label>
                  <input
                    type="text"
                    value={profileForm.narrativeVoice}
                    onChange={(e) => setProfileForm({ ...profileForm, narrativeVoice: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Regole del Mondo, Direttive & Linee Guida per l'AI
                </label>
                <textarea
                  rows={3}
                  placeholder="Es. Il sistema magico richiede sacrifici; non usare termini moderni o gergali; il protagonista non mente mai..."
                  value={profileForm.narrativeNotes}
                  onChange={(e) => setProfileForm({ ...profileForm, narrativeNotes: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none font-sans"
                />
              </div>

              {/* Impostazioni Cartella di Esportazione & Auto-Backup */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-amber-600" />
                    <div>
                      <h5 className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                        Cartella di Backup del Progetto
                      </h5>
                      <p className="text-[11px] text-stone-500">
                        {profileForm.exportFolder ? profileForm.exportFolder : 'Nessuna cartella configurata'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {profileForm.exportFolder && (
                      <button
                        type="button"
                        onClick={() => openFolderInExplorer(profileForm.exportFolder!)}
                        className="px-2 py-1 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center gap-1"
                      >
                        Esplora <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        const f = await selectProjectFolder();
                        if (f) setProfileForm({ ...profileForm, exportFolder: f });
                      }}
                      className="px-2.5 py-1 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      {profileForm.exportFolder ? 'Cambia' : 'Seleziona'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800/60">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <span className="text-xs text-stone-600 dark:text-stone-400">
                      Auto-esportazione periodica con indice:
                    </span>
                  </div>
                  <select
                    value={profileForm.autoExportMinutes}
                    onChange={(e) => setProfileForm({ ...profileForm, autoExportMinutes: Number(e.target.value) })}
                    className="px-2 py-1 text-xs rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100"
                  >
                    <option value={0}>Disattivata (Solo su richiesta)</option>
                    <option value={5}>Ogni 5 minuti</option>
                    <option value={10}>Ogni 10 minuti</option>
                    <option value={15}>Ogni 15 minuti</option>
                    <option value={30}>Ogni 30 minuti</option>
                    <option value={60}>Ogni 60 minuti</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-stone-400">
                  <span>
                    Ultimo backup su disco:{' '}
                    {profileForm.lastExportedAt
                      ? new Date(profileForm.lastExportedAt).toLocaleTimeString()
                      : 'Nessuno'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleManualExport(profileForm)}
                    disabled={isProcessing}
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 font-medium flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Esegui Backup Adesso
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-sm transition-colors"
                >
                  {isProcessing ? 'Salvataggio...' : 'Salva Modifiche Profilo nel Database'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 4: IMPORTA DA BACKUP */}
          {tab === 'import' && (
            <div className="space-y-5 max-w-2xl mx-auto">
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40">
                <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-amber-600" />
                  Reimportazione Completa nel Database SQLite
                </h4>
                <p className="text-xs text-stone-500 mt-1">
                  Puoi ripristinare un progetto precedentemente esportato selezionando il file{' '}
                  <code className="text-amber-700 dark:text-amber-400">zenscribe.manifest.json</code> oppure la cartella del progetto. Verranno ricreati tutti i capitoli, i testi formattati e le schede del Worldbuilding.
                </p>

                <div className="flex flex-wrap gap-3 mt-4">
                  <button
                    onClick={handlePickManifestFile}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-medium hover:border-amber-500 flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <FileText className="w-4 h-4 text-amber-600" />
                    Seleziona File Manifest (.json)
                  </button>

                  <button
                    onClick={handlePickManifestFolder}
                    className="px-4 py-2 rounded-xl bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 text-stone-800 dark:text-stone-200 text-xs font-medium hover:border-amber-500 flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <Folder className="w-4 h-4 text-indigo-600" />
                    Seleziona Cartella Esportata
                  </button>
                </div>
              </div>

              {/* Anteprima Manifest Caricato */}
              {importParsedManifest && (
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Indice Progetto Riconosciuto
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Esportato il:{' '}
                      {new Date(importParsedManifest.exportDate).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-stone-900 p-3 rounded-lg border border-stone-200 dark:border-stone-800 text-xs space-y-1">
                    <div className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                      {importParsedManifest.project.title}
                    </div>
                    <div className="text-stone-500">
                      Genere: <span className="text-stone-700 dark:text-stone-300 font-medium">{importParsedManifest.project.genre || 'Non specificato'}</span>
                    </div>
                    {importParsedManifest.project.description && (
                      <div className="text-stone-500 italic">
                        "{importParsedManifest.project.description}"
                      </div>
                    )}
                    <div className="pt-2 flex gap-4 text-[11px] text-stone-600 dark:text-stone-400 border-t border-stone-100 dark:border-stone-800">
                      <span>📖 Capitoli: <strong>{importParsedManifest.chapters?.length || 0}</strong></span>
                      <span>🧙 Schede Mondo: <strong>{importParsedManifest.worldbuilding?.nodes?.length || 0}</strong></span>
                      <span>🔗 Collegamenti: <strong>{importParsedManifest.worldbuilding?.edges?.length || 0}</strong></span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setImportManifestText(null);
                        setImportParsedManifest(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs text-stone-500 hover:text-stone-700"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={handleExecuteImport}
                      disabled={isProcessing}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {isProcessing ? 'Importazione in corso...' : 'Conferma e Reimporta nel Database'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
