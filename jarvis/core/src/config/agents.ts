import type { AgentDefinition } from '../domain/entities/Agent.js';

/**
 * The specialist roster (PRD §4.3). Each agent gets a focused system prompt and
 * a least-privilege subset of tools. Definitions are pure data — versioned and
 * testable. Adding an agent here does not touch the orchestrator.
 */
export const AGENTS: readonly AgentDefinition[] = [
  {
    name: 'SystemAgent',
    description: 'Controls the OS: opens apps, runs allowlisted shell commands, AppleScript.',
    systemPrompt:
      'You are SystemAgent. You operate the macOS system on the user\'s behalf using only the ' +
      'tools provided. Prefer the least privileged action. Never attempt to bypass approvals.',
    systemPromptVersion: '1',
    allowedTools: ['shell.run', 'notify', 'fs.read_file', 'fs.list'],
  },
  {
    name: 'FileAgent',
    description: 'Reads, writes, organises, and moves files and folders.',
    systemPrompt:
      'You are FileAgent. You manage the filesystem. Confirm destructive operations through the ' +
      'approval flow (the system enforces this). Be precise about paths.',
    systemPromptVersion: '1',
    allowedTools: ['fs.read_file', 'fs.write_file', 'fs.list', 'fs.move', 'fs.delete', 'notify'],
  },
  {
    name: 'ResearchAgent',
    description: 'Searches and fetches information from the web and summarises it.',
    systemPrompt:
      'You are ResearchAgent. Gather information with web tools, cite sources, and summarise ' +
      'faithfully. Do not fabricate facts; if a source is unavailable, say so.',
    systemPromptVersion: '1',
    allowedTools: ['web.search', 'web.fetch', 'memory.store', 'memory.recall'],
  },
  {
    name: 'CodeAgent',
    description: 'Reads and edits code and runs project commands.',
    systemPrompt:
      'You are CodeAgent. Edit code carefully and run only the commands needed to build or test. ' +
      'Explain non-obvious changes.',
    systemPromptVersion: '1',
    allowedTools: ['fs.read_file', 'fs.write_file', 'fs.list', 'shell.run'],
  },
  {
    name: 'IntegrationAgent',
    description: 'Calls external services and MCP-server tools.',
    systemPrompt:
      'You are IntegrationAgent. Use connected MCP/integration tools to fulfil the task. Validate ' +
      'inputs and surface external errors clearly.',
    systemPromptVersion: '1',
    // "*" so dynamically-registered MCP tools are usable without re-listing.
    allowedTools: ['*'],
  },
] as const;

/** Default agent the planner routes to when unsure (PRD §6.1 fallback). */
export const DEFAULT_AGENT = 'ResearchAgent';
