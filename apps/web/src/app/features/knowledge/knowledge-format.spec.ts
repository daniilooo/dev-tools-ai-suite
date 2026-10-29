import { fileRef, formatMs, percent, relationLabel, snippetParts } from "./knowledge-format";

describe("knowledge-format", () => {
  it("separa os termos encontrados sem interpretar HTML", () => {
    expect(snippetParts("…const «total» = <b>«x»</b>")).toEqual([
      { text: "…const ", match: false },
      { text: "total", match: true },
      { text: " = <b>", match: false },
      { text: "x", match: true },
      { text: "</b>", match: false },
    ]);
    expect(snippetParts("sem destaque")).toEqual([{ text: "sem destaque", match: false }]);
  });

  it("formata durações curtas", () => {
    expect(formatMs(450)).toBe("450 ms");
    expect(formatMs(7165)).toBe("7,2 s");
  });

  it("traduz relações do grafo e formata referências", () => {
    expect(relationLabel("calls")).toBe("chama");
    expect(relationLabel("nova_relacao")).toBe("nova_relacao");
    expect(fileRef("src/a.ts", 12)).toBe("src/a.ts:12");
    expect(fileRef("src/a.ts", null)).toBe("src/a.ts");
    expect(fileRef(null, null)).toBe("externo");
  });

  it("calcula o progresso dos vetores", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(50, 200)).toBe(25);
    expect(percent(201, 200)).toBe(100);
  });
});
