import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { AgentRunState } from "@devtools/shared";
import { STATE_DOT, STATE_HINT, STATE_LABEL } from "./agent-format";

/** Estado de uma execução de agente, com a explicação do que foi observado. */
@Component({
  selector: "dt-agent-state-chip",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip gap-1.5" [title]="hint[state()]" data-testid="agent-state">
      <span class="size-1.5 rounded-full" [class]="dot[state()]"></span>
      {{ label[state()] }}
    </span>
  `,
})
export class AgentStateChip {
  readonly state = input.required<AgentRunState>();
  protected readonly label = STATE_LABEL;
  protected readonly hint = STATE_HINT;
  protected readonly dot = STATE_DOT;
}
