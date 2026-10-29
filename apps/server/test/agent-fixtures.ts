import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LocalSourceRoots } from "../src/modules/integrations/sources/local-files.js";
import { claudeProjectDirName } from "../src/modules/integrations/sources/local-files.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

export const CLAUDE_SESSION_ID = "0f6c2a8e-1d4b-4c7a-9e3f-5b2d8a1c6e90";
export const CLAUDE_SUBAGENT_ID = "a1b2c3d4e5f6a7b8c";
export const CODEX_MAIN_ID = "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5b";
export const CODEX_SUB_ID = "019a2b3c-4d5e-7f60-8a9b-0c1d2e3f4a5c";
/** Montado em tempo de execução para não ser pego pelo scanner de segredos do repositório. */
export const FIXTURE_SECRET = ["sk", "ant", "api03", "Zx9".repeat(10)].join("-");

/** Instante de referência das fixtures (último evento do Claude + 1 min). */
export const FIXTURE_NOW = Date.parse("2026-10-28T11:01:00.000Z");

function render(file: string, vars: Record<string, string>): string {
  let text = readFileSync(join(FIXTURES, file), "utf8");
  for (const [key, value] of Object.entries(vars)) text = text.split(key).join(value);
  return text;
}

/**
 * Instala as transcrições anonimizadas (Claude Code 2.1.312 e Codex 0.165.0) em raízes
 * com o mesmo layout de `~/.claude` e `~/.codex`, apontando para `projectPath`.
 * O rollout do Codex vai para o diretório do dia `codexDay` (data local).
 */
export function installAgentFixtures(
  roots: LocalSourceRoots,
  projectPath: string,
  { codexDay = new Date(FIXTURE_NOW), claudeSessionId = CLAUDE_SESSION_ID } = {},
): { claudeSession: string; claudeSubagent: string; codexMain: string; codexSub: string } {
  const vars = {
    __CWD__: projectPath,
    __SESSION__: claudeSessionId,
    __MAIN__: CODEX_MAIN_ID,
    __SUB__: CODEX_SUB_ID,
    __SECRET__: FIXTURE_SECRET,
  };
  const claudeDir = join(roots.claude, "projects", claudeProjectDirName(projectPath));
  const subDir = join(claudeDir, claudeSessionId, "subagents");
  mkdirSync(subDir, { recursive: true });
  const claudeSession = join(claudeDir, `${claudeSessionId}.jsonl`);
  const claudeSubagent = join(subDir, `agent-${CLAUDE_SUBAGENT_ID}.jsonl`);
  writeFileSync(claudeSession, render("claude-code/2.1.312/transcript/session.jsonl", vars));
  writeFileSync(claudeSubagent, render("claude-code/2.1.312/transcript/subagent.jsonl", vars));
  writeFileSync(
    join(subDir, `agent-${CLAUDE_SUBAGENT_ID}.meta.json`),
    render("claude-code/2.1.312/transcript/subagent.meta.json", vars),
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const dayDir = join(
    roots.codex,
    "sessions",
    String(codexDay.getFullYear()),
    pad(codexDay.getMonth() + 1),
    pad(codexDay.getDate()),
  );
  mkdirSync(dayDir, { recursive: true });
  const codexMain = join(dayDir, `rollout-2026-10-28T11-00-00-${CODEX_MAIN_ID}.jsonl`);
  const codexSub = join(dayDir, `rollout-2026-10-28T11-00-02-${CODEX_SUB_ID}.jsonl`);
  writeFileSync(codexMain, render("codex/0.165.0/sessions/main.jsonl", vars));
  writeFileSync(codexSub, render("codex/0.165.0/sessions/subagent.jsonl", vars));
  return { claudeSession, claudeSubagent, codexMain, codexSub };
}

/** Codex: rollout com `rate_limits`; Claude: transcrição com limite atingido (Fase 6). */
export function installQuotaFixtures(
  roots: LocalSourceRoots,
  projectPath: string,
  { codexDay = new Date(FIXTURE_NOW), claudeSessionId = CLAUDE_SESSION_ID } = {},
): { codexRollout: string; claudeTranscript: string } {
  const vars = {
    __CWD__: projectPath,
    __SESSION__: claudeSessionId,
    __MAIN__: CODEX_MAIN_ID,
    __SECRET__: FIXTURE_SECRET,
  };
  const claudeDir = join(roots.claude, "projects", claudeProjectDirName(projectPath));
  mkdirSync(claudeDir, { recursive: true });
  const claudeTranscript = join(claudeDir, `${claudeSessionId}.jsonl`);
  writeFileSync(claudeTranscript, render("claude-code/2.1.312/transcript/limit-hit.jsonl", vars));

  const pad = (n: number) => String(n).padStart(2, "0");
  const dayDir = join(
    roots.codex,
    "sessions",
    String(codexDay.getFullYear()),
    pad(codexDay.getMonth() + 1),
    pad(codexDay.getDate()),
  );
  mkdirSync(dayDir, { recursive: true });
  const codexRollout = join(dayDir, `rollout-2026-10-28T10-49-58-${CODEX_MAIN_ID}.jsonl`);
  writeFileSync(codexRollout, render("codex/0.165.0/sessions/rate-limits.jsonl", vars));
  return { codexRollout, claudeTranscript };
}

/** Entrada documentada da status line do Claude Code (2.1.312), com `rate_limits`. */
export function statusLineInput(): unknown {
  return JSON.parse(render("claude-code/2.1.312/statusline-input.json", { __SESSION__: CLAUDE_SESSION_ID }));
}
