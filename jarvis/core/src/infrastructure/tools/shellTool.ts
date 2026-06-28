import { z } from 'zod';
import type { Tool } from '../../domain/tools/Tool.js';
import { ok, err, domainError } from '../../domain/types.js';
import type { OSBridge } from '../osbridge/OSBridge.js';

export interface ShellPolicy {
  /** Binaries the agent may invoke. */
  allowedBinaries: string[];
  /** Substrings that, if present anywhere, block the command. */
  blockedPaths: string[];
  timeoutMs: number;
}

export const DEFAULT_SHELL_POLICY: ShellPolicy = {
  allowedBinaries: ['ls', 'cat', 'echo', 'pwd', 'grep', 'find', 'git', 'node', 'npm', 'wc', 'head', 'tail'],
  blockedPaths: ['~/.ssh', '/.ssh/', '/System', '/etc/', '/private/etc', 'id_rsa', '.aws/credentials'],
  timeoutMs: 30_000,
};

/** Operators that could chain or escalate commands past the allowlist. */
const FORBIDDEN_TOKENS = ['&&', '||', ';', '|', '`', '$(', '>', '<', 'sudo'];

/**
 * Sandboxed shell (PRD §4.5). Hardened: binary allowlist, no shell operators,
 * blocked sensitive paths, no sudo, enforced timeout. Marked `destructive` so a
 * command outside the allowlist always escalates to approval.
 */
export function shellTool(os: OSBridge, policy: ShellPolicy = DEFAULT_SHELL_POLICY): Tool {
  return {
    name: 'shell.run',
    description:
      'Run a single allowlisted shell command (no pipes, redirects, chaining, or sudo). ' +
      `Allowed binaries: ${policy.allowedBinaries.join(', ')}.`,
    inputSchema: z.object({ command: z.string().describe('The command to run') }),
    permission: 'destructive',
    reversible: false,
    preview(input: { command: string }) {
      return { summary: `Run: ${input.command}`, detail: input.command };
    },
    async execute(input: { command: string }, ctx) {
      const violation = validate(input.command, policy);
      if (violation) return err(domainError('SHELL_BLOCKED', violation));
      try {
        const result = await os.runShell(input.command, {
          timeoutMs: policy.timeoutMs,
          signal: ctx.signal,
        });
        return ok({ output: result });
      } catch (e) {
        return err(domainError('SHELL_FAILED', 'Command execution failed', e));
      }
    },
  };
}

/** Returns a human-readable reason if the command is disallowed, else null. */
export function validate(command: string, policy: ShellPolicy): string | null {
  const trimmed = command.trim();
  if (!trimmed) return 'Empty command';
  for (const token of FORBIDDEN_TOKENS) {
    if (trimmed.includes(token)) return `Forbidden operator: ${token}`;
  }
  for (const blocked of policy.blockedPaths) {
    if (trimmed.includes(blocked)) return `Blocked path: ${blocked}`;
  }
  const bin = trimmed.split(/\s+/)[0] ?? '';
  if (!policy.allowedBinaries.includes(bin)) return `Binary not allowlisted: ${bin}`;
  return null;
}
