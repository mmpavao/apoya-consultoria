import { useTranslation } from 'react-i18next';
import { useJarvisStore } from '../store/useJarvisStore';

/** Agents panel (PRD §7.2): one card per specialist with live status + tokens. */
export function AgentsScreen(): JSX.Element {
  const { t } = useTranslation();
  const agents = useJarvisStore((s) => s.agents);

  return (
    <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-3">
      {agents.map((a) => (
        <div key={a.name} className="rounded border border-edge bg-surface p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{a.name}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                a.status === 'idle' ? 'bg-edge text-gray-400' : 'bg-accent text-black'
              }`}
            >
              {t(`agents.${a.status}`)}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {t('agents.tokens')}: {a.tokensIn} / {a.tokensOut}
          </div>
        </div>
      ))}
    </div>
  );
}
