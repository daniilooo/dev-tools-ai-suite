import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openLogFile } from "../src/core/log-file.js";
import { tempDir } from "./helpers.js";

const write = (stream: ReturnType<typeof openLogFile>, text: string) =>
  new Promise<void>((resolve) => stream.end(text, resolve));

describe("log em arquivo (TD-03)", () => {
  it("acrescenta ao log existente enquanto ele é pequeno", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "server.log"), "antes\n");
    await write(openLogFile(dir, 1024), "depois\n");
    expect(readFileSync(join(dir, "server.log"), "utf8")).toBe("antes\ndepois\n");
    expect(existsSync(join(dir, "server.log.1"))).toBe(false);
  });

  it("gira o log grande para server.log.1 e começa outro com permissão 0600", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "server.log.1"), "bem antigo\n");
    writeFileSync(join(dir, "server.log"), "x".repeat(2048));
    await write(openLogFile(dir, 1024), "novo\n");
    expect(readFileSync(join(dir, "server.log"), "utf8")).toBe("novo\n");
    expect(readFileSync(join(dir, "server.log.1"), "utf8")).toHaveLength(2048);
    expect(statSync(join(dir, "server.log")).mode & 0o777).toBe(0o600);
  });
});
