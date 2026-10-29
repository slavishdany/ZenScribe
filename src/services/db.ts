import Database from "@tauri-apps/plugin-sql";
import { ProjectProfile } from "../types";

const DATABASE_URL = "sqlite:zenscribe.db";

export type NodeMetadata = Record<string, unknown>;

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  description: string;
  metadata: NodeMetadata;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

export interface ConceptMap {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface NodeRow {
  id: string;
  type: string;
  name: string;
  description: string | null;
  metadata: string | null;
}

interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  label: string | null;
}

let dbPromise: Promise<Database> | null = null;

function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);
}

async function createSchema(db: Database): Promise<void> {
  await db.execute(
    `CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '{}'
    )`
  );

  await db.execute(
    `CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
      FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
    )`
  );

  await db.execute(`CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id)`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id)`);

  await db.execute(
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      embedding TEXT
    )`
  );

  // Tabella profilo del progetto (genere, stile, premessa, voce narrante)
  await db.execute(
    `CREATE TABLE IF NOT EXISTS project_profile (
      id TEXT PRIMARY KEY NOT NULL DEFAULT 'main',
      title TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      style_tone TEXT NOT NULL DEFAULT '',
      narrative_voice TEXT NOT NULL DEFAULT '',
      target_audience TEXT NOT NULL DEFAULT '',
      narrative_notes TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`
  );
}

/**
 * Apre il database (creandolo se manca) e crea le tabelle mancanti.
 */
export function inizializzaDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      if (!isTauriEnvironment()) {
        throw new Error("Il database SQLite richiede l'applicazione desktop Tauri.");
      }
      const db = await Database.load(DATABASE_URL);
      await createSchema(db);
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

function parseMetadata(raw: string | null): NodeMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Legge il profilo del progetto corrente (genere, stile, premessa)
 */
export async function caricaProfiloProgetto(): Promise<ProjectProfile> {
  const defaultProfile: ProjectProfile = {
    title: '',
    genre: '',
    description: '',
    styleTone: '',
    narrativeVoice: '',
    targetAudience: '',
    narrativeNotes: '',
  };

  try {
    const db = await inizializzaDatabase();
    const rows = await db.select<
      Array<{
        title: string;
        genre: string;
        description: string;
        style_tone: string;
        narrative_voice: string;
        target_audience: string;
        narrative_notes: string;
      }>
    >(
      `SELECT title, genre, description, style_tone, narrative_voice, target_audience, narrative_notes FROM project_profile WHERE id = 'main'`
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        title: r.title || '',
        genre: r.genre || '',
        description: r.description || '',
        styleTone: r.style_tone || '',
        narrativeVoice: r.narrative_voice || '',
        targetAudience: r.target_audience || '',
        narrativeNotes: r.narrative_notes || '',
      };
    }
  } catch (e) {
    console.warn('[DB] Errore lettura profilo progetto:', e);
  }

  return defaultProfile;
}

/**
 * Salva o aggiorna il profilo del progetto letterario
 */
export async function salvaProfiloProgetto(profile: ProjectProfile): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(
    `INSERT INTO project_profile (id, title, genre, description, style_tone, narrative_voice, target_audience, narrative_notes, updated_at)
     VALUES ('main', $1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       genre = excluded.genre,
       description = excluded.description,
       style_tone = excluded.style_tone,
       narrative_voice = excluded.narrative_voice,
       target_audience = excluded.target_audience,
       narrative_notes = excluded.narrative_notes,
       updated_at = excluded.updated_at`,
    [
      profile.title,
      profile.genre,
      profile.description,
      profile.styleTone,
      profile.narrativeVoice,
      profile.targetAudience,
      profile.narrativeNotes,
      Date.now(),
    ]
  );
}

/**
 * Crea un nodo (personaggio, luogo, ...).
 */
export async function creaNodo(
  id: string,
  type: string,
  name: string,
  description: string,
  metadata: NodeMetadata = {}
): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(
    `INSERT INTO nodes (id, type, name, description, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       name = excluded.name,
       description = excluded.description,
       metadata = excluded.metadata`,
    [id, type, name, description, JSON.stringify(metadata ?? {})]
  );
}

/**
 * Crea un collegamento orientato tra due nodi esistenti.
 */
export async function creaCollegamento(
  id: string,
  source_id: string,
  target_id: string,
  label: string
): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(
    `INSERT INTO edges (id, source_id, target_id, label)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       source_id = excluded.source_id,
       target_id = excluded.target_id,
       label = excluded.label`,
    [id, source_id, target_id, label]
  );
}

/**
 * Salva un capitolo: lo inserisce o ne sovrascrive titolo e contenuto.
 */
export async function salvaCapitolo(id: string, title: string, content: string): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(
    `INSERT INTO documents (id, title, content)
     VALUES ($1, $2, $3)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content`,
    [id, title, content]
  );
}

