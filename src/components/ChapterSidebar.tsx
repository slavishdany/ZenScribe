import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, Edit2, Check, X, FileText } from 'lucide-react';

export interface ChapterItem {
  id: string;
  title: string;
  content: string;
}

interface ChapterSidebarProps {
  isOpen: boolean;
  chapters: ChapterItem[];
  activeChapterId: string;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  onDeleteChapter: (id: string) => void;
  onRenameChapter: (id: string, newTitle: string) => void;
  onClose: () => void;
}

export const ChapterSidebar: React.FC<ChapterSidebarProps> = ({
  isOpen,
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  onDeleteChapter,
  onRenameChapter,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

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

  return (
    <div className="fixed inset-y-0 left-0 z-40 w-72 bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 shadow-xl flex flex-col animate-fade-in select-none">
      {/* Intestazione */}
      <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/40">
        <div className="flex items-center space-x-2 text-stone-800 dark:text-stone-200 font-medium text-sm">
          <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Capitoli & Sezioni</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800"
          title="Chiudi pannello"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Lista capitoli da SQLite */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-xs">
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
                className={`group p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-sm'
                    : 'border-transparent hover:border-stone-200 dark:hover:border-stone-800 hover:bg-stone-100/70 dark:hover:bg-stone-800/50 text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="flex items-center space-x-2 truncate flex-1 mr-2">
                  <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-stone-400'}`} />
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

      {/* Footer con pulsante Nuovo Capitolo */}
      <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40">
        <button
          onClick={onCreateChapter}
          className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Nuovo Capitolo</span>
        </button>
      </div>
    </div>
  );
};
