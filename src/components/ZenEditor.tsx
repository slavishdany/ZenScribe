import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
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
}) => {
  const localSaved = localStorage.getItem(`zenscribe_saved_${activeChapterId}`);
  const savedContent = localSaved || initialContent || DEFAULT_DOC;
  const dbSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentChapterRef = useRef(activeChapterId);

  currentChapterRef.current = activeChapterId;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
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
  }, [editor, onOpenAIWithSelection]);

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
    <main className={`flex-1 overflow-y-auto px-6 sm:px-12 py-10 sm:py-16 flex justify-center transition-all duration-300 ${
      zenMode ? 'py-16 sm:py-24' : ''
    }`}>
      <div
        className={`w-full ${getWidthClass(width)} ${getFontFamily(font)} transition-all duration-200`}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: lineHeight,
        }}
      >
        <EditorContent editor={editor} />
      </div>
    </main>
  );
};
