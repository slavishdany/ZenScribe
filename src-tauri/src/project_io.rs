use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ProjectProfileDto {
    pub title: String,
    pub genre: String,
    pub description: String,
    pub style_tone: String,
    pub narrative_voice: String,
    pub target_audience: String,
    pub narrative_notes: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ChapterExportDto {
    pub id: String,
    pub title: String,
    pub content: String, // HTML o testo
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorldNodeExportDto {
    pub id: String,
    pub node_type: String,
    pub name: String,
    pub description: String,
}

/// Converte HTML di base di TipTap in pulito Markdown
pub fn html_to_markdown(html: &str) -> String {
    let mut text = html.to_string();

    // Sostituzioni tag principali
    text = text.replace("<h1>", "\n# ");
    text = text.replace("</h1>", "\n\n");
    text = text.replace("<h2>", "\n## ");
    text = text.replace("</h2>", "\n\n");
    text = text.replace("<h3>", "\n### ");
    text = text.replace("</h3>", "\n\n");
    text = text.replace("<p>", "");
    text = text.replace("</p>", "\n\n");
    text = text.replace("<blockquote>", "\n> ");
    text = text.replace("</blockquote>", "\n\n");
    text = text.replace("<strong>", "**");
    text = text.replace("</strong>", "**");
    text = text.replace("<b>", "**");
    text = text.replace("</b>", "**");
    text = text.replace("<em>", "*");
    text = text.replace("</em>", "*");
    text = text.replace("<i>", "*");
    text = text.replace("</i>", "*");
    text = text.replace("<code>", "`");
    text = text.replace("</code>", "`");
    text = text.replace("<br>", "\n");
    text = text.replace("<br/>", "\n");
    text = text.replace("<br />", "\n");
    text = text.replace("<li>", "- ");
    text = text.replace("</li>", "\n");
    text = text.replace("<ul>", "\n");
    text = text.replace("</ul>", "\n");
    text = text.replace("<ol>", "\n");
    text = text.replace("</ol>", "\n");
    text = text.replace("&nbsp;", " ");
    text = text.replace("&amp;", "&");
    text = text.replace("&lt;", "<");
    text = text.replace("&gt;", ">");
    text = text.replace("&quot;", "\"");

    // Rimuove eventuali tag HTML rimanenti
    let mut inside_tag = false;
    let mut clean = String::with_capacity(text.len());
    for c in text.chars() {
        if c == '<' {
            inside_tag = true;
        } else if c == '>' {
            inside_tag = false;
        } else if !inside_tag {
            clean.push(c);
        }
    }

    // Compatta righe vuote eccessive
    clean.trim().to_string()
}

/// Rende sicuro un nome file per tutti i sistemi operativi
pub fn sanitize_filename(name: &str) -> String {
    let invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*'];
    let mut sanitized = name
        .chars()
        .map(|c| if invalid_chars.contains(&c) { '_' } else { c })
        .collect::<String>()
        .trim()
        .to_string();

    if sanitized.is_empty() {
        sanitized = "Capitolo".to_string();
    }
    sanitized
}

/// Apre la finestra di dialogo nativa per selezionare una cartella sul computer
pub async fn pick_folder_dialog() -> Option<String> {
    let folder = rfd::AsyncFileDialog::new()
        .set_title("Seleziona la cartella per l'esportazione / backup del Progetto ZenScribe")
        .pick_folder()
        .await;

    folder.map(|f| f.path().to_string_lossy().to_string())
}

/// Apre la finestra di dialogo nativa per selezionare un file manifest (.json)
pub async fn pick_manifest_file_dialog() -> Option<String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Seleziona il file indice di backup ZenScribe (zenscribe.manifest.json)")
        .add_filter("ZenScribe Manifest", &["json"])
        .pick_file()
        .await;

    file.map(|f| f.path().to_string_lossy().to_string())
}

/// Legge il contenuto del manifest JSON da un percorso specificato (file o cartella di progetto).
/// Se viene selezionata una cartella senza manifest esplicito, o il file zenscribe.project.json,
/// ricostruisce al volo il manifest completo leggendo i file .md della cartella Capitoli e Bibbia.
pub fn read_manifest_from_path(path_str: &str) -> Result<String, String> {
    let p = Path::new(path_str);
    if !p.exists() {
        return Err(format!("Il percorso '{}' non esiste sul disco.", path_str));
    }

    let (dir_path, explicit_manifest_path) = if p.is_dir() {
        let candidate_manifest = p.join("zenscribe.manifest.json");
        if candidate_manifest.exists() {
            (p.to_path_buf(), Some(candidate_manifest))
        } else {
            (p.to_path_buf(), None)
        }
    } else {
        let parent = p.parent().unwrap_or_else(|| Path::new("")).to_path_buf();
        let file_name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if file_name == "zenscribe.manifest.json" {
            (parent, Some(p.to_path_buf()))
        } else {
            // Se l'utente ha selezionato zenscribe.project.json o un altro file nella cartella di progetto,
            // controlliamo se nella cartella genitore esiste un zenscribe.manifest.json
            let candidate_manifest = parent.join("zenscribe.manifest.json");
            if candidate_manifest.exists() {
                (parent, Some(candidate_manifest))
            } else {
                (parent, None)
            }
        }
    };

    // 1. Se esiste un zenscribe.manifest.json valido, proviamo a leggerlo
    if let Some(ref m_path) = explicit_manifest_path {
        if let Ok(content) = fs::read_to_string(m_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if val.get("project").is_some() || val.get("chapters").is_some() {
                    return Ok(content);
                }
            }
        }
    }

    // 2. Se abbiamo un file json selezionato direttamente (non cartella) e non c'è manifest esplicito,
    // controlliamo se il file stesso contiene già JSON valido con capitoli
    if !p.is_dir() {
        if let Ok(content) = fs::read_to_string(p) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                if val.get("chapters").and_then(|c| c.as_array()).map_or(false, |arr| !arr.is_empty()) {
                    return Ok(content);
                }
            }
        }
    }

    // 3. Altrimenti, ricostruiamo il manifest completo scansionando la cartella:
    let default_title = dir_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Progetto Importato")
        .to_string();

    let mut project_meta = serde_json::json!({
        "title": default_title,
        "genre": "",
        "description": "",
        "style_tone": "",
        "narrative_voice": "",
        "target_audience": "",
        "narrative_notes": ""
    });

    let project_json_path = if !p.is_dir() && p.extension().and_then(|e| e.to_str()) == Some("json") {
        p.to_path_buf()
    } else {
        dir_path.join("zenscribe.project.json")
    };

    if project_json_path.exists() {
        if let Ok(content) = fs::read_to_string(&project_json_path) {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(obj) = parsed.as_object() {
                    for (k, v) in obj {
                        project_meta[k] = v.clone();
                    }
                }
            }
        }
    }

    // Leggiamo i capitoli dalla sottocartella "Capitoli" o direttamente da dir_path se contiene file .md
    let chapters_dir = {
        let sub = dir_path.join("Capitoli");
        if sub.exists() && sub.is_dir() {
            sub
        } else {
            dir_path.clone()
        }
    };

    let mut chapters = Vec::new();
    if let Ok(entries) = fs::read_dir(&chapters_dir) {
        let mut md_files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|path| path.is_file() && path.extension().and_then(|ext| ext.to_str()) == Some("md"))
            .filter(|path| {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                name != "README.md"
            })
            .collect();

        md_files.sort();

        for (idx, file_path) in md_files.iter().enumerate() {
            if let Ok(text) = fs::read_to_string(file_path) {
                let fallback_title = file_path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Capitolo")
                    .to_string();

                let mut chapter_title = fallback_title;
                for line in text.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("# ") {
                        chapter_title = trimmed[2..].trim().to_string();
                        break;
                    }
                }

                chapters.push(serde_json::json!({
                    "id": format!("cap-import-{}", idx + 1),
                    "title": chapter_title,
                    "content": text
                }));
            }
        }
    }

    // Leggiamo la Bibbia dalla cartella "Bibbia" se presente
    let bible_dir = dir_path.join("Bibbia");
    let mut nodes = Vec::new();
    if bible_dir.exists() && bible_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&bible_dir) {
            for (idx, entry) in entries.filter_map(|e| e.ok()).enumerate() {
                let path = entry.path();
                if path.is_file() && path.extension().and_then(|e| e.to_str()) == Some("md") {
                    if let Ok(text) = fs::read_to_string(&path) {
                        let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Entità");
                        nodes.push(serde_json::json!({
                            "id": format!("node-import-{}", idx + 1),
                            "name": name,
                            "type": "personaggio",
                            "description": text,
                            "metadata": {}
                        }));
                    }
                }
            }
        }
    }

    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let manifest = serde_json::json!({
        "appVersion": "1.1.0",
        "exportDate": now_ts.to_string(),
        "project": project_meta,
        "chapters": chapters,
        "worldbuilding": {
            "nodes": nodes,
            "edges": []
        }
    });

    serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Errore serializzazione manifest ricostruito: {}", e))
}

