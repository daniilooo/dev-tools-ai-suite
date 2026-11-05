import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import { browserCommand } from "../src/browser.js";
import {
  batchCommandLine,
  escapesBase,
  findExecutable,
  isBatchFile,
  isPathWithin,
  samePath,
} from "../src/core/platform.js";

describe("plataforma (ADR-0015)", () => {
  it("resolve executáveis pelo PATH/PATHEXT no Windows, sem cair no shim .ps1", () => {
    const root = mkdtempSync(join(tmpdir(), "devtools-plat-"));
    const a = join(root, "a");
    const b = join(root, "b");
    mkdirSync(a);
    mkdirSync(b);
    writeFileSync(join(a, "claude.ps1"), "");
    writeFileSync(join(b, "claude.cmd"), "");
    writeFileSync(join(b, "codex.exe"), "");
    writeFileSync(join(b, "codex.cmd"), "");
    const env = { Path: [a, b].join(delimiter), PATHEXT: ".EXE;.CMD;.PS1" };
    expect(findExecutable("claude", env, true)).toBe(join(b, "claude.cmd"));
    expect(findExecutable("codex", env, true)).toBe(join(b, "codex.exe"));
    expect(findExecutable("ausente", env, true)).toBeNull();
    expect(findExecutable("claude", env, false)).toBe("claude");
  });

  it("monta a linha do cmd só com argumentos sem metacaracteres", () => {
    expect(isBatchFile("C:\\npm\\claude.CMD")).toBe(true);
    expect(isBatchFile("C:\\bin\\codex.exe")).toBe(false);
    expect(batchCommandLine("C:\\npm\\claude.cmd", ["auth", "status", "--json"])).toBe(
      `""C:\\npm\\claude.cmd" "auth" "status" "--json""`,
    );
    for (const bad of ["a&b", "%PATH%", 'x"y', "a|b", "a^b", "!v!", "a>b", "l\nm"]) {
      expect(() => batchCommandLine("C:\\npm\\claude.cmd", [bad])).toThrow(/recusado/);
    }
  });

  it("compara caminhos sem distinguir maiúsculas nem barras no Windows", () => {
    expect(samePath("c:\\Users\\Ana\\proj", "C:/users/ana/proj/", true)).toBe(true);
    expect(samePath("/home/ana/Proj", "/home/ana/proj", false)).toBe(false);
    expect(isPathWithin("C:\\Users\\Ana\\proj\\sub", "c:\\users\\ana\\proj", true)).toBe(true);
    expect(isPathWithin("C:\\Users\\Ana\\proj-2", "C:\\Users\\Ana\\proj", true)).toBe(false);
    expect(isPathWithin("/a/b/c", "/a/b", false)).toBe(true);
    expect(isPathWithin("/a/bc", "/a/b", false)).toBe(false);
  });

  it("caminho relativo para fora da base (inclusive outro drive) é recusado", () => {
    expect(escapesBase("..")).toBe(true);
    expect(escapesBase("../x")).toBe(true);
    expect(escapesBase("..\\x")).toBe(true);
    expect(escapesBase("/etc/passwd")).toBe(true);
    expect(escapesBase("projects/x.jsonl")).toBe(false);
    expect(escapesBase("..arquivo")).toBe(false);
  });

  it("abre o navegador no Windows sem cmd (URL com & intacta)", () => {
    const url = "http://127.0.0.1:4317/acesso?a=1&b=2";
    const [command, args] = browserCommand(url, "win32");
    expect(command.toLowerCase()).toMatch(/rundll32\.exe$/);
    expect(args).toEqual(["url.dll,FileProtocolHandler", url]);
    expect(browserCommand(url, "linux")).toEqual(["xdg-open", [url]]);
  });
});
