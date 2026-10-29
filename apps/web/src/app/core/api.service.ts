import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type {
  AgentRunDetail,
  CodeGraphQueryResponse,
  CreateProjectRequest,
  CreateTerminalRequest,
  DoctorReport,
  HealthResponse,
  KnowledgeQueryMode,
  KnowledgeQueryResponse,
  KnowledgeSemanticRequest,
  KnowledgeStatus,
  Project,
  ProvidersResponse,
  QuotaResponse,
  SemanticProviderInfo,
  TerminalSession,
} from "@devtools/shared";
import type { Observable } from "rxjs";

@Injectable({ providedIn: "root" })
export class ApiService {
  private readonly http = inject(HttpClient);

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>("/api/v1/health");
  }

  doctor(): Observable<DoctorReport> {
    return this.http.get<DoctorReport>("/api/v1/doctor");
  }

  projects(): Observable<Project[]> {
    return this.http.get<Project[]>("/api/v1/projects");
  }

  project(id: string): Observable<Project> {
    return this.http.get<Project>(`/api/v1/projects/${encodeURIComponent(id)}`);
  }

  createProject(body: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>("/api/v1/projects", body);
  }

  redetectProject(id: string): Observable<Project> {
    return this.http.post<Project>(`/api/v1/projects/${encodeURIComponent(id)}/redetect`, {});
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/projects/${encodeURIComponent(id)}`);
  }

  terminals(projectId: string): Observable<TerminalSession[]> {
    return this.http.get<TerminalSession[]>(`/api/v1/projects/${encodeURIComponent(projectId)}/terminals`);
  }

  createTerminal(projectId: string, body: CreateTerminalRequest): Observable<TerminalSession> {
    return this.http.post<TerminalSession>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/terminals`,
      body,
    );
  }

  closeTerminal(id: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/terminals/${encodeURIComponent(id)}`);
  }

  providers(refresh = false): Observable<ProvidersResponse> {
    return this.http.get<ProvidersResponse>("/api/v1/providers", { params: refresh ? { refresh: "1" } : {} });
  }

  agentRuns(projectId: string): Observable<AgentRunDetail[]> {
    return this.http.get<AgentRunDetail[]>(`/api/v1/projects/${encodeURIComponent(projectId)}/agents/runs`);
  }

  agentRun(id: string): Observable<AgentRunDetail> {
    return this.http.get<AgentRunDetail>(`/api/v1/agents/runs/${encodeURIComponent(id)}`);
  }

  knowledge(projectId: string): Observable<KnowledgeStatus> {
    return this.http.get<KnowledgeStatus>(`/api/v1/projects/${encodeURIComponent(projectId)}/knowledge`);
  }

  indexKnowledge(projectId: string): Observable<KnowledgeStatus> {
    return this.http.post<KnowledgeStatus>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/knowledge/index`,
      {},
    );
  }

  removeKnowledge(projectId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/projects/${encodeURIComponent(projectId)}/knowledge/index`);
  }

  queryKnowledge(
    projectId: string,
    query: string,
    mode?: KnowledgeQueryMode,
  ): Observable<KnowledgeQueryResponse> {
    return this.http.post<KnowledgeQueryResponse>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/knowledge/query`,
      { query, mode },
    );
  }

  semanticProviders(): Observable<SemanticProviderInfo[]> {
    return this.http.get<SemanticProviderInfo[]>("/api/v1/knowledge/semantic/providers");
  }

  configureSemantic(projectId: string, request: KnowledgeSemanticRequest): Observable<KnowledgeStatus> {
    return this.http.put<KnowledgeStatus>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/knowledge/semantic`,
      request,
    );
  }

  buildGraph(projectId: string): Observable<KnowledgeStatus> {
    return this.http.post<KnowledgeStatus>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/knowledge/graph`,
      {},
    );
  }

  removeGraph(projectId: string): Observable<void> {
    return this.http.delete<void>(`/api/v1/projects/${encodeURIComponent(projectId)}/knowledge/graph`);
  }

  queryGraph(projectId: string, symbol: string, depth = 2): Observable<CodeGraphQueryResponse> {
    return this.http.post<CodeGraphQueryResponse>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/knowledge/graph/query`,
      { symbol, depth },
    );
  }

  quota(): Observable<QuotaResponse> {
    return this.http.get<QuotaResponse>("/api/v1/quota");
  }
}
