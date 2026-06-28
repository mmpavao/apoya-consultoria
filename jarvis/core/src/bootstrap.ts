import { systemClock, randomIdGenerator } from './domain/clock.js';
import { ToolRegistry } from './application/ToolRegistry.js';
import {
  PermissionService,
  InMemoryPermissionStore,
  type PermissionStore,
} from './application/PermissionService.js';
import { ApprovalService } from './application/ApprovalService.js';
import { AuditLog, InMemoryAuditStore, type AuditStore } from './application/AuditLog.js';
import { ToolExecutor } from './application/ToolExecutor.js';
import { CostTracker } from './application/CostTracker.js';
import { Planner } from './application/Planner.js';
import { AgentRunner } from './application/AgentRunner.js';
import { Orchestrator } from './application/Orchestrator.js';
import {
  SessionManager,
  InMemorySessionStore,
  type SessionStore,
} from './application/SessionManager.js';
import { TaskQueue, InMemoryJobStore, type JobStore } from './application/TaskQueue.js';
import { createLlmClient } from './infrastructure/llm/createLlmClient.js';
import { pricingTable } from './infrastructure/llm/modelInfo.js';
import { LocalOSBridge } from './infrastructure/osbridge/LocalOSBridge.js';
import { nativeTools } from './infrastructure/tools/registerNativeTools.js';
import {
  InMemoryVectorStore,
  HashingEmbeddingProvider,
  type VectorStore,
} from './infrastructure/memory/VectorStore.js';
import {
  MemoryService,
  InMemoryFactStore,
  type MemoryFactStore,
} from './infrastructure/memory/MemoryService.js';
import { openDatabase, type Db } from './infrastructure/db/Database.js';
import {
  SqliteSessionStore,
  SqliteAuditStore,
  SqliteJobStore,
  SqlitePermissionStore,
  SqliteFactStore,
  SqliteVectorStore,
} from './infrastructure/db/sqliteStores.js';
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
  queue: TaskQueue;
  registry: ToolRegistry;
  settings: Settings;
  /** Underlying SQLite handle when persistence is enabled, else null. */
  db: Db | null;
}

/**
 * Composition root (Clean Architecture wiring, PRD §4.2). Builds the whole core
 * from settings. With `dbPath` set, every store is SQLite-backed and survives
 * restart (PRD §8); otherwise in-memory. The swap is confined to this file —
 * no call site changes — which is exactly the persistence-boundary claim.
 */
export function bootstrap(overrides: Partial<Settings> = {}): Jarvis {
  const settings = { ...loadSettings(), ...overrides };
  const clock = systemClock;
  const ids = randomIdGenerator;
  const log = toolLogger();

  const db: Db | null =
    settings.dbPath && settings.dbPath !== ':memory:' ? openDatabase(settings.dbPath) : null;

  const llm = createLlmClient({
    provider: settings.provider,
    model: settings.model,
    apiKey: settings.apiKey,
  });

  // Pick persistent or in-memory stores — the only place the choice is made.
  const sessionStore: SessionStore = db ? new SqliteSessionStore(db) : new InMemorySessionStore();
  const auditStore: AuditStore = db ? new SqliteAuditStore(db) : new InMemoryAuditStore();
  const jobStore: JobStore = db ? new SqliteJobStore(db) : new InMemoryJobStore();
  const factStore: MemoryFactStore = db ? new SqliteFactStore(db) : new InMemoryFactStore();
  const vectorStore: VectorStore = db ? new SqliteVectorStore(db) : new InMemoryVectorStore();
  const permissionStore = buildPermissionStore(db, clock.now());

  const registry = new ToolRegistry();
  const permissions = new PermissionService(permissionStore);
  const approvals = new ApprovalService(clock, ids);
  const audit = new AuditLog(auditStore, clock, ids);
  const executor = new ToolExecutor(registry, permissions, approvals, audit, () => ids.next());
  const cost = new CostTracker(pricingTable());

  const memory = new MemoryService(factStore, vectorStore, new HashingEmbeddingProvider(), clock, ids);

  registry.registerAll(nativeTools({ os: new LocalOSBridge(), memory }));

  const planner = new Planner(llm, AGENTS, DEFAULT_AGENT);
  const runner = new AgentRunner(llm, registry, executor, cost);
  const orchestrator = new Orchestrator(planner, runner, AGENTS, clock, ids, log);
  const sessions = new SessionManager(sessionStore, clock, ids);
  const queue = new TaskQueue(jobStore, clock, ids);

  return { orchestrator, approvals, audit, cost, memory, sessions, queue, registry, settings, db };
}

function buildPermissionStore(db: Db | null, now: string): PermissionStore {
  const rules = defaultAllowlist(now);
  if (!db) return new InMemoryPermissionStore(rules);
  const store = new SqlitePermissionStore(db);
  for (const rule of rules) store.insert(rule); // idempotent seed
  return store;
}

/** Seed allowlist so common safe writes don't all require approval (PRD §4.5). */
function defaultAllowlist(now: string): PermissionRule[] {
  const base = { createdAt: now, updatedAt: now, deletedAt: null, enabled: true } as const;
  return [
    { ...base, id: 'allow-tmp', scope: 'fs.path', pattern: '/tmp/*', level: 'write' },
    { ...base, id: 'allow-notify', scope: 'fs.path', pattern: '*', level: 'read' },
  ];
}
