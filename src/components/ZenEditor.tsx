import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Search, Replace, ChevronUp, ChevronDown, X, Layers } from 'lucide-react';
import { EditorFont, EditorWidth } from '../types';
import { salvaCapitolo, caricaCapitolo } from '../services/db';

const MAIN_DOCUMENT_ID = 'capitolo-principale';
const DB_SAVE_DELAY_MS = 800;

interface ZenEditorProps {
  initialContent?: string;
  activeChapterId?: string;
  font: EditorFont;
  fontSize: number;
  lineHeight: number;
  width: EditorWidth;
  zenMode: boolean;
  onUpdateCounts: (words: number, characters: number) => void;
  onEditorReady: (editor: any) => void;
  onOpenAIWithSelection: (text: string) => void;
  onChapterSaved?: () => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
  onCloseSearch?: () => void;
}

const DEFAULT_DOC = `
<h1>La Chiarezza delle Parole</h1>
<p>Inizia a scrivere qui. ZenScribe è un rifugio progettato per eliminare ogni distrazione e lasciare spazio unicamente al pensiero.</p>
<p>Seleziona qualsiasi frase per correggerla istantaneamente tramite il <strong>motore AI locale privato</strong> oppure per espanderla con <strong>Gemini Cloud</strong>.</p>
`;

