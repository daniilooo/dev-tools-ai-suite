import type { CodeGraphState, KnowledgeIndexState, SemanticState } from "@devtools/shared";

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

export const SEMANTIC_STATE_LABEL: Record<SemanticState, string> = {
  off: "desligada",
  indexing: "calculando vetores…",
  ready: "pronta",
  failed: "falhou",
};

export const GRAPH_STATE_LABEL: Record<CodeGraphState, string> = {
  not_built: "não gerado",
  building: "gerando…",
  built: "gerado",
  failed: "falhou",
};

/** Relações do Graphify em português; as desconhecidas aparecem como vieram. */
const RELATION_LABEL: Record<string, string> = {
  calls: "chama",
  indirect_call: "chama indiretamente",
  references: "referencia",
  imports: "importa",
  imports_from: "importa de",
  dynamic_import: "importa dinamicamente",
  re_exports: "reexporta",
  inherits: "herda de",
  extends: "estende",
  implements: "implementa",
  uses: "usa",
  method: "método",
  contains: "contém",
  defines: "define",
  case_of: "caso de",
};

export function relationLabel(relation: string): string {
  return RELATION_LABEL[relation] ?? relation;
}

export function percent(done: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

/** `arquivo:linha`, ou "externo" para símbolos de bibliotecas. */
export function fileRef(filePath: string | null, line: number | null): string {
  if (!filePath) return "externo";
  return line ? `${filePath}:${line}` : filePath;
}
