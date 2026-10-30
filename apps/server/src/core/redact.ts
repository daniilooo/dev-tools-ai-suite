/**
 * Redator de segredos (RN-02): aplicado a logs, eventos e payloads persistidos.
 * Padrões alinhados a scripts/check-secrets.sh.
 */
const PATTERNS: RegExp[] = [
  /-----BEGIN ([A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END ([A-Z]+ )?PRIVATE KEY-----/g,
  /AKIA[0-9A-Z]{16}/g,
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /github_pat_[A-Za-z0-9_]{50,}/g,
  /sk-ant-[A-Za-z0-9_-]{20,}/g,
  /sk-(proj-)?[A-Za-z0-9]{32,}/g,
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,
  /npm_[A-Za-z0-9]{36}/g,
  /AIza[0-9A-Za-z_-]{35}/g,
  /(authorization|cookie|x-csrf-token)(["']?\s*[:=]\s*["']?)(?:(?:Bearer|Basic)\s+)?[^"'\s,}]+/gi,
];

export const REDACTED = "[REDIGIDO]";

export function redact(text: string, extraSecrets: readonly string[] = []): string {
  let out = text;
  for (const secret of extraSecrets) {
    if (secret.length >= 8) out = out.split(secret).join(REDACTED);
  }
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, (match, ...groups) => {
      // Mantém o nome do campo em pares chave/valor.
      if (/^(authorization|cookie|x-csrf-token)/i.test(match) && typeof groups[0] === "string") {
        return `${groups[0]}${groups[1] ?? ""}${REDACTED}`;
      }
      return REDACTED;
    });
  }
  return out;
}

/** Stream de destino para o logger que redige cada linha antes de escrever. */
export function redactingStream(
  target: { write(chunk: string): unknown },
  extraSecrets: () => readonly string[],
): { write(chunk: string): void } {
  return {
    write(chunk: string) {
      target.write(redact(chunk, extraSecrets()));
    },
  };
}
