import Database from "@tauri-apps/plugin-sql";
import { ProjectProfile, ProjectItem, ProjectManifest } from "../types";
import { syncProjectToFolder } from "./projectFiles";

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

export function getActiveProjectId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("zenscribe_active_project_id") || "default";
  }
  return "default";
}

export function setActiveProjectId(id: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("zenscribe_active_project_id", id);
  }
}

async function createSchema(db: Database): Promise<void> {
  // 1. Tabella Progetti Multi-Romanzo
  await db.execute(
    `CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      style_tone TEXT NOT NULL DEFAULT '',
      narrative_voice TEXT NOT NULL DEFAULT '',
      target_audience TEXT NOT NULL DEFAULT '',
      narrative_notes TEXT NOT NULL DEFAULT '',
      export_folder TEXT,
      auto_export_minutes INTEGER NOT NULL DEFAULT 0,
      last_exported_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )`
  );

  // 2. Tabella Nodi Worldbuilding
  await db.execute(
    `CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      metadata TEXT NOT NULL DEFAULT '{}'
    )`
  );

  // 3. Tabella Collegamenti
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

  // 4. Tabella Capitoli
  await db.execute(
    `CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      embedding TEXT
    )`
  );

  // 5. Tabella profilo legacy (per retrocompatibilità)
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

  // Migrazione colonne project_id
  try {
    const docInfo = await db.select<Array<{ name: string }>>("PRAGMA table_info(documents)");
    if (!docInfo.some((c) => c.name === "project_id")) {
      await db.execute("ALTER TABLE documents ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default'");
    }
  } catch (e) {
    console.warn("[DB Migration] documents project_id:", e);
  }

  try {
    const nodeInfo = await db.select<Array<{ name: string }>>("PRAGMA table_info(nodes)");
    if (!nodeInfo.some((c) => c.name === "project_id")) {
      await db.execute("ALTER TABLE nodes ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default'");
    }
  } catch (e) {
    console.warn("[DB Migration] nodes project_id:", e);
  }

  try {
    const edgeInfo = await db.select<Array<{ name: string }>>("PRAGMA table_info(edges)");
    if (!edgeInfo.some((c) => c.name === "project_id")) {
      await db.execute("ALTER TABLE edges ADD COLUMN project_id TEXT NOT NULL DEFAULT 'default'");
    }
  } catch (e) {
    console.warn("[DB Migration] edges project_id:", e);
  }

  // Inizializzazione del progetto default se la tabella è vuota
  try {
    const existing = await db.select<Array<{ id: string }>>("SELECT id FROM projects LIMIT 1");
    if (!existing || existing.length === 0) {
      let migrated = false;
      const legacyProfiles = await db.select<Array<any>>(
        "SELECT * FROM project_profile WHERE id = 'main' LIMIT 1"
      );
      const now = Date.now();
      if (legacyProfiles && legacyProfiles.length > 0) {
        const p = legacyProfiles[0];
        if (p.title || p.description || p.genre) {
          await db.execute(
            `INSERT INTO projects (id, title, genre, description, style_tone, narrative_voice, target_audience, narrative_notes, created_at, updated_at)
             VALUES ('default', $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              p.title || "Il Mio Romanzo",
              p.genre || "Fantasy",
              p.description || "",
              p.style_tone || "",
              p.narrative_voice || "",
              p.target_audience || "",
              p.narrative_notes || "",
              p.updated_at || now,
              p.updated_at || now,
            ]
          );
          migrated = true;
        }
      }

      if (!migrated) {
        await db.execute(
          `INSERT INTO projects (id, title, genre, description, style_tone, narrative_voice, target_audience, narrative_notes, created_at, updated_at)
           VALUES ('default', 'Il Mio Romanzo', 'Fantasy', 'Una grande narrazione letteraria', 'Evocativo & Cupo', 'Terza persona limitata', '', '', $1, $2)`,
          [now, now]
        );
      }
    }
  } catch (e) {
    console.warn("[DB Migration] Inizializzazione progetto:", e);
  }

  // Verifica che esista almeno un capitolo base
  try {
    const docs = await db.select<Array<{ id: string }>>("SELECT id FROM documents LIMIT 1");
    if (!docs || docs.length === 0) {
      await db.execute(
        `INSERT INTO documents (id, title, content, project_id)
         VALUES ('capitolo-principale', 'Capitolo 1: La Chiarezza', '<h1>La Chiarezza delle Parole</h1><p>Inizia a scrivere qui. Il database SQLite locale è sempre l\\'unica fonte di verità e memorizza ogni parola istantaneamente.</p>', 'default')`
      );
    }
  } catch (e) {
    console.warn("[DB Migration] Inserimento capitolo iniziale:", e);
  }
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

// ============================================================================
// GESTIONE PROGETTI MULTIPLI
// ============================================================================

/**
 * Restituisce l'elenco di tutti i progetti salvati nel database SQLite con il conteggio dei capitoli
 */
export async function elencaProgetti(): Promise<ProjectItem[]> {
  const db = await inizializzaDatabase();
  const rows = await db.select<
    Array<{
      id: string;
      title: string;
      genre: string;
      description: string;
      style_tone: string;
      narrative_voice: string;
      target_audience: string;
      narrative_notes: string;
      export_folder: string | null;
      auto_export_minutes: number;
      last_exported_at: number;
      created_at: number;
      updated_at: number;
      chapters_count: number;
    }>
  >(
    `SELECT p.*, (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) AS chapters_count
     FROM projects p
     ORDER BY p.updated_at DESC`
  );

  return rows.map((r) => ({
    id: r.id,
    title: r.title || "Senza Titolo",
    genre: r.genre || "",
    description: r.description || "",
    styleTone: r.style_tone || "",
    narrativeVoice: r.narrative_voice || "",
    targetAudience: r.target_audience || "",
    narrativeNotes: r.narrative_notes || "",
    exportFolder: r.export_folder,
    autoExportMinutes: r.auto_export_minutes || 0,
    lastExportedAt: r.last_exported_at || 0,
    createdAt: r.created_at || Date.now(),
    updatedAt: r.updated_at || Date.now(),
    chaptersCount: r.chapters_count || 0,
  }));
}

/**
 * Carica un singolo progetto dal database SQLite
 */
export async function caricaProgetto(id: string): Promise<ProjectItem | null> {
  const db = await inizializzaDatabase();
  const rows = await db.select<
    Array<{
      id: string;
      title: string;
      genre: string;
      description: string;
      style_tone: string;
      narrative_voice: string;
      target_audience: string;
      narrative_notes: string;
      export_folder: string | null;
      auto_export_minutes: number;
      last_exported_at: number;
      created_at: number;
      updated_at: number;
      chapters_count: number;
    }>
  >(
    `SELECT p.*, (SELECT COUNT(*) FROM documents d WHERE d.project_id = p.id) AS chapters_count
     FROM projects p
     WHERE p.id = $1`,
    [id]
  );

  if (rows && rows.length > 0) {
    const r = rows[0];
    return {
      id: r.id,
      title: r.title || "",
      genre: r.genre || "",
      description: r.description || "",
      styleTone: r.style_tone || "",
      narrativeVoice: r.narrative_voice || "",
      targetAudience: r.target_audience || "",
      narrativeNotes: r.narrative_notes || "",
      exportFolder: r.export_folder,
      autoExportMinutes: r.auto_export_minutes || 0,
      lastExportedAt: r.last_exported_at || 0,
      createdAt: r.created_at || Date.now(),
      updatedAt: r.updated_at || Date.now(),
      chaptersCount: r.chapters_count || 0,
    };
  }
  return null;
}

/**
 * Crea un nuovo progetto nel database SQLite e vi assegna un capitolo iniziale
 */
export async function creaNuovoProgetto(data: Partial<ProjectItem>): Promise<ProjectItem> {
  const db = await inizializzaDatabase();
  const now = Date.now();
  const id = `proj-${now}`;
  const title = data.title?.trim() || "Nuovo Romanzo";
  const genre = data.genre || "";
  const description = data.description || "";
  const styleTone = data.styleTone || "";
  const narrativeVoice = data.narrativeVoice || "";
  const targetAudience = data.targetAudience || "";
  const narrativeNotes = data.narrativeNotes || "";
  const exportFolder = data.exportFolder || null;
  const autoExportMinutes = data.autoExportMinutes || 0;

  await db.execute(
    `INSERT INTO projects (id, title, genre, description, style_tone, narrative_voice, target_audience, narrative_notes, export_folder, auto_export_minutes, last_exported_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, $11, $12)`,
    [
      id,
      title,
      genre,
      description,
      styleTone,
      narrativeVoice,
      targetAudience,
      narrativeNotes,
      exportFolder,
      autoExportMinutes,
      now,
      now,
    ]
  );

  // Crea capitolo iniziale per il nuovo progetto
  const chapId = `cap-${now}`;
  const defaultContent = `<h1>Capitolo 1: Inizio</h1><p>Inizia a scrivere la storia di <strong>${title}</strong>...</p>`;
  await db.execute(
    `INSERT INTO documents (id, title, content, project_id) VALUES ($1, $2, $3, $4)`,
    [chapId, "Capitolo 1: Inizio", defaultContent, id]
  );

  setActiveProjectId(id);

  return {
    id,
    title,
    genre,
    description,
    styleTone,
    narrativeVoice,
    targetAudience,
    narrativeNotes,
    exportFolder,
    autoExportMinutes,
    lastExportedAt: 0,
    createdAt: now,
    updatedAt: now,
    chaptersCount: 1,
  };
}

/**
 * Salva o aggiorna i metadati di un progetto
 */
export async function salvaProgetto(project: ProjectItem): Promise<void> {
  const db = await inizializzaDatabase();
  const now = Date.now();
  await db.execute(
    `UPDATE projects SET
       title = $1,
       genre = $2,
       description = $3,
       style_tone = $4,
       narrative_voice = $5,
       target_audience = $6,
       narrative_notes = $7,
       export_folder = $8,
       auto_export_minutes = $9,
       last_exported_at = $10,
       updated_at = $11
     WHERE id = $12`,
    [
      project.title,
      project.genre,
      project.description,
      project.styleTone,
      project.narrativeVoice,
      project.targetAudience,
      project.narrativeNotes,
      project.exportFolder || null,
      project.autoExportMinutes || 0,
      project.lastExportedAt || 0,
      now,
      project.id,
    ]
  );
}

/**
 * Elimina un progetto e tutti i suoi capitoli, nodi e collegamenti associati
 */
export async function eliminaProgetto(id: string): Promise<void> {
  const db = await inizializzaDatabase();

  await db.execute(`DELETE FROM documents WHERE project_id = $1`, [id]);
  await db.execute(`DELETE FROM edges WHERE project_id = $1`, [id]);
  await db.execute(`DELETE FROM nodes WHERE project_id = $1`, [id]);
  await db.execute(`DELETE FROM projects WHERE id = $1`, [id]);

  // Se abbiamo eliminato il progetto attivo, seleziona il primo disponibile o creane uno
  if (getActiveProjectId() === id) {
    const remaining = await db.select<Array<{ id: string }>>("SELECT id FROM projects LIMIT 1");
    if (remaining && remaining.length > 0) {
      setActiveProjectId(remaining[0].id);
    } else {
      const nuovo = await creaNuovoProgetto({ title: "Nuovo Romanzo" });
      setActiveProjectId(nuovo.id);
    }
  }
}

/**
 * Legge il profilo del progetto corrente (retrocompatibile)
 */
export async function caricaProfiloProgetto(projectId?: string): Promise<ProjectProfile> {
  const targetId = projectId || getActiveProjectId();
  const proj = await caricaProgetto(targetId);
  if (proj) {
    return {
      title: proj.title,
      genre: proj.genre,
      description: proj.description,
      styleTone: proj.styleTone,
      narrativeVoice: proj.narrativeVoice,
      targetAudience: proj.targetAudience,
      narrativeNotes: proj.narrativeNotes,
    };
  }

  return {
    title: "",
    genre: "",
    description: "",
    styleTone: "",
    narrativeVoice: "",
    targetAudience: "",
    narrativeNotes: "",
  };
}

/**
 * Salva o aggiorna il profilo del progetto corrente (retrocompatibile)
 */
export async function salvaProfiloProgetto(
  profile: ProjectProfile,
  projectId?: string
): Promise<void> {
  const targetId = projectId || getActiveProjectId();
  const current = (await caricaProgetto(targetId)) || {
    id: targetId,
    title: profile.title,
    genre: profile.genre,
    description: profile.description,
    styleTone: profile.styleTone,
    narrativeVoice: profile.narrativeVoice,
    targetAudience: profile.targetAudience,
    narrativeNotes: profile.narrativeNotes,
    autoExportMinutes: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updated: ProjectItem = {
    ...current,
    title: profile.title,
    genre: profile.genre,
    description: profile.description,
    styleTone: profile.styleTone,
    narrativeVoice: profile.narrativeVoice,
    targetAudience: profile.targetAudience,
    narrativeNotes: profile.narrativeNotes,
    updatedAt: Date.now(),
  };

  await salvaProgetto(updated);
}

// ============================================================================
// GESTIONE CAPITOLI (DOCUMENTS) PER PROGETTO
// ============================================================================

/**
 * Legge tutti i capitoli salvati nel database per il progetto specificato
 */
export async function elencaCapitoli(
  projectId?: string
): Promise<Array<{ id: string; title: string; content: string }>> {
  const db = await inizializzaDatabase();
  const projId = projectId || getActiveProjectId();
  const rows = await db.select<Array<{ id: string; title: string; content: string }>>(
    `SELECT id, title, content FROM documents WHERE project_id = $1 ORDER BY rowid ASC`,
    [projId]
  );
  return rows;
}

/**
 * Legge un capitolo salvato per ID
 */
export async function caricaCapitolo(
  id: string
): Promise<{ id: string; title: string; content: string } | null> {
  const db = await inizializzaDatabase();
  const rows = await db.select<{ id: string; title: string; content: string }[]>(
    `SELECT id, title, content FROM documents WHERE id = $1`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Salva un capitolo nel database SQLite
 */
export async function salvaCapitolo(
  id: string,
  title: string,
  content: string,
  projectId?: string
): Promise<void> {
  const db = await inizializzaDatabase();
  const projId = projectId || getActiveProjectId();
  await db.execute(
    `INSERT INTO documents (id, title, content, project_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       project_id = excluded.project_id`,
    [id, title, content, projId]
  );

  // Aggiorna data modifica del progetto
  await db.execute(`UPDATE projects SET updated_at = $1 WHERE id = $2`, [Date.now(), projId]);
}

/**
 * Crea un nuovo capitolo con titolo predefinito
 */
export async function creaNuovoCapitolo(
  title?: string,
  projectId?: string
): Promise<string> {
  const db = await inizializzaDatabase();
  const projId = projectId || getActiveProjectId();
  const id = `capitolo-${Date.now()}`;
  const chapterTitle = title?.trim() || "Nuovo Capitolo";
  const defaultContent = `<h1>${chapterTitle}</h1><p>Inizia a scrivere questo capitolo...</p>`;
  await db.execute(
    `INSERT INTO documents (id, title, content, project_id) VALUES ($1, $2, $3, $4)`,
    [id, chapterTitle, defaultContent, projId]
  );
  await db.execute(`UPDATE projects SET updated_at = $1 WHERE id = $2`, [Date.now(), projId]);
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

// ============================================================================
// WORLDBUILDING & MAPPA CONCETTUALE PER PROGETTO
// ============================================================================

/**
 * Crea o aggiorna un nodo del Worldbuilding
 */
export async function creaNodo(
  id: string,
  type: string,
  name: string,
  description: string,
  metadata: NodeMetadata = {},
  projectId?: string
): Promise<void> {
  const db = await inizializzaDatabase();
  const projId = projectId || getActiveProjectId();
  await db.execute(
    `INSERT INTO nodes (id, type, name, description, metadata, project_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       name = excluded.name,
       description = excluded.description,
       metadata = excluded.metadata,
       project_id = excluded.project_id`,
    [id, type, name, description, JSON.stringify(metadata ?? {}), projId]
  );
  await db.execute(`UPDATE projects SET updated_at = $1 WHERE id = $2`, [Date.now(), projId]);
}

/**
 * Crea un collegamento orientato tra due nodi del Worldbuilding
 */
export async function creaCollegamento(
  id: string,
  source_id: string,
  target_id: string,
  label: string,
  projectId?: string
): Promise<void> {
  const db = await inizializzaDatabase();
  const projId = projectId || getActiveProjectId();
  await db.execute(
    `INSERT INTO edges (id, source_id, target_id, label, project_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(id) DO UPDATE SET
       source_id = excluded.source_id,
       target_id = excluded.target_id,
       label = excluded.label,
       project_id = excluded.project_id`,
    [id, source_id, target_id, label, projId]
  );
}

/**
 * Elimina un nodo dalla mappa concettuale
 */
export async function eliminaNodo(id: string): Promise<void> {
  const db = await inizializzaDatabase();
  await db.execute(`DELETE FROM nodes WHERE id = $1`, [id]);
}

/**
 * Restituisce tutti i nodi e collegamenti del progetto attivo
 */
export async function ottieniMappaConcettuale(projectId?: string): Promise<ConceptMap> {
  const db = await inizializzaDatabase();
  const projId = projectId || getActiveProjectId();

  const nodeRows = await db.select<NodeRow[]>(
    `SELECT id, type, name, description, metadata FROM nodes WHERE project_id = $1 ORDER BY name`,
    [projId]
  );
  const edgeRows = await db.select<EdgeRow[]>(
    `SELECT id, source_id, target_id, label FROM edges WHERE project_id = $1`,
    [projId]
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

/**
 * Restituisce una sintesi testuale ricca del profilo del progetto e dei nodi del Worldbuilding
 */
export async function ottieniContestoNarrativo(projectId?: string): Promise<string> {
  const sections: string[] = [];
  const projId = projectId || getActiveProjectId();

  try {
    const profile = await caricaProfiloProgetto(projId);
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
    const mappa = await ottieniMappaConcettuale(projId);
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

// ============================================================================
// ESPORTAZIONE SNAPSHOT CON INDICE & REIMPORTAZIONE LOSSLESS
// ============================================================================

/**
 * Esporta un intero snapshot del progetto con indice manifest su una cartella fisica
 */
export async function esportaSnapshotProgetto(
  projectId?: string,
  targetFolder?: string
): Promise<{ folderPath: string; exportedAt: number }> {
  const projId = projectId || getActiveProjectId();
  const proj = await caricaProgetto(projId);
  if (!proj) {
    throw new Error(`Progetto '${projId}' non trovato nel database.`);
  }

  const folder = targetFolder || proj.exportFolder;
  if (!folder) {
    throw new Error("Nessuna cartella di esportazione specificata.");
  }

  const chapters = await elencaCapitoli(projId);
  const conceptMap = await ottieniMappaConcettuale(projId);
  const now = Date.now();

  const manifest: ProjectManifest = {
    version: "1.0",
    appName: "ZenScribe",
    exportDate: new Date().toISOString(),
    project: {
      id: proj.id,
      title: proj.title,
      genre: proj.genre,
      description: proj.description,
      styleTone: proj.styleTone,
      narrativeVoice: proj.narrativeVoice,
      targetAudience: proj.targetAudience,
      narrativeNotes: proj.narrativeNotes,
      exportFolder: folder,
      autoExportMinutes: proj.autoExportMinutes,
      createdAt: proj.createdAt,
      updatedAt: now,
    },
    chapters: chapters.map((ch, idx) => ({
      id: ch.id,
      title: ch.title,
      content: ch.content,
      order: idx + 1,
    })),
    worldbuilding: {
      nodes: conceptMap.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        description: n.description,
        metadata: n.metadata,
      })),
      edges: conceptMap.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
      })),
    },
  };

  const manifestJson = JSON.stringify(manifest, null, 2);

  // Sincronizza su disco tramite Tauri Backend in Rust
  const savedFolder = await syncProjectToFolder(
    folder,
    manifestJson,
    {
      title: proj.title,
      genre: proj.genre,
      description: proj.description,
      styleTone: proj.styleTone,
      narrativeVoice: proj.narrativeVoice,
      targetAudience: proj.targetAudience,
      narrativeNotes: proj.narrativeNotes,
    },
    chapters,
    conceptMap.nodes
  );

  // Salva l'orario di esportazione nel DB
  const db = await inizializzaDatabase();
  await db.execute(
    `UPDATE projects SET export_folder = $1, last_exported_at = $2 WHERE id = $3`,
    [folder, now, projId]
  );

  return {
    folderPath: savedFolder,
    exportedAt: now,
  };
}

/**
 * Reimporta un intero progetto a partire da una stringa JSON manifest nel database SQLite
 */
export async function importaProgettoCompleto(
  manifestRaw: string | ProjectManifest
): Promise<ProjectItem> {
  const db = await inizializzaDatabase();
  let manifest: ProjectManifest;

  if (typeof manifestRaw === "string") {
    try {
      manifest = JSON.parse(manifestRaw);
    } catch (e: any) {
      throw new Error(`Il file selezionato non è un JSON valido: ${e.message}`);
    }
  } else {
    manifest = manifestRaw;
  }

  if (!manifest || !manifest.project || !manifest.project.title) {
    throw new Error("L'indice manifest non contiene i dati minimi del progetto.");
  }

  const pData = manifest.project;
  const now = Date.now();

  // Verifica se l'ID esiste già nel DB per evitare sovrascritture accidentali
  let targetId = pData.id || `proj-${now}`;
  let targetTitle = pData.title;

  const existing = await caricaProgetto(targetId);
  if (existing) {
    targetId = `proj-${now}`;
    targetTitle = `${pData.title} (Importato)`;
  }

  // Inserisce il progetto nel DB SQLite
  await db.execute(
    `INSERT INTO projects (id, title, genre, description, style_tone, narrative_voice, target_audience, narrative_notes, export_folder, auto_export_minutes, last_exported_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      targetId,
      targetTitle,
      pData.genre || "",
      pData.description || "",
      pData.styleTone || "",
      pData.narrativeVoice || "",
      pData.targetAudience || "",
      pData.narrativeNotes || "",
      pData.exportFolder || null,
      pData.autoExportMinutes || 0,
      now,
      pData.createdAt || now,
      now,
    ]
  );

  // Inserisce i capitoli
  if (manifest.chapters && Array.isArray(manifest.chapters)) {
    for (let i = 0; i < manifest.chapters.length; i++) {
      const ch = manifest.chapters[i];
      const chapId = ch.id ? `${ch.id}-${now}` : `cap-${now}-${i}`;
      await db.execute(
        `INSERT INTO documents (id, title, content, project_id) VALUES ($1, $2, $3, $4)`,
        [chapId, ch.title || `Capitolo ${i + 1}`, ch.content || "", targetId]
      );
    }
  } else {
    // Capitolo default se assente
    await db.execute(
      `INSERT INTO documents (id, title, content, project_id)
       VALUES ($1, 'Capitolo 1: Inizio', '<h1>Capitolo 1: Inizio</h1><p></p>', $2)`,
      [`cap-${now}`, targetId]
    );
  }

  // Inserisce nodi del Worldbuilding
  const nodeIdMap = new Map<string, string>();
  if (manifest.worldbuilding?.nodes && Array.isArray(manifest.worldbuilding.nodes)) {
    for (const node of manifest.worldbuilding.nodes) {
      const newNodeId = `node-${now}-${node.id}`;
      nodeIdMap.set(node.id, newNodeId);
      await db.execute(
        `INSERT INTO nodes (id, type, name, description, metadata, project_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          newNodeId,
          node.type || "personaggio",
          node.name || "Senza Nome",
          node.description || "",
          JSON.stringify(node.metadata || {}),
          targetId,
        ]
      );
    }
  }

  // Inserisce collegamenti
  if (manifest.worldbuilding?.edges && Array.isArray(manifest.worldbuilding.edges)) {
    for (const edge of manifest.worldbuilding.edges) {
      const newSource = nodeIdMap.get(edge.source) || edge.source;
      const newTarget = nodeIdMap.get(edge.target) || edge.target;
      const newEdgeId = `edge-${now}-${edge.id}`;
      await db.execute(
        `INSERT INTO edges (id, source_id, target_id, label, project_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [newEdgeId, newSource, newTarget, edge.label || "", targetId]
      );
    }
  }

  setActiveProjectId(targetId);

  return {
    id: targetId,
    title: targetTitle,
    genre: pData.genre || "",
    description: pData.description || "",
    styleTone: pData.styleTone || "",
    narrativeVoice: pData.narrativeVoice || "",
    targetAudience: pData.targetAudience || "",
    narrativeNotes: pData.narrativeNotes || "",
    exportFolder: pData.exportFolder || null,
    autoExportMinutes: pData.autoExportMinutes || 0,
    lastExportedAt: now,
    createdAt: pData.createdAt || now,
    updatedAt: now,
    chaptersCount: manifest.chapters?.length || 1,
  };
}
