import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { useJarvisStore } from '../store/useJarvisStore';

/**
 * Approval queue (PRD §7.3): each pending item shows a preview (summary, detail
 * diff/command, affected items) with Approve/Reject. Decisions flow back to the
 * core's ApprovalService over IPC.
 */
export function ApprovalsScreen(): JSX.Element {
  const { t } = useTranslation();
  const { approvals, resolveApproval } = useJarvisStore();

  if (approvals.length === 0) {
    return <p className="p-8 text-center text-gray-500">{t('approvals.empty')}</p>;
  }

  return (
    <div className="space-y-3 p-4">
      {approvals.map((a) => (
        <div key={a.id} className="rounded border border-edge bg-surface p-3">
          <div className="font-medium">{a.summary}</div>
          <div className="text-xs text-gray-500">{a.toolName}</div>
          {a.detail && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-panel p-2 text-xs text-gray-300">
              {a.detail}
            </pre>
          )}
          {a.affected && a.affected.length > 0 && (
            <div className="mt-2 text-xs text-gray-400">
              {t('approvals.affected')}: {a.affected.join(', ')}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => resolveApproval(a.id)}
              className="flex items-center gap-1 rounded bg-green-600 px-3 py-1.5 text-white"
            >
              <Check size={14} /> {t('approvals.approve')}
            </button>
            <button
              onClick={() => resolveApproval(a.id)}
              className="flex items-center gap-1 rounded bg-red-600 px-3 py-1.5 text-white"
            >
              <X size={14} /> {t('approvals.reject')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
