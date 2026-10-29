import type { Routes } from "@angular/router";
import { authGuard } from "./core/auth.guard";

export const routes: Routes = [
  {
    path: "acesso",
    title: "Acesso — Dev Tools AI Suite",
    loadComponent: () => import("./features/access/access-page").then((m) => m.AccessPage),
  },
  {
    path: "",
    canActivate: [authGuard],
    loadComponent: () => import("./layout/shell").then((m) => m.Shell),
    children: [
      { path: "", pathMatch: "full", redirectTo: "projetos" },
      {
        path: "projetos",
        title: "Projetos — Dev Tools AI Suite",
        loadComponent: () => import("./features/projects/projects-page").then((m) => m.ProjectsPage),
      },
      {
        path: "projetos/:id",
        title: "Projeto — Dev Tools AI Suite",
        loadComponent: () =>
          import("./features/projects/project-detail-page").then((m) => m.ProjectDetailPage),
      },
      {
        path: "projetos/:id/terminal",
        title: "Terminal — Dev Tools AI Suite",
        loadComponent: () => import("./features/terminal/terminal-page").then((m) => m.TerminalPage),
      },
      {
        path: "terminal",
        title: "Terminal — Dev Tools AI Suite",
        loadComponent: () => import("./features/terminal/terminal-hub-page").then((m) => m.TerminalHubPage),
      },
      {
        path: "provedores",
        title: "Provedores — Dev Tools AI Suite",
        loadComponent: () => import("./features/providers/providers-page").then((m) => m.ProvidersPage),
      },
      {
        path: "agentes",
        title: "Agentes — Dev Tools AI Suite",
        loadComponent: () => import("./features/agents/agents-page").then((m) => m.AgentsPage),
      },
      {
        path: "agentes/:runId/terminal",
        title: "Terminal do agente — Dev Tools AI Suite",
        loadComponent: () => import("./features/agents/agent-terminal-page").then((m) => m.AgentTerminalPage),
      },
      {
        path: "diagnostico",
        title: "Diagnóstico — Dev Tools AI Suite",
        loadComponent: () => import("./features/system/doctor-page").then((m) => m.DoctorPage),
      },
    ],
  },
  { path: "**", redirectTo: "" },
];
