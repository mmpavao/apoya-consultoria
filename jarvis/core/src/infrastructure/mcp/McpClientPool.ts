import { z } from 'zod';
import type { Tool } from '../../domain/tools/Tool.js';
import { ok, err, domainError } from '../../domain/types.js';
import type { ToolRegistry } from '../../application/ToolRegistry.js';

/**
 * Connection descriptor for an MCP server (PRD §4.4, §5 mcp_servers). Secrets
 * (tokens) are resolved from the Keychain at connect time, never stored here.
 */
export interface McpServerConfig {
  id: string;
  name: string;
  transport: 'stdio' | 'http';
  /** Command (stdio) or URL (http). */
  urlOrCmd: string;
  enabled: boolean;
}

/** Minimal shape of an MCP client; the real one wraps @modelcontextprotocol/sdk. */
export interface McpConnection {
  listTools(): Promise<{ name: string; description: string; inputSchema: Record<string, unknown> }[]>;
  callTool(name: string, args: unknown): Promise<{ content: string; isError?: boolean }>;
  close(): Promise<void>;
}

export type McpConnector = (config: McpServerConfig) => Promise<McpConnection>;

/**
 * Manages connections to external MCP servers and registers their tools into
 * the shared registry with a server-name prefix (e.g. `receita.consultar_cnpj`),
 * so they are usable like any native tool (PRD §4.4). The transport connector is
 * injected — a real one uses @modelcontextprotocol/sdk; tests pass a fake.
 */
export class McpClientPool {
  private readonly connections = new Map<string, McpConnection>();
  private readonly registered = new Map<string, string[]>();

  constructor(
    private readonly registry: ToolRegistry,
    private readonly connector: McpConnector,
  ) {}

  async connect(config: McpServerConfig): Promise<{ toolNames: string[] }> {
    const conn = await this.connector(config);
    this.connections.set(config.id, conn);
    const discovered = await conn.listTools();
    const names: string[] = [];
    for (const t of discovered) {
      const tool = this.wrap(config, conn, t);
      this.registry.register(tool);
      names.push(tool.name);
    }
    this.registered.set(config.id, names);
    return { toolNames: names };
  }

  async disconnect(serverId: string): Promise<void> {
    for (const name of this.registered.get(serverId) ?? []) this.registry.unregister(name);
    this.registered.delete(serverId);
    await this.connections.get(serverId)?.close();
    this.connections.delete(serverId);
  }

  /** Connectivity probe for the Connectors screen "Test" button (PRD §7.6). */
  async test(config: McpServerConfig): Promise<{ ok: boolean; toolCount: number; error?: string }> {
    try {
      const conn = await this.connector(config);
      const tools = await conn.listTools();
      await conn.close();
      return { ok: true, toolCount: tools.length };
    } catch (e) {
      return { ok: false, toolCount: 0, error: String(e) };
    }
  }

  private wrap(
    config: McpServerConfig,
    conn: McpConnection,
    descriptor: { name: string; description: string; inputSchema: Record<string, unknown> },
  ): Tool {
    const prefixed = `${config.name}.${descriptor.name}`;
    return {
      name: prefixed,
      description: descriptor.description,
      // MCP advertises raw JSON Schema; we accept any object and let the server validate.
      inputSchema: z.record(z.string(), z.unknown()),
      permission: 'write',
      reversible: false,
      async execute(input) {
        try {
          const res = await conn.callTool(descriptor.name, input);
          return res.isError
            ? err(domainError('MCP_TOOL_ERROR', res.content))
            : ok({ output: res.content });
        } catch (e) {
          return err(domainError('MCP_CALL_FAILED', `MCP call ${prefixed} failed`, e));
        }
      },
    };
  }
}
