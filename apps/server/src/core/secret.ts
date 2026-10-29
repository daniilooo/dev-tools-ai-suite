import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { restrictPermissions } from "./data-dir.js";

const SECRET_BYTES = 32;

/**
 * Segredo de instalação (RN-01 / ADR-0007): gerado uma única vez, arquivo 0600,
 * nunca exibido, nunca em URL, log ou bundle. Usado para assinar sessões e
 * tokens descartáveis do CLI (cli-auth.ts); o valor bruto nunca trafega.
 */
export class InstallSecret {
  private constructor(private readonly value: Buffer) {}

  static loadOrCreate(file: string): InstallSecret {
    if (!existsSync(file)) {
      const value = randomBytes(SECRET_BYTES);
      writeFileSync(file, value.toString("hex"), { mode: 0o600, flag: "wx" });
      return new InstallSecret(value);
    }
    restrictPermissions(file, 0o600);
    const raw = readFileSync(file, "utf8").trim();
    if (!/^[0-9a-f]{64}$/.test(raw)) {
      throw new Error(
        `Arquivo de segredo corrompido: ${file}. Remova-o para gerar um novo (sessões serão invalidadas).`,
      );
    }
    return new InstallSecret(Buffer.from(raw, "hex"));
  }

  hmac(data: string): string {
    return createHmac("sha256", this.value).update(data).digest("base64url");
  }

  /** Valor bruto, usado apenas pelo redator de logs para mascará-lo caso apareça por acidente. */
  redactionValue(): string {
    return this.value.toString("hex");
  }
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
