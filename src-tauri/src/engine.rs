use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use candle_core::quantized::gguf_file;
use candle_core::{Device, Tensor};
use candle_transformers::generation::LogitsProcessor;
use candle_transformers::models::quantized_llama::ModelWeights;
use tokenizers::Tokenizer;

pub struct LoadedEngine {
    pub model: ModelWeights,
    pub tokenizer: Option<Tokenizer>,
    pub device: Device,
    pub eos_token_id: u32,
}

pub struct NativeEngine {
    pub active_model_filename: Mutex<Option<String>>,
    pub active_model_path: Mutex<Option<PathBuf>>,
    pub loaded_engine: Mutex<Option<LoadedEngine>>,
}

impl NativeEngine {
    pub fn new() -> Self {
        Self {
            active_model_filename: Mutex::new(None),
            active_model_path: Mutex::new(None),
            loaded_engine: Mutex::new(None),
        }
    }

    pub fn is_ready(&self) -> bool {
        self.loaded_engine
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false)
    }

    pub fn get_active_model_name(&self) -> Option<String> {
        self.active_model_filename
            .lock()
            .ok()
            .and_then(|guard| guard.clone())
    }

    /// Carica nativamente il modello GGUF specificato in memoria
    pub fn load_model(&self, model_path: &Path, filename: &str) -> Result<(), String> {
        println!("[ZenScribe Native AI] Caricamento modello da: {}", model_path.display());
        let device = Device::Cpu;

        let mut file = File::open(model_path)
            .map_err(|e| format!("Impossibile aprire il file modello {}: {}", model_path.display(), e))?;

        let content = gguf_file::Content::read(&mut file)
            .map_err(|e| format!("Errore lettura intestazione GGUF: {}", e))?;

        // 1. Individua o estrai il Tokenizer
        let mut tokenizer: Option<Tokenizer> = None;

        // A. Cerca tokenizer.json companion nella stessa directory
        let companion_tok1 = model_path.with_file_name(format!("{}.tokenizer.json", filename));
        let companion_tok2 = model_path.with_file_name("tokenizer.json");
        let candidate_tok_paths = [companion_tok1, companion_tok2];

        for tok_path in candidate_tok_paths {
            if tok_path.exists() {
                if let Ok(tok) = Tokenizer::from_file(&tok_path) {
                    println!("[ZenScribe Native AI] Tokenizer caricato da file esterno: {}", tok_path.display());
                    tokenizer = Some(tok);
                    break;
                }
            }
        }

        // B. Se non trovato esternamente, cerca nei metadati GGUF (chiave tokenizer.huggingface.json)
        if tokenizer.is_none() {
            if let Some(gguf_file::Value::String(hf_json)) = content.metadata.get("tokenizer.huggingface.json") {
                if let Ok(tok) = Tokenizer::from_bytes(hf_json.as_bytes()) {
                    println!("[ZenScribe Native AI] Tokenizer estratto direttamente dai metadati GGUF.");
                    tokenizer = Some(tok);
                }
            }
        }

        // Determina EOS token ID dai metadati GGUF se presente
        let mut eos_token_id: u32 = 128001; // default Llama 3 <|end_of_text|>
        if let Some(gguf_file::Value::U32(eos)) = content.metadata.get("tokenizer.ggml.eos_token_id") {
            eos_token_id = *eos;
        } else if let Some(gguf_file::Value::I32(eos)) = content.metadata.get("tokenizer.ggml.eos_token_id") {
            if *eos >= 0 {
                eos_token_id = *eos as u32;
            }
        }

        // 2. Carica i pesi quantizzati del modello tramite Candle
        let model = ModelWeights::from_gguf(content, &mut file, &device)
            .map_err(|e| format!("Errore inizializzazione pesi modello GGUF: {}", e))?;

        let engine = LoadedEngine {
            model,
            tokenizer,
            device,
            eos_token_id,
        };

        if let Ok(mut guard) = self.loaded_engine.lock() {
            *guard = Some(engine);
        }
        if let Ok(mut guard) = self.active_model_path.lock() {
            *guard = Some(model_path.to_path_buf());
        }
        if let Ok(mut guard) = self.active_model_filename.lock() {
            *guard = Some(filename.to_string());
        }

        println!("[ZenScribe Native AI] Modello {} caricato nativamente con successo!", filename);
        Ok(())
    }

    /// Scarica il modello dalla memoria
    pub fn unload_model(&self) {
        if let Ok(mut guard) = self.loaded_engine.lock() {
            *guard = None;
        }
        if let Ok(mut guard) = self.active_model_filename.lock() {
            *guard = None;
        }
        if let Ok(mut guard) = self.active_model_path.lock() {
            *guard = None;
        }
    }

    /// Genera testo localmente in modo nativo
    pub fn generate(
        &self,
        prompt: &str,
        system_prompt: Option<&str>,
        max_tokens: usize,
        temperature: f64,
    ) -> Result<String, String> {
        let mut engine_guard = self
            .loaded_engine
            .lock()
            .map_err(|_| "Blocco concorrenza motore AI fallito")?;

        let engine = engine_guard
            .as_mut()
            .ok_or_else(|| "Nessun modello AI locale caricato in memoria.".to_string())?;

        let tokenizer = engine
            .tokenizer
            .as_ref()
            .ok_or_else(|| "Tokenizer non disponibile per il modello selezionato.".to_string())?;

        // Formattazione prompt compatibile con modelli Instruct (Llama 3 / Mistral)
        let formatted_prompt = if let Some(sys) = system_prompt {
            format!(
                "<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                sys.trim(),
                prompt.trim()
            )
        } else {
            format!(
                "<|begin_of_text|><|start_header_id|>user<|end_header_id|>\n\n{}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n",
                prompt.trim()
            )
        };

        let encoding = tokenizer
            .encode(formatted_prompt, true)
            .map_err(|e| format!("Errore di tokenizzazione: {}", e))?;

        let tokens = encoding.get_ids();
        if tokens.is_empty() {
            return Err("Il prompt fornito ha generato 0 token.".to_string());
        }

        let mut logits_processor = LogitsProcessor::new(299792458, Some(temperature.max(0.1)), None);
        let mut generated_tokens: Vec<u32> = Vec::new();
        let device = &engine.device;

        // Processo di inferenza autoregressiva
        let mut current_pos = 0;

        // Prompt feed-forward
        let input_tensor = Tensor::new(tokens, device)
            .and_then(|t| t.unsqueeze(0))
            .map_err(|e| format!("Errore creazione tensore di input: {}", e))?;

        let logits = engine
            .model
            .forward(&input_tensor, current_pos)
            .map_err(|e| format!("Errore forward pass iniziale: {}", e))?;

        let logits = logits
            .squeeze(0)
            .map_err(|e| format!("Errore squeeze logits: {}", e))?;

        let last_logit = logits
            .get(tokens.len() - 1)
            .map_err(|e| format!("Errore recupero ultimo logit: {}", e))?;

        let mut next_token = logits_processor
            .sample(&last_logit)
            .map_err(|e| format!("Errore campionamento token: {}", e))?;

        current_pos += tokens.len();

        for _ in 0..max_tokens {
            if next_token == engine.eos_token_id || next_token == 128009 || next_token == 2 {
                break;
            }

            generated_tokens.push(next_token);

            let input_tensor = Tensor::new(&[next_token], device)
                .and_then(|t| t.unsqueeze(0))
                .map_err(|e| format!("Errore creazione tensore token: {}", e))?;

            let logits = engine
                .model
                .forward(&input_tensor, current_pos)
                .map_err(|e| format!("Errore forward pass: {}", e))?;

            let logits = logits
                .squeeze(0)
                .map_err(|e| format!("Errore squeeze logits: {}", e))?;

            let last_logit = logits
                .get(0)
                .map_err(|e| format!("Errore recupero logit: {}", e))?;

            next_token = logits_processor
                .sample(&last_logit)
                .map_err(|e| format!("Errore campionamento token: {}", e))?;

            current_pos += 1;
        }

        let generated_text = tokenizer
            .decode(&generated_tokens, true)
            .map_err(|e| format!("Errore decodifica testo: {}", e))?;

        let clean_text = clean_output(&generated_text);
        Ok(clean_text)
    }
}

fn clean_output(raw: &str) -> String {
    raw.replace("<|eot_id|>", "")
        .replace("<|end_of_text|>", "")
        .replace("<|begin_of_text|>", "")
        .replace("</s>", "")
        .replace("<end_of_turn>", "")
        .trim()
        .to_string()
}
