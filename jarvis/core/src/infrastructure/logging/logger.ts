import pino from 'pino';
import type { ToolLogger } from '../../domain/tools/Tool.js';

/**
 * Structured logging (PRD §8 observability). Secrets must never be passed here
 * (PRD §4.5) — callers redact before logging.
 */
export const rootLogger = pino({
  level: process.env.JARVIS_LOG_LEVEL ?? 'info',
  base: { app: 'jarvis-core' },
});

/** Adapts pino to the narrow ToolLogger the domain depends on. */
export function toolLogger(bindings: Record<string, unknown> = {}): ToolLogger {
  const child = rootLogger.child(bindings);
  return {
    debug: (msg, meta) => child.debug(meta ?? {}, msg),
    info: (msg, meta) => child.info(meta ?? {}, msg),
    warn: (msg, meta) => child.warn(meta ?? {}, msg),
    error: (msg, meta) => child.error(meta ?? {}, msg),
  };
}
