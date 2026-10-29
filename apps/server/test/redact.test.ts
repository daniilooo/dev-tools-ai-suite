import { describe, expect, it } from "vitest";
import { REDACTED, redact } from "../src/core/redact.js";

describe("redact", () => {
  it("remove tokens conhecidos", () => {
    const text = "token ghp_" + "a".repeat(36) + " e sk-ant-" + "b".repeat(30);
    const out = redact(text);
    expect(out).not.toContain("ghp_");
    expect(out).not.toContain("sk-ant-");
    expect(out).toContain(REDACTED);
  });

  it("mantém o nome do campo e redige o valor de cabeçalhos sensíveis", () => {
    expect(redact('{"authorization":"Bearer abc123"}')).toBe('{"authorization":"[REDIGIDO]"}');
    expect(redact("cookie=devtools_session=xyz")).toContain("cookie=[REDIGIDO]");
  });

  it("redige segredos adicionais informados", () => {
    expect(redact("valor deadbeefcafe no log", ["deadbeefcafe"])).toBe("valor [REDIGIDO] no log");
  });

  it("não altera texto comum", () => {
    expect(redact("projeto criado em /home/user/app")).toBe("projeto criado em /home/user/app");
  });
});
