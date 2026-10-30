---
tags: [releases]
---

# Versionamento

- **Semantic Versioning**. Antes de `1.0.0`: `0.MINOR.PATCH`; MINOR pode conter mudanças incompatíveis, documentadas.
- Pré-lançamentos: GitHub pré-release da própria versão (D-26); `0.1.0-next.N` no dist-tag `next` só quando houver registro npm.
- Tags git `vX.Y.Z` criadas apenas em `main`, com gate humano (HG-02).
- `v0.1.0` = MVP (Fase 9). `v1.0.0` = após feedback e polish, com contratos estáveis.
- Mudanças de esquema SQLite acompanham migração automática (G-09).
