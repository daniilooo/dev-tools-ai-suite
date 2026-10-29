import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { DetectedStack } from "@devtools/shared";

const LABELS: Record<DetectedStack, string> = {
  node: "Node.js",
  typescript: "TypeScript",
  angular: "Angular",
  react: "React",
  "java-maven": "Maven",
  "java-gradle": "Gradle",
  "spring-boot": "Spring Boot",
  python: "Python",
  go: "Go",
  rust: "Rust",
  dotnet: ".NET",
};

@Component({
  selector: "dt-stack-chips",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "flex flex-wrap gap-1" },
  template: `
    @for (item of stack(); track item) {
      <span class="chip">{{ labels[item] }}</span>
    } @empty {
      <span class="text-xs text-muted">Stack não identificada</span>
    }
  `,
})
export class StackChips {
  readonly stack = input.required<DetectedStack[]>();
  protected readonly labels = LABELS;
}
