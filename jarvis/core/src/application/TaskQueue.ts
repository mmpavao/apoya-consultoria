import type { Clock, IdGenerator } from '../domain/clock.js';

export type QueuedJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface QueuedJob {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: QueuedJobStatus;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
}

export type JobHandler = (job: QueuedJob, signal: AbortSignal) => Promise<void>;

/**
 * Persistence boundary for the queue (outbox pattern, PRD §4.1). The in-memory
 * implementation is the test/dev default; production swaps in a SQLite-backed
 * store so the queue survives restarts (PRD §8 reliability).
 */
export interface JobStore {
  enqueue(job: QueuedJob): void;
  update(job: QueuedJob): void;
  /** Jobs eligible to run (queued, or running orphaned by a crash). */
  claimable(): QueuedJob[];
  list(): readonly QueuedJob[];
}

export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, QueuedJob>();
  enqueue(job: QueuedJob): void {
    this.jobs.set(job.id, job);
  }
  update(job: QueuedJob): void {
    this.jobs.set(job.id, job);
  }
  claimable(): QueuedJob[] {
    return [...this.jobs.values()].filter((j) => j.status === 'queued' || j.status === 'running');
  }
  list(): readonly QueuedJob[] {
    return [...this.jobs.values()];
  }
}

/**
 * Background worker for long/recurring tasks (PRD §4.3, §6.3). Runs jobs off
 * the interactive loop, retrying with bounded attempts and emitting completion
 * so the UI can surface a native notification.
 */
export class TaskQueue {
  private readonly handlers = new Map<string, JobHandler>();
  private controller: AbortController | null = null;
  private running = false;

  constructor(
    private readonly store: JobStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly onComplete?: (job: QueuedJob) => void,
  ) {}

  register(kind: string, handler: JobHandler): void {
    this.handlers.set(kind, handler);
  }

  enqueue(kind: string, payload: Record<string, unknown>, maxAttempts = 3): QueuedJob {
    const now = this.clock.now();
    const job: QueuedJob = {
      id: this.ids.next(),
      kind,
      payload,
      status: 'queued',
      attempts: 0,
      maxAttempts,
      createdAt: now,
      updatedAt: now,
      lastError: null,
    };
    this.store.enqueue(job);
    return job;
  }

  /** Drain claimable jobs once. The desktop app calls this on a timer/event. */
  async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.controller = new AbortController();
    try {
      for (const job of this.store.claimable()) {
        if (this.controller.signal.aborted) break;
        await this.process(job, this.controller.signal);
      }
    } finally {
      this.running = false;
    }
  }

  /** Kill switch — aborts the active drain (PRD §4.5). */
  stop(): void {
    this.controller?.abort();
  }

  list(): readonly QueuedJob[] {
    return this.store.list();
  }

  private async process(job: QueuedJob, signal: AbortSignal): Promise<void> {
    const handler = this.handlers.get(job.kind);
    if (!handler) {
      this.fail(job, `no handler for kind ${job.kind}`);
      return;
    }
    job.status = 'running';
    job.attempts += 1;
    job.updatedAt = this.clock.now();
    this.store.update(job);
    try {
      await handler(job, signal);
      job.status = 'done';
      job.updatedAt = this.clock.now();
      this.store.update(job);
      this.onComplete?.(job);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (job.attempts >= job.maxAttempts) this.fail(job, message);
      else {
        job.status = 'queued';
        job.lastError = message;
        job.updatedAt = this.clock.now();
        this.store.update(job);
      }
    }
  }

  private fail(job: QueuedJob, message: string): void {
    job.status = 'failed';
    job.lastError = message;
    job.updatedAt = this.clock.now();
    this.store.update(job);
    this.onComplete?.(job);
  }
}
