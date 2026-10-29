---
tags: [produto]
---

# Visão do Produto

## Problema
Desenvolvedores usam várias ferramentas de IA isoladas (Claude Code, Codex, Ollama, MCPs, skills, RAG, observabilidade), cada uma com configuração própria, sem conhecimento compartilhado e com pouca visibilidade sobre agentes, consumo e execução.

Cinco dores centrais:
1. **Fragmentação** de ferramentas, agentes, skills e integrações.
2. **Perda de conhecimento** sobre código, arquitetura e decisões.
3. **Consumo ineficiente** de IA: contexto desnecessário, tokens, limites.
4. **Falta de observabilidade** de agentes, subagentes e uso de modelos.
5. **Complexidade operacional** para montar um ambiente AI-native completo.

## Proposta
Uma camada de **integração, inteligência, gerenciamento e observabilidade** que roda localmente e se apresenta como um dashboard web. **Não substitui** Claude Code, Codex ou outros assistentes.

## Resultado esperado
O desenvolvedor instala a suíte, abre o dashboard e usa as funcionalidades principais sem configurar individualmente uma coleção de ferramentas.

## Diferencial
Combinação, em uma instalação local, de: ambiente de execução (terminal real) + inteligência contextual (RAG e grafo de código) + observabilidade + gestão de múltiplos agentes.

## Referências conceituais (não reproduzir)
VS Code (terminal e painéis) · Claude Code e Codex (agentes, skills, hooks) · Notch (cotas compactas) · Langfuse (traces e custos) · Graphify (grafo de código) · Obsidian (conhecimento).

## Diretrizes
Simplicidade de instalação · independência de provedores · privacidade · modularidade · evolução incremental. Toda funcionalidade resolve um problema concreto; nada entra por ser tecnicamente interessante.

## Indicadores de sucesso
Tempo de instalação · nº de configurações manuais · tarefas reais executadas pela interface · confiabilidade do monitor de agentes · precisão de consumo e limites · qualidade da recuperação de conhecimento · redução mensurável de contexto · estabilidade de aplicação e sessões.

Relacionado: [[MVP_SCOPE]] · [[PERSONAS]] · [[USER_JOURNEYS]]
