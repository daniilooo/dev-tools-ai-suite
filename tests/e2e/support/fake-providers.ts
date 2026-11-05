import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

const FIXTURES = join(import.meta.dirname, "../../../apps/server/test/fixtures");
const IS_WINDOWS = process.platform === "win32";

/**
 * Implementação única (Node) do `claude` e do `codex` falsos, chamada por shims por plataforma:
 * script `sh` no Linux e `.cmd` no Windows — o mesmo formato dos shims do npm, que a suíte
 * precisa resolver (ADR-0015).
 *
 * Com `--session-id`, o Claude falso grava uma transcrição mínima onde o real gravaria
 * (`$CLAUDE_CONFIG_DIR/projects/<cwd codificado>/<id>.jsonl`), para o Agent Monitor achá-la,
 * e roda a status line passada em `--settings` (cotas, Fase 6), como o Claude Code real:
 * pelo shell, com `rate_limits` na entrada padrão. `FAKE_CLAUDE_BANNER` troca o marcador
 * impresso no modo interativo (`{cwd}` vira o diretório atual).
 */
const FAKE_CLI = `
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const FIXTURES = ${JSON.stringify(FIXTURES)};
const [name, ...args] = process.argv.slice(2);
const all = args.join(" ");
const fixture = (file) => process.stdout.write(readFileSync(join(FIXTURES, file), "utf8"));
const interactive = () =>
  console.log(
    name === "claude" && process.env.FAKE_CLAUDE_BANNER
      ? process.env.FAKE_CLAUDE_BANNER.replaceAll("{cwd}", process.cwd())
      : name + "-falso-interativo",
  );
if (name === "claude" && all === "--version") fixture("claude-code/2.1.312/version.txt");
else if (name === "claude" && all === "auth status --json") fixture("claude-code/2.1.312/auth-status.json");
else if (name === "codex" && all === "--version") fixture("codex/0.165.0/version.txt");
else if (name === "codex" && all === "login status") fixture("codex/0.165.0/login-status.txt");
else if (all === "") interactive();
else if (name === "claude" && args[0] === "--session-id") {
  const cwd = process.cwd();
  const dir = join(process.env.CLAUDE_CONFIG_DIR, "projects", cwd.replace(/[^A-Za-z0-9]/g, "-"));
  mkdirSync(dir, { recursive: true });
  const record = { type: "user", cwd, version: "2.1.312", timestamp: new Date().toISOString(), message: { role: "user", content: "oi" } };
  writeFileSync(join(dir, args[1] + ".jsonl"), JSON.stringify(record) + "\\n");
  if (args[2] === "--settings") {
    const command = JSON.parse(readFileSync(args[3], "utf8")).statusLine.command;
    const now = Math.floor(Date.now() / 1000);
    const input = JSON.stringify({
      model: { display_name: "Opus 5.5" },
      version: "2.1.312",
      rate_limits: {
        five_hour: { used_percentage: 23.5, resets_at: now + 3600 },
        seven_day: { used_percentage: 61, resets_at: now + 86400 },
      },
    });
    spawnSync(command, { shell: true, input, stdio: ["pipe", "ignore", "inherit"] });
  }
  interactive();
} else process.exit(2);
`;

/**
 * Binários falsos de `claude` e `codex` que respondem com as fixtures oficiais.
 * Devolve um ambiente com PATH restrito (o rc do usuário não pode trazer o binário real),
 * `/bin/sh` como shell no Linux e raízes vazias de transcrições (`CLAUDE_CONFIG_DIR`/`CODEX_HOME`),
 * para o Agent Monitor nunca ler o `~/.claude` real.
 */
export function fakeProvidersEnv(): NodeJS.ProcessEnv {
  const root = mkdtempSync(join(tmpdir(), "devtools-e2e-bin-"));
  const bin = join(root, "bin");
  mkdirSync(bin);
  const claudeHome = join(root, "claude");
  const codexHome = join(root, "codex");
  mkdirSync(claudeHome);
  mkdirSync(codexHome);
  const cli = join(bin, "fake-cli.mjs");
  writeFileSync(cli, FAKE_CLI);
  for (const name of ["claude", "codex"]) {
    if (IS_WINDOWS) {
      writeFileSync(join(bin, `${name}.cmd`), `@"${process.execPath}" "${cli}" ${name} %*\r\n`);
    } else {
      const file = join(bin, name);
      writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${cli}" ${name} "$@"\n`);
      chmodSync(file, 0o755);
    }
  }
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_CONFIG_DIR: claudeHome,
    CODEX_HOME: codexHome,
  };
  if (IS_WINDOWS) {
    // O Windows precisa do System32 e do git do sistema; o binário falso vem antes de tudo.
    const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "Path";
    env[pathKey] = [bin, env[pathKey]].join(delimiter);
  } else {
    env.PATH = `${bin}:/usr/bin:/bin`;
    env.SHELL = "/bin/sh";
  }
  return env;
}
