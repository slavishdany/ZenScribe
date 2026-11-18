use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use candle_core::quantized::gguf_file;
use candle_core::{Device, Tensor};
use candle_transformers::generation::LogitsProcessor;
use candle_transformers::models::quantized_llama::ModelWeights as LlamaWeights;
use candle_transformers::models::quantized_phi3::ModelWeights as Phi3Weights;
use candle_transformers::models::quantized_qwen2::ModelWeights as Qwen2Weights;
use tokenizers::Tokenizer;

pub enum QuantizedModel {
    Llama(LlamaWeights),
    Phi3(Phi3Weights),
    Qwen2(Qwen2Weights),
}

impl QuantizedModel {
    pub fn forward(&mut self, x: &Tensor, index_pos: usize) -> candle_core::Result<Tensor> {
        match self {
            Self::Llama(m) => m.forward(x, index_pos),
            Self::Phi3(m) => m.forward(x, index_pos),
            Self::Qwen2(m) => m.forward(x, index_pos),
        }
    }

    pub fn clear_kv_cache(&mut self) {
        match self {
            Self::Llama(m) => m.clear_kv_cache(),
            Self::Qwen2(m) => m.clear_kv_cache(),
            Self::Phi3(_) => {},
        }
    }
}

pub struct LoadedEngine {
    pub model: QuantizedModel,
    pub tokenizer: Option<Tokenizer>,
    pub device: Device,
    pub eos_token_id: u32,
    pub arch_name: String,
}

pub struct NativeEngine {
    pub active_model_filename: Mutex<Option<String>>,
    pub active_model_path: Mutex<Option<PathBuf>>,
    pub loaded_engine: Mutex<Option<LoadedEngine>>,
    pub is_loaded: AtomicBool,
    pub is_generating: AtomicBool,
    pub abort_signal: AtomicBool,
}

impl NativeEngine {
    pub fn new() -> Self {
        Self {
            active_model_filename: Mutex::new(None),
            active_model_path: Mutex::new(None),
            loaded_engine: Mutex::new(None),
            is_loaded: AtomicBool::new(false),
            is_generating: AtomicBool::new(false),
            abort_signal: AtomicBool::new(false),
        }
    }

    pub fn is_ready(&self) -> bool {
        self.is_loaded.load(Ordering::Relaxed)
    }

