import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Sparkles,
  FileText,
  User,
  Shield,
  MapPin,
  Bookmark,
  Plus,
  Edit2,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Layers,
  BookOpen,
  Trash2,
} from 'lucide-react';
import { TabItem } from '../types';
import {
  GraphNode,
  ottieniMappaConcettuale,
  creaNodo,
  eliminaNodo,
  elencaCapitoli,
} from '../services/db';

interface GlossaryDrawerProps {
  isOpen: boolean;
  activeProjectId?: string;
  projectTitle?: string;
  tabs: TabItem[];
  activeTabId: string;
  allChapters: Array<{ id: string; title: string; content?: string }>;
  onClose: () => void;
  onSelectTab: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onDeleteChapter?: (chapterId: string) => void;
  onOpenPlotTab: () => void;
  onOpenChapter: (chapterId: string) => void;
  onCreateChapter: () => void;
  onOpenWorldbuilding: () => void;
  onInsertTextIntoEditor?: (text: string) => void;
}

export const GlossaryDrawer: React.FC<GlossaryDrawerProps> = ({
  isOpen,
  activeProjectId,
  projectTitle,
  tabs,
  activeTabId,
  allChapters,
  onClose,
  onSelectTab,
  onCloseTab,
  onDeleteChapter,
  onOpenPlotTab,
  onOpenChapter,
  onCreateChapter,
  onOpenWorldbuilding,
  onInsertTextIntoEditor,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'tabs' | 'chapters' | 'world'>('all');
  const [worldNodes, setWorldNodes] = useState<GraphNode[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modifica scheda rapida dentro il Glossario
  const [editingNode, setEditingNode] = useState<GraphNode | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('personaggio');
  const [editDesc, setEditDesc] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Caricamento nodi del worldbuilding da SQLite
  const loadWorldNodes = async () => {
    try {
      const map = await ottieniMappaConcettuale(activeProjectId);
      setWorldNodes(map.nodes || []);
    } catch (e) {
      console.warn('[GlossaryDrawer] Errore caricamento nodi:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWorldNodes();
    }
  }, [isOpen, activeProjectId]);

  // Chiudi con il tasto Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (editingNode) {
          setEditingNode(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingNode, onClose]);

  // Calcolo conteggio parole per ciascun capitolo
  const chapterWordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ch of allChapters) {
      if (!ch.content) {
        counts[ch.id] = 0;
        continue;
      }
      const text = ch.content.replace(/<[^>]*>/g, ' ');
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      counts[ch.id] = words;
    }
    return counts;
  }, [allChapters]);

  // Filtro ricerca
  const q = searchQuery.toLowerCase().trim();

  const filteredChapters = useMemo(() => {
    if (!q) return allChapters;
    return allChapters.filter((c) => c.title.toLowerCase().includes(q));
  }, [allChapters, q]);

  const filteredNodes = useMemo(() => {
    if (!q) return worldNodes;
    return worldNodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        (n.description && n.description.toLowerCase().includes(q)) ||
        n.type.toLowerCase().includes(q)
    );
  }, [worldNodes, q]);

  const handleCopy = (id: string, text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleStartEditNode = (node: GraphNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNode(node);
    setEditName(node.name);
    setEditType(node.type);
    setEditDesc(node.description || '');
  };

  const handleSaveNodeEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode || !editName.trim()) return;

    setIsSavingEdit(true);
    try {
      await creaNodo(
        editingNode.id,
        editType,
        editName.trim(),
        editDesc.trim(),
        editingNode.metadata || {},
        activeProjectId
      );
      setEditingNode(null);
      await loadWorldNodes();
    } catch (err) {
      console.error('[GlossaryDrawer] Errore salvataggio modifica:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteNode = async (id: string, name: string) => {
    if (!confirm(`Vuoi davvero eliminare la scheda "${name}" dal glossario?`)) return;
    try {
      await eliminaNodo(id);
      await loadWorldNodes();
    } catch (err) {
      console.error('[GlossaryDrawer] Errore eliminazione scheda:', err);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'personaggio':
        return <User className="w-3.5 h-3.5 text-indigo-500" />;
      case 'fazione':
        return <Shield className="w-3.5 h-3.5 text-amber-500" />;
      case 'luogo':
        return <MapPin className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Bookmark className="w-3.5 h-3.5 text-rose-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex select-none">
      {/* Sfondo sfumato per chiusura a click esterno */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Pannello Laterale Scorrevole */}
      <div className="relative w-84 sm:w-96 max-w-[90vw] h-full bg-white dark:bg-stone-900 border-r border-stone-200 dark:border-stone-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-left duration-250">
        {/* Intestazione Glossario */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-950/40">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                Glossario Schede &amp; Indice
              </h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-[200px]">
                {projectTitle || 'Navigazione rapida opera'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
            title="Chiudi glossario (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barra di Ricerca Veloce */}
        <div className="p-3 border-b border-stone-200/80 dark:border-stone-800/80 bg-stone-50/30 dark:bg-stone-950/20">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca schede, capitoli, personaggi..."
              className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filtro Categoria Rapido */}
          <div className="flex items-center space-x-1 mt-2.5 text-[11px] overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'Tutti' },
              { id: 'tabs', label: `Schede (${tabs.length})` },
              { id: 'chapters', label: `Capitoli (${allChapters.length})` },
              { id: 'world', label: `Mondo (${worldNodes.length})` },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as any)}
                className={`px-2.5 py-1 rounded-lg transition-all border ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 text-white font-medium border-indigo-600 shadow-sm'
                    : 'text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 bg-stone-100/70 dark:bg-stone-800/80 hover:bg-stone-200/80 dark:hover:bg-stone-700 border-stone-200/60 dark:border-stone-700/80'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Corpo Scorrevole con le Sezioni */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs select-text">
          {/* SEZIONE 1: SCHEDE APERTE NELL'EDITOR */}
          {(activeCategory === 'all' || activeCategory === 'tabs') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider px-1">
                <span className="flex items-center space-x-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Schede Attive ({tabs.length})</span>
                </span>
              </div>

              <div className="space-y-1.5">
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const isPlot = tab.type === 'plot';

                  return (
                    <div
                      key={tab.id}
                      onClick={() => {
                        onSelectTab(tab.id);
                        onClose();
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isActive
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-400 dark:border-indigo-600/80 font-semibold text-indigo-950 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-500/20'
                          : 'bg-stone-50/80 dark:bg-stone-800/60 border-stone-200/80 dark:border-stone-700/70 hover:bg-stone-100 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        {isPlot ? (
                          <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400 flex-shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-stone-400 dark:text-stone-400 flex-shrink-0" />
                        )}
                        <span className="truncate text-xs">{tab.title}</span>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-mono font-medium">
                            In uso
                          </span>
                        )}
                        {onCloseTab && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseTab(tab.id);
                            }}
                            className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Chiudi scheda"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SEZIONE 2: TRAMA & STRUTTURA NARRATIVA */}
          {(activeCategory === 'all' || activeCategory === 'tabs' || activeCategory === 'chapters') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider px-1">
                <span className="flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Struttura &amp; Canovaccio</span>
                </span>
              </div>

              <div
                onClick={() => {
                  onOpenPlotTab();
                  onClose();
                }}
                className="p-3 rounded-xl border border-indigo-200/90 dark:border-indigo-700/70 bg-gradient-to-r from-indigo-50/80 to-purple-50/60 dark:from-indigo-950/50 dark:to-purple-950/30 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-all group flex items-center justify-between shadow-2xs hover:shadow-xs"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-xs text-indigo-950 dark:text-indigo-100 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Trama &amp; Struttura Narrativa</span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-snug">
                    Apri la scheda scaletta con atti, svolte e sottotrame.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-indigo-500 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
              </div>
            </div>
          )}

          {/* SEZIONE 3: CAPITOLI DEL MANOSCRITTO */}
          {(activeCategory === 'all' || activeCategory === 'chapters') && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider px-1">
                <span className="flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-500 dark:text-stone-400" />
                  <span>Capitoli Manoscritto ({filteredChapters.length})</span>
                </span>
                <button
                  type="button"
                  onClick={onCreateChapter}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center space-x-0.5 normal-case font-medium text-[11px] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuovo</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {filteredChapters.map((ch, idx) => {
                  const words = chapterWordCounts[ch.id] || 0;
                  const isCurrent = ch.id === activeTabId;

                  return (
                    <div
                      key={ch.id}
                      onClick={() => {
                        onOpenChapter(ch.id);
                        onClose();
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all group ${
                        isCurrent
                          ? 'bg-stone-100 dark:bg-stone-800 border-indigo-400 dark:border-indigo-500 text-stone-900 dark:text-stone-100 font-semibold ring-1 ring-indigo-500/25 shadow-xs'
                          : 'bg-stone-50/70 dark:bg-stone-850/60 border-stone-200/80 dark:border-stone-700/60 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-800 dark:text-stone-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span className="text-[11px] text-stone-400 dark:text-stone-400 font-mono w-4 text-right">
                          {idx + 1}.
                        </span>
                        <span className="truncate text-xs text-stone-900 dark:text-stone-100 font-medium">
                          {ch.title}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-200/70 dark:bg-stone-700 text-stone-700 dark:text-stone-200 border border-stone-300/40 dark:border-stone-600/50 font-mono font-medium">
                          {words} p.
                        </span>
                        {onDeleteChapter && allChapters.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Vuoi davvero eliminare definitivamente "${ch.title}" dal romanzo?`)) {
                                onDeleteChapter(ch.id);
                              }
                            }}
                            className="p-1 rounded-md opacity-60 group-hover:opacity-100 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                            title="Elimina capitolo dal romanzo"
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

          {/* SEZIONE 4: GLOSSARIO DEL MONDO (PERSONAGGI, FAZIONI, LUOGHI) */}
          {(activeCategory === 'all' || activeCategory === 'world') && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 dark:text-stone-300 uppercase tracking-wider px-1">
                <span className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Glossario Personaggi &amp; Lore ({filteredNodes.length})</span>
                </span>
                <button
                  type="button"
                  onClick={onOpenWorldbuilding}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center space-x-1 normal-case font-medium text-[11px] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Studio</span>
                </button>
              </div>

              {filteredNodes.length === 0 ? (
                <div className="p-4 text-center text-xs text-stone-400 select-none bg-stone-50/50 dark:bg-stone-900/60 rounded-xl border border-dashed border-stone-200 dark:border-stone-700">
                  <p>Nessun elemento trovato nel glossario.</p>
                  <button
                    onClick={onOpenWorldbuilding}
                    className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline text-[11px] font-medium"
                  >
                    + Aggiungi scheda nello Studio Worldbuilding
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNodes.map((n) => {
                    const isCopied = copiedId === n.id;

                    return (
                      <div
                        key={n.id}
                        className="p-3 rounded-xl border border-stone-200/90 dark:border-stone-700/80 bg-stone-50/70 dark:bg-stone-850/80 hover:border-indigo-400 dark:hover:border-indigo-500/80 transition-all space-y-2 group shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 font-semibold text-stone-900 dark:text-stone-100 truncate text-xs">
                            {getNodeIcon(n.type)}
                            <span className="truncate">{n.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-stone-200/70 dark:bg-stone-700 text-stone-600 dark:text-stone-300 border border-stone-300/40 dark:border-stone-600/50 uppercase font-mono tracking-wider font-normal">
                              {n.type}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleStartEditNode(n, e)}
                              className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-indigo-600 dark:text-stone-300 dark:hover:text-indigo-400 transition-colors"
                              title="Modifica scheda"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) =>
                                handleCopy(
                                  n.id,
                                  n.description ? `${n.name}: ${n.description}` : n.name,
                                  e
                                )
                              }
                              className="p-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-500 hover:text-stone-800 dark:text-stone-300 dark:hover:text-white transition-colors"
                              title="Copia negli appunti"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNode(n.id, n.name);
                              }}
                              className="p-1 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Elimina scheda dal glossario"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {onInsertTextIntoEditor && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInsertTextIntoEditor(n.name);
                                  onClose();
                                }}
                                className="px-2 py-0.8 rounded-md text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/70 transition-all shadow-2xs"
                                title="Inserisci nome nell'editor di testo"
                              >
                                Inserisci
                              </button>
                            )}
                          </div>
                        </div>

                        {n.description && (
                          <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed line-clamp-3 select-text">
                            {n.description}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con scorciatoie */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-950/60 text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-between">
          <span>Tasto rapido: <strong className="text-stone-700 dark:text-stone-200">Ctrl+G</strong></span>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 underline"
          >
            Chiudi
          </button>
        </div>
      </div>

      {/* Dialog Modale Dedicato per Modifica Scheda Veloce dal Glossario */}
      {editingNode && (
        <div
          className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setEditingNode(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3.5 z-70 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-stone-200 dark:border-stone-800">
              <h3 className="font-semibold text-xs text-stone-900 dark:text-stone-100 flex items-center space-x-1.5">
                <Edit2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Modifica: {editingNode.name}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingNode(null)}
                className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveNodeEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  Nome Entità *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  Categoria
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none cursor-pointer"
                >
                  <option value="personaggio">👤 Personaggio</option>
                  <option value="fazione">🛡️ Fazione / Clan</option>
                  <option value="luogo">📍 Luogo</option>
                  <option value="oggetto">🔮 Oggetto / Artefatto</option>
                  <option value="nota">📜 Nota di Trama</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  Descrizione &amp; Lore
                </label>
                <textarea
                  rows={4}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Dettagli, tratti psicologici, ruolo nella narrazione..."
                  className="w-full text-xs p-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setEditingNode(null)}
                  className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit || !editName.trim()}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm flex items-center space-x-1"
                >
                  <Check className="w-3 h-3" />
                  <span>Salva</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
