import React, { useState, useEffect } from 'react';
import {
  X,
  BookMarked,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Feather,
  Palette,
  Volume2,
  ShieldAlert,
} from 'lucide-react';
import { ProjectProfile } from '../types';
import { caricaProfiloProgetto, salvaProfiloProgetto } from '../services/db';

interface ProjectProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated?: (profile: ProjectProfile) => void;
}

const GENRE_SUGGESTIONS = [
  'Fantasy',
  'Dark Fantasy',
  'Fantascienza',
  'Giallo / Noir',
  'Thriller psicologico',
  'Horror',
  'Romanzo Storico',
  'Distopico',
  'Cyberpunk',
  'Grimdark',
  'Saggistica narrativa',
];

const TONE_SUGGESTIONS = [
  'Cupo ed Epico',
  'Introspettivo & Psicologico',
  'Incalzante & Teso',
  'Poetico & Evocativo',
  'Crudo & Realista',
  'Ironico & Brillante',
  'Onirico & Misterioso',
];

const POV_SUGGESTIONS = [
  'Prima Persona (Io narrante)',
  'Terza Persona Limitata (Focalizzazione interna)',
  'Terza Persona Onnisciente',
  'Seconda Persona (Tu)',
  'Punti di vista alternati (POV multiplo)',
];

export const ProjectProfileModal: React.FC<ProjectProfileModalProps> = ({
  isOpen,
  onClose,
  onProjectUpdated,
}) => {
  const [profile, setProfile] = useState<ProjectProfile>({
    title: '',
    genre: '',
    description: '',
    styleTone: '',
    narrativeVoice: '',
    targetAudience: '',
    narrativeNotes: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      caricaProfiloProgetto().then((p) => {
        setProfile(p);
      });
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      await salvaProfiloProgetto(profile);
      setFeedback('Profilo del progetto salvato con successo! Le AI adatteranno automaticamente il loro stile.');
      if (onProjectUpdated) {
        onProjectUpdated(profile);
      }
      setTimeout(() => {
        setFeedback(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setFeedback(`Errore salvataggio: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/70 dark:bg-stone-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-stone-900 dark:text-stone-100">
                Profilazione del Progetto & Stile Narrativo
              </h3>
              <p className="text-xs text-stone-500">
                Informa l'AI su genere, tono, voce e regole del mondo per risposte su misura
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800/60 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs overflow-y-auto flex-1">
          {/* Box Informativo */}
          <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-800 dark:text-indigo-300 text-[11px] leading-relaxed flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Guida Creativa dell'AI:</strong> I dettagli inseriti qui vengono passati come contesto
              sia ai modelli locali (.gguf) che a quelli cloud. L'AI saprà sempre chi è il protagonista, qual è l'atmosfera
              e quali formule stilistiche prediligere.
            </div>
          </div>

          {/* Titolo e Genere */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center space-x-1.5">
                <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
                <span>Titolo del Romanzo / Progetto</span>
              </label>
              <input
                type="text"
                value={profile.title}
                onChange={(e) => setProfile({ ...profile, title: e.target.value })}
                placeholder="es. Il ritorno del male"
                className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center space-x-1.5">
                <Feather className="w-3.5 h-3.5 text-indigo-500" />
                <span>Genere Letterario</span>
              </label>
              <input
                type="text"
                value={profile.genre}
                onChange={(e) => setProfile({ ...profile, genre: e.target.value })}
                placeholder="es. Dark Fantasy, Thriller..."
                className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {/* Suggerimenti rapidi genere */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                {GENRE_SUGGESTIONS.slice(0, 5).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setProfile({ ...profile, genre: g })}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Descrizione rapida / Premessa narrativa */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center space-x-1.5">
              <span>Premessa & Descrizione Rapida (Logline)</span>
            </label>
            <textarea
              value={profile.description}
              onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              rows={3}
              placeholder="es. Romanzo fantasy che ribalta i normali ruoli: un demone antico è costretto ad allearsi con i ribelli per fermare una tirannica inquisizione che purifica il mondo con il fuoco sacro..."
              className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
            />
          </div>

          {/* Tono e Voce Narrante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center space-x-1.5">
                <Palette className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tono & Registro Stilistico</span>
              </label>
              <input
                type="text"
                value={profile.styleTone}
                onChange={(e) => setProfile({ ...profile, styleTone: e.target.value })}
                placeholder="es. Cupo, introspettivo, prosa ricca di immagini sensoriali..."
                className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {TONE_SUGGESTIONS.slice(0, 4).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setProfile({ ...profile, styleTone: t })}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center space-x-1.5">
                <Volume2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>Voce Narrante & Punto di Vista</span>
              </label>
              <input
                type="text"
                value={profile.narrativeVoice}
                onChange={(e) => setProfile({ ...profile, narrativeVoice: e.target.value })}
                placeholder="es. Prima persona singolare (demone disilluso)..."
                className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {POV_SUGGESTIONS.slice(0, 2).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setProfile({ ...profile, narrativeVoice: p })}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Regole del Mondo & Direttive Speciali */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1.5 flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Regole del Mondo & Direttive Narratoriali per l'AI</span>
            </label>
            <textarea
              value={profile.narrativeNotes}
              onChange={(e) => setProfile({ ...profile, narrativeNotes: e.target.value })}
              rows={3}
              placeholder="es. Nessun manicheismo tra bene e male; la magia richiede un sacrificio fisico visibile; mantieni i dialoghi taglienti senza retorica moralista; la città è sempre avvolta da una nebbia perenne di zolfo..."
              className="w-full p-2.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
            />
          </div>

          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center space-x-2 text-[11px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Footer interno */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <span>Salva Profilo Romanzo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
