import { execFileSync } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURE_SECRET } from "./agent-fixtures.js";
import { tempDir } from "./helpers.js";

export /** Projeto git com código, segredos, ruído, binário, arquivo grande e um repositório aninhado ignorado pela raiz. */
function makeProject(): string {
  const root = realpathSync(tempDir("devtools-know-"));
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-C", cwd, ...args], { stdio: "ignore" });
  git(root, "init", "-q");
  writeFileSync(join(root, ".gitignore"), "*.log\n/backend/\n");
  mkdirSync(join(root, "src"));
  writeFileSync(
    join(root, "src", "pedido.service.ts"),
    [
      "// Serviço de pedidos",
      "export class PedidoService {",
      "  calcularTotalComDesconto(itens: number[]): number {",
      "    return itens.reduce((a, b) => a + b, 0) * 0.9;",
      "  }",
      "}",
      `const chave = "${FIXTURE_SECRET}";`,
    ].join("\n"),
  );
  writeFileSync(join(root, "README.md"), "# Projeto\n\nDocumentação da reserva recorrente.\n");
  writeFileSync(join(root, ".env"), `API_TOKEN=${FIXTURE_SECRET}\nsenhaDoBanco=palavraSecretaDoEnv\n`);
  writeFileSync(join(root, ".env.example"), "API_TOKEN=\n");
  mkdirSync(join(root, "secrets"));
  writeFileSync(join(root, "secrets", "chave.txt"), "conteudoDaPastaSecrets\n");
  writeFileSync(join(root, "servidor.pem"), "-----BEGIN CERTIFICATE-----\n");
  writeFileSync(join(root, "debug.log"), "linhaDeLogIgnorada\n");
  writeFileSync(join(root, "logo.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0]));
  writeFileSync(join(root, "dados.bin.txt"), Buffer.from([0x41, 0, 0x42]));
  writeFileSync(join(root, "grande.txt"), "x".repeat(1024 * 1024 + 1));
  mkdirSync(join(root, "node_modules", "lib"), { recursive: true });
  writeFileSync(join(root, "node_modules", "lib", "index.js"), "dependenciaDeTerceiros();\n");
  const nested = join(root, "backend", "api");
  mkdirSync(join(nested, "src"), { recursive: true });
  git(nested, "init", "-q");
  writeFileSync(
    join(nested, "src", "ReservaController.java"),
    "public class ReservaController {\n  // agendaRecorrente\n}\n",
  );
  return root;
}
