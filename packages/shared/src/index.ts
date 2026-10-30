// Contratos compartilhados entre apps/server e apps/web.
// Regra: somente tipos (import type), para não criar dependência de runtime.

export type ModuleState = "ok" | "degraded" | "not_available" | "planned";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface HealthResponse {
  status: "ok";
  version: string;
  modules: Record<string, ModuleState>;
}

export interface SessionResponse {
  authenticated: true;
  csrfToken: string;
  expiresAt: string;
}

export interface ExchangeRequest {
  code: string;
}

export type DetectedStack =
  | "node"
  | "typescript"
  | "angular"
  | "react"
  | "java-maven"
  | "java-gradle"
  | "spring-boot"
  | "python"
  | "go"
  | "rust"
  | "dotnet";

export interface Project {
  id: string;
  name: string;
  path: string;
  detectedStack: DetectedStack[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  path: string;
  name?: string;
}

/** Estado público de uma sessão de terminal (ver STATE_MACHINES no Vault). */
export type TerminalState = "active" | "disconnected" | "exited";

export interface TerminalSession {
  id: string;
  projectId: string;
  title: string;
  shell: string;
  state: TerminalState;
  cols: number;
  rows: number;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | null;
}

export interface CreateTerminalRequest {
  cols?: number;
  rows?: number;
  /** Provedor a iniciar no shell recém-aberto (somente provedores lançáveis). */
  launch?: LaunchableProviderId;
}

export type ProviderId = "claude-code" | "codex" | "ollama";
export type LaunchableProviderId = Extract<ProviderId, "claude-code" | "codex">;

/** Nível de suporte de uma fonte de dados (INTEGRATIONS no Vault). */
export type SupportLevel = "A" | "B" | "C";

export interface ProviderCapability {
  id: string;
  label: string;
  level: SupportLevel;
  /** Fase em que a suíte passa a usar a capacidade; ausente = já em uso. */
  phase?: number;
}

export interface ProviderAuth {
  state: "authenticated" | "unauthenticated" | "unavailable";
  /** Forma de login informada pelo comando oficial (ex.: "claude.ai", "ChatGPT", "API key"). */
  method: string | null;
  /** Plano informado pelo comando oficial, quando houver. */
  plan: string | null;
  category: DataCategory;
  /** Comando oficial consultado. */
  source: string | null;
  fetchedAt: string;
  /** Motivo quando `unavailable`. */
  reason?: string;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  installed: boolean;
  version: string | null;
  /** `tested` = versão coberta por testes de contrato; `untested` = funciona, com aviso. */
  versionSupport: "tested" | "untested" | "unknown";
  testedVersions: string;
  auth: ProviderAuth;
  capabilities: ProviderCapability[];
  launchable: boolean;
  notes: string[];
}

export interface ProvidersResponse {
  generatedAt: string;
  providers: ProviderInfo[];
}

/** Mensagens do navegador para o servidor em `/ws/terminal/:id`. */
export type TerminalClientMessage =
  { type: "input"; data: string } | { type: "resize"; cols: number; rows: number };

/** Mensagens do servidor para o navegador em `/ws/terminal/:id`. */
export type TerminalServerMessage =
  | { type: "replay"; data: string; session: TerminalSession }
  | { type: "output"; data: string }
  | { type: "exit"; exitCode: number | null; signal: number | null };

/**
 * Códigos de fechamento do WebSocket do terminal (faixa reservada a aplicações):
 * 4401 sessão do navegador expirou · 4404 terminal inexistente ·
 * 4410 terminal encerrado pelo usuário · 4429 cliente lento demais (reconectar).
 */
export type TerminalCloseCode = 4401 | 4404 | 4410 | 4429;

/**
 * Estado de uma execução de agente (STATE_MACHINES). Derivado só de eventos observados:
 * sem evento recente, `unknown` — nunca presumido (INV-03).
 */
export type AgentRunState = "detected" | "running" | "waiting" | "completed" | "failed" | "unknown";

/** `agent` = sessão principal, roda em um terminal; `subagent` = só emite eventos. */
export type AgentRunKind = "agent" | "subagent";

export interface AgentTokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface AgentRun {
  id: string;
  projectId: string;
  providerId: LaunchableProviderId;
  kind: AgentRunKind;
  parentRunId: string | null;
  /** Id da sessão no provedor (Claude: sessionId; Codex: thread id; subagente: agentId). */
  externalId: string;
  /** Título curto e redigido (título da conversa, tipo/descrição do subagente). */
  title: string | null;
  /** Tipo do subagente (ex.: "explorer"), quando informado. */
  agentType: string | null;
  model: string | null;
  providerVersion: string | null;
  state: AgentRunState;
  startedAt: string;
  lastEventAt: string;
  endedAt: string | null;
  /** Somados a partir dos registros do provedor: categoria `calculated`; null = INDISPONÍVEL. */
  tokens: AgentTokenUsage | null;
  /** Contagem de chamadas por ferramenta (só o nome, nunca os argumentos). */
  toolCalls: Record<string, number>;
  /** Terminal da suíte em que o agente foi aberto, quando identificado. */
  terminalId: string | null;
  source: { level: SupportLevel; description: string };
  error: string | null;
}

export interface AgentRunDetail extends AgentRun {
  subagents: AgentRun[];
}

/**
 * Frescor de uma leitura de cota (STATE_MACHINES): `fresh` = medida recente;
 * `stale` = medida antiga, o uso pode ter mudado; `reset` = a janela renovou depois
 * da medida, então o percentual medido não vale mais.
 */
export type QuotaFreshness = "fresh" | "stale" | "reset";

/** Uma janela de limite de uso (ex.: 5 h, semanal), como o provedor informou. */
export interface QuotaWindow {
  /** `five_hour`, `seven_day` ou `window_<min>m`. */
  id: string;
  label: string;
  /** Percentual usado informado pelo provedor; null quando só se sabe que o limite foi atingido. */
  usedPercent: number | null;
  limitReached: boolean;
  resetsAt: string | null;
  freshness: QuotaFreshness;
  category: Exclude<DataCategory, "unavailable">;
  /** Quando o provedor informou o valor (não quando a suíte leu). */
  observedAt: string;
  source: { level: SupportLevel; description: string };
}

export interface ProviderQuota {
  providerId: LaunchableProviderId;
  label: string;
  /** Plano informado junto com os limites, quando houver. */
  plan: string | null;
  windows: QuotaWindow[];
  /** Sem nenhuma leitura válida: motivo exibido com INDISPONÍVEL. */
  unavailableReason: string | null;
  notes: string[];
}

export interface QuotaResponse {
  generatedAt: string;
  providers: ProviderQuota[];
}

/** Mensagens do servidor em `/ws/events`. */
export type ServerEvent =
  { type: "agent.run.state"; run: AgentRun } | { type: "quota.updated"; quota: QuotaResponse };

/** Categoria de proveniência de todo dado exibido (ADR-0010, INV-03). */
export type DataCategory = "official" | "calculated" | "estimated" | "unavailable";

export type DoctorStatus = "ok" | "warning" | "error" | "unavailable";

export interface DoctorCheck {
  id: string;
  label: string;
  status: DoctorStatus;
  detail: string;
  /** Instrução de correção em PT-BR, quando aplicável. */
  hint?: string;
}

export interface DoctorTool {
  id: "git" | "claude" | "codex" | "ollama" | "graphify" | "transformers";
  label: string;
  installed: boolean;
  version: string | null;
  /** Login do provedor via comando oficial; null quando não se aplica (git, graphify, ollama, transformers). */
  auth: ProviderAuth | null;
  optional: boolean;
}

export interface DoctorReport {
  generatedAt: string;
  checks: DoctorCheck[];
  tools: DoctorTool[];
}

/** Estado do índice de conhecimento de um projeto (STATE_MACHINES). */
export type KnowledgeIndexState = "not_indexed" | "indexing" | "indexed" | "outdated" | "failed";

/** Arquivos deixados de fora da indexação, por motivo (INDEXING_EXCLUSIONS). */
export interface KnowledgeSkipped {
  sensitive: number;
  noise: number;
  large: number;
  binary: number;
}

export interface KnowledgeStatus {
  projectId: string;
  state: KnowledgeIndexState;
  files: number;
  chunks: number;
  skipped: KnowledgeSkipped;
  indexedAt: string | null;
  durationMs: number | null;
  /** Arquivos alterados, novos ou removidos desde a indexação (só em `outdated`). */
  changedFiles: number;
  error: string | null;
  /** Busca semântica opcional (ADR-0006): ligada pelo humano, por projeto. */
  semantic: SemanticStatus;
  /** Grafo de código opcional via Graphify externo (ADR-0006). */
  graph: CodeGraphStatus;
}

/** Mecanismos de embeddings locais aceitos (D-20). */
export type SemanticProviderId = "ollama" | "transformers";

export type SemanticState = "off" | "indexing" | "ready" | "failed";

export interface SemanticStatus {
  /** Há um mecanismo de embeddings utilizável agora (o escolhido ou algum, se desligada). */
  available: boolean;
  reason: string | null;
  enabled: boolean;
  provider: SemanticProviderId | null;
  model: string | null;
  state: SemanticState;
  /** Trechos com vetor / total de trechos do índice textual. */
  embedded: number;
  total: number;
  updatedAt: string | null;
  error: string | null;
}

export interface SemanticProviderInfo {
  id: SemanticProviderId;
  label: string;
  model: string;
  available: boolean;
  /** Por que não está disponível e como resolver (ex.: `ollama pull …`). */
  reason: string | null;
  /** Ligar exige consentimento para baixar o modelo (Transformers.js). */
  downloadsModel: boolean;
}

export interface KnowledgeSemanticRequest {
  enabled: boolean;
  provider?: SemanticProviderId;
  /** Obrigatório para provedores que baixam o modelo. */
  consentModelDownload?: boolean;
}

export type CodeGraphState = "not_built" | "building" | "built" | "failed";

export interface CodeGraphStatus {
  available: boolean;
  reason: string | null;
  state: CodeGraphState;
  nodes: number;
  edges: number;
  /** Repositórios analisados (raiz + aninhados). */
  repos: number;
  builtAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface CodeGraphNode {
  id: string;
  label: string;
  /** null = símbolo externo (biblioteca). */
  filePath: string | null;
  line: number | null;
}

export interface CodeGraphLink {
  relation: string;
  node: CodeGraphNode;
  /** Onde a relação aparece no código. */
  filePath: string | null;
  line: number | null;
}

export interface CodeGraphImpact {
  node: CodeGraphNode;
  relation: string;
  depth: number;
}

export interface CodeGraphQueryRequest {
  symbol: string;
  depth?: number;
}

export interface CodeGraphQueryResponse {
  symbol: string;
  node: CodeGraphNode | null;
  /** Outros símbolos com o mesmo nome (escolha pelo `id`). */
  candidates: CodeGraphNode[];
  /** O que o símbolo usa. */
  dependencies: CodeGraphLink[];
  /** Quem usa o símbolo diretamente. */
  dependents: CodeGraphLink[];
  /** Quem pode ser afetado por uma mudança no símbolo (dependentes transitivos). */
  impact: CodeGraphImpact[];
}

export interface KnowledgeHit {
  /** Caminho relativo à raiz do projeto. */
  filePath: string;
  lineStart: number;
  lineEnd: number;
  /** Trecho com os termos encontrados entre `«` e `»`. */
  snippet: string;
  /** O arquivo mudou ou sumiu desde a indexação: as linhas podem não corresponder mais. */
  stale: boolean;
  /** Quais buscas encontraram o trecho. */
  matchedBy: ("lexical" | "semantic")[];
}

export type KnowledgeQueryMode = "lexical" | "semantic" | "hybrid";

export interface KnowledgeQueryRequest {
  query: string;
  limit?: number;
  /** Padrão: híbrida quando há vetores prontos, senão textual. */
  mode?: KnowledgeQueryMode;
}

export interface KnowledgeQueryResponse {
  query: string;
  mode: KnowledgeQueryMode;
  hits: KnowledgeHit[];
}
