# START — Recebendo uma demanda

O **Orchestrator** lê a demanda e escolhe o fluxo **proporcional** ao tamanho e ao risco.

## 1. Carregar estado

- `.ai/state/AI_DEVELOPMENT_STATE.md` (handoff, branch, fase atual)
- `vault/00_HOME/PROJECT_STATUS.md`
- Fase correspondente em `vault/11_ROADMAP/DEVELOPMENT_PLAN.md`

## 2. Classificar a demanda

| Classe | Exemplos | Fluxo |
|---|---|---|
| **Trivial** | typo, ajuste de doc, renomear variável | IMPLEMENTACAO → COMMIT_PUSH |
| **Pequena** | bug localizado, teste faltante | Explorer → IMPLEMENTACAO → TESTES → COMMIT_PUSH |
| **Padrão** | feature dentro de um módulo | PLANEJAMENTO → IMPLEMENTACAO → TESTES → REVISAO → COMMIT_PUSH |
| **Estrutural** | novo módulo, contrato público, dependência nativa | INTAKE (curto) → PLANEJAMENTO + Architect/ADR → **gate humano** → IMPLEMENTACAO → TESTES → REVISAO → COMMIT_PUSH |
| **Sensível** | `core/security`, auth, WebSocket, PTY, privacidade | Como Estrutural + Security Engineer + **gate humano obrigatório** |
| **Release** | versão, tag, npm | DEPLOY (sempre com gate humano) |

## 3. Checar escopo

- A demanda pertence à fase atual? Se não, registrar em `POST_MVP_BACKLOG.md` ou na fase correta e informar o humano.
- Viola alguma invariante (`vault/02_BUSINESS/BUSINESS_INVARIANTS.md`)? Se sim, parar e reportar.

## 4. Despachar

Usar `.ai/contracts/TASK_CONTRACT.md` para cada agente. Paralelizar apenas tarefas independentes.

## 5. Encerrar

Consolidar respostas → Reporter → atualizar `PROJECT_STATUS.md` e HANDOFF.
