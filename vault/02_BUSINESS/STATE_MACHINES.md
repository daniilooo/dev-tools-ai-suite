---
tags: [negocio, estados]
---

# Máquinas de Estado

> Modelos iniciais (hipóteses) para orientar a Fase 2+. Ajustes exigem atualização deste arquivo.

## Sessão de terminal
```mermaid
stateDiagram-v2
  [*] --> Criando
  Criando --> Ativa: PTY iniciado
  Criando --> Falhou: erro ao iniciar
  Ativa --> Desconectada: cliente WebSocket caiu
  Desconectada --> Ativa: reconexão autenticada (buffer reenviado)
  Desconectada --> Encerrada: timeout de retenção
  Ativa --> Encerrada: processo saiu / usuário fechou
  Encerrada --> [*]
  Falhou --> [*]
```
Regra: sessão `Desconectada` mantém o processo vivo e um buffer limitado de saída (256 KiB) até o timeout de retenção de **8 h**. Sessão `Encerrada` continua listada por 10 min para a aba mostrar o código de saída. Encerrar a sessão encerra toda a árvore de processos dela (descendentes e processos da mesma sessão POSIX). Na API: `active` = Ativa, `disconnected` = Desconectada, `exited` = Encerrada; `Falhou` vira erro na criação (sem sessão).

## Execução de agente (Agent Monitor)
```mermaid
stateDiagram-v2
  [*] --> Detectado: sessão encontrada
  Detectado --> EmExecucao: mensagem do usuário ou início de turno
  EmExecucao --> Aguardando: turno encerrado (agente principal)
  Aguardando --> EmExecucao: nova mensagem
  EmExecucao --> Concluido: subagente terminou
  EmExecucao --> Falhou: evento de erro
  Falhou --> EmExecucao: nova mensagem
  Detectado --> Desconhecido: sem eventos por 30 min
  EmExecucao --> Desconhecido: sem eventos por 5 min
  Aguardando --> Desconhecido: sem eventos por 30 min
  Desconhecido --> EmExecucao: novo evento
  Concluido --> [*]
```
`Desconhecido` existe para cumprir INV-03: sem evento, não se presume estado. As fontes atuais (transcrições, nível B) não registram o fim de uma sessão principal: por isso ela termina em `Aguardando` ou `Desconhecido`, nunca em `Concluído` presumido.

| Estado (`AgentRunState`) | Evidência observada | Limite de frescor |
|---|---|---|
| `detected` — Detectado | sessão existe, sem turnos | 30 min |
| `running` — Em execução | último registro é de trabalho (mensagem, ferramenta, início de turno) | 5 min |
| `waiting` — Aguardando | turno encerrado (`end_turn`, `task_complete`, interrupção do usuário) | 30 min |
| `completed` — Concluído | subagente encerrou o turno | — |
| `failed` — Falhou | último evento é erro | — |
| `unknown` — Desconhecido | limite de frescor excedido ou servidor reiniciado antes da releitura | — |

Implementação: `deriveState` em `apps/server/src/modules/integrations/sources/run-snapshot.ts` ([[ADR-0013-fontes-agent-monitor]]).

## Dado de cota/telemetria
```mermaid
stateDiagram-v2
  [*] --> Indisponivel
  Indisponivel --> Fresco: leitura bem-sucedida
  Fresco --> Obsoleto: expirou janela de frescor
  Obsoleto --> Fresco: nova leitura
  Fresco --> Indisponivel: fonte falhou/incompatível
  Obsoleto --> Indisponivel: fonte falhou/incompatível
```
Cada leitura carrega `categoria ∈ {oficial, calculado, estimado}`; `indisponível` é estado, não valor.

Cotas (Fase 6, D-16) — frescor de cada janela (`QuotaFreshness`):
| Estado | Valor | Condição |
|---|---|---|
| Fresco | `fresh` ("atualizado") | medida há até 15 min e renovação ainda no futuro |
| Obsoleto | `stale` ("pode ter mudado") | medida há mais de 15 min |
| Renovada | `reset` ("janela renovada") | a renovação passou depois da medida: o percentual medido não é mostrado |
| Indisponível | `unavailableReason` | nenhuma leitura nos últimos 8 dias, fonte desligada ou com falha |

Limite atingido registrado em transcrição deixa de aparecer quando a janela renova. Implementação: `freshnessOf` em `apps/server/src/modules/quota/quota-monitor.ts`.

## Indexação de projeto
```mermaid
stateDiagram-v2
  [*] --> NaoIndexado
  NaoIndexado --> Indexando: usuário solicita
  Indexando --> Indexado
  Indexando --> FalhaIndexacao
  Indexado --> Desatualizado: arquivos mudaram
  Desatualizado --> Indexando
  Indexado --> NaoIndexado: usuário remove índice
  FalhaIndexacao --> Indexando: nova tentativa
  Indexando --> FalhaIndexacao: servidor reiniciado
```
Valores (`KnowledgeIndexState`): `not_indexed`, `indexing`, `indexed`, `outdated` (calculado ao consultar o estado: arquivo novo, alterado ou removido desde a indexação), `failed`. Reindexar mantém o índice anterior consultável até o novo terminar. Implementação: `apps/server/src/modules/knowledge/knowledge.service.ts`.

## Alteração de configuração de projeto (RN-05)
```mermaid
stateDiagram-v2
  [*] --> Proposta
  Proposta --> Recusada: usuário recusa
  Proposta --> Aplicada: usuário autoriza (backup criado)
  Aplicada --> Revertida: usuário desativa
  Recusada --> [*]
  Revertida --> [*]
```
