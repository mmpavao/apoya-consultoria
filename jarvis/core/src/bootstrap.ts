import { systemClock, randomIdGenerator } from './domain/clock.js';
import { ToolRegistry } from './application/ToolRegistry.js';
import { PermissionService, InMemoryPermissionStore } from './application/PermissionService.js';
import { ApprovalService } from './application/ApprovalService.js';
import { AuditLog, InMemoryAuditStore } from './application/AuditLog.js';
import { ToolExecutor } from './application/ToolExecutor.js';
import { CostTracker } from './application/CostTracker.js';
import { Planner } from './application/Planner.js';
import { AgentRunner } from './application/AgentRunner.js';
import { Orchestrator } from './application/Orchestrator.js';
import { SessionManager, InMemorySessionStore } from './application/SessionManager.js';
import { createLlmClient } from './infrastructure/llm/createLlmClient.js';
import { pricingTable } from './infrastructure/llm/modelInfo.js';
import { LocalOSBridge } from './infrastructure/osbridge/LocalOSBridge.js';
import { nativeTools } from './infrastructure/tools/registerNativeTools.js';
import {
  InMemoryVectorStore,
  HashingEmbeddingProvider,
} from './infrastructure/memory/VectorStore.js';
import { MemoryService, InMemoryFactStore } from './infrastructure/memory/MemoryService.js';
import { toolLogger } from './infrastructure/logging/logger.js';
import { AGENTS, DEFAULT_AGENT } from './config/agents.js';
import { loadSettings, type Settings } from './config/settings.js';
import type { PermissionRule } from './domain/entities/Permission.js';

export interface Jarvis {
  orchestrator: Orchestrator;
  approvals: ApprovalService;
  audit: AuditLog;
  cost: CostTracker;
  memory: MemoryService;
  sessions: SessionManager;
  registry: ToolRegistry;
  settings: Settings;
}

/**
 * Composition root (Clean Architecture wiring, PRD §4.2). Builds the whole core
 * from settings; the desktop shell calls this once and exposes the result over
 * IPC. Defaults are in-memory so the core runs standalone; production swaps the
 * stores for SQLite-backed ones without touching call sites.
 */
export function bootstrap(overrides: Partial<Settings> = {}): Jarvis {
  const settings = { ...loadSettings(), ...overrides };
  const clock = systemClock;
  const ids = randomIdGenerator;
  const log = toolLogger();

  const llm = createLlmClient({
    provider: settings.provider,
    model: settings.model,
    apiKey: settings.apiKey,
  });

  const registry = new ToolRegistry();
  const permissions = new PermissionService(new InMemoryPermissionStore(defaultAllowlist(clock.now())));
  const approvals = new ApprovalService(clock, ids);
  const audit = new AuditLog(new InMemoryAuditStore(), clock, ids);
  const executor = new ToolExecutor(registry, permissions, approvals, audit, () => ids.next());
  const cost = new CostTracker(pricingTable());

  const memory = new MemoryService(
    new InMemoryFactStore(),
    new InMemoryVectorStore(),
    new HashingEmbeddingProvider(),
    clock,
    ids,
  );

  registry.registerAll(nativeTools({ os: new LocalOSBridge(), memory }));

  const planner = new Planner(llm, AGENTS, DEFAULT_AGENT);
  const runner = new AgentRunner(llm, registry, executor, cost);
  const orchestrator = new Orchestrator(planner, runner, AGENTS, clock, ids, log);
  const sessions = new SessionManager(new InMemorySessionStore(), clock, ids);

  return { orchestrator, approvals, audit, cost, memory, sessions, registry, settings };
}

/** Seed allowlist so common safe writes don't all require approval (PRD §4.5). */
function defaultAllowlist(now: string): PermissionRule[] {
  const base = { createdAt: now, updatedAt: now, deletedAt: null, enabled: true } as const;
  return [
    { ...base, id: 'allow-tmp', scope: 'fs.path', pattern: '/tmp/*', level: 'write' },
    { ...base, id: 'allow-notify', scope: 'fs.path', pattern: '*', level: 'read' },
  ];
}
