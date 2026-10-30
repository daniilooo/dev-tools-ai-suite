import { describe, expect, it } from "vitest";
import { terminalEnv } from "../src/modules/terminal/terminal-manager.js";
import { OutputBuffer } from "../src/modules/terminal/output-buffer.js";
import { parseClientMessage } from "../src/modules/terminal/terminal.routes.js";

describe("OutputBuffer", () => {
  it("guarda tudo enquanto cabe no limite", () => {
    const buffer = new OutputBuffer(10);
    buffer.append("abc");
    buffer.append("def");
    expect(buffer.snapshot()).toBe("abcdef");
  });

  it("descarta o início ao exceder o limite", () => {
    const buffer = new OutputBuffer(5);
    buffer.append("abc");
    buffer.append("defg");
    expect(buffer.snapshot()).toBe("cdefg");
    expect(buffer.length).toBe(5);
    buffer.append("0123456789");
    expect(buffer.snapshot()).toBe("56789");
  });
});

describe("parseClientMessage", () => {
  it("aceita input e resize válidos", () => {
    expect(parseClientMessage('{"type":"input","data":"ls\\r"}')).toEqual({ type: "input", data: "ls\r" });
    expect(parseClientMessage('{"type":"resize","cols":80,"rows":24}')).toEqual({
      type: "resize",
      cols: 80,
      rows: 24,
    });
  });

  it("ignora mensagens malformadas ou desconhecidas", () => {
    for (const raw of [
      "não é json",
      "null",
      '{"type":"input","data":42}',
      '{"type":"resize","cols":"80","rows":24}',
      '{"type":"exec","cmd":"rm -rf /"}',
    ]) {
      expect(parseClientMessage(raw)).toBeNull();
    }
  });
});

describe("terminalEnv", () => {
  it("remove a identidade de uma sessão do Claude Code que tenha iniciado o servidor", () => {
    const env = terminalEnv({
      PATH: "/usr/bin",
      CLAUDECODE: "1",
      CLAUDE_PID: "123",
      CLAUDE_EFFORT: "high",
      CLAUDE_CODE_ENTRYPOINT: "cli",
      CLAUDE_CODE_EXECPATH: "/x/claude",
      CLAUDE_CODE_CHILD_SESSION: "1",
      CLAUDE_CODE_SESSION_ID: "abc",
      CLAUDE_CODE_SESSION_ATTENDED: "1",
      CLAUDE_CODE_BRIDGE_SESSION_ID: "def",
      CLAUDE_CODE_MESSAGING_SOCKET: "/tmp/s",
      CLAUDE_CODE_MESSAGING_TOKEN: "segredo",
      CLAUDE_CONFIG_DIR: "/home/x/.claude",
      CLAUDE_CODE_USE_BEDROCK: "1",
    });
    expect(
      Object.keys(env)
        .filter((k) => k.startsWith("CLAUDE"))
        .sort(),
    ).toEqual(["CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CONFIG_DIR"]);
  });

  it("remove variáveis DEVTOOLS_* e define o tipo do terminal", () => {
    const env = terminalEnv({ PATH: "/usr/bin", DEVTOOLS_PORT: "4317", HOME: "/home/x", VAZIO: undefined });
    expect(env).toEqual({
      PATH: "/usr/bin",
      HOME: "/home/x",
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      TERM_PROGRAM: "devtools-ai-suite",
    });
  });
});
