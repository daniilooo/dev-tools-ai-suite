import { describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PORT, loadConfig } from "../src/core/config.js";

describe("loadConfig", () => {
  it("usa 127.0.0.1, porta padrão e diretório no home", () => {
    const config = loadConfig({});
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.dataDir).toBe(join(homedir(), ".dev-tools-ai-suite"));
  });

  it("recusa host fora do loopback (RN-01 / HG-12)", () => {
    expect(() => loadConfig({ DEVTOOLS_HOST: "0.0.0.0" })).toThrow(/não é permitido/);
    expect(() => loadConfig({ DEVTOOLS_HOST: "192.168.0.10" })).toThrow(/não é permitido/);
  });

  it("aceita localhost mas sempre faz bind em 127.0.0.1", () => {
    expect(loadConfig({ DEVTOOLS_HOST: "localhost" }).host).toBe("127.0.0.1");
  });

  it("valida a porta", () => {
    expect(() => loadConfig({ DEVTOOLS_PORT: "80" })).toThrow(/DEVTOOLS_PORT/);
    expect(() => loadConfig({ DEVTOOLS_PORT: "abc" })).toThrow(/DEVTOOLS_PORT/);
    expect(loadConfig({ DEVTOOLS_PORT: "5000" }).port).toBe(5000);
  });
});
