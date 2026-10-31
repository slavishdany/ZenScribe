use std::fs::File;
use std::path::{Path, PathBuf};
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

        // Prompt feed-forward iniziale
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
            if next_token == engine.eos_token_id
                || next_token == 128009 // Llama 3 <|eot_id|>
                || next_token == 128001 // Llama 3 <|end_of_text|>
                || next_token == 151645 // Qwen 2 <|im_end|>
                || next_token == 32000  // Phi-3 <|end|>
                || next_token == 32007  // Phi-3 <|endoftext|>
                || next_token == 2      // Generic EOS
            {
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
