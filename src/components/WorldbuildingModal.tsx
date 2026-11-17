import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  User,
  MapPin,
  Bookmark,
  Plus,
  Trash2,
  X,
  Sparkles,
  Edit2,
  Copy,
  Check,
  Loader2,
  BookOpen,
  Network,
  Shield,
  ArrowRight,
  Link2,
  Search,
  Filter,
} from 'lucide-react';
import {
  GraphNode,
  GraphEdge,
  creaNodo,
  eliminaNodo,
  creaCollegamento,
  eliminaCollegamento,
  ottieniMappaConcettuale,
  ottieniContestoNarrativo,
} from '../services/db';
import { generatePlotFromBible } from '../services/geminiAi';
import { EditorSettings } from '../types';

interface WorldbuildingModalProps {
  isOpen: boolean;
  geminiApiKey?: string;
  settings?: EditorSettings;
  onClose: () => void;
  onCreateChapterFromPlot?: (title: string, content: string) => Promise<void>;
  onOpenSettings?: () => void;
}

const RELATION_PRESETS = [
  'Nemico / Rivale',
  'Alleato / Amico',
  'Parente / Famiglia',
  'Amante / Attrazione',
  'Mentore di',
  'Membro di',
  'Originario di',
  'Custode di',
  'Sospetta di',
  'Debitore di',
  'Traditore di',
];

