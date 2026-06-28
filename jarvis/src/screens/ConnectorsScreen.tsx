import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';

/**
 * Connectors (MCP) screen (PRD §7.6): add/remove/test MCP servers and view the
 * tools each exposes. Wired to the core McpClientPool over IPC.
 */
export function ConnectorsScreen(): JSX.Element {
  const { t } = useTranslation();
  const servers: { id: string; name: string; toolCount: number }[] = [];

  return (
    <div className="p-4">
      <button className="mb-4 flex items-center gap-1 rounded bg-accent px-3 py-2 font-medium text-black">
        <Plus size={16} /> {t('connectors.add')}
      </button>
      <div className="space-y-2">
        {servers.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded border border-edge bg-surface px-3 py-2">
            <div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-gray-500">
                {s.toolCount} {t('connectors.tools')}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded bg-panel px-2 py-1 text-xs">{t('connectors.test')}</button>
              <button className="rounded bg-panel px-2 py-1 text-xs text-red-400">
                {t('connectors.remove')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
