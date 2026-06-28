import { z } from 'zod';
import type { Tool } from '../../domain/tools/Tool.js';
import { ok, err, domainError } from '../../domain/types.js';

/**
 * Web tools (PRD §4.4). `web.fetch` retrieves a URL; `web.search` is wired to a
 * pluggable search backend (stubbed here — the packaged app injects a provider
 * or an MCP search server). Both are `read`.
 */
export interface SearchProvider {
  search(query: string, limit: number): Promise<{ title: string; url: string; snippet: string }[]>;
}

export function webTools(opts: { search?: SearchProvider; fetchImpl?: typeof fetch } = {}): Tool[] {
  const doFetch = opts.fetchImpl ?? fetch;

  const webFetch: Tool<{ url: string }, { status: number; body: string }> = {
    name: 'web.fetch',
    description: 'Fetch the text content of a URL.',
    inputSchema: z.object({ url: z.string().url().describe('Absolute URL to fetch') }),
    permission: 'read',
    reversible: true,
    async execute(input, ctx) {
      try {
        const res = await doFetch(input.url, { signal: ctx.signal });
        const body = await res.text();
        return ok({ output: { status: res.status, body: body.slice(0, 100_000) } });
      } catch (e) {
        return err(domainError('WEB_FETCH_FAILED', `Cannot fetch ${input.url}`, e));
      }
    },
  };

  const webSearch: Tool<{ query: string; limit?: number }, { results: unknown[] }> = {
    name: 'web.search',
    description: 'Search the web and return ranked results.',
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      limit: z.number().int().positive().max(20).optional().describe('Max results (default 5)'),
    }),
    permission: 'read',
    reversible: true,
    async execute(input) {
      if (!opts.search) {
        return err(domainError('WEB_SEARCH_UNCONFIGURED', 'No search provider configured'));
      }
      try {
        const results = await opts.search.search(input.query, input.limit ?? 5);
        return ok({ output: { results } });
      } catch (e) {
        return err(domainError('WEB_SEARCH_FAILED', 'Search failed', e));
      }
    },
  };

  return [webFetch, webSearch];
}