export const WorldbuildingModal: React.FC<WorldbuildingModalProps> = ({
  isOpen,
  geminiApiKey,
  settings,
  onClose,
  onCreateChapterFromPlot,
  onOpenSettings,
}) => {
  // Navigazione a Schede Principali
  const [activeTab, setActiveTab] = useState<'nodes' | 'relations' | 'plot'>('nodes');

  // Mappa Concettuale (Nodi ed Archi da SQLite)
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);

  // Filtri e Ricerca Schede
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Creazione / Modifica Nodo
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('personaggio');
  const [newDesc, setNewDesc] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Creazione Collegamento / Relazione
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [relationFilterNodeId, setRelationFilterNodeId] = useState<string>('all');
  const [isSubmittingRelation, setIsSubmittingRelation] = useState(false);

  // Generatore di trama con Gemini Cloud
  const [plotGuidance, setPlotGuidance] = useState('');
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [generatedPlot, setGeneratedPlot] = useState('');
  const [plotError, setPlotError] = useState<string | null>(null);
  const [plotCopied, setPlotCopied] = useState(false);
  const [plotSavedFeedback, setPlotSavedFeedback] = useState<string | null>(null);

  // Caricamento completo da SQLite
  const loadMap = async () => {
    try {
      const map = await ottieniMappaConcettuale();
      setNodes(map.nodes || []);
      setEdges(map.edges || []);
    } catch (e) {
      console.warn('[Worldbuilding] Errore caricamento mappa concettuale:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMap();
      setEditingNodeId(null);
      setNewName('');
      setNewDesc('');
      setPlotSavedFeedback(null);
      setPlotError(null);
    }
  }, [isOpen]);

  // Lookup rapido per trovare un nodo dato il suo ID
  const nodeMap = useMemo(() => {
    const map = new Map<string, GraphNode>();
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);

  // Mappa delle relazioni associate a ciascun nodo (in entrata o in uscita)
  const nodeRelationsMap = useMemo(() => {
    const map = new Map<string, { outgoing: GraphEdge[]; incoming: GraphEdge[] }>();
    for (const n of nodes) {
      map.set(n.id, { outgoing: [], incoming: [] });
    }
    for (const e of edges) {
      const src = map.get(e.source);
      if (src) src.outgoing.push(e);
      const trg = map.get(e.target);
      if (trg) trg.incoming.push(e);
    }
    return map;
  }, [nodes, edges]);

  if (!isOpen) return null;

  // Gestione salvataggio / aggiornamento nodo
  const handleSaveNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    try {
      const id = editingNodeId || `node-${Date.now()}`;
      await creaNodo(id, newType, newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      setEditingNodeId(null);
      await loadMap();
    } catch (err) {
      console.error('[Worldbuilding] Errore salvataggio scheda:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (node: GraphNode) => {
    setEditingNodeId(node.id);
    setNewName(node.name);
    setNewType(node.type);
    setNewDesc(node.description);
  };

  const handleCancelEdit = () => {
    setEditingNodeId(null);
    setNewName('');
    setNewDesc('');
  };

  const handleCopyText = (node: GraphNode, e: React.MouseEvent) => {
    e.stopPropagation();
    const fullText = node.description ? `${node.name}: ${node.description}` : node.name;
    navigator.clipboard.writeText(fullText);
    setCopiedId(node.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Vuoi davvero eliminare la scheda "${name}" e tutti i collegamenti associati?`)) return;
    try {
      await eliminaNodo(id);
      if (editingNodeId === id) {
        handleCancelEdit();
      }
      await loadMap();
    } catch (err) {
      console.error('[Worldbuilding] Errore eliminazione scheda:', err);
    }
  };

  // Creazione collegamento orientato tra due entità
  const handleCreateRelation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSourceId || !selectedTargetId) return;
    if (selectedSourceId === selectedTargetId) {
      alert('Non puoi collegare un elemento a se stesso.');
      return;
    }

    const label = relationshipLabel.trim() || 'collegato a';
    setIsSubmittingRelation(true);
    try {
      const id = `edge-${Date.now()}`;
      await creaCollegamento(id, selectedSourceId, selectedTargetId, label);
      setRelationshipLabel('');
      await loadMap();
    } catch (err) {
      console.error('[Worldbuilding] Errore creazione collegamento:', err);
    } finally {
      setIsSubmittingRelation(false);
    }
  };

  // Eliminazione collegamento
  const handleDeleteRelation = async (id: string) => {
    try {
      await eliminaCollegamento(id);
      await loadMap();
    } catch (err) {
      console.error('[Worldbuilding] Errore eliminazione collegamento:', err);
    }
  };

  // Apertura rapida tab relazioni con nodo sorgente preselezionato
  const handleQuickConnect = (nodeId: string) => {
    setSelectedSourceId(nodeId);
    // Seleziona un bersaglio differente se disponibile
    const other = nodes.find((n) => n.id !== nodeId);
    if (other) setSelectedTargetId(other.id);
    setActiveTab('relations');
  };

  // Generazione Trama tramite Cloud AI
  const handleGeneratePlot = async () => {
    const activeProvider = settings?.cloud?.activeProvider || 'gemini';
    const config = settings?.cloud?.providers[activeProvider];
    const hasKey = Boolean(config?.apiKey?.trim() || activeProvider === 'custom' || geminiApiKey?.trim());

    if (!hasKey) {
      setPlotError(
        `Per generare la trama serve configurare le API cloud (${activeProvider.toUpperCase()}). Apri le impostazioni.`
      );
      return;
    }

    const bibleContent = await ottieniContestoNarrativo();
    if (!bibleContent.trim()) {
      setPlotError(
        'Aggiungi prima almeno un personaggio, fazione o luogo nella Bibbia (o compila il profilo del romanzo)!'
      );
      return;
    }

    setIsGeneratingPlot(true);
    setPlotError(null);
    setPlotSavedFeedback(null);

    try {
      const target = settings || geminiApiKey!;
      const plot = await generatePlotFromBible(target, bibleContent, plotGuidance);
      setGeneratedPlot(plot);
    } catch (err: any) {
      setPlotError(err.message || 'Errore durante la generazione della trama.');
    } finally {
      setIsGeneratingPlot(false);
    }
  };

  // Salvataggio della trama generata come nuovo capitolo in SQLite
  const handleSavePlotAsChapter = async () => {
    if (!generatedPlot) return;
    if (onCreateChapterFromPlot) {
      const title = 'Schema di Trama';
      const htmlContent = `<h1>${title}</h1><pre style="white-space: pre-wrap; font-family: inherit;">${generatedPlot
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}</pre>`;
      await onCreateChapterFromPlot(title, htmlContent);
      setPlotSavedFeedback("Trama salvata come nuovo capitolo nell'elenco capitoli!");
      setTimeout(() => setPlotSavedFeedback(null), 3500);
    }
  };

  // Salvataggio della trama come scheda 'nota' nella bibbia stessa
  const handleSavePlotAsNote = async () => {
    if (!generatedPlot) return;
    try {
      const id = `node-trama-${Date.now()}`;
      await creaNodo(id, 'nota', 'Trama Principale', generatedPlot);
      await loadMap();
      setPlotSavedFeedback('Trama archiviata tra le schede (Note) del Worldbuilding!');
      setTimeout(() => setPlotSavedFeedback(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper stile e icona per tipo di entità
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'personaggio':
        return {
          label: 'Personaggio',
          tagClass: 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900',
          icon: <User className="w-3.5 h-3.5 text-indigo-500" />,
        };
      case 'fazione':
        return {
          label: 'Fazione / Clan',
          tagClass: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900',
          icon: <Shield className="w-3.5 h-3.5 text-amber-500" />,
        };
      case 'luogo':
        return {
          label: 'Luogo',
          tagClass: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900',
          icon: <MapPin className="w-3.5 h-3.5 text-emerald-500" />,
        };
      case 'oggetto':
        return {
          label: 'Oggetto / Artefatto',
          tagClass: 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900',
          icon: <Bookmark className="w-3.5 h-3.5 text-purple-500" />,
        };
      case 'nota':
      default:
        return {
          label: 'Nota di Trama',
          tagClass: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-900',
          icon: <Sparkles className="w-3.5 h-3.5 text-sky-500" />,
        };
    }
  };

  // Filtraggio schede
  const filteredNodes = nodes.filter((n) => {
    const matchesType = filterType === 'all' || n.type === filterType;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q || n.name.toLowerCase().includes(q) || n.description.toLowerCase().includes(q);
    return matchesType && matchesQuery;
  });

  // Filtraggio relazioni
  const filteredEdges = edges.filter((e) => {
    if (relationFilterNodeId === 'all') return true;
    return e.source === relationFilterNodeId || e.target === relationFilterNodeId;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in select-text">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Principale */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-950/60 select-none">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                  Bibbia & Mappa Concettuale del Mondo
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-200/70 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-mono">
                  {nodes.length} schede • {edges.length} relazioni
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Costruisci personaggi, fazioni, luoghi e relazioni orientate. Il contesto arricchisce l'Assistente AI e il generatore di trama.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra di Navigazione Tab */}
        <div className="px-6 border-b border-stone-200 dark:border-stone-800 flex items-center space-x-1 bg-stone-100/40 dark:bg-stone-950/40 select-none text-xs">
          <button
            onClick={() => setActiveTab('nodes')}
            className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'nodes'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Schede del Mondo</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-stone-200/80 dark:bg-stone-800 text-[10px] font-mono">
              {nodes.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('relations')}
            className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'relations'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>Mappa Relazioni & Connessioni</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-md bg-stone-200/80 dark:bg-stone-800 text-[10px] font-mono">
              {edges.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('plot')}
            className={`flex items-center space-x-2 py-3 px-3.5 border-b-2 font-medium transition-colors ${
              activeTab === 'plot'
                ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Generatore Trama AI</span>
          </button>
        </div>

        {/* CONTENUTO TAB 1: SCHEDE DEL MONDO (NODI) */}
        {activeTab === 'nodes' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Form Aggiunta / Modifica Scheda */}
            <form
              onSubmit={handleSaveNode}
              className={`p-5 border-b border-stone-200 dark:border-stone-800 space-y-3 transition-colors ${
                editingNodeId ? 'bg-indigo-50/50 dark:bg-indigo-950/30' : 'bg-stone-50/40 dark:bg-stone-950/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center space-x-1.5">
                  {editingNodeId ? <Edit2 className="w-3.5 h-3.5 text-indigo-600" /> : <Plus className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>{editingNodeId ? 'Modifica Scheda Esistente' : 'Nuova Scheda del Mondo'}</span>
                </span>
                {editingNodeId && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline text-xs"
                  >
                    Annulla modifica
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  placeholder="Nome (es. Elena Vance, Fortezza di Nord, Clan Ombra)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="sm:col-span-2 text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none cursor-pointer"
                >
                  <option value="personaggio">👤 Personaggio</option>
                  <option value="fazione">🛡️ Fazione / Clan</option>
                  <option value="luogo">📍 Luogo</option>
                  <option value="oggetto">🔮 Oggetto / Artefatto</option>
                  <option value="nota">📜 Nota di Trama</option>
                </select>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="submit"
                    disabled={isSubmitting || !newName.trim()}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-xl text-white text-xs font-medium shadow-sm disabled:opacity-50 transition-colors ${
                      editingNodeId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'
                    }`}
                  >
                    {editingNodeId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{editingNodeId ? 'Salva Modifiche' : 'Aggiungi Scheda'}</span>
                  </button>
                  {editingNodeId && (
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-2.5 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
                      title="Annulla"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={2}
                placeholder="Descrizione, tratti psicologici, ruolo nella narrazione, segreti, motivazioni o lore..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </form>

            {/* Barra Filtri e Ricerca */}
            <div className="px-5 py-2.5 border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-2 select-none text-xs bg-stone-50/20 dark:bg-stone-950/10">
              <div className="flex items-center space-x-1.5">
                <Filter className="w-3.5 h-3.5 text-stone-400" />
                {[
                  { id: 'all', label: 'Tutti' },
                  { id: 'personaggio', label: 'Personaggi' },
                  { id: 'fazione', label: 'Fazioni' },
                  { id: 'luogo', label: 'Luoghi' },
                  { id: 'oggetto', label: 'Oggetti' },
                  { id: 'nota', label: 'Note' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setFilterType(t.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                      filterType === t.id
                        ? 'bg-indigo-600 text-white font-medium shadow-2xs'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200/60 dark:hover:bg-stone-800'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cerca schede..."
                  className="w-full pl-7 pr-3 py-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg text-xs text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Search className="w-3 h-3 text-stone-400 absolute left-2.5 top-2" />
              </div>
            </div>

            {/* Griglia Nodi */}
            <div className="p-5 flex-1 overflow-y-auto">
              {filteredNodes.length === 0 ? (
                <div className="p-12 text-center text-xs text-stone-400 space-y-2 select-none">
                  <Sparkles className="w-6 h-6 mx-auto text-stone-300 dark:text-stone-700" />
                  <p className="font-medium text-stone-600 dark:text-stone-300">Nessuna scheda trovata.</p>
                  <p className="text-[11px]">Usa il modulo in alto per iniziare a popolare il tuo mondo narrativo!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredNodes.map((n) => {
                    const badge = getTypeBadge(n.type);
                    const isBeingEdited = editingNodeId === n.id;
                    const isCopied = copiedId === n.id;
                    const rels = nodeRelationsMap.get(n.id) || { outgoing: [], incoming: [] };
                    const totalRels = rels.outgoing.length + rels.incoming.length;

                    return (
                      <div
                        key={n.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col justify-between space-y-3 text-xs group ${
                          isBeingEdited
                            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/40 shadow-sm'
                            : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/30 hover:border-stone-300 dark:hover:border-stone-700 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 font-semibold text-stone-900 dark:text-stone-100">
                              <span className="p-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200/50 dark:border-stone-700/50">
                                {badge.icon}
                              </span>
                              <span className="select-text text-sm">{n.name}</span>
                            </div>

                            {/* Azioni Scheda */}
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                              <button
                                onClick={() => handleQuickConnect(n.id)}
                                className="px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-[11px] font-medium flex items-center space-x-1"
                                title="Crea un collegamento/relazione partendo da questa scheda"
                              >
                                <Link2 className="w-3 h-3" />
                                <span>Connetti</span>
                              </button>
                              <button
                                onClick={() => handleStartEdit(n)}
                                className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                                title="Modifica scheda"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleCopyText(n, e)}
                                className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                                title="Copia negli appunti"
                              >
                                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDelete(n.id, n.name)}
                                className="p-1.5 rounded hover:bg-stone-200/60 dark:hover:bg-stone-800 text-stone-400 hover:text-rose-600"
                                title="Elimina scheda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {n.description ? (
                            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed select-text cursor-text line-clamp-4">
                              {n.description}
                            </p>
                          ) : (
                            <p className="text-[11px] text-stone-400 italic">Nessuna descrizione o dettaglio inserito.</p>
                          )}

                          {/* Sezione Relazioni Collegate in Miniatura */}
                          {totalRels > 0 && (
                            <div className="pt-2 border-t border-stone-200/60 dark:border-stone-800/60 space-y-1">
                              <span className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                                Connessioni ({totalRels}):
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {rels.outgoing.map((e) => {
                                  const targetNode = nodeMap.get(e.target);
                                  return (
                                    <span
                                      key={e.id}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-stone-200/60 dark:bg-stone-800/80 text-[10px] text-stone-700 dark:text-stone-300"
                                    >
                                      <span>──({e.label})──&gt;</span>
                                      <strong className="font-semibold">{targetNode?.name || e.target}</strong>
                                    </span>
                                  );
                                })}
                                {rels.incoming.map((e) => {
                                  const srcNode = nodeMap.get(e.source);
                                  return (
                                    <span
                                      key={e.id}
                                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-stone-200/60 dark:bg-stone-800/80 text-[10px] text-stone-600 dark:text-stone-400"
                                    >
                                      <strong className="font-medium">{srcNode?.name || e.source}</strong>
                                      <span>──({e.label})──&gt;</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-stone-200/40 dark:border-stone-800/40 select-none">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${badge.tagClass}`}
                          >
                            {badge.label}
                          </span>
                          {isCopied && <span className="text-[10px] text-emerald-600 font-medium">Copiato!</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENUTO TAB 2: MAPPA RELAZIONI & CONNESSIONI (ARCHI) */}
        {activeTab === 'relations' && (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Box Creazione Collegamento Orientato */}
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center space-x-1.5">
                  <Network className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Crea Collegamento / Relazione Narrativa</span>
                </span>
                <span className="text-[11px] text-stone-500">
                  I legami orientati consentono all'AI di comprendere rivalità, alleanze, luoghi d'origine e parentele.
                </span>
              </div>

              {nodes.length < 2 ? (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200">
                  Servono almeno 2 schede nel mondo per poter creare collegamenti. Passa a "Schede del Mondo" per aggiungere personaggi o luoghi.
                </div>
              ) : (
                <form onSubmit={handleCreateRelation} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-7 gap-2.5 items-center">
                    {/* Entità Sorgente */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Entità Origine</label>
                      <select
                        value={selectedSourceId}
                        onChange={(e) => setSelectedSourceId(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        required
                      >
                        <option value="">-- Seleziona Origine --</option>
                        {nodes.map((n) => (
                          <option key={n.id} value={n.id}>
                            [{n.type.slice(0, 4).toUpperCase()}] {n.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tipo / Etichetta Relazione */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Relazione / Ruolo</label>
                      <input
                        type="text"
                        placeholder="es. Nemico giurato, Mentore di, Custode di..."
                        value={relationshipLabel}
                        onChange={(e) => setRelationshipLabel(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        required
                      />
                    </div>

                    {/* Entità Destinazione */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] uppercase tracking-wider text-stone-400 mb-1">Entità Bersaglio</label>
                      <select
                        value={selectedTargetId}
                        onChange={(e) => setSelectedTargetId(e.target.value)}
                        className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        required
                      >
                        <option value="">-- Seleziona Bersaglio --</option>
                        {nodes
                          .filter((n) => n.id !== selectedSourceId)
                          .map((n) => (
                            <option key={n.id} value={n.id}>
                              [{n.type.slice(0, 4).toUpperCase()}] {n.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Preset Relazioni Rapide */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider mr-1">Preset Rapidi:</span>
                    {RELATION_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRelationshipLabel(preset)}
                        className="px-2 py-0.5 rounded-md bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-750 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-[11px] transition-colors"
                      >
                        {preset}
                      </button>
                    ))}

                    <button
                      type="submit"
                      disabled={isSubmittingRelation || !selectedSourceId || !selectedTargetId || !relationshipLabel.trim()}
                      className="ml-auto px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-40 transition-colors shadow-sm flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Crea Collegamento</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Filtro Relazioni per Entità */}
            <div className="px-5 py-2.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between text-xs bg-stone-50/20 dark:bg-stone-950/10">
              <div className="flex items-center space-x-2">
                <span className="text-stone-500 text-[11px]">Mostra connessioni di:</span>
                <select
                  value={relationFilterNodeId}
                  onChange={(e) => setRelationFilterNodeId(e.target.value)}
                  className="text-xs p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none cursor-pointer"
                >
                  <option value="all">Tutti ({edges.length})</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-[11px] text-stone-400">
                {filteredEdges.length} relazioni visualizzate
              </span>
            </div>

            {/* Lista Visuale Relazioni */}
            <div className="p-5 flex-1 overflow-y-auto space-y-2.5">
              {filteredEdges.length === 0 ? (
                <div className="p-12 text-center text-xs text-stone-400 space-y-2 select-none">
                  <Network className="w-6 h-6 mx-auto text-stone-300 dark:text-stone-700" />
                  <p className="font-medium text-stone-600 dark:text-stone-300">Nessuna connessione trovata.</p>
                  <p className="text-[11px]">Usa il modulo sopra per collegare personaggi, luoghi e fazioni!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredEdges.map((e) => {
                    const src = nodeMap.get(e.source);
                    const trg = nodeMap.get(e.target);
                    const srcBadge = src ? getTypeBadge(src.type) : null;
                    const trgBadge = trg ? getTypeBadge(trg.type) : null;

                    return (
                      <div
                        key={e.id}
                        className="p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 hover:border-stone-300 dark:hover:border-stone-700 transition-all flex items-center justify-between space-x-3 text-xs shadow-2xs group"
                      >
                        {/* Diagramma A -> B */}
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          {/* Nodo Origine */}
                          <div className="flex items-center space-x-1.5 p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 shrink-0">
                            {srcBadge?.icon}
                            <span className="font-semibold text-stone-900 dark:text-stone-100 max-w-[110px] truncate" title={src?.name || e.source}>
                              {src?.name || e.source}
                            </span>
                          </div>

                          {/* Connettore Relazione */}
                          <div className="flex-1 flex flex-col items-center min-w-[100px] px-1">
                            <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-indigo-900/60 truncate max-w-full text-center">
                              {e.label}
                            </span>
                            <div className="w-full flex items-center justify-center my-0.5">
                              <div className="h-[1.5px] bg-indigo-300 dark:bg-indigo-700 flex-1" />
                              <ArrowRight className="w-3.5 h-3.5 text-indigo-500 shrink-0 -ml-1" />
                            </div>
                          </div>

                          {/* Nodo Bersaglio */}
                          <div className="flex items-center space-x-1.5 p-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200/60 dark:border-stone-700/60 shrink-0">
                            {trgBadge?.icon}
                            <span className="font-semibold text-stone-900 dark:text-stone-100 max-w-[110px] truncate" title={trg?.name || e.target}>
                              {trg?.name || e.target}
                            </span>
                          </div>
                        </div>

                        {/* Pulsante Elimina Relazione */}
                        <button
                          onClick={() => handleDeleteRelation(e.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Elimina questo collegamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONTENUTO TAB 3: GENERATORE TRAMA AI */}
        {activeTab === 'plot' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Sintesi e Sviluppo Trama da Bibbia & Relazioni</span>
                </span>
                {!geminiApiKey && onOpenSettings && (
                  <button
                    onClick={onOpenSettings}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 underline font-medium hover:text-indigo-800"
                  >
                    Configura Chiave API
                  </button>
                )}
              </div>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                L'intelligenza artificiale analizzerà tutte le {nodes.length} schede create e le {edges.length} relazioni per suggerire un arco narrativo coerente, con conflitti fra personaggi, ostacoli e punti di svolta.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300">
                Direttive o indicazioni di trama (opzionale):
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Es. Thriller psicologico, finale agrodolce, tradimento di uno dei compagni..."
                  value={plotGuidance}
                  onChange={(e) => setPlotGuidance(e.target.value)}
                  className="flex-1 text-xs p-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  onClick={handleGeneratePlot}
                  disabled={isGeneratingPlot}
                  className="flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-50 transition-colors shadow-sm"
                >
                  {isGeneratingPlot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span>{isGeneratingPlot ? 'Generazione in corso...' : 'Genera Schema di Trama'}</span>
                </button>
              </div>
            </div>

            {plotError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
                {plotError}
              </div>
            )}

            {generatedPlot && (
              <div className="space-y-3 pt-3 border-t border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-800 dark:text-stone-200">
                  <span>Proposta di Trama Strutturata:</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPlot);
                        setPlotCopied(true);
                        setTimeout(() => setPlotCopied(false), 2000);
                      }}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-xs hover:bg-stone-50 dark:hover:bg-stone-750"
                    >
                      {plotCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{plotCopied ? 'Copiato!' : 'Copia'}</span>
                    </button>
                    {onCreateChapterFromPlot && (
                      <button
                        onClick={handleSavePlotAsChapter}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Crea Capitolo da Trama</span>
                      </button>
                    )}
                    <button
                      onClick={handleSavePlotAsNote}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium hover:bg-stone-50"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>Salva in Note Worldbuilding</span>
                    </button>
                  </div>
                </div>

                {plotSavedFeedback && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center space-x-2">
                    <Check className="w-4 h-4" />
                    <span>{plotSavedFeedback}</span>
                  </div>
                )}

                <div className="p-4 bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-stone-800 rounded-xl text-xs leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-stone-800 dark:text-stone-200 shadow-inner">
                  {generatedPlot}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
