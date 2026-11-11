export interface CommandContext {
  sessionId?: string;
  agentId?: string;
  headed: boolean;
  trace?: string;
  traceStrict: boolean;
  waitFor?: string;
  waitForGone?: string;
  waitTimeoutMs?: number;
  waitApp?: string;
  waitWindowId?: string;
  cursorOverlay: { enabled: boolean };
  [k: string]: unknown;
}

export function defaultContext(): CommandContext {
  return { headed: false, traceStrict: false, cursorOverlay: { enabled: false } };
}
