import { defineConfig, devices } from "@playwright/test";

/** Gera os prints do manual do usuário (`docs/manual/`). Não faz parte da suíte de testes. */
export default defineConfig({
  testDir: ".",
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
});
