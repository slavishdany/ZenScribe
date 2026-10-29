export type EditorFont = 'serif' | 'sans' | 'mono';
export type EditorWidth = 'narrow' | 'medium' | 'wide' | 'full';

export interface PresetModel {
  id: string;
  name: string;
  badge: string;
  description: string;
  repo_id: string;
  filename: string;
  size_label: string;
  approx_bytes: number;
}

export interface LocalModelInfo {
  filename: string;
  display_name: string;
  size_mb: number;
  is_active: boolean;
  path?: string;
  is_custom?: boolean;
}

export interface DownloadProgress {
  repo_id: string;
  filename: string;
  downloaded_bytes: number;
  total_bytes: number;
  percentage: number;
  speed_mbps: number;
  status: 'downloading' | 'completed' | 'error' | 'cached' | 'cancelled';
  error?: string;
}

export type CloudProviderType = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'custom';

export interface CloudProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface CloudSettings {
  activeProvider: CloudProviderType;
  providers: {
    gemini: CloudProviderConfig;
    openai: CloudProviderConfig;
    anthropic: CloudProviderConfig;
    openrouter: CloudProviderConfig;
    groq: CloudProviderConfig;
    custom: CloudProviderConfig;
  };
}

export interface ProjectProfile {
  title: string;
  genre: string;
  description: string;
  styleTone: string;
  narrativeVoice: string;
  targetAudience: string;
  narrativeNotes: string;
}

export interface EditorSettings {
  font: EditorFont;
  fontSize: number; // in px
  lineHeight: number;
  width: EditorWidth;
  theme: 'light' | 'dark' | 'system';
  zenMode: boolean;
  selectedLocalModel?: string;
  cloud: CloudSettings;
  // Retrocompatibilità
  geminiApiKey?: string;
}

export interface ServerStatusInfo {
  isReady: boolean;
  isChecking: boolean;
  lastChecked: number;
  activeModelName?: string;
}

export interface AIActionRequest {
  type: 'spellcheck' | 'summarize' | 'continue' | 'expand' | 'rephrase';
  text: string;
  provider: 'local' | 'cloud';
}
