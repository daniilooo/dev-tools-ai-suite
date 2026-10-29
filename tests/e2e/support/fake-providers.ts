import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FIXTURES = join(import.meta.dirname, "../../../apps/server/test/fixtures");

/**
 * Com `--session-id`, o Claude falso grava uma transcrição mínima onde o real gravaria
 * (`$CLAUDE_CONFIG_DIR/projects/<cwd codificado>/<id>.jsonl`), para o Agent Monitor achá-la,
 * e roda a status line passada em `--settings` (cotas, Fase 6).
 */
const FAKE_CLAUDE_SESSION = [
  'dir="$CLAUDE_CONFIG_DIR/projects/$(printf %s "$PWD" | sed "s/[^A-Za-z0-9]/-/g")"',
  'mkdir -p "$dir"',
  'printf \'{"type":"user","cwd":"%s","version":"2.1.312","timestamp":"%s","message":{"role":"user","content":"oi"}}\\n\' "$PWD" "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" > "$dir/$2.jsonl"',
  // Como o Claude Code real: com `--settings`, executa a status line configurada passando
  // `rate_limits` pela entrada padrão (renovações no futuro, relativas ao relógio atual).
  'if [ "$3" = "--settings" ]; then' +
    ` cmd=$("${process.execPath}" -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).statusLine.command)' "$4");` +
    ` now=$(date +%s); printf '{"model":{"display_name":"Opus 5.5"},"version":"2.1.312","rate_limits":{"five_hour":{"used_percentage":23.5,"resets_at":%s},"seven_day":{"used_percentage":61,"resets_at":%s}}}' $((now + 3600)) $((now + 86400)) | sh -c "$cmd" > /dev/null;` +
    " fi",
  'echo "claude-falso-interativo"',
].join("; ");

/**
 * Binários falsos de `claude` e `codex` que respondem com as fixtures oficiais.
 * Sem argumentos ou com `--session-id <uuid>` (modo interativo) só imprimem um marcador.
 * Devolve um ambiente com PATH restrito e `/bin/sh` como shell — o rc do usuário não pode
 * trazer o binário real — e raízes vazias de transcrições (`CLAUDE_CONFIG_DIR`/`CODEX_HOME`),
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
  const script = (name: string, cases: string) => {
    const file = join(bin, name);
    writeFileSync(
      file,
      `#!/bin/sh\ncase "$*" in\n${cases}\n  "") echo "${name}-falso-interativo";;\n  *) exit 2;;\nesac\n`,
    );
    chmodSync(file, 0o755);
  };
  script(
    "claude",
    `  "--version") cat "${FIXTURES}/claude-code/2.1.312/version.txt";;\n  "auth status --json") cat "${FIXTURES}/claude-code/2.1.312/auth-status.json";;\n  "--session-id "*) ${FAKE_CLAUDE_SESSION};;`,
  );
  script(
    "codex",
    `  "--version") cat "${FIXTURES}/codex/0.165.0/version.txt";;\n  "login status") cat "${FIXTURES}/codex/0.165.0/login-status.txt";;`,
  );
  return {
    ...process.env,
    PATH: `${bin}:/usr/bin:/bin`,
    SHELL: "/bin/sh",
    CLAUDE_CONFIG_DIR: claudeHome,
    CODEX_HOME: codexHome,
  };
}