/**
 * Legge un capitolo salvato.
 */
export async function caricaCapitolo(id: string): Promise<{ id: string; title: string; content: string } | null> {
  const db = await inizializzaDatabase();
  const rows = await db.select<{ id: string; title: string; content: string }[]>(
    `SELECT id, title, content FROM documents WHERE id = $1`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Legge tutti i capitoli salvati nel database in ordine di inserimento
 */
export async function elencaCapitoli(): Promise<Array<{ id: string; title: string; content: string }>> {
  const db = await inizializzaDatabase();
  const rows = await db.select<Array<{ id: string; title: string; content: string }>>(
    `SELECT id, title, content FROM documents ORDER BY rowid ASC`
  );
  return rows;
}

/**
 * Crea un nuovo capitolo con titolo predefinito e testo iniziale vuoto
 */
export async function creaNuovoCapitolo(title?: string): Promise<string> {
  const db = await inizializzaDatabase();
  const id = `capitolo-${Date.now()}`;
  const chapterTitle = title?.trim() || "Nuovo Capitolo";
  const defaultContent = `<h1>${chapterTitle}</h1><p>Inizia a scrivere questo capitolo...</p>`;
  await db.execute(
    `INSERT INTO documents (id, title, content) VALUES ($1, $2, $3)`,
    [id, chapterTitle, defaultContent]
  );
  return id;
}

/**
 * Elimina un capitolo dal database
 */
export async function eliminaCapitolo(id: string): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(`DELETE FROM documents WHERE id = $1`, [id]);
}

/**
 * Rinomina il titolo di un capitolo
 */
export async function rinominaCapitolo(id: string, newTitle: string): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(`UPDATE documents SET title = $1 WHERE id = $2`, [newTitle, id]);
}

/**
 * Elimina un nodo (personaggio, luogo) dalla mappa concettuale
 */
export async function eliminaNodo(id: string): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(`DELETE FROM nodes WHERE id = $1`, [id]);
}

/**
 * Restituisce una sintesi testuale ricca sia del profilo del progetto (genere, stile, premessa)
 * che di tutti i nodi (personaggi/luoghi) da fornire come contesto all'AI.
 */
export async function ottieniContestoNarrativo(): Promise<string> {
  const sections: string[] = [];

  try {
    const profile = await caricaProfiloProgetto();
    const hasProfile = Boolean(
      profile.title || profile.genre || profile.description || profile.styleTone || profile.narrativeNotes
    );

    if (hasProfile) {
      const pLines: string[] = [];
      pLines.push("=== PROFILO DEL PROGETTO & STILE NARRATIVO ===");
      if (profile.title) pLines.push(`• Titolo Opera: "${profile.title}"`);
      if (profile.genre) pLines.push(`• Genere Letterario: ${profile.genre}`);
      if (profile.description) pLines.push(`• Premessa / Descrizione rapida: ${profile.description}`);
      if (profile.styleTone) pLines.push(`• Tono & Registro Stilistico: ${profile.styleTone}`);
      if (profile.narrativeVoice) pLines.push(`• Voce Narrante & POV: ${profile.narrativeVoice}`);
      if (profile.targetAudience) pLines.push(`• Atmosfera / Target: ${profile.targetAudience}`);
      if (profile.narrativeNotes) pLines.push(`• Regole del Mondo & Direttive: ${profile.narrativeNotes}`);
      sections.push(pLines.join("\n"));
    }
  } catch (e) {
    console.warn("[DB] Errore contesto profilo:", e);
  }

  try {
    const mappa = await ottieniMappaConcettuale();
    if (mappa.nodes.length > 0) {
      const bLines: string[] = [];
      bLines.push("=== BIBBIA DEL ROMANZO (PERSONAGGI & LUOGHI) ===");
      for (const n of mappa.nodes) {
        bLines.push(`• [${n.type.toUpperCase()}] ${n.name}: ${n.description}`);
      }
      sections.push(bLines.join("\n"));
    }
  } catch (e) {
    console.warn("[DB] Errore contesto mappa:", e);
  }

  return sections.join("\n\n").trim();
}

/**
 * Restituisce tutti i nodi e collegamenti
 */
export async function ottieniMappaConcettuale(): Promise<ConceptMap> {
  const db = await inizializzaDatabase();

  const nodeRows = await db.select<NodeRow[]>(
    `SELECT id, type, name, description, metadata FROM nodes ORDER BY name`
  );
  const edgeRows = await db.select<EdgeRow[]>(
    `SELECT id, source_id, target_id, label FROM edges`
  );

  return {
    nodes: nodeRows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      description: row.description ?? "",
      metadata: parseMetadata(row.metadata),
    })),
    edges: edgeRows.map((row) => ({
      id: row.id,
      source: row.source_id,
      target: row.target_id,
      label: row.label ?? "",
    })),
  };
}
