import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold, Italic, Heading1, Heading2, Heading3,
  Quote, List, ListOrdered, Undo, Redo,
  Sparkles, Sun, Moon, Type, Maximize2,
  BookOpen, Compass
} from 'lucide-react';
import { EditorFont, EditorWidth } from '../types';

interface EditorToolbarProps {
  editor: Editor | null;
  font: EditorFont;
  width: EditorWidth;
  theme: 'light' | 'dark' | 'system';
  zenMode: boolean;
  onFontChange: (font: EditorFont) => void;
  onWidthChange: (width: EditorWidth) => void;
  onThemeToggle: () => void;
  onOpenAIPanel: () => void;
  onToggleChapters?: () => void;
  onOpenWorldbuilding?: () => void;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  font,
  width,
  theme,
  zenMode,
  onFontChange,
  onWidthChange,
  onThemeToggle,
  onOpenAIPanel,
  onToggleChapters,
  onOpenWorldbuilding,
}) => {
  if (!editor) return null;

  return (
    <header className={`px-4 py-2 border-b border-stone-200/80 dark:border-stone-800/80 bg-zen-bg/90 dark:bg-zen-darkBg/90 backdrop-blur-md flex items-center justify-between transition-all duration-300 z-10 ${
      zenMode ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
    }`}>
      {/* Brand & Strumenti Formattazione */}
      <div className="flex items-center space-x-1 sm:space-x-2">
        {onToggleChapters && (
          <button
            onClick={onToggleChapters}
            className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300 flex items-center space-x-1 text-xs font-medium"
            title="Sfoglia Capitoli (SQLite)"
          >
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline">Capitoli</span>
          </button>
        )}

        {onOpenWorldbuilding && (
          <button
            onClick={onOpenWorldbuilding}
            className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300 flex items-center space-x-1 text-xs font-medium"
            title="Bibbia del Romanzo: Personaggi e Luoghi (SQLite)"
          >
            <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden md:inline">Personaggi</span>
          </button>
        )}

        <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-1"></div>

        <span className="font-serif font-bold text-sm tracking-tight mr-1 text-stone-800 dark:text-stone-200 select-none">
          ZenScribe
        </span>

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
      <div className="flex items-center space-x-2">
        {/* Scelta Font */}
        <div className="flex items-center bg-stone-200/50 dark:bg-stone-800/50 rounded p-0.5 text-xs">
          <button
            onClick={() => onFontChange('serif')}
            className={`px-2 py-1 rounded font-serif ${
              font === 'serif' ? 'bg-white dark:bg-stone-700 shadow-sm font-semibold' : 'opacity-70'
            }`}
            title="Carattere Serif (Merriweather)"
          >
            Serif
          </button>
          <button
            onClick={() => onFontChange('sans')}
            className={`px-2 py-1 rounded font-sans ${
              font === 'sans' ? 'bg-white dark:bg-stone-700 shadow-sm font-semibold' : 'opacity-70'
            }`}
            title="Carattere Sans-Serif (Inter)"
          >
            Sans
          </button>
          <button
            onClick={() => onFontChange('mono')}
            className={`px-2 py-1 rounded font-mono ${
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
          className="text-xs bg-stone-200/50 dark:bg-stone-800/50 border-none rounded px-2 py-1 text-stone-700 dark:text-stone-300 focus:outline-none cursor-pointer"
          title="Larghezza Foglio di Scrittura"
        >
          <option value="narrow">Stretto (65ch)</option>
          <option value="medium">Standard (80ch)</option>
          <option value="wide">Largo (100ch)</option>
          <option value="full">Piena Larghezza</option>
        </select>

        {/* Tema Scuro / Chiaro */}
        <button
          onClick={onThemeToggle}
          className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-600 dark:text-stone-400"
          title="Alterna Tema Chiaro / Scuro"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Assistente AI ZenScribe */}
        <button
          onClick={onOpenAIPanel}
          className="flex items-center space-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded shadow-sm transition-colors"
          title="Assistente AI (Locale + Cloud)"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Assistente AI</span>
        </button>
      </div>
    </header>
  );
};
