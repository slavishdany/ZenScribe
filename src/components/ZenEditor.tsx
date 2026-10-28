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
  font: EditorFont;
  fontSize: number;
  lineHeight: number;
  width: EditorWidth;
  zenMode: boolean;
  onUpdateCounts: (words: number, characters: number) => void;
  onEditorReady: (editor: any) => void;
  onOpenAIWithSelection: (text: string) => void;
}

const DEFAULT_DOC = `
<h1>La Chiarezza delle Parole</h1>
<p>Inizia a scrivere qui. ZenScribe è un rifugio progettato per eliminare ogni distrazione e lasciare spazio unicamente al pensiero.</p>
<p>Seleziona qualsiasi frase per correggerla istantaneamente tramite il <strong>motore AI locale privato</strong> oppure per espanderla con <strong>Gemini Cloud</strong>.</p>
`;

export const ZenEditor: React.FC<ZenEditorProps> = ({
  initialContent,
  font,
  fontSize,
  lineHeight,
  width,
  zenMode,
  onUpdateCounts,
  onEditorReady,
  onOpenAIWithSelection,
}) => {
  const localSaved = localStorage.getItem('zenscribe_saved_document');
  const savedContent = localSaved || initialContent || DEFAULT_DOC;
  const dbSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      // Salvataggio automatico locale
      const html = editor.getHTML();
      localStorage.setItem('zenscribe_saved_document', html);

      // Salvataggio su SQLite con debounce, titolo ricavato dalla prima riga
      if (dbSaveTimer.current) clearTimeout(dbSaveTimer.current);
      dbSaveTimer.current = setTimeout(() => {
        const firstLine = editor.getText().split('\n').find((l) => l.trim() !== '') ?? '';
        const title = firstLine.trim().slice(0, 80) || 'Senza titolo';
        salvaCapitolo(MAIN_DOCUMENT_ID, title, html).catch((err) =>
          console.warn('[DB] Salvataggio capitolo non riuscito:', err)
        );
      }, DB_SAVE_DELAY_MS);
    },
  });

  // Se il salvataggio locale manca (es. dati del browser puliti) ripristina dal database
  useEffect(() => {
    if (!editor || localSaved) return;
    caricaCapitolo(MAIN_DOCUMENT_ID)
      .then((doc) => {
        if (doc && doc.content) editor.commands.setContent(doc.content);
      })
      .catch((err) => console.warn('[DB] Ripristino capitolo non riuscito:', err));
  }, [editor]);

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
