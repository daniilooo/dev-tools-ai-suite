import { describe, expect, it } from "vitest";
import { runProcess } from "../src/core/process-runner.js";

const posix = process.platform !== "win32";

describe.runIf(posix)("runProcess", () => {
  it("captura saída e código de saída", async () => {
    const result = await runProcess("sh", ["-c", "echo ok; echo err >&2; exit 3"]);
    expect(result.stdout.trim()).toBe("ok");
    expect(result.stderr.trim()).toBe("err");
    expect(result.exitCode).toBe(3);
  });

  it("não interpreta argumentos em shell (anti injeção)", async () => {
    const result = await runProcess("echo", ["$(echo hacked)", "; rm -rf /"]);
    expect(result.stdout.trim()).toBe("$(echo hacked) ; rm -rf /");
  });

  it("encerra a árvore de processos no timeout", async () => {
    const started = Date.now();
    const result = await runProcess("sh", ["-c", "sleep 30 & sleep 30"], { timeoutMs: 300 });
    expect(result.timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("informa executável inexistente sem lançar exceção", async () => {
    const result = await runProcess("comando-que-nao-existe-xyz", []);
    expect(result.spawnError).not.toBeNull();
  });

  it("limita a saída capturada", async () => {
    const result = await runProcess("sh", ["-c", "yes | head -c 100000"], { maxOutputBytes: 1_000 });
    expect(result.stdout.length).toBeLessThanOrEqual(1_000);
  });
});
