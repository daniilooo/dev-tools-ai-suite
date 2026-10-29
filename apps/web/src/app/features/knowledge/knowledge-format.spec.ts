import { formatMs, snippetParts } from "./knowledge-format";

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
});
