import type { LlmClient, LlmMessage, LlmContentBlock } from '../domain/llm/LlmClient.js';
import type { AgentDefinition } from '../domain/entities/Agent.js';
import type { ToolContext } from '../domain/tools/Tool.js';
import type { ToolRegistry } from './ToolRegistry.js';
import type { ToolExecutor } from './ToolExecutor.js';
import type { CostTracker } from './CostTracker.js';

export interface AgentStepEvent {
  kind: 'agent_text' | 'tool_call' | 'tool_result';
  agent: string;
  text?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  ok?: boolean;
}

export interface AgentRunResult {
  finalText: string;
  iterations: number;
}

/**
 * Runs one specialist agent through a ReAct tool-use loop until it stops
 * requesting tools or hits the iteration cap (PRD §4.3, §6.1 step 4). Tool
 * calls go through the ToolExecutor, so governance applies uniformly.
 */
export class AgentRunner {
  constructor(
    private readonly llm: LlmClient,
    private readonly registry: ToolRegistry,
    private readonly executor: ToolExecutor,
    private readonly cost: CostTracker,
    private readonly maxIterations = 8,
  ) {}

  async run(
    agent: AgentDefinition,
    instruction: string,
    ctx: ToolContext,
    onEvent: (e: AgentStepEvent) => void,
  ): Promise<AgentRunResult> {
    const tools = this.registry.schemasFor(agent.allowedTools);
    const messages: LlmMessage[] = [
      { role: 'user', content: [{ type: 'text', text: instruction }] },
    ];
    let finalText = '';

    for (let i = 1; i <= this.maxIterations; i++) {
      if (ctx.signal?.aborted) break;

      const res = await this.llm.complete({
        system: agent.systemPrompt,
        messages,
        tools,
        maxTokens: 2048,
      });
      this.cost.record({
        sessionId: ctx.sessionId,
        agent: agent.name,
        model: res.model,
        usage: res.usage,
      });

      const text = textOf(res.content);
      if (text) {
        finalText = text;
        onEvent({ kind: 'agent_text', agent: agent.name, text });
      }

      const toolUses = res.content.filter(
        (b): b is Extract<LlmContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
      );
      if (res.stopReason !== 'tool_use' || toolUses.length === 0) {
        return { finalText, iterations: i };
      }

      messages.push({ role: 'assistant', content: res.content });
      const results: LlmContentBlock[] = [];
      for (const call of toolUses) {
        onEvent({ kind: 'tool_call', agent: agent.name, toolName: call.name, toolInput: call.input });
        const result = await this.executor.execute({
          toolName: call.name,
          input: call.input,
          ctx,
        });
        const content = result.ok
          ? JSON.stringify(result.value.output)
          : `ERROR ${result.error.code}: ${result.error.message}`;
        onEvent({
          kind: 'tool_result',
          agent: agent.name,
          toolName: call.name,
          toolOutput: content,
          ok: result.ok,
        });
        results.push({
          type: 'tool_result',
          toolUseId: call.id,
          content,
          isError: !result.ok,
        });
      }
      messages.push({ role: 'user', content: results });
    }

    return { finalText, iterations: this.maxIterations };
  }
}

function textOf(content: LlmContentBlock[]): string {
  return content
    .filter((b): b is Extract<LlmContentBlock, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}
