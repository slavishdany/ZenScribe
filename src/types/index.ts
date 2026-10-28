export type EditorFont = 'serif' | 'sans' | 'mono';
export type EditorWidth = 'narrow' | 'medium' | 'wide' | 'full';

export interface LocalModelInfo {
  filename: string;
  display_name: string;
  size_mb: number;
  is_active: boolean;
}

export interface EditorSettings {
  font: EditorFont;
  fontSize: number; // in px
  lineHeight: number;
  width: EditorWidth;
  geminiApiKey: string;
  theme: 'light' | 'dark' | 'system';
  zenMode: boolean;
  selectedLocalModel?: string;
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
