import { z } from 'zod';
import type { Tool } from '../../domain/tools/Tool.js';
import { ok, err, domainError } from '../../domain/types.js';
import type { OSBridge } from '../osbridge/OSBridge.js';

/**
 * Filesystem tools (PRD §4.4). Reads are `read`; writes/moves are `write`
 * (allowlist-gated); deletes are `destructive` (always approved). Each is a
 * self-contained file implementing the `Tool` interface — adding one never
 * touches the orchestrator (PRD §11.4).
 */
export function fsTools(os: OSBridge): Tool[] {
  const readFile: Tool<{ path: string }, { content: string }> = {
    name: 'fs.read_file',
    description: 'Read a UTF-8 text file and return its contents.',
    inputSchema: z.object({ path: z.string().describe('Absolute path to the file') }),
    permission: 'read',
    reversible: true,
    async execute(input) {
      try {
        return ok({ output: { content: await os.readFile(input.path) } });
      } catch (e) {
        return err(domainError('FS_READ_FAILED', `Cannot read ${input.path}`, e));
      }
    },
  };

  const writeFile: Tool<{ path: string; content: string }, { bytes: number }> = {
    name: 'fs.write_file',
    description: 'Write (create or overwrite) a UTF-8 text file.',
    inputSchema: z.object({
      path: z.string().describe('Absolute path to write'),
      content: z.string().describe('Full file contents'),
    }),
    permission: 'write',
    reversible: false,
    preview(input) {
      return {
        summary: `Write ${input.content.length} chars to ${input.path}`,
        detail: input.content.slice(0, 2000),
        affected: [input.path],
      };
    },
    async execute(input) {
      try {
        await os.writeFile(input.path, input.content);
        return ok({ output: { bytes: input.content.length } });
      } catch (e) {
        return err(domainError('FS_WRITE_FAILED', `Cannot write ${input.path}`, e));
      }
    },
  };

  const list: Tool<{ path: string }, { entries: { name: string; isDir: boolean }[] }> = {
    name: 'fs.list',
    description: 'List the entries of a directory.',
    inputSchema: z.object({ path: z.string().describe('Absolute directory path') }),
    permission: 'read',
    reversible: true,
    async execute(input) {
      try {
        return ok({ output: { entries: await os.list(input.path) } });
      } catch (e) {
        return err(domainError('FS_LIST_FAILED', `Cannot list ${input.path}`, e));
      }
    },
  };

  const move: Tool<{ from: string; to: string }, { moved: true }> = {
    name: 'fs.move',
    description: 'Move or rename a file or directory.',
    inputSchema: z.object({
      from: z.string().describe('Source path'),
      to: z.string().describe('Destination path'),
    }),
    permission: 'write',
    reversible: true,
    preview(input) {
      return { summary: `Move ${input.from} → ${input.to}`, affected: [input.from, input.to] };
    },
    async execute(input) {
      try {
        await os.move(input.from, input.to);
        return ok({ output: { moved: true }, meta: { reversible: true } });
      } catch (e) {
        return err(domainError('FS_MOVE_FAILED', `Cannot move ${input.from}`, e));
      }
    },
  };

  const remove: Tool<{ path: string }, { removed: true }> = {
    name: 'fs.delete',
    description: 'Delete a file or directory (recursive).',
    inputSchema: z.object({ path: z.string().describe('Path to delete') }),
    permission: 'destructive',
    reversible: false,
    preview(input) {
      return { summary: `Delete ${input.path}`, affected: [input.path] };
    },
    async execute(input) {
      try {
        await os.remove(input.path);
        return ok({ output: { removed: true } });
      } catch (e) {
        return err(domainError('FS_DELETE_FAILED', `Cannot delete ${input.path}`, e));
      }
    },
  };

  return [readFile, writeFile, list, move, remove];
}
