import { describe, expect, it } from "vitest";
import { CliTokenVerifier, createCliToken } from "../src/core/cli-auth.js";
import { ensureDataDir } from "../src/core/data-dir.js";
import { InstallSecret } from "../src/core/secret.js";
import { tempDir } from "./helpers.js";

const secret = () => InstallSecret.loadOrCreate(ensureDataDir(tempDir()).secretFile);

describe("token descartável do CLI", () => {
  it("não contém o segredo de instalação", () => {
    const s = secret();
    expect(createCliToken(s)).not.toContain(s.redactionValue());
  });

  it("vale uma única vez", () => {
    const s = secret();
    const verifier = new CliTokenVerifier(s);
    const token = createCliToken(s);
    expect(verifier.verify(token)).toBe(true);
    expect(verifier.verify(token)).toBe(false);
  });

  it("expira em 30 s e rejeita relógio adiantado", () => {
    const s = secret();
    let now = 1_000_000;
    const verifier = new CliTokenVerifier(s, () => now);
    const token = createCliToken(s, now);
    now += 30_001;
    expect(verifier.verify(token)).toBe(false);
    expect(verifier.verify(createCliToken(s, now + 60_000))).toBe(false);
  });

  it("rejeita token de outro segredo ou malformado", () => {
    const verifier = new CliTokenVerifier(secret());
    expect(verifier.verify(createCliToken(secret()))).toBe(false);
    expect(verifier.verify("abc")).toBe(false);
    expect(verifier.verify("")).toBe(false);
  });
});
