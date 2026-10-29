import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import type { CreateProjectRequest, DoctorReport, HealthResponse, Project } from "@devtools/shared";
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
}
