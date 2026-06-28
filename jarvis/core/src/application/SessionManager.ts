import type { Session, Message } from '../domain/entities/Session.js';
import type { Clock, IdGenerator } from '../domain/clock.js';

export interface SessionStore {
  save(session: Session): void;
  get(id: string): Session | undefined;
  list(): readonly Session[];
  addMessage(message: Message): void;
  messages(sessionId: string): readonly Message[];
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly msgs = new Map<string, Message[]>();
  save(session: Session): void {
    this.sessions.set(session.id, session);
  }
  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }
  list(): readonly Session[] {
    return [...this.sessions.values()];
  }
  addMessage(message: Message): void {
    const arr = this.msgs.get(message.sessionId) ?? [];
    arr.push(message);
    this.msgs.set(message.sessionId, arr);
  }
  messages(sessionId: string): readonly Message[] {
    return this.msgs.get(sessionId) ?? [];
  }
}

export class SessionManager {
  constructor(
    private readonly store: SessionStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  create(title: string): Session {
    const now = this.clock.now();
    const session: Session = {
      id: this.ids.next(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      title,
      status: 'active',
      startedAt: now,
    };
    this.store.save(session);
    return session;
  }

  appendMessage(
    sessionId: string,
    role: Message['role'],
    content: string,
    tokens: { in?: number; out?: number } = {},
  ): Message {
    const now = this.clock.now();
    const message: Message = {
      id: this.ids.next(),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      sessionId,
      role,
      content,
      tokensIn: tokens.in ?? 0,
      tokensOut: tokens.out ?? 0,
    };
    this.store.addMessage(message);
    return message;
  }

  get(id: string): Session | undefined {
    return this.store.get(id);
  }

  list(): readonly Session[] {
    return this.store.list();
  }
}
