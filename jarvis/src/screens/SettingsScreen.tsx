import { useTranslation } from 'react-i18next';

/**
 * Settings (PRD §7.7): model selection (swap model = 1 value, §10), language,
 * API key (stored in Keychain via IPC), and the cost panel. The model list is
 * the single place the LLM is chosen.
 */
const MODELS = ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5', 'claude-fable-5'];

export function SettingsScreen(): JSX.Element {
  const { t, i18n } = useTranslation();

  return (
    <div className="max-w-lg space-y-6 p-4">
      <label className="block">
        <span className="text-xs uppercase text-gray-400">{t('settings.model')}</span>
        <select className="mt-1 w-full rounded border border-edge bg-panel px-3 py-2">
          {MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs uppercase text-gray-400">{t('settings.language')}</span>
        <select
          value={i18n.language}
          onChange={(e) => void i18n.changeLanguage(e.target.value)}
          className="mt-1 w-full rounded border border-edge bg-panel px-3 py-2"
        >
          <option value="pt-BR">Português (BR)</option>
          <option value="en-US">English (US)</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs uppercase text-gray-400">{t('settings.apiKey')}</span>
        <input
          type="password"
          placeholder="sk-ant-…"
          className="mt-1 w-full rounded border border-edge bg-panel px-3 py-2"
        />
      </label>

      <div className="rounded border border-edge bg-surface p-3">
        <div className="text-xs uppercase text-gray-400">{t('settings.cost')}</div>
        <div className="mt-1 text-lg">$0.0000</div>
      </div>
    </div>
  );
}
