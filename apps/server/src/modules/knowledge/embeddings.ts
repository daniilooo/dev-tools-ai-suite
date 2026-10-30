import type { SemanticProviderId, SemanticProviderInfo } from "@devtools/shared";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export type EmbeddingKind = "query" | "passage";

/**
 * Porta de embeddings locais (ADR-0006, D-20). Nenhum adaptador envia código para fora da
 * máquina: o Ollama só é aceito em loopback e o Transformers.js roda no próprio processo.
 * `check` devolve o motivo da indisponibilidade (e como resolver) ou null.
 */
export interface EmbeddingProvider {
  readonly id: SemanticProviderId;
  readonly label: string;
  readonly model: string;
  /** Ligar baixa o modelo da internet (só com consentimento explícito). */
  readonly downloadsModel: boolean;
  check(): Promise<string | null>;
  embed(texts: string[], kind: EmbeddingKind): Promise<Float32Array[]>;
}

export async function describe(provider: EmbeddingProvider): Promise<SemanticProviderInfo> {
  const reason = await provider.check();
  return {
    id: provider.id,
    label: provider.label,
    model: provider.model,
    available: reason === null,
    reason,
    downloadsModel: provider.downloadsModel,
  };
}

/** Ollama local (API documentada `/api/embed`). O modelo é baixado pelo humano (`ollama pull`). */
export class OllamaEmbeddings implements EmbeddingProvider {
  readonly id = "ollama";
  readonly label = "Ollama (local)";
  readonly downloadsModel = false;

  constructor(
    private readonly baseUrl: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async check(): Promise<string | null> {
    let names: string[];
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { models?: { name?: string; model?: string }[] };
      names = (body.models ?? []).flatMap((m) => [m.name, m.model]).filter((n): n is string => !!n);
    } catch {
      return `O Ollama não respondeu em ${this.baseUrl}. Inicie com \`ollama serve\`.`;
    }
    const wanted = this.model.includes(":") ? [this.model] : [this.model, `${this.model}:latest`];
    return names.some((n) => wanted.includes(n))
      ? null
      : `Modelo de embeddings "${this.model}" não baixado no Ollama. Rode \`ollama pull ${this.model}\`.`;
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, input: texts, truncate: true }),
      signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) throw new Error(`Ollama respondeu ${response.status} ao gerar embeddings`);
    const body = (await response.json()) as { embeddings?: number[][] };
    if (!Array.isArray(body.embeddings) || body.embeddings.length !== texts.length) {
      throw new Error("resposta do Ollama sem os embeddings esperados");
    }
    return body.embeddings.map((v) => Float32Array.from(v));
  }
}

interface FeatureExtractor {
  (
    texts: string[],
    options: { pooling: "mean"; normalize: boolean },
  ): Promise<{ data: Float32Array; dims: number[] }>;
}

/**
 * Transformers.js + ONNX na CPU. Não vem no pacote (548 MB): o humano instala o complemento
 * em `<dados>/addons`, e o modelo só é baixado (para `<dados>/models`) depois do consentimento.
 */
export class TransformersEmbeddings implements EmbeddingProvider {
  readonly id = "transformers";
  readonly label = "Transformers.js (ONNX local)";
  readonly downloadsModel = true;
  static readonly PACKAGE = "@huggingface/transformers@4.3.2";
  private extractor: Promise<FeatureExtractor> | null = null;

  constructor(
    private readonly addonsDir: string,
    private readonly modelsDir: string,
    readonly model: string,
  ) {}

  async check(): Promise<string | null> {
    return this.resolveModule()
      ? null
      : `Complemento não instalado. Rode \`npm install --prefix "${this.addonsDir}" ${TransformersEmbeddings.PACKAGE}\` (≈560 MB).`;
  }

  async embed(texts: string[], kind: EmbeddingKind): Promise<Float32Array[]> {
    const extract = await (this.extractor ??= this.load());
    // Modelos E5 esperam o papel do texto como prefixo.
    const input = /e5/i.test(this.model) ? texts.map((t) => `${kind}: ${t}`) : texts;
    const result = await extract(input, { pooling: "mean", normalize: true });
    const dim = result.dims[result.dims.length - 1]!;
    return texts.map((_, i) => result.data.slice(i * dim, (i + 1) * dim));
  }

  private resolveModule(): string | null {
    try {
      return createRequire(join(this.addonsDir, "package.json")).resolve("@huggingface/transformers");
    } catch {
      return null;
    }
  }

  private async load(): Promise<FeatureExtractor> {
    const resolved = this.resolveModule();
    if (!resolved) throw new Error("complemento @huggingface/transformers não instalado");
    const lib = (await import(pathToFileURL(resolved).href)) as {
      env: { cacheDir: string };
      pipeline: (task: string, model: string, options: { dtype: string }) => Promise<FeatureExtractor>;
    };
    lib.env.cacheDir = this.modelsDir;
    return lib.pipeline("feature-extraction", this.model, { dtype: "q8" });
  }
}
