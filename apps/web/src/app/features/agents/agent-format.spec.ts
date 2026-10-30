import type { AgentRun } from "@devtools/shared";
import { formatAgo, formatDuration, formatTokens, isActive, topTools, totalTokens } from "./agent-format";

describe("agent-format", () => {
  it("formata tokens em pt-BR", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(12_340)).toBe("12,3 mil");
    expect(formatTokens(2_282_136)).toBe("2,3 mi");
    expect(totalTokens({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 })).toBe(10);
  });

  it("formata durações e tempo relativo", () => {
    expect(formatDuration(4_000)).toBe("4 s");
    expect(formatDuration(-10)).toBe("1 s");
    expect(formatDuration(25 * 60_000)).toBe("25 min");
    expect(formatDuration(135 * 60_000)).toBe("2 h 15 min");
    expect(formatDuration(50 * 60 * 60_000)).toBe("2 d 2 h");
    const now = Date.parse("2026-10-28T10:10:00.000Z");
    expect(formatAgo("2026-10-28T10:09:30.000Z", now)).toBe("agora");
    expect(formatAgo("2026-10-28T10:00:00.000Z", now)).toBe("há 10 min");
  });

  it("ordena ferramentas por uso e considera ativo só o que ainda pode mudar", () => {
    expect(topTools({ Read: 2, Bash: 5, Edit: 2, Grep: 1, Agent: 1 }, 3)).toEqual([
      { name: "Bash", count: 5 },
      { name: "Edit", count: 2 },
      { name: "Read", count: 2 },
    ]);
    const run = (state: AgentRun["state"]) => ({ state }) as AgentRun;
    expect(["running", "waiting", "detected"].every((s) => isActive(run(s as AgentRun["state"])))).toBe(true);
    expect(["completed", "failed", "unknown"].some((s) => isActive(run(s as AgentRun["state"])))).toBe(false);
  });
});
