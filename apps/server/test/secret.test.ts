import { describe, expect, it } from "vitest";
import { chmodSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ensureDataDir } from "../src/core/data-dir.js";
import { InstallSecret } from "../src/core/secret.js";
import { tempDir } from "./helpers.js";

const posix = process.platform !== "win32";

describe("InstallSecret", () => {
  it("gera segredo de 256 bits com permissão 0600 e reutiliza na próxima carga", () => {
    const layout = ensureDataDir(join(tempDir(), "data"));
    const first = InstallSecret.loadOrCreate(layout.secretFile);
    if (posix) {
      expect(statSync(layout.secretFile).mode & 0o777).toBe(0o600);
      expect(statSync(layout.root).mode & 0o777).toBe(0o700);
    }
    expect(readFileSync(layout.secretFile, "utf8")).toMatch(/^[0-9a-f]{64}$/);
    const second = InstallSecret.loadOrCreate(layout.secretFile);
    expect(second.redactionValue()).toBe(first.redactionValue());
  });

  it.runIf(posix)("restringe permissões abertas demais", () => {
    const layout = ensureDataDir(tempDir());
    InstallSecret.loadOrCreate(layout.secretFile);
    chmodSync(layout.secretFile, 0o644);
    InstallSecret.loadOrCreate(layout.secretFile);
    expect(statSync(layout.secretFile).mode & 0o777).toBe(0o600);
  });

  it("produz HMAC determinístico por segredo", () => {
    const a = InstallSecret.loadOrCreate(ensureDataDir(tempDir()).secretFile);
    const b = InstallSecret.loadOrCreate(ensureDataDir(tempDir()).secretFile);
    expect(a.hmac("x")).toBe(a.hmac("x"));
    expect(a.hmac("x")).not.toBe(b.hmac("x"));
  });
});