/// Apre la finestra di dialogo nativa "Salva con nome" per esportare un file
pub async fn save_file_dialog(default_name: &str, extension: &str) -> Option<String> {
    let file = rfd::AsyncFileDialog::new()
        .set_title("Esporta file")
        .set_file_name(default_name)
        .add_filter(extension.to_uppercase(), &[extension])
        .save_file()
        .await;

    file.map(|f| f.path().to_string_lossy().to_string())
}

/// Apre la cartella in Esplora File di Windows
pub fn open_folder_in_system_explorer(folder_path: &str) -> Result<(), String> {
    let p = Path::new(folder_path);
    if !p.exists() {
        return Err(format!("La cartella '{}' non esiste.", folder_path));
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("Impossibile aprire Esplora File: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("Impossibile aprire Finder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(folder_path)
            .spawn()
            .map_err(|e| format!("Impossibile aprire il file manager: {}", e))?;
    }

    Ok(())
}

/// Salva e sincronizza l'intero progetto su una struttura fisica di cartelle su disco con indice manifest
pub fn write_full_project_to_directory(
    folder_path: &str,
    manifest_json: &str,
    project: ProjectProfileDto,
    chapters: Vec<ChapterExportDto>,
    nodes: Vec<WorldNodeExportDto>,
) -> Result<String, String> {
    let root = PathBuf::from(folder_path);
    if !root.exists() {
        fs::create_dir_all(&root)
            .map_err(|e| format!("Impossibile creare la cartella di progetto: {}", e))?;
    }

    let chapters_dir = root.join("Capitoli");
    let bible_dir = root.join("Bibbia");
    let exports_dir = root.join("Manoscritto");

    fs::create_dir_all(&chapters_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&bible_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&exports_dir).map_err(|e| e.to_string())?;

    // 1. Salva l'indice completo zenscribe.manifest.json per reimportazione al 100%
    let manifest_path = root.join("zenscribe.manifest.json");
    fs::write(&manifest_path, manifest_json)
        .map_err(|e| format!("Errore salvataggio zenscribe.manifest.json: {}", e))?;

    // 2. Salva metadati rapidi zenscribe.project.json
    let project_json_path = root.join("zenscribe.project.json");
    let json_content = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Errore serializzazione progetto: {}", e))?;
    let _ = fs::write(&project_json_path, json_content);

    // 3. Crea README.md del libro per visualizzazione immediata
    let mut readme_content = String::new();
    readme_content.push_str(&format!("# 📖 {}\n\n", if project.title.is_empty() { "Nuovo Romanzo" } else { &project.title }));
    if !project.genre.is_empty() {
        readme_content.push_str(&format!("**Genere:** {}\n\n", project.genre));
    }
    if !project.description.is_empty() {
        readme_content.push_str(&format!("## 📜 Premessa Narrativa\n{}\n\n", project.description));
    }
    if !project.style_tone.is_empty() {
        readme_content.push_str(&format!("**Tono e Registro:** {}\n\n", project.style_tone));
    }
    if !project.narrative_voice.is_empty() {
        readme_content.push_str(&format!("**Voce Narrante:** {}\n\n", project.narrative_voice));
    }
    if !project.narrative_notes.is_empty() {
        readme_content.push_str(&format!("## 🛡️ Regole del Mondo & Direttive\n{}\n\n", project.narrative_notes));
    }
    readme_content.push_str(&format!("---\n*Generato con ZenScribe - {} capitoli salvati*\n", chapters.len()));
    let _ = fs::write(root.join("README.md"), readme_content);

    // 3. Salva ogni capitolo come file .md separato
    for (idx, ch) in chapters.iter().enumerate() {
        let order = idx + 1;
        let safe_title = sanitize_filename(&ch.title);
        let filename = format!("{:02} - {}.md", order, safe_title);
        let ch_path = chapters_dir.join(filename);

        let md_body = html_to_markdown(&ch.content);
        let full_ch_content = format!("# {}\n\n{}", ch.title, md_body);
        fs::write(&ch_path, full_ch_content)
            .map_err(|e| format!("Errore scrittura capitolo {}: {}", ch.title, e))?;
    }

    // 4. Salva la Bibbia del Mondo (Personaggi & Luoghi)
    let characters: Vec<&WorldNodeExportDto> = nodes.iter().filter(|n| n.node_type.to_lowercase() == "personaggio").collect();
    let locations: Vec<&WorldNodeExportDto> = nodes.iter().filter(|n| n.node_type.to_lowercase() == "luogo").collect();
    let other_notes: Vec<&WorldNodeExportDto> = nodes.iter().filter(|n| n.node_type.to_lowercase() != "personaggio" && n.node_type.to_lowercase() != "luogo").collect();

    // Personaggi.md
    let mut pers_content = String::from("# 🧙 Personaggi del Romanzo\n\n");
    if characters.is_empty() {
        pers_content.push_str("*Nessun personaggio inserito finora.*\n");
    } else {
        for p in characters {
            pers_content.push_str(&format!("## {}\n{}\n\n", p.name, p.description));
        }
    }
    let _ = fs::write(bible_dir.join("Personaggi.md"), pers_content);

    // Luoghi.md
    let mut loc_content = String::from("# 🏰 Luoghi & Ambientazioni\n\n");
    if locations.is_empty() {
        loc_content.push_str("*Nessun luogo inserito finora.*\n");
    } else {
        for l in locations {
            loc_content.push_str(&format!("## {}\n{}\n\n", l.name, l.description));
        }
    }
    let _ = fs::write(bible_dir.join("Luoghi.md"), loc_content);

    // Note.md
    let mut notes_content = String::from("# 📝 Note di Trama & Oggetti\n\n");
    if other_notes.is_empty() {
        notes_content.push_str("*Nessuna nota aggiuntiva.*\n");
    } else {
        for o in other_notes {
            notes_content.push_str(&format!("## {} ({})\n{}\n\n", o.name, o.node_type, o.description));
        }
    }
    let _ = fs::write(bible_dir.join("Note.md"), notes_content);

    // 5. Salva il Manoscritto Completo Unificato
    let mut manuscript = String::new();
    let book_title = if project.title.is_empty() { "Manoscritto" } else { &project.title };
    manuscript.push_str(&format!("# {}\n\n", book_title));
    if !project.description.is_empty() {
        manuscript.push_str(&format!("> {}\n\n---\n\n", project.description));
    }

    for (_idx, ch) in chapters.iter().enumerate() {
        manuscript.push_str(&format!("## {}\n\n", ch.title));
        manuscript.push_str(&html_to_markdown(&ch.content));
        manuscript.push_str("\n\n---\n\n");
    }

    let manuscript_file = exports_dir.join(format!("{}_Completo.md", sanitize_filename(book_title)));
    let _ = fs::write(&manuscript_file, manuscript);

    Ok(root.to_string_lossy().to_string())
}
