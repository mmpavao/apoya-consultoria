import { DEFAULT_MODEL } from '../infrastructure/llm/modelInfo.js';

/**
 * Runtime settings (PRD §5 settings table, §10 "swap model = 1 value"). In the
 * packaged app these are persisted in SQLite and secrets come from the Keychain;
 * here we read from env for standalone/CLI use. The API key is never logged nor
 * placed in the LLM context (PRD §4.5).
 */
export interface Settings {
  provider: 'anthropic' | 'fake';
  model: string;
  locale: 'pt-BR' | 'en-US';
  apiKey?: string;
}

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const apiKey = env.ANTHROPIC_API_KEY;
  return {
    provider: apiKey ? 'anthropic' : 'fake',
    model: env.JARVIS_MODEL ?? DEFAULT_MODEL,
    locale: (env.JARVIS_LOCALE as Settings['locale']) ?? 'pt-BR',
    apiKey,
  };
}
