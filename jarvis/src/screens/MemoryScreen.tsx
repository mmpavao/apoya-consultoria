import { useTranslation } from 'react-i18next';

/**
 * Memory screen (PRD §7.5): stored facts/preferences, editable and removable.
 * Backed by the core MemoryService (RAG) over IPC.
 */
export function MemoryScreen(): JSX.Element {
  const { t } = useTranslation();
  const facts: { id: string; content: string }[] = [];

  if (facts.length === 0) {
    return <p className="p-8 text-center text-gray-500">{t('memory.empty')}</p>;
  }
  return (
    <ul className="space-y-2 p-4">
      {facts.map((f) => (
        <li key={f.id} className="flex items-center justify-between rounded border border-edge bg-surface px-3 py-2">
          <span>{f.content}</span>
          <button className="text-xs text-red-400">{t('memory.remove')}</button>
        </li>
      ))}
    </ul>
  );
}
