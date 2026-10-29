import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, HOST, login } from "./helpers.js";
import type { TestContext } from "./helpers.js";
import { extractVersion } from "../src/modules/integrations/provider-adapter.js";

let ctx: TestContext | undefined;
afterEach(async () => ctx?.close());

describe("servidor", () => {
  it("escuta somente em 127.0.0.1", async () => {
    ctx = await createTestApp();
    await ctx.server.listen({ host: "127.0.0.1", port: 0 });
    const addresses = ctx.server.addresses();
    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) expect(address.address).toBe("127.0.0.1");
  });

  it("inicia o Core sem módulos opcionais e reporta o estado", async () => {
    ctx = await createTestApp();
    const { cookie } = await login(ctx);
    const health = await ctx.server.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { host: HOST, cookie },
    });
    expect(health.json().modules.core).toBe("ok");
    const doctor = await ctx.server.inject({
      method: "GET",
      url: "/api/v1/doctor",
      headers: { host: HOST, cookie },
    });
    const report = doctor.json();
    expect(report.checks.find((c: { id: string }) => c.id === "database").status).toBe("ok");
    // Login nunca é inventado (INV-03): ou não se aplica, ou vem de comando oficial, ou é INDISPONÍVEL.
    for (const tool of report.tools) {
      if (tool.auth === null) continue;
      if (tool.auth.state === "unavailable") expect(tool.auth.category).toBe("unavailable");
      else expect(tool.auth.category).toBe("official");
    }
  });

  it("aplica cabeçalhos de segurança", async () => {
    ctx = await createTestApp();
    const response = await ctx.server.inject({ method: "GET", url: "/", headers: { host: HOST } });
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("extractVersion", () => {
  it.each([
    ["git version 2.43.0", "2.43.0"],
    ["2.1.312 (Claude Code)", "2.1.312"],
    ["codex-cli 0.162.0", "0.162.0"],
    ["ollama version is 0.40.0", "0.40.0"],
    ["sem versão", null],
  ])("%s → %s", (input, expected) => expect(extractVersion(input)).toBe(expected));
});
