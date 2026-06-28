import type { Tool } from '../../domain/tools/Tool.js';
import type { OSBridge } from '../osbridge/OSBridge.js';
import type { MemoryService } from '../memory/MemoryService.js';
import { fsTools } from './fsTools.js';
import { shellTool, type ShellPolicy } from './shellTool.js';
import { webTools, type SearchProvider } from './webTools.js';
import { notifyTool } from './notifyTool.js';
import { memoryTools } from './memoryTools.js';

export interface NativeToolDeps {
  os: OSBridge;
  memory: MemoryService;
  search?: SearchProvider;
  shellPolicy?: ShellPolicy;
}

/** Assembles the v1 native tool set (PRD §4.4, §10 acceptance: ≥5 tools). */
export function nativeTools(deps: NativeToolDeps): Tool[] {
  return [
    ...fsTools(deps.os),
    shellTool(deps.os, deps.shellPolicy),
    ...webTools({ search: deps.search }),
    notifyTool(deps.os),
    ...memoryTools(deps.memory),
  ];
}
