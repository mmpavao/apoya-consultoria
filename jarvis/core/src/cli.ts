import { bootstrap } from './bootstrap.js';
import type { OrchestratorEvent } from './application/Orchestrator.js';

/**
 * Minimal CLI to exercise the orchestrator without the desktop shell
 * (PRD §9 Phase 1 "Orchestrator funcionando via CLI/log"). Auto-approves
 * nothing — destructive/non-allowlisted actions will block awaiting a decision,
 * which here we surface and reject so the CLI never performs them unattended.
 *
 *   ANTHROPIC_API_KEY=... node dist/cli.js "Pesquise X e salve um resumo"
 */
async function main(): Promise<void> {
  const intent = process.argv.slice(2).join(' ').trim();
  if (!intent) {
    console.error('usage: jarvis "<intenção>"');
    process.exit(1);
  }

  const jarvis = bootstrap();
  const session = jarvis.sessions.create(intent.slice(0, 60));

  // Unattended CLI: reject anything needing human approval rather than act blind.
  jarvis.approvals.onEvent((e) => {
    if (e.type === 'requested') {
      console.log(`\n[approval needed] ${e.request.preview.summary} — rejecting (unattended)`);
      jarvis.approvals.decide(e.request.id, 'rejected', 'unattended CLI');
    }
  });

  await jarvis.orchestrator.handleIntent(intent, { sessionId: session.id }, render);

  const cost = jarvis.cost.sessionCost(session.id);
  console.log(
    `\n— tokens in/out: ${cost.inputTokens}/${cost.outputTokens} · cost ~$${cost.costUsd.toFixed(4)}`,
  );
}

function render(e: OrchestratorEvent): void {
  switch (e.type) {
    case 'plan_created':
      console.log(`\nPlan (${e.plan.steps.length} steps):`);
      for (const s of e.plan.steps) console.log(`  ${s.index}. [${s.agent}] ${s.instruction}`);
      break;
    case 'step_started':
      console.log(`\n▶ step ${e.step} → ${e.agent}`);
      break;
    case 'agent_event':
      if (e.kind === 'agent_text' && e.text) console.log(`  ${e.agent}: ${e.text}`);
      else if (e.kind === 'tool_call') console.log(`  ↳ tool ${e.toolName}`);
      else if (e.kind === 'tool_result') console.log(`  ↳ result (${e.ok ? 'ok' : 'error'})`);
      break;
    case 'done':
      console.log(`\n✅ ${e.summary}`);
      break;
    case 'error':
      console.error(`\n❌ ${e.message}`);
      break;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
