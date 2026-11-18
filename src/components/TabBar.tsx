import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Bookmark,
  Plus,
  X,
  BookOpen,
  ChevronDown,
  Layers,
  Sparkles,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { TabItem } from '../types';

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  isVisible: boolean;
  isGlossaryOpen: boolean;
  allChapters?: Array<{ id: string; title: string }>;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs?: (keepTabId: string) => void;
  onDeleteChapter?: (chapterId: string) => void;
  onOpenPlotTab: () => void;
  onOpenNewChapter: () => void;
  onOpenChapter: (chapterId: string) => void;
  onToggleGlossary: () => void;
  onToggleVisibility: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  isVisible,
  isGlossaryOpen,
  allChapters = [],
  onSelectTab,
  onCloseTab,
  onCloseOtherTabs,
  onDeleteChapter,
  onOpenPlotTab,
  onOpenNewChapter,
  onOpenChapter,
  onToggleGlossary,
  onToggleVisibility,
}) => {
  // Menu a comparsa per il pulsante "+" (posizionato in modo fisso per evitare clipping da overflow)
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const plusButtonRef = useRef<HTMLButtonElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);

  // Menu contestuale al clic col tasto destro sulla scheda
  const [contextMenu, setContextMenu] = useState<{ tab: TabItem; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Chiude i menu aperti cliccando all'esterno o premendo Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isPlusMenuOpen &&
        plusMenuRef.current &&
        !plusMenuRef.current.contains(e.target as Node) &&
        plusButtonRef.current &&
        !plusButtonRef.current.contains(e.target as Node)
      ) {
        setIsPlusMenuOpen(false);
      }

      if (
        contextMenu &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPlusMenuOpen(false);
        setContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlusMenuOpen, contextMenu]);

  // Apertura menu a discesa per altre opzioni scheda con coordinate assolute non clippate
  const handleTogglePlusMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlusMenuOpen) {
      setIsPlusMenuOpen(false);
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuCoords({
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 260),
    });
    setIsPlusMenuOpen(true);
  };

  const handleTabContextMenu = (e: React.MouseEvent, tab: TabItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      tab,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 150),
    });
  };

  // Se la barra delle schede è nascosta, mostriamo un sottile trigger a scomparsa
  if (!isVisible) {
    return (
      <div className="flex items-center justify-between px-4 py-0.5 bg-transparent select-none z-10 transition-all duration-200">
        <button
          onClick={onToggleVisibility}
          className="group flex items-center space-x-1.5 py-0.5 px-2.5 rounded-full text-[11px] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 transition-all border border-stone-200/70 dark:border-stone-700/80 shadow-2xs"
          title="Mostra la Barra delle Schede (Ctrl+Alt+T)"
        >
          <Layers className="w-3 h-3 text-indigo-500 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
          <span>Schede di lavoro ({tabs.length})</span>
          <ChevronDown className="w-2.5 h-2.5 opacity-70" />
        </button>

        <button
          onClick={onToggleGlossary}
          className={`flex items-center space-x-1 py-0.5 px-2.5 rounded-full text-[11px] transition-colors border shadow-2xs ${
            isGlossaryOpen
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 border-stone-200/70 dark:border-stone-700/80'
          }`}
          title="Apri il Glossario Schede (Ctrl+G)"
        >
          <BookOpen className="w-3 h-3" />
          <span>Glossario</span>
        </button>
      </div>
    );
  }

  // Capitoli non ancora aperti nelle schede
  const unOpenedChapters = allChapters.filter(
    (ch) => !tabs.some((t) => t.id === ch.id)
  );

  const isPlotOpen = tabs.some((t) => t.type === 'plot');

  return (
    <div className="border-b border-stone-200/80 dark:border-stone-800 bg-stone-50/90 dark:bg-stone-950/80 px-3 pt-1 flex items-center justify-between gap-2 select-none z-10 transition-all duration-200">
      {/* Lista Schede Orizzontale Scorrevole */}
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar flex-1 py-0.5">
        {tabs.length === 0 ? (
          <div className="py-1 px-2 text-xs text-stone-400 italic flex items-center space-x-2">
            <span>Nessuna scheda aperta.</span>
            <button
              onClick={onOpenNewChapter}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium not-italic"
            >
              + Nuovo Capitolo
            </button>
          </div>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const isPlot = tab.type === 'plot';
            const isWorld = tab.type === 'world';

            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                onContextMenu={(e) => handleTabContextMenu(e, tab)}
                className={`group relative flex items-center space-x-1.5 py-1.5 px-3 rounded-t-lg text-xs cursor-pointer transition-all border-t-2 border-x border-b-0 ${
                  isActive
                    ? 'bg-white dark:bg-stone-850 text-stone-900 dark:text-stone-50 font-semibold border-t-indigo-600 dark:border-t-indigo-400 border-x-stone-200 dark:border-x-stone-750 shadow-2xs z-1'
                    : 'bg-transparent text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200 border-transparent hover:bg-stone-200/50 dark:hover:bg-stone-800/60'
                }`}
                title={`${tab.title} (tasto destro per opzioni)`}
              >
                {isPlot ? (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                ) : isWorld ? (
                  <Bookmark className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-stone-400 dark:text-stone-400 flex-shrink-0" />
                )}

                <span className="truncate max-w-[130px] sm:max-w-[180px]">
                  {tab.title}
                </span>

                {/* Pulsante Chiusura Scheda: SEMPRE VISIBILE E ATTIVO */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 ml-1 rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  title="Chiudi scheda"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}

        {/* Pulsante Più (+) con Creazione Immediata & Menu Opzioni non clippato */}
        <div className="flex items-center rounded-lg bg-stone-200/50 dark:bg-stone-800/60 border border-stone-200/80 dark:border-stone-700/60 p-0.5 ml-1 flex-shrink-0">
          <button
            type="button"
            onClick={onOpenNewChapter}
            className="flex items-center space-x-1 px-2 py-0.5 rounded text-stone-700 dark:text-stone-200 hover:bg-white dark:hover:bg-stone-700 text-xs font-medium transition-colors"
            title="Crea subito un Nuovo Capitolo"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden sm:inline text-[11px]">Capitolo</span>
          </button>

          <button
            ref={plusButtonRef}
            type="button"
            onClick={handleTogglePlusMenu}
            className="p-1 rounded text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-white hover:bg-white dark:hover:bg-stone-700 transition-colors"
            title="Altre schede da aprire (Trama, Capitoli esistenti)"
          >
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Pulsanti Azioni Destra: Glossario e Nascondi Barra */}
      <div className="flex items-center space-x-1.5 flex-shrink-0 pb-1">
        <button
          onClick={onToggleGlossary}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            isGlossaryOpen
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100'
          }`}
          title="Glossario delle Schede &amp; Indice del Mondo (Ctrl+G)"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Glossario</span>
        </button>

        <button
          onClick={onToggleVisibility}
          className="p-1 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors"
          title="Nascondi barra schede per massima pulizia visiva (Ctrl+Alt+T)"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Menu a comparsa NON CLIPPATO per il pulsante "+" (posizionamento fixed) */}
      {isPlusMenuOpen && menuCoords && (
        <div
          ref={plusMenuRef}
          style={{ top: menuCoords.top, left: menuCoords.left }}
          className="fixed w-64 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden py-1 z-[9999] text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Opzione Nuovo Capitolo */}
          <button
            onClick={() => {
              setIsPlusMenuOpen(false);
              onOpenNewChapter();
            }}
            className="w-full text-left px-3 py-2 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200 flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Nuovo Capitolo</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">+ Crea</span>
          </button>

          {/* Opzione Trama */}
          <button
            onClick={() => {
              setIsPlusMenuOpen(false);
              onOpenPlotTab();
            }}
            className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-stone-800 dark:text-stone-200 flex items-center justify-between font-medium group"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Trama &amp; Struttura</span>
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
              {isPlotOpen ? 'Vai a' : 'Apri'}
            </span>
          </button>

          {/* Capitoli esistenti da aprire */}
          {unOpenedChapters.length > 0 && (
            <>
              <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />
              <div className="px-3 py-1 text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                Apri capitolo in scheda:
              </div>
              <div className="max-h-48 overflow-y-auto">
                {unOpenedChapters.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setIsPlusMenuOpen(false);
                      onOpenChapter(ch.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center space-x-2 truncate"
                  >
                    <FileText className="w-3 h-3 text-stone-400 flex-shrink-0" />
                    <span className="truncate">{ch.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Menu Contestuale (Tasto Destro sulla Scheda) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed w-56 bg-white dark:bg-stone-850 border border-stone-200 dark:border-stone-700 rounded-xl shadow-2xl overflow-hidden py-1 z-[9999] text-xs animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider truncate border-b border-stone-100 dark:border-stone-800 mb-1">
            {contextMenu.tab.title}
          </div>

          <button
            onClick={() => {
              onCloseTab(contextMenu.tab.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center space-x-2"
          >
            <X className="w-3.5 h-3.5 text-stone-400" />
            <span>Chiudi scheda</span>
          </button>

          {tabs.length > 1 && onCloseOtherTabs && (
            <button
              onClick={() => {
                onCloseOtherTabs(contextMenu.tab.id);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center space-x-2"
            >
              <Layers className="w-3.5 h-3.5 text-stone-400" />
              <span>Chiudi le altre schede</span>
            </button>
          )}

          {contextMenu.tab.type === 'chapter' && onDeleteChapter && (
            <>
              <div className="h-px bg-stone-100 dark:bg-stone-800 my-1" />
              <button
                onClick={() => {
                  const toDelete = contextMenu.tab;
                  setContextMenu(null);
                  if (confirm(`Vuoi davvero eliminare definitivamente "${toDelete.title}" dal romanzo?`)) {
                    onDeleteChapter(toDelete.id);
                  }
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center space-x-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Elimina capitolo dal romanzo</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
