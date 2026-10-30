#!/usr/bin/env node
import { Command } from "commander";
import type { DoctorReport, ProviderAuth } from "@devtools/shared";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { buildApp } from "./app.js";
import { openBrowser } from "./browser.js";
import { cliAuthorizationHeader } from "./core/cli-auth.js";
import { loadConfig } from "./core/config.js";
import type { AppConfig } from "./core/config.js";
import { ensureDataDir } from "./core/data-dir.js";
import { openDatabase } from "./core/database.js";
import { InstallSecret } from "./core/secret.js";
import { runDoctor } from "./modules/system/doctor.js";
import { ProvidersService } from "./modules/integrations/providers.service.js";
import { loadPtyBackend } from "./modules/terminal/pty-backend.js";
import { VERSION } from "./version.js";

interface StartOptions {
  port?: string;
  dataDir?: string;
  open: boolean;
}

const program = new Command()
  .name("devtools")
  .description("Dev Tools AI Suite — ambiente local de desenvolvimento assistido por IA")
  .version(VERSION);

program
  .command("start")
  .description("inicia o servidor em 127.0.0.1 e abre o dashboard")
  .option("-p, --port <porta>", "porta local (padrão 4317)")
  .option("--data-dir <dir>", "diretório de dados (padrão ~/.dev-tools-ai-suite)")
  .option("--no-open", "não abre o navegador automaticamente")
  .action(async (options: StartOptions) => {
    const config = loadConfig(process.env, {
      port: options.port ? Number(options.port) : undefined,
      dataDir: options.dataDir,
    });
    await start(config, options.open);
  });

program
  .command("doctor")
  .description("diagnostica a instalação e as ferramentas de IA disponíveis")
  .option("--data-dir <dir>", "diretório de dados")
  .option("--json", "saída em JSON")
  .action(async (options: { dataDir?: string; json?: boolean }) => {
    const config = loadConfig(process.env, { dataDir: options.dataDir });
    const layout = ensureDataDir(config.dataDir);
    InstallSecret.loadOrCreate(layout.secretFile);
    const db = openDatabase(layout.database);
    const pty = await loadPtyBackend();
    const { providers } = await new ProvidersService().list();
    const report = await runDoctor(
      layout,
      db,
      { backend: pty.backend?.name ?? null, error: pty.error },
      providers,
      config.knowledge.graphifyBin,
    );
    db.close();
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else printDoctor(report);
    process.exitCode = report.checks.some((c) => c.status === "error") ? 1 : 0;
  });

async function start(config: AppConfig, open: boolean): Promise<void> {
  const layout = ensureDataDir(config.dataDir);
  const secret = InstallSecret.loadOrCreate(layout.secretFile);
  const base = `http://${config.host}:${config.port}`;

  const db = openDatabase(layout.database);
  const logFile = createWriteStream(join(layout.logs, "server.log"), { flags: "a", mode: 0o600 });
  const { server, codes } = await buildApp({ config, layout, secret, db, logStream: logFile });

  try {
    await server.listen({ host: config.host, port: config.port });
  } catch (error) {
    await server.close();
    db.close();
    if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
      await attachToRunningServer(base, secret, open);
      return;
    }
    throw error;
  }

  const code = codes.issue();
  console.log(`\n  Dev Tools AI Suite v${VERSION} rodando em ${base}`);
  console.log(`  Dados: ${layout.root}`);
  await announceAccess(base, code.token, code.short, open);
  console.log("  Ctrl+C para encerrar.\n");

  const shutdown = async () => {
    await server.close();
    db.close();
    logFile.end();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

/** Servidor já rodando nesta porta: pede um novo código com um token descartável assinado pelo segredo local. */
async function attachToRunningServer(base: string, secret: InstallSecret, open: boolean): Promise<void> {
  try {
    const response = await fetch(`${base}/api/v1/session/launch-code`, {
      method: "POST",
      headers: { authorization: cliAuthorizationHeader(secret) },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const code = (await response.json()) as { token: string; short: string };
    console.log(`\n  A suíte já está rodando em ${base}.`);
    await announceAccess(base, code.token, code.short, open);
  } catch {
    console.error(`\n  A porta de ${base} está em uso por outro processo. Use --port ou DEVTOOLS_PORT.`);
    process.exitCode = 1;
  }
}

async function announceAccess(base: string, token: string, short: string, open: boolean): Promise<void> {
  const opened = open ? await openBrowser(`${base}/#code=${token}`) : false;
  if (opened) console.log("  Dashboard aberto no navegador.");
  else console.log(`  Abra ${base} no navegador e informe o código de acesso.`);
  console.log(`  Código de acesso (uso único, expira em 60 s): ${short}`);
}

function printDoctor(report: DoctorReport): void {
  const icon = { ok: "✔", warning: "!", error: "✖", unavailable: "–" } as const;
  console.log("\nVerificações");
  for (const check of report.checks) {
    console.log(`  ${icon[check.status]} ${check.label}: ${check.detail}`);
    if (check.hint) console.log(`      ↳ ${check.hint}`);
  }
  console.log("\nFerramentas");
  for (const tool of report.tools) {
    const state = tool.installed
      ? `v${tool.version ?? "?"}`
      : tool.optional
        ? "não encontrado (opcional)"
        : "não encontrado";
    console.log(`  ${tool.installed ? "✔" : tool.optional ? "–" : "✖"} ${tool.label}: ${state}`);
    if (tool.auth) console.log(`      ↳ login: ${authText(tool.auth)}`);
  }
  console.log("");
}

function authText(auth: ProviderAuth): string {
  if (auth.state === "authenticated") {
    return `conectado${auth.method ? ` (${auth.method}${auth.plan ? `, plano ${auth.plan}` : ""})` : ""}`;
  }
  if (auth.state === "unauthenticated") return "não conectado";
  return `INDISPONÍVEL${auth.reason ? ` — ${auth.reason}` : ""}`;
}

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(`Erro: ${(error as Error).message}`);
  process.exit(1);
});
