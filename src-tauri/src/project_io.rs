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
        .set_title("Seleziona la cartella per il Progetto ZenScribe")
        .pick_folder()
        .await;

    folder.map(|f| f.path().to_string_lossy().to_string())
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

/// Salva e sincronizza l'intero progetto su una struttura fisica di cartelle su disco
pub fn write_full_project_to_directory(
    folder_path: &str,
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

    // 1. Salva metadati zenscribe.project.json
    let project_json_path = root.join("zenscribe.project.json");
    let json_content = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Errore serializzazione progetto: {}", e))?;
    fs::write(&project_json_path, json_content)
        .map_err(|e| format!("Errore salvataggio zenscribe.project.json: {}", e))?;

    // 2. Crea README.md del libro per visualizzazione immediata
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
