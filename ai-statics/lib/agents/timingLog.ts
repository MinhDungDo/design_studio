import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const projectRoot = process.env.INIT_CWD || process.cwd();
const LOG_PATH = process.env.GENERATION_TIMING_LOG || join(projectRoot, ".next", "generation-timing.log");

export function timingLog(scope: string, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    scope,
    event,
    ...data,
  });

  console.info(`[${scope}] ${event}`, data);
  void mkdir(dirname(LOG_PATH), { recursive: true })
    .then(() => appendFile(LOG_PATH, `${line}\n`))
    .catch(() => {});
}

export function timingWarn(scope: string, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: "warn",
    scope,
    event,
    ...data,
  });

  console.warn(`[${scope}] ${event}`, data);
  void mkdir(dirname(LOG_PATH), { recursive: true })
    .then(() => appendFile(LOG_PATH, `${line}\n`))
    .catch(() => {});
}
