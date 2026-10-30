import type { CreateProjectRequest, Project } from "@devtools/shared";
import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { basename, isAbsolute } from "node:path";
import { AppError, badRequest, notFound } from "../../core/errors.js";
import type { ProjectsRepository } from "./projects.repository.js";
import { detectStack } from "./stack-detection.js";

export class ProjectsService {
  constructor(private readonly repository: ProjectsRepository) {}

  list(): Project[] {
    return this.repository.list();
  }

  get(id: string): Project {
    const project = this.repository.findById(id);
    if (!project) throw notFound("Projeto não encontrado.");
    return project;
  }

  /** Cadastra um diretório existente. Não cria nem altera arquivos no projeto (INV-05). */
  create(input: CreateProjectRequest): Project {
    const rawPath = input.path?.trim();
    if (!rawPath) throw badRequest("Informe o caminho do projeto.");
    if (!isAbsolute(rawPath)) throw badRequest("O caminho do projeto deve ser absoluto.");

    let path: string;
    try {
      path = realpathSync(rawPath);
      if (!statSync(path).isDirectory()) throw new Error("not a directory");
      accessSync(path, constants.R_OK | constants.X_OK);
    } catch {
      throw badRequest("Diretório inexistente ou sem permissão de leitura.", { path: rawPath });
    }

    if (this.repository.findByPath(path)) {
      throw new AppError("PROJECT_ALREADY_EXISTS", 409, "Este diretório já está cadastrado.", { path });
    }

    const name = input.name?.trim() || basename(path);
    if (name.length > 120) throw badRequest("Nome do projeto muito longo (máximo de 120 caracteres).");

    return this.repository.create({ name, path, detectedStack: detectStack(path) });
  }

  redetect(id: string): Project {
    const project = this.get(id);
    return this.repository.updateStack(id, detectStack(project.path)) ?? project;
  }

  remove(id: string): void {
    if (!this.repository.delete(id)) throw notFound("Projeto não encontrado.");
  }
}
