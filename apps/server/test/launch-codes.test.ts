import { describe, expect, it } from "vitest";
import { LaunchCodeStore } from "../src/core/launch-codes.js";

describe("LaunchCodeStore", () => {
  it("aceita o código longo uma única vez", () => {
    const store = new LaunchCodeStore();
    const code = store.issue();
    expect(store.consume(code.token)).toBe(true);
    expect(store.consume(code.token)).toBe(false);
  });

  it("aceita o código curto, sem diferenciar maiúsculas nem hífen", () => {
    const store = new LaunchCodeStore();
    const code = store.issue();
    expect(code.short).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(store.consume(code.short.toLowerCase().replace("-", ""))).toBe(true);
    expect(store.consume(code.token)).toBe(false);
  });

  it("expira após o TTL", () => {
    let now = 1_000;
    const store = new LaunchCodeStore(60_000, () => now);
    const code = store.issue();
    now += 60_001;
    expect(store.consume(code.token)).toBe(false);
  });

  it("rejeita códigos desconhecidos", () => {
    const store = new LaunchCodeStore();
    store.issue();
    expect(store.consume("ABCD-EFGH")).toBe(false);
    expect(store.consume("")).toBe(false);
  });
});
