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
  [*] --> Detectado
  Detectado --> EmExecucao: evento de início
  EmExecucao --> Aguardando: aguardando input/permissão
  Aguardando --> EmExecucao
  EmExecucao --> Concluido: evento de fim com sucesso
  EmExecucao --> Falhou: evento de erro
  EmExecucao --> Desconhecido: sem eventos além do limite de frescor
  Desconhecido --> EmExecucao: novo evento
  Concluido --> [*]
  Falhou --> [*]
```
`Desconhecido` existe para cumprir INV-03: sem evento, não se presume estado.

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
```

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