    pub fn abort(&self) {
        self.abort_signal.store(true, Ordering::SeqCst);
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

        let arch = content
            .metadata
            .get("general.architecture")
            .and_then(|v| match v {
                gguf_file::Value::String(s) => Some(s.to_lowercase()),
                _ => None,
            })
            .unwrap_or_else(|| "llama".to_string());

        println!("[ZenScribe Native AI] Architettura GGUF rilevata: '{}'", arch);

        // Verifica esplicita architetture non compatibili con Candle GGUF
        if arch.contains("gemma") {
            return Err(format!(
                "Il modello '{}' utilizza l'architettura '{}' (Gemma 2) che non è supportata dal parser Candle GGUF. Si consiglia di utilizzare Llama 3.2 (1B o 3B), Qwen 2.5 o Mistral 7B.",
                filename, arch
            ));
        }

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

        // 2. Carica i pesi quantizzati del modello in base all'architettura supportata
        let model = if arch == "phi3" || arch == "phi" {
            let m = Phi3Weights::from_gguf(false, content, &mut file, &device)
                .map_err(|e| format!("Errore inizializzazione pesi modello Phi-3 GGUF: {}", e))?;
            QuantizedModel::Phi3(m)
        } else if arch == "qwen2" || arch == "qwen" {
            let m = Qwen2Weights::from_gguf(content, &mut file, &device)
                .map_err(|e| format!("Errore inizializzazione pesi modello Qwen2 GGUF: {}", e))?;
            QuantizedModel::Qwen2(m)
        } else {
            // LLaMA, Mistral, Alpaca, Vicuna ecc.
            let m = LlamaWeights::from_gguf(content, &mut file, &device)
                .map_err(|e| format!("Errore inizializzazione pesi modello LLaMA/Mistral GGUF: {}", e))?;
            QuantizedModel::Llama(m)
        };

        let engine = LoadedEngine {
            model,
            tokenizer,
            device,
            eos_token_id,
            arch_name: arch,
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
        self.is_loaded.store(true, Ordering::SeqCst);

        println!("[ZenScribe Native AI] Modello {} caricato nativamente con successo!", filename);
        Ok(())
    }

    /// Scarica il modello dalla memoria
    pub fn unload_model(&self) {
        self.is_loaded.store(false, Ordering::SeqCst);
        self.abort();
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
        self.abort_signal.store(false, Ordering::SeqCst);
        self.is_generating.store(true, Ordering::SeqCst);

        struct GenGuard<'a>(&'a AtomicBool);
        impl<'a> Drop for GenGuard<'a> {
            fn drop(&mut self) {
                self.0.store(false, Ordering::SeqCst);
            }
        }
        let _guard = GenGuard(&self.is_generating);

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

        // CRUCIALE: Ripulisce la cache KV precedente per evitare accumulo esponenziale in memoria
        // e calcoli quadratici corrotti sui vecchi token
        engine.model.clear_kv_cache();

        // Formattazione prompt in base all'architettura specifica
        let formatted_prompt = if engine.arch_name.contains("qwen") {
            if let Some(sys) = system_prompt {
                format!(
                    "<|im_start|>system\n{}<|im_end|>\n<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    sys.trim(),
                    prompt.trim()
                )
            } else {
                format!(
                    "<|im_start|>user\n{}<|im_end|>\n<|im_start|>assistant\n",
                    prompt.trim()
                )
            }
        } else if engine.arch_name.contains("phi") {
            if let Some(sys) = system_prompt {
                format!(
                    "<|system|>\n{}<|end|>\n<|user|>\n{}<|end|>\n<|assistant|>\n",
                    sys.trim(),
                    prompt.trim()
                )
            } else {
                format!(
                    "<|user|>\n{}<|end|>\n<|assistant|>\n",
                    prompt.trim()
                )
            }
        } else {
            // Llama 3 / Mistral default
            if let Some(sys) = system_prompt {
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
            }
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

        let mut current_pos = 0;
        let mut last_logit_opt = None;
        let chunk_size = 64;

        // Prompt feed-forward a blocchi per consentire l'interruzione immediata anche durante il prefill
        for chunk in tokens.chunks(chunk_size) {
            if self.abort_signal.load(Ordering::SeqCst) {
                println!("[ZenScribe Native AI] Inferenza interrotta durante il prefill del prompt.");
                engine.model.clear_kv_cache();
                return Err("Generazione interrotta dall'utente.".to_string());
            }

            let input_tensor = Tensor::new(chunk, device)
                .and_then(|t| t.unsqueeze(0))
                .map_err(|e| format!("Errore creazione tensore di input: {}", e))?;

            let logits = engine
                .model
                .forward(&input_tensor, current_pos)
                .map_err(|e| format!("Errore forward pass: {}", e))?;

            current_pos += chunk.len();

            let logits = logits
                .squeeze(0)
                .map_err(|e| format!("Errore squeeze logits: {}", e))?;

            last_logit_opt = Some(
                logits
                    .get(chunk.len() - 1)
                    .map_err(|e| format!("Errore recupero logit: {}", e))?,
            );
        }

        let last_logit = last_logit_opt
            .ok_or_else(|| "Nessun logit calcolato dal prompt.".to_string())?;

        let mut next_token = logits_processor
            .sample(&last_logit)
            .map_err(|e| format!("Errore campionamento token: {}", e))?;

        let effective_max_tokens = max_tokens.clamp(16, 512);
        let mut was_aborted = false;

        for _ in 0..effective_max_tokens {
            if self.abort_signal.load(Ordering::SeqCst) {
                println!("[ZenScribe Native AI] Inferenza interrotta da segnale di abort.");
                was_aborted = true;
                break;
            }

            if next_token == engine.eos_token_id
                || next_token == 128009 // Llama 3 <|eot_id|>
                || next_token == 128001 // Llama 3 <|end_of_text|>
                || next_token == 128008 // Llama 3 <|header_id|>
                || next_token == 151645 // Qwen 2 <|im_end|>
                || next_token == 32000  // Phi-3 <|end|>
                || next_token == 32007  // Phi-3 <|endoftext|>
                || next_token == 2      // Generic EOS
            {
                break;
            }

            // Rilevamento loop di ripetizione infinita (3 token consecutivi identici)
            let gen_len = generated_tokens.len();
            if gen_len >= 3
                && generated_tokens[gen_len - 1] == next_token
                && generated_tokens[gen_len - 2] == next_token
            {
                println!("[ZenScribe Native AI] Loop di ripetizione rilevato, arresto generazione.");
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

        // Ripulisce la cache KV al termine della generazione per liberare memoria
        engine.model.clear_kv_cache();

        let generated_text = tokenizer
            .decode(&generated_tokens, true)
            .map_err(|e| format!("Errore decodifica testo: {}", e))?;

        let mut clean_text = clean_output(&generated_text);
        if was_aborted {
            if clean_text.is_empty() {
                return Err("Generazione interrotta dall'utente.".to_string());
            } else {
                clean_text.push_str("\n\n*[Risposta interrotta dall'utente]*");
            }
        }
        Ok(clean_text)
    }
}

fn clean_output(raw: &str) -> String {
    raw.replace("<|eot_id|>", "")
        .replace("<|end_of_text|>", "")
        .replace("<|begin_of_text|>", "")
        .replace("<|start_header_id|>", "")
        .replace("<|end_header_id|>", "")
        .replace("<|im_start|>", "")
        .replace("<|im_end|>", "")
        .replace("<|end|>", "")
        .replace("</s>", "")
        .replace("<end_of_turn>", "")
        .trim()
        .to_string()
}
