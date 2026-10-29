import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Quote,
  List,
  Undo,
  Redo,
  Sparkles,
  Sun,
  Moon,
  BookOpen,
  Compass,
  BookMarked,
  Download,
} from 'lucide-react';
import { EditorFont, EditorWidth } from '../types';

interface EditorToolbarProps {
  editor: Editor | null;
  font: EditorFont;
  width: EditorWidth;
  theme: 'light' | 'dark' | 'system';
  zenMode: boolean;
  projectTitle?: string;
  onFontChange: (font: EditorFont) => void;
  onWidthChange: (width: EditorWidth) => void;
  onThemeToggle: () => void;
  onOpenAIPanel: () => void;
  onToggleChapters?: () => void;
  onOpenWorldbuilding?: () => void;
  onOpenProjectProfile?: () => void;
  onOpenProjectsManager?: (tab?: 'library' | 'create' | 'profile' | 'import') => void;
  onExportSnapshot?: () => void;
  onExportChapter?: (format: 'md' | 'txt') => void;
  onExportManuscript?: (format: 'md' | 'txt') => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  font,
  width,
  theme,
  zenMode,
  projectTitle,
  onFontChange,
  onWidthChange,
  onThemeToggle,
  onOpenAIPanel,
  onToggleChapters,
  onOpenWorldbuilding,
  onOpenProjectProfile,
  onOpenProjectsManager,
  onExportSnapshot,
  onExportChapter,
  onExportManuscript,
}) => {
  const [isExportOpen, setIsExportOpen] = useState(false);

  if (!editor) return null;

  return (
    <header
      className={`px-4 py-2 border-b border-stone-200/80 dark:border-stone-800/80 bg-zen-bg/90 dark:bg-zen-darkBg/90 backdrop-blur-md flex items-center justify-between transition-all duration-300 z-10 ${
        zenMode ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Brand & Strumenti Formattazione */}
      <div className="flex items-center space-x-1 sm:space-x-1.5">
        {onToggleChapters && (
          <button
            onClick={onToggleChapters}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300 flex items-center space-x-1 text-xs font-medium"
            title="Sfoglia Capitoli del Libro"
          >
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">Capitoli</span>
          </button>
        )}

        {onOpenWorldbuilding && (
          <button
            onClick={onOpenWorldbuilding}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300 flex items-center space-x-1 text-xs font-medium"
            title="Bibbia del Romanzo: Personaggi e Luoghi"
          >
            <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Personaggi</span>
          </button>
        )}

        {(onOpenProjectsManager || onOpenProjectProfile) && (
          <button
            onClick={() => {
              if (onOpenProjectsManager) {
                onOpenProjectsManager('library');
              } else if (onOpenProjectProfile) {
                onOpenProjectProfile();
              }
            }}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300 flex items-center space-x-1 text-xs font-medium max-w-[190px] truncate"
            title="Gestione Progetti Letterari & Profilo Narrativo"
          >
            <BookMarked className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="truncate hidden sm:inline">
              {projectTitle ? projectTitle : 'I Miei Romanzi'}
            </span>
          </button>
        )}

        <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-1"></div>

        {/* Undo / Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400 disabled:opacity-30"
          title="Annulla (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400 disabled:opacity-30"
          title="Ripristina (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-1"></div>

        {/* Formattazione Testo Base */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bold')
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400'
          }`}
          title="Grassetto (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('italic')
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400'
          }`}
          title="Corsivo (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>

        {/* Titoli e Stili */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400'
          }`}
          title="Titolo Principale (H1)"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400'
          }`}
          title="Sezione (H2)"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400'
          }`}
          title="Citazione"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400'
          }`}
          title="Elenco Puntato"
        >
          <List className="w-4 h-4" />
        </button>
      </div>

      {/* Preferenze Tipografia, Layout & Assistente AI */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Scelta Font */}
        <div className="flex items-center bg-stone-200/50 dark:bg-stone-800/50 rounded-lg p-0.5 text-xs">
          <button
            onClick={() => onFontChange('serif')}
            className={`px-2 py-1 rounded-md font-serif ${
              font === 'serif' ? 'bg-white dark:bg-stone-700 shadow-sm font-semibold' : 'opacity-70'
            }`}
            title="Carattere Serif (Merriweather)"
          >
            Serif
          </button>
          <button
            onClick={() => onFontChange('sans')}
            className={`px-2 py-1 rounded-md font-sans ${
              font === 'sans' ? 'bg-white dark:bg-stone-700 shadow-sm font-semibold' : 'opacity-70'
            }`}
            title="Carattere Sans-Serif (Inter)"
          >
            Sans
          </button>
          <button
            onClick={() => onFontChange('mono')}
            className={`px-2 py-1 rounded-md font-mono ${
              font === 'mono' ? 'bg-white dark:bg-stone-700 shadow-sm font-semibold' : 'opacity-70'
            }`}
            title="Carattere Monospazio (JetBrains Mono)"
          >
            Mono
          </button>
        </div>

        {/* Ampiezza Pagina */}
        <select
          value={width}
          onChange={(e) => onWidthChange(e.target.value as EditorWidth)}
          className="text-xs bg-stone-200/50 dark:bg-stone-800/50 border-none rounded-lg px-2 py-1 text-stone-700 dark:text-stone-300 focus:outline-none cursor-pointer"
          title="Larghezza Foglio di Scrittura"
        >
          <option value="narrow">Stretto (65ch)</option>
          <option value="medium">Standard (80ch)</option>
          <option value="wide">Largo (100ch)</option>
          <option value="full">Piena Larghezza</option>
        </select>

        {/* Menu Esporta su File */}
        {(onExportChapter || onExportManuscript || onExportSnapshot) && (
          <div className="relative">
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400"
              title="Esporta su File (.md / .txt / Snapshot con Indice)"
            >
              <Download className="w-4 h-4" />
            </button>

            {isExportOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-xl overflow-hidden py-1 z-50 text-xs">
                {onExportSnapshot && (
                  <>
                    <button
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportSnapshot();
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-800 dark:text-stone-200 flex items-center justify-between font-semibold"
                    >
                      <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                        📦 Esporta Backup con Indice
                      </span>
                      <span className="text-[10px] font-mono text-amber-600">Snapshot</span>
                    </button>
                    <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />
                  </>
                )}
                {onExportChapter && (
                  <>
                    <button
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportChapter('md');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-between"
                    >
                      <span>Esporta Capitolo (.md)</span>
                      <span className="text-[10px] font-mono text-stone-400">Markdown</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportChapter('txt');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-between"
                    >
                      <span>Esporta Capitolo (.txt)</span>
                      <span className="text-[10px] font-mono text-stone-400">Testo puro</span>
                    </button>
                  </>
                )}
                {onExportManuscript && (
                  <>
                    <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />
                    <button
                      onClick={() => {
                        setIsExportOpen(false);
                        onExportManuscript('md');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-between font-medium"
                    >
                      <span>Tutto il Manoscritto (.md)</span>
                      <span className="text-[10px] font-mono text-indigo-500">Completo</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tema Scuro / Chiaro */}
        <button
          onClick={onThemeToggle}
          className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400"
          title="Alterna Tema Chiaro / Scuro"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Assistente AI ZenScribe */}
        <button
          onClick={onOpenAIPanel}
          className="flex items-center space-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors"
          title="Assistente AI (Locale + Cloud Multi-Provider)"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Assistente AI</span>
        </button>
      </div>
    </header>
  );
};
