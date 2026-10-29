import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  FileText,
  FolderOpen,
  FolderSync,
  BookMarked,
  Download,
  FolderArchive,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { ProjectProfile, ProjectItem } from '../types';

export interface ChapterItem {
  id: string;
  title: string;
  content: string;
}

interface ChapterSidebarProps {
  isOpen: boolean;
  chapters: ChapterItem[];
  activeChapterId: string;
  projectProfile: ProjectProfile;
  activeProject?: ProjectItem | null;
  projectFolder: string | null;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  onDeleteChapter: (id: string) => void;
  onRenameChapter: (id: string, newTitle: string) => void;
  onClose: () => void;
  onOpenProjectProfile: () => void;
  onOpenProjectsManager?: (tab?: 'library' | 'create' | 'profile' | 'import') => void;
  onSelectProjectFolder: () => void;
  onSyncProjectFolder: () => void;
  onExportSnapshot?: () => void;
  onOpenFolderInExplorer: () => void;
  onExportManuscript: (format: 'md' | 'txt') => void;
}

export const ChapterSidebar: React.FC<ChapterSidebarProps> = ({
  isOpen,
  chapters,
  activeChapterId,
  projectProfile,
  activeProject,
  projectFolder,
  onSelectChapter,
  onCreateChapter,
  onDeleteChapter,
  onRenameChapter,
  onClose,
  onOpenProjectProfile,
  onOpenProjectsManager,
  onSelectProjectFolder,
  onSyncProjectFolder,
  onExportSnapshot,
  onOpenFolderInExplorer,
  onExportManuscript,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  if (!isOpen) return null;

  const handleStartRename = (chapter: ChapterItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chapter.id);
    setEditingTitle(chapter.title);
  };

  const handleConfirmRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingTitle.trim()) {
      onRenameChapter(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const folderName = projectFolder
    ? projectFolder.split(/[\\/]/).filter(Boolean).pop() || projectFolder
    : null;

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-80 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 shadow-xl flex flex-col animate-fade-in select-none">
      {/* Intestazione */}
      <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/60 dark:bg-stone-950/40">
        <div className="flex items-center space-x-2 text-stone-800 dark:text-stone-200 font-semibold text-sm">
          <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span>Capitoli & Progetto</span>
        </div>
        <div className="flex items-center gap-1">
          {onOpenProjectsManager && (
            <button
              onClick={() => onOpenProjectsManager('library')}
              className="p-1 rounded text-stone-500 hover:text-amber-600 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
              title="Gestione Multi-Progetto"
            >
              <FolderArchive className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
            title="Chiudi pannello"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Profilo del Romanzo & Cartella su Disco */}
      <div className="p-3 border-b border-stone-200 dark:border-stone-800 space-y-2 bg-stone-50/30 dark:bg-stone-950/20 text-xs">
        {/* Card Profilo Progetto */}
        <div className="p-2.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm space-y-2">
          <div className="flex items-start justify-between gap-1">
            <div
              onClick={() => onOpenProjectsManager ? onOpenProjectsManager('profile') : onOpenProjectProfile()}
              className="cursor-pointer truncate flex-1"
            >
              <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center space-x-1.5 truncate">
                <BookMarked className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <span className="truncate">{projectProfile.title || 'Nuovo Romanzo'}</span>
              </div>
              <div className="flex items-center space-x-1.5 text-[10px] text-stone-500 mt-0.5">
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  {projectProfile.genre || 'Genere non impostato'}
                </span>
                {projectProfile.styleTone && (
                  <>
                    <span>•</span>
                    <span className="truncate">{projectProfile.styleTone}</span>
                  </>
                )}
              </div>
            </div>

            {onOpenProjectsManager && (
              <button
                type="button"
                onClick={() => onOpenProjectsManager('library')}
                className="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-medium hover:bg-amber-100 dark:hover:bg-amber-950 hover:text-amber-700 transition-colors"
                title="Cambia o crea progetti"
              >
                Progetti
              </button>
            )}
          </div>

          {/* Backup e Cartella su Disco */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[10px] text-stone-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-400" />
              {activeProject?.autoExportMinutes && activeProject.autoExportMinutes > 0
                ? `Backup: ogni ${activeProject.autoExportMinutes}m`
                : 'Backup: manuale'}
            </span>
            <div className="flex items-center gap-1">
              {onExportSnapshot && (
                <button
                  type="button"
                  onClick={onExportSnapshot}
                  className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 font-medium flex items-center gap-0.5"
                  title="Esporta Snapshot adesso con indice"
                >
                  <Download className="w-2.5 h-2.5" /> Snapshot
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Percorso Cartella */}
        <div className="p-2 rounded-lg border border-dashed border-stone-200 dark:border-stone-800 flex items-center justify-between text-[11px]">
          {projectFolder ? (
            <>
              <div className="flex items-center space-x-1.5 text-stone-700 dark:text-stone-300 truncate mr-2">
                <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="truncate font-mono" title={projectFolder}>
                  📁 {folderName}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={onSyncProjectFolder}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                  title="Sincronizza file su disco ora"
                >
                  <FolderSync className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onOpenFolderInExplorer}
                  className="p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-800 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                  title="Apri in Esplora File"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={onSelectProjectFolder}
              className="w-full text-left text-amber-700 dark:text-amber-400 hover:underline flex items-center space-x-1.5 font-medium"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Collega cartella di backup su disco...</span>
            </button>
          )}
        </div>
      </div>

      {/* Lista capitoli */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
        <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-stone-400 px-1 mb-1 tracking-wider">
          <span>Capitoli del Libro ({chapters.length})</span>
        </div>

        {chapters.length === 0 ? (
          <div className="p-4 text-center text-stone-400">
            Nessun capitolo trovato. Clicca sotto per crearne uno.
          </div>
        ) : (
          chapters.map((chap, idx) => {
            const isActive = chap.id === activeChapterId;
            const isEditing = editingId === chap.id;

            return (
              <div
                key={chap.id}
                onClick={() => !isEditing && onSelectChapter(chap.id)}
                className={`group p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm'
                    : 'border-transparent hover:border-stone-200 dark:hover:border-stone-800 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="flex items-center space-x-2 truncate flex-1 mr-2">
                  <FileText
                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-stone-400'
                    }`}
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-xs p-1 rounded border border-indigo-400 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <div className="truncate">
                      <div className="font-medium truncate">{chap.title || `Capitolo ${idx + 1}`}</div>
                    </div>
                  )}
                </div>

                {/* Pulsanti azioni */}
                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isEditing ? (
                    <>
                      <button
                        onClick={(e) => handleConfirmRename(chap.id, e)}
                        className="p-1 text-emerald-600 hover:text-emerald-700"
                        title="Conferma"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="p-1 text-stone-400 hover:text-stone-600"
                        title="Annulla"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => handleStartRename(chap, e)}
                        className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                        title="Rinomina capitolo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {chapters.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Sei sicuro di voler eliminare "${chap.title}"?`)) {
                              onDeleteChapter(chap.id);
                            }
                          }}
                          className="p-1 text-stone-400 hover:text-rose-600"
                          title="Elimina capitolo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer con pulsante Nuovo Capitolo ed Esportazione */}
      <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 space-y-2">
        <button
          onClick={onCreateChapter}
          className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nuovo Capitolo</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Esporta Manoscritto...</span>
          </button>

          {isExportMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl overflow-hidden py-1 z-50 text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onExportManuscript('md');
                }}
                className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-between"
              >
                <span>Manoscritto Completo (.md)</span>
                <span className="text-[10px] font-mono text-stone-400">Markdown</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsExportMenuOpen(false);
                  onExportManuscript('txt');
                }}
                className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-between"
              >
                <span>Manoscritto Completo (.txt)</span>
                <span className="text-[10px] font-mono text-stone-400">Testo puro</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
