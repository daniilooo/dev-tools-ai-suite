# Skill: security-review

Executada pelo agente `SECURITY_ENGINEER`. Modelo de ameaças: `vault/07_SECURITY/SECURITY_MODEL.md`.

Checklist:
- [ ] Toda rota HTTP e todo upgrade WebSocket exigem sessão local válida.
- [ ] `Origin` e `Host` validados contra a allowlist local (anti CSWSH e DNS rebinding).
- [ ] CORS restritivo; CSRF protegido em requisições com efeito colateral.
- [ ] Bind padrão `127.0.0.1`.
- [ ] Segredo de instalação com permissão 0600, fora de URL/log/bundle.
- [ ] Argumentos de processos externos sem interpolação em shell (`spawn` com array).
- [ ] Nenhuma leitura de credenciais de provedores.
- [ ] Redação de segredos em logs, eventos e índices.
- [ ] Exclusões de indexação aplicadas (`vault/07_SECURITY/INDEXING_EXCLUSIONS.md`).
- [ ] Nenhuma transmissão de código para fora da máquina sem consentimento explícito.

Qualquer item falho em área sensível = achado **bloqueante**.
