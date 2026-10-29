import type { KnowledgeIndexState } from "@devtools/shared";

export const INDEX_STATE_LABEL: Record<KnowledgeIndexState, string> = {
  not_indexed: "não indexado",
  indexing: "indexando…",
  indexed: "indexado",
  outdated: "desatualizado",
  failed: "falhou",
};

export const INDEX_STATE_DOT: Record<KnowledgeIndexState, string> = {
  not_indexed: "bg-muted",
  indexing: "bg-accent animate-pulse",
  indexed: "bg-ok",
  outdated: "bg-warn",
  failed: "bg-err",
};

export interface SnippetPart {
  text: string;
  match: boolean;
}

/** Separa o trecho nos termos encontrados (`«termo»`) para destacar sem usar HTML. */
export function snippetParts(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  const re = /«([^»]*)»/g;
  let last = 0;
  for (let m = re.exec(snippet); m; m = re.exec(snippet)) {
    if (m.index > last) parts.push({ text: snippet.slice(last, m.index), match: false });
    parts.push({ text: m[1]!, match: true });
    last = m.index + m[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), match: false });
  return parts;
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}
