import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FIXTURES = join(import.meta.dirname, "../../../apps/server/test/fixtures");

/**
 * Binários falsos de `claude` e `codex` que respondem com as fixtures oficiais.
 * Sem argumentos (modo interativo) só imprimem um marcador. Devolve um ambiente com
 * PATH restrito e `/bin/sh` como shell — o rc do usuário não pode trazer o binário real.
 */
export function fakeProvidersEnv(): NodeJS.ProcessEnv {
  const bin = join(mkdtempSync(join(tmpdir(), "devtools-e2e-bin-")), "bin");
  mkdirSync(bin);
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
    `  "--version") cat "${FIXTURES}/claude-code/2.1.312/version.txt";;\n  "auth status --json") cat "${FIXTURES}/claude-code/2.1.312/auth-status.json";;`,
  );
  script(
    "codex",
    `  "--version") cat "${FIXTURES}/codex/0.165.0/version.txt";;\n  "login status") cat "${FIXTURES}/codex/0.165.0/login-status.txt";;`,
  );
  return { ...process.env, PATH: `${bin}:/usr/bin:/bin`, SHELL: "/bin/sh" };
}
