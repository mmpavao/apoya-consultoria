import { useTranslation } from 'react-i18next';

/**
 * Activity / audit log (PRD §7.4): filterable list of every action; reversible
 * entries expose an Undo button. Bound to the core AuditLog over IPC in the
 * packaged app; placeholder rows shown here for layout.
 */
interface Row {
  id: string;
  actor: string;
  action: string;
  target: string;
  reversible: boolean;
}

const SAMPLE: Row[] = [];

export function ActivityScreen(): JSX.Element {
  const { t } = useTranslation();
  if (SAMPLE.length === 0) {
    return <p className="p-8 text-center text-gray-500">{t('activity.empty')}</p>;
  }
  return (
    <table className="w-full text-left text-xs">
      <tbody>
        {SAMPLE.map((r) => (
          <tr key={r.id} className="border-b border-edge">
            <td className="px-3 py-2 text-accent">{r.actor}</td>
            <td className="px-3 py-2">{r.action}</td>
            <td className="px-3 py-2 text-gray-400">{r.target}</td>
            <td className="px-3 py-2">
              {r.reversible && (
                <button className="rounded bg-surface px-2 py-1">{t('activity.undo')}</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
