import React, { useState, useEffect } from 'react';
import {
  Compass, User, MapPin, Bookmark, Plus, Trash2, X, Sparkles,
  Edit2, Copy, Check, Loader2, BookOpen, ChevronDown, ChevronUp
} from 'lucide-react';
import { GraphNode, creaNodo, eliminaNodo, ottieniMappaConcettuale, ottieniContestoNarrativo } from '../services/db';
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

export const WorldbuildingModal: React.FC<WorldbuildingModalProps> = ({
  isOpen,
  geminiApiKey,
  settings,
  onClose,
  onCreateChapterFromPlot,
  onOpenSettings,
}) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('personaggio');
  const [newDesc, setNewDesc] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generatore di trama con Gemini
  const [isPlotDrawerOpen, setIsPlotDrawerOpen] = useState(false);
  const [plotGuidance, setPlotGuidance] = useState('');
  const [isGeneratingPlot, setIsGeneratingPlot] = useState(false);
  const [generatedPlot, setGeneratedPlot] = useState('');
  const [plotError, setPlotError] = useState<string | null>(null);
  const [plotCopied, setPlotCopied] = useState(false);
  const [plotSavedFeedback, setPlotSavedFeedback] = useState<string | null>(null);

  const loadNodes = async () => {
    try {
      const map = await ottieniMappaConcettuale();
      setNodes(map.nodes);
    } catch (e) {
      console.warn('[Worldbuilding] Errore caricamento mappa:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNodes();
      setEditingNodeId(null);
      setNewName('');
      setNewDesc('');
      setPlotSavedFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
      await loadNodes();
    } catch (err) {
      console.error('[Worldbuilding] Errore salvataggio nodo:', err);
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
    if (!confirm(`Vuoi davvero eliminare la scheda "${name}"?`)) return;
    try {
      await eliminaNodo(id);
      if (editingNodeId === id) {
        handleCancelEdit();
      }
      await loadNodes();
    } catch (err) {
      console.error('[Worldbuilding] Errore eliminazione nodo:', err);
    }
  };

  // Generazione Trama tramite Cloud AI
  const handleGeneratePlot = async () => {
    const activeProvider = settings?.cloud?.activeProvider || 'gemini';
    const config = settings?.cloud?.providers[activeProvider];
    const hasKey = Boolean(config?.apiKey?.trim() || activeProvider === 'custom' || geminiApiKey?.trim());

    if (!hasKey) {
      setPlotError(`Per generare la trama serve configurare le API cloud (${activeProvider.toUpperCase()}). Apri le impostazioni.`);
      return;
    }

    const bibleContent = await ottieniContestoNarrativo();
    if (!bibleContent.trim()) {
      setPlotError("Aggiungi prima almeno un personaggio o un luogo nella Bibbia (o compila il profilo del romanzo)!");
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
      setPlotError(err.message || "Errore durante la generazione della trama.");
    } finally {
      setIsGeneratingPlot(false);
    }
  };

  // Salvataggio della trama generata come nuovo capitolo in SQLite
  const handleSavePlotAsChapter = async () => {
    if (!generatedPlot) return;
    if (onCreateChapterFromPlot) {
      const title = "Schema di Trama";
      const htmlContent = `<h1>${title}</h1><pre style="white-space: pre-wrap; font-family: inherit;">${generatedPlot.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
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
      await loadNodes();
      setPlotSavedFeedback("Trama archiviata tra le schede (Note) della Bibbia!");
      setTimeout(() => setPlotSavedFeedback(null), 3500);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredNodes = nodes.filter((n) => filterType === 'all' || n.type === filterType);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'personaggio': return <User className="w-3.5 h-3.5 text-indigo-500" />;
      case 'luogo': return <MapPin className="w-3.5 h-3.5 text-emerald-500" />;
      default: return <Bookmark className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in select-text">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/40 select-none">
          <div className="flex items-center space-x-2">
            <Compass className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                Bibbia del Romanzo & Personaggi
              </h3>
              <p className="text-[11px] text-stone-500">
                Schede su personaggi, luoghi e note. Puoi usarle per generare una trama completa con Gemini.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPlotDrawerOpen(!isPlotDrawerOpen)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors ${
                isPlotDrawerOpen
                  ? 'bg-indigo-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
              title="Genera trama a partire da queste schede con Gemini Cloud"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Genera Trama</span>
              {isPlotDrawerOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cassetto Generatore di Trama (Gemini) */}
        {isPlotDrawerOpen && (
          <div className="p-4 border-b border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-indigo-900 dark:text-indigo-200 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Generatore di Trama da Personaggi & Luoghi (Gemini Flash)</span>
              </span>
              {!geminiApiKey && onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 underline font-medium"
                >
                  Configura API Key Gemini
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Genere o indicazioni desiderate (es: Thriller psicologico cupo con finale a sorpresa)..."
                value={plotGuidance}
                onChange={(e) => setPlotGuidance(e.target.value)}
                className="flex-1 text-xs p-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleGeneratePlot}
                disabled={isGeneratingPlot}
                className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium disabled:opacity-50 transition-colors shadow-sm"
              >
                {isGeneratingPlot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isGeneratingPlot ? 'Elaborazione trama...' : 'Crea Trama'}</span>
              </button>
            </div>

            {plotError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300">
                {plotError}
              </div>
            )}

            {generatedPlot && (
              <div className="space-y-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40">
                <div className="flex items-center justify-between text-xs font-semibold text-stone-700 dark:text-stone-300">
                  <span>Proposta di Trama Strutturata:</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPlot);
                        setPlotCopied(true);
                        setTimeout(() => setPlotCopied(false), 2000);
                      }}
                      className="flex items-center space-x-1 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 text-xs"
                    >
                      {plotCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{plotCopied ? 'Copiato!' : 'Copia'}</span>
                    </button>
                    {onCreateChapterFromPlot && (
                      <button
                        onClick={handleSavePlotAsChapter}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white dark:bg-stone-800 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-medium"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>Crea Capitolo da Trama</span>
                      </button>
                    )}
                    <button
                      onClick={handleSavePlotAsNote}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium"
                    >
                      <Bookmark className="w-3 h-3" />
                      <span>Salva in Note</span>
                    </button>
                  </div>
                </div>

                {plotSavedFeedback && (
                  <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex items-center space-x-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>{plotSavedFeedback}</span>
                  </div>
                )}

                <div className="p-3 bg-white dark:bg-stone-900 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-xs leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-stone-800 dark:text-stone-200 shadow-inner">
                  {generatedPlot}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Aggiunta / Modifica Elemento */}
        <form
          onSubmit={handleSaveNode}
          className={`p-4 border-b border-stone-200 dark:border-stone-800 space-y-2 transition-colors ${
            editingNodeId
              ? 'bg-indigo-50/50 dark:bg-indigo-950/30'
              : 'bg-stone-50/30 dark:bg-stone-950/20'
          }`}
        >
          {editingNodeId && (
            <div className="flex items-center justify-between text-xs text-indigo-700 dark:text-indigo-300 font-medium pb-1">
              <span>Stai modificando una scheda esistente</span>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 underline text-[11px]"
              >
                Annulla modifica
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Nome (es. Elena, Fortezza Oscura)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="text-xs p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="text-xs p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none cursor-pointer"
            >
              <option value="personaggio">Personaggio</option>
              <option value="luogo">Luogo</option>
              <option value="oggetto">Oggetto / Fazione</option>
              <option value="nota">Nota di Trama</option>
            </select>
            <div className="flex items-center space-x-1.5">
              <button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-white text-xs font-medium shadow-sm disabled:opacity-50 transition-colors ${
                  editingNodeId
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {editingNodeId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editingNodeId ? 'Salva Modifiche' : 'Aggiungi Scheda'}</span>
              </button>
              {editingNodeId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400"
                  title="Annulla"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <input
            type="text"
            placeholder="Descrizione / Tratti chiave (es. Archeologa esperta di manufatti antichi, diffidente verso Marco)"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full text-xs p-2 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </form>

        {/* Filtri per tipo */}
        <div className="px-4 py-2 border-b border-stone-200 dark:border-stone-800 flex items-center space-x-2 text-xs select-none">
          <span className="text-stone-500 text-[11px]">Filtra:</span>
          {['all', 'personaggio', 'luogo', 'oggetto', 'nota'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                filterType === t
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              {t === 'all' ? 'Tutti' : t}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-stone-400">
            {filteredNodes.length} schede
          </span>
        </div>

        {/* Griglia Nodi */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          {filteredNodes.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-400 space-y-1 select-none">
              <Sparkles className="w-5 h-5 mx-auto text-stone-300 dark:text-stone-700" />
              <p>Nessuna scheda creata per questa categoria.</p>
              <p className="text-[10px]">Usa il modulo sopra per iniziare a popolare il tuo mondo narrativo!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredNodes.map((n) => {
                const isBeingEdited = editingNodeId === n.id;
                const isCopied = copiedId === n.id;

                return (
                  <div
                    key={n.id}
                    className={`p-3 rounded-lg border transition-all flex flex-col justify-between space-y-2 text-xs group ${
                      isBeingEdited
                        ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/40'
                        : 'border-stone-200 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-950/30 hover:border-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 font-semibold text-stone-900 dark:text-stone-100">
                          {getTypeIcon(n.type)}
                          <span className="select-text">{n.name}</span>
                        </div>

                        {/* Pulsanti azioni: Modifica, Copia, Elimina */}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                          <button
                            onClick={() => handleStartEdit(n)}
                            className="p-1 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            title="Modifica scheda (tipo, nome, descrizione)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleCopyText(n, e)}
                            className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                            title="Copia testo negli appunti"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(n.id, n.name)}
                            className="p-1 text-stone-400 hover:text-rose-600"
                            title="Elimina scheda"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {n.description && (
                        <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed select-text cursor-text">
                          {n.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-stone-200/50 dark:border-stone-800/50 select-none">
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider font-mono">
                        {n.type}
                      </span>
                      {isCopied && (
                        <span className="text-[10px] text-emerald-600 font-medium">Copiato!</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
