---
tags: [produto, mvp]
---

# Escopo do MVP

## Prioridade
- **P0 — Fundação e operação:** instalação e inicialização seguras · dashboard web · projetos · SUG03 Integrated Terminal · execução de Claude Code e Codex.
- **P1 — Acompanhamento e inteligência:** SUG01 Agent Monitor · SUG02 AI Quota Monitor · RAG local · integração estrutural Graphify · persistência de histórico e conhecimento.
- **P2 — Pós-MVP:** ver [[POST_MVP_BACKLOG]].

P0 e P1 são ordem de desenvolvimento; ambos estão **dentro** do MVP, salvo revisão explícita em gate humano.

## Funcionalidades obrigatórias

### Foundation
Instalação local · Linux homologado (arquitetura multiplataforma) · dashboard web · gerenciamento básico de projetos · detecção e integração inicial com Claude Code e Codex.

### SUG03 — Integrated Terminal
Terminal real no navegador · comandos locais · processos interativos · múltiplas sessões e abas · reconexão a sessões ativas · integração com diretórios dos projetos.

### SUG01 — Agent Monitor
Agentes disponíveis nas sessões monitoradas · agentes e subagentes conforme eventos dos provedores · status · logs/eventos em tempo real quando disponíveis · histórico básico.

### SUG02 — AI Quota Monitor
Claude Code e Codex · limites e disponibilidade quando acessíveis · horários de renovação quando informados · categorias **oficial / calculado / estimado / indisponível** · atualização periódica.

### Conhecimento
Indexação de projetos e documentação · RAG local · Graphify (ou adaptador equivalente) · recuperação com referências às fontes · persistência local.

### Observabilidade básica
Registro de sessões · histórico de eventos · identificação de agentes e provedores · métricas básicas · tokens quando disponibilizados.

### Segurança
Serviços locais protegidos · restrição de acesso ao terminal · proteção de credenciais · isolamento lógico entre projetos · exclusão de arquivos sensíveis da indexação.

## Definition of MVP Done
O MVP está pronto quando:
1. Instala e inicializa em Linux limpo e compatível.
2. Dashboard web funcional.
3. Cadastrar e abrir projeto.
4. Terminal executa comandos reais e aplicações interativas.
5. Claude Code e Codex iniciam pela plataforma (quando instalados e autenticados).
6. Agent Monitor acompanha sessões e eventos suportados pelos provedores.
7. Monitor de cotas mostra informações verificáveis **ou** indica claramente indisponibilidade.
8. Indexa um repositório e responde consultas com referências verificáveis, com ao menos um mecanismo de embeddings local funcionando e validado.
9. Dados persistem entre reinicializações.
10. Fluxos críticos têm testes automatizados.
11. Documentação de instalação, operação e arquitetura atualizada.
12. Jornada completa de desenvolvimento assistido por IA sem abrir terminal externo.

**Validação:** em pelo menos um projeto real, preferencialmente Angular + Spring Boot.

## Fora do MVP
Widget desktop · multiusuário/Team · sincronização entre máquinas · fine-tuning · Model Lab · cache semântico · orquestração própria · controle remoto · integrações avançadas GitHub/GitLab/Jira · monitor de recursos de modelos locais · marketplace · instaladores Windows/macOS homologados · auto-update. → [[POST_MVP_BACKLOG]]
