import { invoke } from "@tauri-apps/api/core";
import { ChapterItem } from "../components/ChapterSidebar";
import { GraphNode } from "./db";
import { ProjectProfile } from "../types";

/**
 * Apre la finestra di dialogo nativa del sistema operativo per selezionare una cartella sul disco
 */
export async function selectProjectFolder(): Promise<string | null> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string | null>("select_project_folder");
  }
  return null;
}

/**
 * Apre la cartella specificata nell'Esplora File di Windows (o Finder su Mac)
 */
export async function openFolderInExplorer(folderPath: string): Promise<void> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    await invoke("open_folder_in_explorer", { folderPath });
  }
}

/**
 * Esporta il capitolo attivo con dialogo "Salva con nome" in formato .md o .txt
 */
export async function exportChapterToFile(
  title: string,
  content: string,
  format: "md" | "txt" = "md"
): Promise<string | null> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string | null>("export_chapter_file", {
      title,
      content,
      format,
    });
  }
  return null;
}

/**
 * Esporta l'intero manoscritto unificato in formato .md o .txt
 */
export async function exportFullManuscript(
  title: string,
  chapters: ChapterItem[],
  format: "md" | "txt" = "md"
): Promise<string | null> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    const chaptersDto = chapters.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.content,
    }));

    return await invoke<string | null>("export_full_manuscript", {
      title,
      chapters: chaptersDto,
      format,
    });
  }
  return null;
}

/**
 * Apre la finestra di dialogo nativa del sistema operativo per selezionare un file manifest JSON (.json)
 */
export async function selectManifestFile(): Promise<string | null> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string | null>("select_manifest_file");
  }
  return null;
}

/**
 * Legge il contenuto del manifest da un file o da una cartella di progetto
 */
export async function readManifestFile(path: string): Promise<string> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string>("read_manifest_file", { path });
  }
  throw new Error("La lettura del manifest richiede l'ambiente Tauri.");
}

/**
 * Apre la finestra di dialogo nativa per selezionare qualsiasi file di trama, testo (.txt, .md) o backup (.json)
 */
export async function selectImportFile(): Promise<string | null> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string | null>("select_import_file");
  }
  return null;
}

/**
 * Legge il contenuto testuale di qualsiasi file da percorso specificato sul disco
 */
export async function readTextFileContent(path: string): Promise<string> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    return await invoke<string>("read_text_file_content", { path });
  }
  throw new Error("La lettura del file richiede l'ambiente desktop ZenScribe.");
}

/**
 * Sincronizza ed esporta l'intero progetto su una cartella fisica con indice zenscribe.manifest.json, Capitoli/, Bibbia/ e Manoscritto/
 */
export async function syncProjectToFolder(
  folderPath: string,
  manifestJson: string,
  project: ProjectProfile,
  chapters: ChapterItem[],
  nodes: GraphNode[]
): Promise<string> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    const projectDto = {
      title: project.title,
      genre: project.genre,
      description: project.description,
      style_tone: project.styleTone,
      narrative_voice: project.narrativeVoice,
      target_audience: project.targetAudience,
      narrative_notes: project.narrativeNotes,
    };

    const chaptersDto = chapters.map((c) => ({
      id: c.id,
      title: c.title,
      content: c.content,
    }));

    const nodesDto = nodes.map((n) => ({
      id: n.id,
      node_type: n.type,
      name: n.name,
      description: n.description,
    }));

    return await invoke<string>("sync_project_to_folder", {
      folderPath,
      manifestJson,
      project: projectDto,
      chapters: chaptersDto,
      nodes: nodesDto,
    });
  }
  throw new Error("La sincronizzazione cartella richiede l'applicazione desktop.");
}
