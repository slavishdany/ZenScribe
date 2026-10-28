# ARCHITETTURA STRUTTURALE ZENSCRIBE

## 1. VISIONE E FILOSOFIA (README.md)
ZenScribe è un harness di videoscrittura minimale, privato e ibrido (Locale + Cloud).
- Fase 1 (Locale - Gratis & Privato): Correzioni ortografiche tramite Llamafile (es. Qwen 2.5 1.5B).
- Fase 2 (Cloud - Gratis tramite Google AI Studio): Assistenza creativa con Gemini 2.5/3.8 Flash tramite chiave API dell'utente.

## 2. CONFIGURAZIONE FRONTEND (package.json)
{
  "name": "zenscribe-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "@google/generative-ai": "^0.21.0",
    "@tiptap/extension-document": "^2.2.0",
    "@tiptap/extension-paragraph": "^2.2.0",
    "@tiptap/extension-text": "^2.2.0",
    "@tiptap/react": "^2.2.0",
    "@tiptap/starter-kit": "^2.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.2.2",
    "vite": "^5.3.1"
  }
}

## 3. CONFIGURAZIONE DESKTOP (src-tauri/tauri.conf.json)
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "ZenScribe",
        "width": 1200,
        "height": 800
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "identifier": "com.zenscribe.app",
    "externalBin": [
      "resources/llamafile-server"
    ]
  },
  "productName": "ZenScribe",
  "version": "0.1.0"
}

## 4. DIPENDENZE BACKEND (src-tauri/Cargo.toml)
[package]
name = "zenscribe"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0" }

[dependencies]
tauri = { version = "2.0.0" }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

## 5. BASE LOGICA BACKEND (src-tauri/src/main.rs)
use tauri::{Manager, WindowEvent};
use std::process::{Command, Child};
use std::sync::Mutex;

struct LlamaProcess {
    child: Mutex<Option<Child>>,
}

fn main() {
    tauri::Builder::default()
        .manage(LlamaProcess { child: Mutex::new(None) })
        .setup(|app| {
            let state = app.state::<LlamaProcess>();
            let child = Command::new("resources/llamafile-server.exe")
                .args(&["--model", "resources/qwen-2.5-1.5b.gguf", "--port", "8080", "--embedding"])
                .spawn()
                .expect("Impossibile avviare il motore AI locale");
            *state.child.lock().unwrap() = Some(child);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                let state = window.state::<LlamaProcess>();
                let mut lock = state.child.lock().unwrap();
                if let Some(mut child) = lock.take() {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Errore durante l'esecuzione dell'app Tauri");
}
