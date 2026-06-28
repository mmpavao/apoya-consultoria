import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../src/application/ToolRegistry.js';
import {
  McpClientPool,
  type McpConnection,
  type McpServerConfig,
} from '../src/infrastructure/mcp/McpClientPool.js';
import { toolLogger } from '../src/infrastructure/logging/logger.js';
import type { ToolContext } from '../src/domain/tools/Tool.js';

const config: McpServerConfig = {
  id: 'srv1',
  name: 'receita',
  transport: 'http',
  urlOrCmd: 'https://example.test/mcp',
  enabled: true,
};

const ctx: ToolContext = { sessionId: 's', taskId: 't', agent: 'IntegrationAgent', log: toolLogger() };

function fakeConnection(): McpConnection {
  return {
    async listTools() {
      return [
        { name: 'consultar_cnpj', description: 'Consulta CNPJ', inputSchema: { type: 'object' } },
      ];
    },
    async callTool(name, args) {
      return { content: JSON.stringify({ name, args }) };
    },
    async close() {},
  };
}

describe('McpClientPool', () => {
  it('registers discovered tools with a server-name prefix', async () => {
    const registry = new ToolRegistry();
    const pool = new McpClientPool(registry, async () => fakeConnection());
    const { toolNames } = await pool.connect(config);
    expect(toolNames).toEqual(['receita.consultar_cnpj']);
    expect(registry.has('receita.consultar_cnpj')).toBe(true);
  });

  it('routes calls through the connection', async () => {
    const registry = new ToolRegistry();
    const pool = new McpClientPool(registry, async () => fakeConnection());
    await pool.connect(config);
    const tool = registry.get('receita.consultar_cnpj')!;
    const res = await tool.execute({ cnpj: '00.000.000/0001-00' }, ctx);
    expect(res.ok).toBe(true);
  });

  it('unregisters tools on disconnect', async () => {
    const registry = new ToolRegistry();
    const pool = new McpClientPool(registry, async () => fakeConnection());
    await pool.connect(config);
    await pool.disconnect('srv1');
    expect(registry.has('receita.consultar_cnpj')).toBe(false);
  });

  it('reports test connectivity', async () => {
    const pool = new McpClientPool(new ToolRegistry(), async () => fakeConnection());
    expect(await pool.test(config)).toEqual({ ok: true, toolCount: 1 });
  });
});
