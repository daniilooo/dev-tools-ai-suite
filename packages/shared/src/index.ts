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
  id: "git" | "claude" | "codex" | "ollama" | "graphify";
  label: string;
  installed: boolean;
  version: string | null;
  /** Estado de autenticação: verificado somente por mecanismos documentados (Fase 4). */
  auth: DataCategory;
  optional: boolean;
}

export interface DoctorReport {
  generatedAt: string;
  checks: DoctorCheck[];
  tools: DoctorTool[];
}
