# @sva/sdk

`@sva/sdk` ist nach dem Package-Hard-Cut kein Zielpackage für neue Plugin- oder Server-Runtime-Verträge mehr. Die früher gebündelten Rollen sind getrennt:

| Aufgabe | Zielpackage |
| --- | --- |
| Plugin-Verträge, Admin-Ressourcen, Content-Type-Erweiterungen und Plugin-i18n | `@sva/plugin-sdk` |
| Server-Logger, Request-Kontext, JSON-Fehlerantworten, Workspace-Kontext und OTEL-Bootstrap | `@sva/server-runtime` |

Neue Consumer importieren die passende Zielrolle direkt. `@sva/sdk` bleibt nur für Altpfade und ausdrücklich erhaltene Kompatibilität relevant.

## Betrieb

- **Name:** `sdk`
- **Tags:** `scope:sdk`, `type:lib`
- **Build:** `pnpm nx run sdk:build`
- **Lint:** `pnpm nx run sdk:lint`
- **Unit-Tests:** `pnpm nx run sdk:test:unit`

## Verwandte Dokumentation

- [Package-Zielarchitektur](../../docs/architecture/package-zielarchitektur.md)
- [Logging-Architektur](../../docs/architecture/logging-architecture.md)
- [Querschnittliche Konzepte (arc42 §8)](../../docs/architecture/08-cross-cutting-concepts.md)