export const ZenEditor: React.FC<ZenEditorProps> = ({
  initialContent,
  activeChapterId = MAIN_DOCUMENT_ID,
  font,
  fontSize,
  lineHeight,
  width,
  zenMode,
  onUpdateCounts,
  onEditorReady,
  onOpenAIWithSelection,
  onChapterSaved,
  isSearchOpen: externalIsSearchOpen,
  onToggleSearch,
  onCloseSearch,
}) => {
  const localSaved = localStorage.getItem(`zenscribe_saved_${activeChapterId}`);
  const savedContent = localSaved || initialContent || DEFAULT_DOC;
  const dbSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentChapterRef = useRef(activeChapterId);

  currentChapterRef.current = activeChapterId;

  // Stato barra fluttuante Trova e Sostituisci
  const [internalIsSearchOpen, setInternalIsSearchOpen] = useState(false);
  const isSearchOpen = externalIsSearchOpen !== undefined ? externalIsSearchOpen : internalIsSearchOpen;

  const handleToggleSearch = () => {
    if (onToggleSearch) {
      onToggleSearch();
    } else {
      setInternalIsSearchOpen((prev) => !prev);
    }
  };

  const handleCloseSearch = () => {
    if (onCloseSearch) {
      onCloseSearch();
    } else {
      setInternalIsSearchOpen(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isSearchOpen]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        horizontalRule: {},
      }),
      Underline,
      Highlight.configure({
        multicolor: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Scrivi la tua storia...',
      }),
      CharacterCount,
    ],
    content: savedContent,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[75vh]',
      },
    },
    onUpdate: ({ editor }) => {
      const words = editor.storage.characterCount.words();
      const chars = editor.storage.characterCount.characters();
      onUpdateCounts(words, chars);

      const html = editor.getHTML();
      const chapId = currentChapterRef.current;
      localStorage.setItem(`zenscribe_saved_${chapId}`, html);

      // Salvataggio su SQLite con debounce
      if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current);
      dbSaveTimer.current = setTimeout(() => {
        const firstLine = editor.getText().split('\n').find((l) => l.trim() !== '') ?? '';
        const title = firstLine.trim().slice(0, 80) || 'Senza titolo';
        salvaCapitolo(chapId, title, html)
          .then(() => onChapterSaved?.())
          .catch((err) => console.warn('[DB] Salvataggio capitolo non riuscito:', err));
      }, DB_SAVE_DELAY_MS);
    },
  });

  // Trova occorrenze della query nel documento ProseMirror
  const getMatches = useCallback(() => {
    if (!editor || !searchTerm.trim()) return [];
    const query = searchTerm.toLowerCase();
    const doc = editor.state.doc;
    const matches: Array<{ from: number; to: number }> = [];

    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        let idx = node.text.toLowerCase().indexOf(query);
        while (idx !== -1) {
          matches.push({
            from: pos + idx,
            to: pos + idx + query.length,
          });
          idx = node.text.toLowerCase().indexOf(query, idx + 1);
        }
      }
    });

    return matches;
  }, [editor, searchTerm]);

  // Aggiorna totale match quando cambia il testo cercato
  useEffect(() => {
    const matches = getMatches();
    setTotalMatches(matches.length);
    if (matches.length > 0) {
      if (currentMatchIndex >= matches.length) {
        setCurrentMatchIndex(0);
      }
      const m = matches[0];
      editor?.chain().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
    } else {
      setCurrentMatchIndex(0);
    }
  }, [searchTerm, getMatches]);

  const handleNextMatch = () => {
    const matches = getMatches();
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    const m = matches[nextIdx];
    editor?.chain().focus().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  };

  const handlePrevMatch = () => {
    const matches = getMatches();
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    const m = matches[prevIdx];
    editor?.chain().focus().setTextSelection({ from: m.from, to: m.to }).scrollIntoView().run();
  };

  const handleReplaceCurrent = () => {
    if (!editor || !searchTerm.trim()) return;
    const matches = getMatches();
    if (matches.length === 0) return;
    const m = matches[currentMatchIndex] || matches[0];
    editor
      .chain()
      .focus()
      .setTextSelection({ from: m.from, to: m.to })
      .insertContent(replaceTerm)
      .run();

    setTimeout(() => {
      const next = getMatches();
      setTotalMatches(next.length);
      if (currentMatchIndex >= next.length) {
        setCurrentMatchIndex(Math.max(0, next.length - 1));
      }
      if (next.length > 0) {
        const nextMatch = next[Math.min(currentMatchIndex, next.length - 1)];
        editor.chain().setTextSelection({ from: nextMatch.from, to: nextMatch.to }).scrollIntoView().run();
      }
    }, 50);
  };

  const handleReplaceAll = () => {
    if (!editor || !searchTerm.trim()) return;
    const matches = getMatches();
    if (matches.length === 0) return;

    const rev = [...matches].reverse();
    editor.chain().focus().command(({ tr }) => {
      for (const m of rev) {
        tr.replaceWith(m.from, m.to, editor.schema.text(replaceTerm));
      }
      return true;
    }).run();

    setTotalMatches(0);
    setCurrentMatchIndex(0);
  };

  // Carica il contenuto quando cambia il capitolo attivo
  useEffect(() => {
    if (!editor || !activeChapterId) return;
    caricaCapitolo(activeChapterId)
      .then((doc) => {
        if (doc && doc.content) {
          editor.commands.setContent(doc.content);
        } else {
          editor.commands.setContent(`<h1>Nuovo Capitolo</h1><p></p>`);
        }
      })
      .catch((err) => console.warn('[DB] Caricamento capitolo non riuscito:', err));
  }, [editor, activeChapterId]);

  // Evita un salvataggio pendente dopo lo smontaggio del componente
  useEffect(() => {
    return () => {
      if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current);
    };
  }, []);

  useEffect(() => {
    if (editor) {
      onEditorReady(editor);
      onUpdateCounts(
        editor.storage.characterCount.words(),
        editor.storage.characterCount.characters()
      );
    }
  }, [editor]);

  // Gestione scorciatoie da tastiera globali dell'editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F: Apri barra Trova e Sostituisci
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleSearch();
      }

      // Ctrl+U: Sottolineato
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        editor?.chain().focus().toggleUnderline().run();
      }

      // Esc: Chiudi ricerca
      if (e.key === 'Escape' && isSearchOpen) {
        handleCloseSearch();
        editor?.commands.focus();
      }

      // Ctrl+J / Cmd+J: Apri Assistente AI per il testo selezionato o intero paragrafo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (editor) {
          const { from, to } = editor.state.selection;
          const selectedText = editor.state.doc.textBetween(from, to, ' ');
          onOpenAIWithSelection(selectedText || editor.getText());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, isSearchOpen, onOpenAIWithSelection, handleToggleSearch, handleCloseSearch]);

  // Classi ampiezza foglio
  const getWidthClass = (w: EditorWidth) => {
    switch (w) {
      case 'narrow': return 'max-w-[65ch]';
      case 'medium': return 'max-w-[80ch]';
      case 'wide': return 'max-w-[100ch]';
      case 'full': return 'max-w-4xl';
      default: return 'max-w-[80ch]';
    }
  };

  // Famiglia di font
  const getFontFamily = (f: EditorFont) => {
    switch (f) {
      case 'serif': return 'font-serif';
      case 'sans': return 'font-sans';
      case 'mono': return 'font-mono';
      default: return 'font-serif';
    }
  };

  return (
    <main className={`flex-1 overflow-y-auto px-4 sm:px-12 py-6 sm:py-16 flex justify-center transition-all duration-300 relative ${
      zenMode ? 'py-10 sm:py-24' : ''
    }`}>
      {/* Barra Fluttuante Trova e Sostituisci */}
      {isSearchOpen && (
        <div className="absolute top-3 right-4 sm:right-10 z-30 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl p-3 flex flex-col space-y-2 animate-fade-in w-72 sm:w-88 text-xs select-none">
          <div className="flex items-center space-x-1.5">
            <div className="relative flex-1">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (e.shiftKey) handlePrevMatch();
                    else handleNextMatch();
                  }
                }}
                placeholder="Trova nel capitolo..."
                className="w-full pl-7 pr-16 py-1.5 bg-stone-100 dark:bg-stone-800 border-none rounded-xl text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
              <span className="text-[10px] text-stone-400 absolute right-2.5 top-2 font-mono">
                {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : '0'}
              </span>
            </div>
            <button
              onClick={handlePrevMatch}
              disabled={totalMatches === 0}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-stone-600 dark:text-stone-300 transition-colors"
              title="Precedente (Shift+Enter)"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMatch}
              disabled={totalMatches === 0}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-stone-600 dark:text-stone-300 transition-colors"
              title="Successivo (Enter)"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              onClick={handleCloseSearch}
              className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
              title="Chiudi (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <div className="relative flex-1">
              <input
                type="text"
                value={replaceTerm}
                onChange={(e) => setReplaceTerm(e.target.value)}
                placeholder="Sostituisci con..."
                className="w-full pl-7 pr-2 py-1.5 bg-stone-100 dark:bg-stone-800 border-none rounded-xl text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Replace className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
            </div>
            <button
              onClick={handleReplaceCurrent}
              disabled={totalMatches === 0}
              className="px-2.5 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 rounded-xl text-[11px] font-medium disabled:opacity-30 transition-colors shadow-2xs"
              title="Sostituisci occorrenza attiva"
            >
              Sostituisci
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={totalMatches === 0}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-medium disabled:opacity-30 transition-colors shadow-2xs"
              title="Sostituisci tutte le occorrenze"
            >
              Tutti
            </button>
          </div>
        </div>
      )}

      <div
        className={`w-full ${getWidthClass(width)} ${getFontFamily(font)} transition-all duration-200`}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: lineHeight,
        }}
      >
        {!activeChapterId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none space-y-3 max-w-sm mx-auto my-auto animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Nessuna scheda aperta</h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tutte le schede sono state chiuse. Usa il pulsante <strong>+</strong> in alto per aprire un capitolo oppure consulta il <strong>Glossario</strong> (Ctrl+G).
              </p>
            </div>
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </main>
  );
};
