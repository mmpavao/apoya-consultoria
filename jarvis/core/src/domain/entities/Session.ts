import type { AuditFields } from '../types.js';

export type SessionStatus = 'active' | 'paused' | 'closed';

export interface Session extends AuditFields {
  title: string;
  status: SessionStatus;
  startedAt: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message extends AuditFields {
  sessionId: string;
  role: MessageRole;
  content: string;
  tokensIn: number;
  tokensOut: number;
}
