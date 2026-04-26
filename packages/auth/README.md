# @sva/auth

`@sva/auth` ist nach dem Package-Hard-Cut kein Zielpackage für neue Auth-, IAM-, Governance- oder Registry-Fachlogik mehr. Das Paket bleibt als Alt- und Kompatibilitätsbereich für bereits migrierte Importpfade bestehen.

## Zielimporte

| Aufgabe | Zielpackage |
| --- | --- |
| Login, Logout, OIDC, Session, Cookies, Auth-Middleware, Runtime-Routen | `@sva/auth-runtime` |
| Zentrale Autorisierungsentscheidung und IAM-Basisverträge | `@sva/iam-core` |
| Benutzer, Rollen, Gruppen, Organisationen, Actor-Auflösung und Reconcile | `@sva/iam-admin` |
| Governance, Legal Texts, DSR und audit-nahe IAM-Fachfälle | `@sva/iam-governance` |
| Instanzen, Host-Klassifikation, Registry und Provisioning | `@sva/instance-registry` |
| Serverseitiger Request-Kontext, Logger, Fehlerantworten und OTEL | `@sva/server-runtime` |
| Serverseitige Repositories | `@sva/data-repositories` |

Neue Consumer importieren nicht aus diesem Paket, wenn eine der Zielrollen passt. Adapter in `@sva/auth` dürfen nur bestehende Kompatibilität erhalten und keine neue fachliche Ownership begründen.

## Betrieb

- **Name:** `auth`
- **Tags:** `scope:auth`, `type:lib`
- **Build:** `pnpm nx run auth:build`
- **Lint:** `pnpm nx run auth:lint`
- **Unit-Tests:** `pnpm nx run auth:test:unit`
- **Runtime-Check:** `pnpm nx run auth:check:runtime`

## Verwandte Dokumentation

- [Package-Zielarchitektur](../../docs/architecture/package-zielarchitektur.md)
- [Bausteinsicht (arc42 §5)](../../docs/architecture/05-building-block-view.md)
- [Querschnittliche Konzepte (arc42 §8)](../../docs/architecture/08-cross-cutting-concepts.md)
