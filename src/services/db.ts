import Database from "@tauri-apps/plugin-sql";

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

  // embedding: array di numeri serializzato in JSON (NULL finché non viene calcolato)
  await db.execute(
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      embedding TEXT
    )`
  );
}

/**
 * Apre il database (creandolo se manca) e crea le tabelle mancanti.
 * Chiamata una sola volta: le invocazioni successive riusano la stessa connessione.
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
      // Permette un nuovo tentativo alla chiamata successiva
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
 * Crea un nodo (personaggio, luogo, ...). Se l'id esiste già ne aggiorna i campi,
 * senza toccare i collegamenti che lo riguardano.
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
 * Crea un collegamento orientato tra due nodi esistenti. Se l'id esiste già ne
 * aggiorna i campi. Fallisce se source_id o target_id non corrispondono a un nodo.
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
 * L'embedding esistente non viene toccato.
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
 * Legge un capitolo salvato. Restituisce null se l'id non esiste.
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
 * Restituisce tutti i nodi e tutti i collegamenti in un unico oggetto,
 * con i metadati già convertiti da JSON.
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
