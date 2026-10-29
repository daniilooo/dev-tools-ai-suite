import { Injectable, signal } from "@angular/core";

export type Theme = "dark" | "light";
const STORAGE_KEY = "devtools-theme";

@Injectable({ providedIn: "root" })
export class ThemeService {
  readonly theme = signal<Theme>("dark");

  init(): void {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      // armazenamento indisponível: mantém o padrão
    }
    this.apply(stored === "light" ? "light" : "dark");
  }

  toggle(): void {
    const next: Theme = this.theme() === "dark" ? "light" : "dark";
    this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignora
    }
  }

  private apply(theme: Theme): void {
    this.theme.set(theme);
    document.documentElement.dataset["theme"] = theme;
  }
}
