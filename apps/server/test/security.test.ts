import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestApp, HOST, login, ORIGIN } from "./helpers.js";
import type { TestContext } from "./helpers.js";

let ctx: TestContext;
beforeEach(async () => (ctx = await createTestApp()));
afterEach(async () => ctx.close());

const get = (url: string, headers: Record<string, string> = {}) =>
  ctx.server.inject({ method: "GET", url, headers: { host: HOST, ...headers } });

describe("autenticação local (ADR-0007, INV-01)", () => {
  it("recusa API sem sessão com 401", async () => {
    for (const url of ["/api/v1/health", "/api/v1/projects", "/api/v1/doctor", "/api/v1/session"]) {
      expect((await get(url)).statusCode, url).toBe(401);
    }
  });

  it("troca código de uso único por cookie HttpOnly SameSite=Strict", async () => {
    const code = ctx.codes.issue();
    const response = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/session/exchange",
      headers: { host: HOST, origin: ORIGIN },
      payload: { code: code.token },
    });
    expect(response.statusCode).toBe(200);
    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\//);

    const reuse = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/session/exchange",
      headers: { host: HOST, origin: ORIGIN },
      payload: { code: code.token },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it("aceita sessão válida e devolve o token anti-CSRF", async () => {
    const { cookie, csrf } = await login(ctx);
    const response = await get("/api/v1/session", { cookie });
    expect(response.statusCode).toBe(200);
    expect(response.json().csrfToken).toBe(csrf);
    expect((await get("/api/v1/health", { cookie })).statusCode).toBe(200);
  });

  it("aceita o Bearer do CLI local e recusa Bearer inválido", async () => {
    const ok = await get("/api/v1/health", { authorization: `Bearer ${ctx.secret.toBearer()}` });
    expect(ok.statusCode).toBe(200);
    const bad = await get("/api/v1/health", { authorization: `Bearer ${"0".repeat(64)}` });
    expect(bad.statusCode).toBe(401);
  });

  it("só emite novo código de acesso para o CLI (Bearer), não para sessão do navegador", async () => {
    const { cookie, csrf } = await login(ctx);
    const viaBrowser = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/session/launch-code",
      headers: { host: HOST, origin: ORIGIN, cookie, "x-csrf-token": csrf },
    });
    expect(viaBrowser.statusCode).toBe(401);
    const viaCli = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/session/launch-code",
      headers: { host: HOST, authorization: `Bearer ${ctx.secret.toBearer()}` },
    });
    expect(viaCli.statusCode).toBe(200);
  });

  it("limita tentativas de troca de código", async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) {
      last = (
        await ctx.server.inject({
          method: "POST",
          url: "/api/v1/session/exchange",
          headers: { host: HOST, origin: ORIGIN },
          payload: { code: "ERRADO" },
        })
      ).statusCode;
    }
    expect(last).toBe(429);
  });
});

describe("Host, Origin e CSRF", () => {
  it("recusa Host diferente de 127.0.0.1/localhost na porta (anti DNS rebinding)", async () => {
    const { cookie } = await login(ctx);
    for (const host of ["evil.example:4317", "127.0.0.1:9999", "0.0.0.0:4317"]) {
      expect((await get("/api/v1/health", { host, cookie })).statusCode, host).toBe(403);
    }
    expect((await get("/api/v1/health", { host: "localhost:4317", cookie })).statusCode).toBe(200);
  });

  it("recusa Origin de outro site, inclusive na troca de código", async () => {
    const code = ctx.codes.issue();
    const response = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/session/exchange",
      headers: { host: HOST, origin: "https://evil.example" },
      payload: { code: code.token },
    });
    expect(response.statusCode).toBe(403);
    expect(ctx.codes.consume(code.token)).toBe(true); // o código não foi consumido
  });

  it("exige token anti-CSRF em métodos com efeito colateral", async () => {
    const { cookie, csrf } = await login(ctx);
    const payload = { path: ctx.dataDir };
    const noToken = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: { host: HOST, origin: ORIGIN, cookie },
      payload,
    });
    expect(noToken.statusCode).toBe(403);
    const wrongToken = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: { host: HOST, origin: ORIGIN, cookie, "x-csrf-token": "x" },
      payload,
    });
    expect(wrongToken.statusCode).toBe(403);
    const ok = await ctx.server.inject({
      method: "POST",
      url: "/api/v1/projects",
      headers: { host: HOST, origin: ORIGIN, cookie, "x-csrf-token": csrf },
      payload,
    });
    expect(ok.statusCode).toBe(201);
  });

  it("não emite cabeçalhos CORS", async () => {
    const { cookie } = await login(ctx);
    const response = await get("/api/v1/health", { cookie, origin: ORIGIN });
    expect(Object.keys(response.headers).some((h) => h.startsWith("access-control-"))).toBe(false);
  });
});

describe("segredo de instalação nunca vaza", () => {
  it("não aparece em respostas nem em logs, mesmo usado como Bearer", async () => {
    const bearer = ctx.secret.toBearer();
    const { cookie } = await login(ctx);
    const bodies = [
      (await get("/api/v1/health", { authorization: `Bearer ${bearer}` })).body,
      (await get("/api/v1/session", { cookie })).body,
      (await get("/api/v1/doctor", { cookie })).body,
    ];
    ctx.server.log.info(`teste de vazamento ${bearer}`);
    for (const body of bodies) expect(body).not.toContain(bearer);
    const logs = ctx.logs.join("");
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).not.toContain(bearer);
    expect(readFileSync(ctx.layout.secretFile, "utf8")).toBe(bearer);
  });
});
