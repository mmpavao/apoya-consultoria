import { describe, it, expect } from 'vitest';
import { TaskQueue, InMemoryJobStore } from '../src/application/TaskQueue.js';
import { systemClock } from '../src/domain/clock.js';

let n = 0;
const ids = { next: () => `job-${n++}` };

describe('TaskQueue', () => {
  it('runs a queued job and marks it done, notifying on completion', async () => {
    n = 0;
    const completed: string[] = [];
    const queue = new TaskQueue(new InMemoryJobStore(), systemClock, ids, (j) => completed.push(j.id));
    let ran = false;
    queue.register('demo', async () => {
      ran = true;
    });
    queue.enqueue('demo', { x: 1 });
    await queue.drain();
    expect(ran).toBe(true);
    expect(completed).toHaveLength(1);
    expect(queue.list()[0]!.status).toBe('done');
  });

  it('retries then fails after maxAttempts', async () => {
    n = 0;
    const queue = new TaskQueue(new InMemoryJobStore(), systemClock, ids);
    queue.register('flaky', async () => {
      throw new Error('boom');
    });
    queue.enqueue('flaky', {}, 2);
    await queue.drain(); // attempt 1 -> requeued
    await queue.drain(); // attempt 2 -> failed
    const job = queue.list()[0]!;
    expect(job.status).toBe('failed');
    expect(job.attempts).toBe(2);
    expect(job.lastError).toMatch(/boom/);
  });
});
