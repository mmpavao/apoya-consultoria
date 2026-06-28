import { z } from 'zod';
import type { Tool } from '../../domain/tools/Tool.js';
import { ok, err, domainError } from '../../domain/types.js';
import type { OSBridge } from '../osbridge/OSBridge.js';

/** Native notification tool (PRD §4.4). Side-effecting but non-destructive. */
export function notifyTool(os: OSBridge): Tool<{ title: string; body: string }, { sent: true }> {
  return {
    name: 'notify',
    description: 'Show a native desktop notification.',
    inputSchema: z.object({
      title: z.string().describe('Notification title'),
      body: z.string().describe('Notification body'),
    }),
    permission: 'write',
    reversible: false,
    async execute(input) {
      try {
        await os.notify(input.title, input.body);
        return ok({ output: { sent: true } });
      } catch (e) {
        return err(domainError('NOTIFY_FAILED', 'Notification failed', e));
      }
    },
  };
}
