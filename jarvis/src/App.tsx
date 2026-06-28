import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Cpu,
  ShieldCheck,
  ScrollText,
  Brain,
  Plug,
  Settings as SettingsIcon,
  Power,
} from 'lucide-react';
import { useJarvisStore, type Screen } from './store/useJarvisStore';
import { ChatScreen } from './screens/ChatScreen';
import { AgentsScreen } from './screens/AgentsScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { ActivityScreen } from './screens/ActivityScreen';
import { MemoryScreen } from './screens/MemoryScreen';
import { ConnectorsScreen } from './screens/ConnectorsScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const NAV: { id: Screen; icon: typeof MessageSquare; key: string }[] = [
  { id: 'chat', icon: MessageSquare, key: 'nav.chat' },
  { id: 'agents', icon: Cpu, key: 'nav.agents' },
  { id: 'approvals', icon: ShieldCheck, key: 'nav.approvals' },
  { id: 'activity', icon: ScrollText, key: 'nav.activity' },
  { id: 'memory', icon: Brain, key: 'nav.memory' },
  { id: 'connectors', icon: Plug, key: 'nav.connectors' },
  { id: 'settings', icon: SettingsIcon, key: 'nav.settings' },
];

const SCREENS: Record<Screen, () => JSX.Element> = {
  chat: ChatScreen,
  agents: AgentsScreen,
  approvals: ApprovalsScreen,
  activity: ActivityScreen,
  memory: MemoryScreen,
  connectors: ConnectorsScreen,
  settings: SettingsScreen,
};

export function App(): JSX.Element {
  const { t } = useTranslation();
  const { screen, setScreen, paused, togglePause, approvals } = useJarvisStore();
  const Active = SCREENS[screen];

  return (
    <div className="flex h-screen text-sm">
      <nav className="flex w-52 shrink-0 flex-col border-r border-edge bg-panel p-2">
        <div className="px-2 py-3 text-lg font-semibold tracking-tight text-accent">JARVIS</div>
        {NAV.map(({ id, icon: Icon, key }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            aria-current={screen === id}
            className={`flex items-center gap-2 rounded px-2 py-2 text-left transition ${
              screen === id ? 'bg-surface text-white' : 'text-gray-400 hover:bg-surface/60'
            }`}
          >
            <Icon size={16} />
            <span>{t(key)}</span>
            {id === 'approvals' && approvals.length > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-xs text-black">
                {approvals.length}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={togglePause}
          className={`mt-auto flex items-center gap-2 rounded px-2 py-2 ${
            paused ? 'bg-red-600 text-white' : 'text-red-400 hover:bg-surface/60'
          }`}
        >
          <Power size={16} />
          {t('common.killSwitch')}
        </button>
      </nav>
      <main className="flex-1 overflow-auto bg-[#0b0d12]">
        <Active />
      </main>
    </div>
  );
}
