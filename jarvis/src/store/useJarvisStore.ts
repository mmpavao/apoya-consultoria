import { create } from 'zustand';

/**
 * UI state (PRD §4.1 Zustand). The store mirrors events streamed from the core
 * sidecar over IPC; in browser-dev it starts empty. Kept intentionally small —
 * server state (cost, audit) is fetched via TanStack Query in real screens.
 */
export type Screen =
  | 'chat'
  | 'agents'
  | 'approvals'
  | 'activity'
  | 'memory'
  | 'connectors'
  | 'settings';

export interface TimelineItem {
  id: string;
  agent: string;
  kind: 'plan' | 'text' | 'tool' | 'done' | 'error';
  text: string;
}

export interface PendingApproval {
  id: string;
  toolName: string;
  summary: string;
  detail?: string;
  affected?: string[];
}

export interface AgentCard {
  name: string;
  status: 'idle' | 'thinking' | 'acting';
  tokensIn: number;
  tokensOut: number;
}

interface JarvisState {
  screen: Screen;
  paused: boolean;
  timeline: TimelineItem[];
  approvals: PendingApproval[];
  agents: AgentCard[];
  setScreen: (s: Screen) => void;
  togglePause: () => void;
  pushTimeline: (item: TimelineItem) => void;
  addApproval: (a: PendingApproval) => void;
  resolveApproval: (id: string) => void;
}

export const useJarvisStore = create<JarvisState>((set) => ({
  screen: 'chat',
  paused: false,
  timeline: [],
  approvals: [],
  agents: [
    { name: 'SystemAgent', status: 'idle', tokensIn: 0, tokensOut: 0 },
    { name: 'FileAgent', status: 'idle', tokensIn: 0, tokensOut: 0 },
    { name: 'ResearchAgent', status: 'idle', tokensIn: 0, tokensOut: 0 },
    { name: 'CodeAgent', status: 'idle', tokensIn: 0, tokensOut: 0 },
    { name: 'IntegrationAgent', status: 'idle', tokensIn: 0, tokensOut: 0 },
  ],
  setScreen: (screen) => set({ screen }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  pushTimeline: (item) => set((s) => ({ timeline: [...s.timeline, item] })),
  addApproval: (a) => set((s) => ({ approvals: [...s.approvals, a] })),
  resolveApproval: (id) => set((s) => ({ approvals: s.approvals.filter((a) => a.id !== id) })),
}));
