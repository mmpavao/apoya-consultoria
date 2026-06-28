import type { Tool, ToolSchema } from '../domain/tools/Tool.js';
import { zodToJsonSchema } from './zodToJsonSchema.js';

/**
 * Central registry. Tools register themselves here; the orchestrator and agents
 * query it. Adding a capability never touches the orchestrator (PRD §4.4,
 * §11.4).
 */
export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  /** Register many, e.g. native tools at boot or MCP tools after discovery. */
  registerAll(tools: Iterable<Tool>): void {
    for (const t of tools) this.register(t);
  }

  /** Remove a tool (e.g. when an MCP server disconnects). */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): Tool[] {
    return [...this.tools.values()];
  }

  /**
   * JSON-Schema'd tool list for the LLM. When `allowed` is provided, only those
   * tools are advertised — enforcing per-agent least privilege. "*" = all.
   */
  schemasFor(allowed?: readonly string[]): ToolSchema[] {
    const visible =
      !allowed || allowed.includes('*')
        ? this.list()
        : this.list().filter((t) => allowed.includes(t.name));
    return visible.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: zodToJsonSchema(t.inputSchema),
    }));
  }
}
