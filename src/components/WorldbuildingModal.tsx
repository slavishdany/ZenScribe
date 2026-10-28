import React, { useState, useEffect } from 'react';
import { Compass, User, MapPin, Bookmark, Plus, Trash2, X, Sparkles, Edit2, Copy, Check } from 'lucide-react';
import { GraphNode, creaNodo, eliminaNodo, ottieniMappaConcettuale } from '../services/db';

interface WorldbuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorldbuildingModal: React.FC<WorldbuildingModalProps> = ({ isOpen, onClose }) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('personaggio');
  const [newDesc, setNewDesc] = useState('');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-950/40 select-none">
          <div className="flex items-center space-x-2">
            <Compass className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div>
              <h3 className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                Bibbia del Romanzo & Personaggi
              </h3>
              <p className="text-[11px] text-stone-500">
                Archivia e modifica dettagli su personaggi, luoghi e note. Verranno usati come contesto dall'AI.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
