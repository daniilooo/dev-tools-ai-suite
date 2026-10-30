import { describe, expect, it } from "vitest";
import { ensureDataDir } from "../src/core/data-dir.js";
import { InstallSecret } from "../src/core/secret.js";
import { SessionManager } from "../src/core/sessions.js";
import { tempDir } from "./helpers.js";

const secret = () => InstallSecret.loadOrCreate(ensureDataDir(tempDir()).secretFile);

describe("SessionManager", () => {
  it("cria e verifica sessão assinada com token anti-CSRF estável", () => {
    const manager = new SessionManager(secret());
    const { cookieValue, session } = manager.create();
    const verified = manager.verify(cookieValue);
    expect(verified?.id).toBe(session.id);
    expect(verified?.csrfToken).toBe(session.csrfToken);
  });

  it("rejeita cookie adulterado, expirado ou de outro segredo", () => {
    let now = 0;
    const manager = new SessionManager(secret(), 1_000, () => now);
    const { cookieValue } = manager.create();
    const [id, exp, sig] = cookieValue.split(".");
    expect(manager.verify(`${id}.${Number(exp) + 999999}.${sig}`)).toBeNull();
    expect(manager.verify(`${id}x.${exp}.${sig}`)).toBeNull();
    expect(new SessionManager(secret()).verify(cookieValue)).toBeNull();
    expect(manager.verify("lixo")).toBeNull();
    now = 2_000;
    expect(manager.verify(cookieValue)).toBeNull();
  });
});
