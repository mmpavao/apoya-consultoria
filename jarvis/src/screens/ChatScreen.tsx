import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { useJarvisStore } from '../store/useJarvisStore';

/**
 * Chat / Command screen (PRD §7.1): intent input + a live timeline of agent
 * steps. Submitting forwards the intent to the core sidecar over IPC; here it
 * appends to the local timeline so the layout is exercisable in browser-dev.
 */
export function ChatScreen(): JSX.Element {
  const { t } = useTranslation();
  const { timeline, pushTimeline } = useJarvisStore();
  const [input, setInput] = useState('');

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    pushTimeline({ id: crypto.randomUUID(), agent: 'you', kind: 'text', text });
    setInput('');
    // Real impl: window dispatch → core.handleIntent(text) and stream events back.
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-auto p-4">
        {timeline.length === 0 && (
          <p className="mt-20 text-center text-gray-500">{t('chat.placeholder')}</p>
        )}
        {timeline.map((item) => (
          <div key={item.id} className="rounded border border-edge bg-surface px-3 py-2">
            <span className="mr-2 text-xs uppercase text-accent">{item.agent}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-edge p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('chat.placeholder')}
          className="flex-1 rounded border border-edge bg-panel px-3 py-2 outline-none focus:border-accent"
        />
        <button
          onClick={submit}
          className="flex items-center gap-1 rounded bg-accent px-4 py-2 font-medium text-black"
        >
          <Send size={16} />
          {t('chat.send')}
        </button>
      </div>
    </div>
  );
}
