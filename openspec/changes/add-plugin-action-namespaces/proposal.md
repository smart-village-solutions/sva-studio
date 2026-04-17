# Change: Erweiterbare Plugin-Aktionen mit Namespace-Isolation einführen

## Why

Plugin-Routen können derzeit nur eine fest codierte kleine Menge an Guard-Werten wie `content.read` oder `content.write` referenzieren. Neue Plugin-spezifische Aktionen wie `content.export` oder `news.publish` erfordern dadurch Änderungen im SDK und im Routing-Package und erlauben keine saubere Eigentumsgrenze zwischen Core- und Plugin-Berechtigungen.

## What Changes

- Ein **Drei-Scope** namespaced Action-Modell wird eingeführt: `core` (host-kontrollierte Typed-Union), `plugin` (plugin-eigene Aktionen) und `shared` (plugin-übergreifende, host-registrierte Namespaces)
- Plugins deklarieren eigene Aktionen explizit und referenzieren sie in Routen und Navigation
- `@sva/routing` prüft Plugin-Routen generisch über eine zentrale `AuthorizationContext`-Schnittstelle (definiert in `@sva/sdk`, implementiert in `@sva/auth`) statt über harte Guard-Mappings
- Die Plugin-Registry validiert Namespace-Eigentum, Identifier-Format und verhindert Referenzen auf fremde Plugin-Namespaces; sie wird einmalig beim App-Start gebaut und eingefroren
- Navigation-Items erhalten `visibilityActions` (statt `requiredAction`) zur expliziten semantischen Trennung von Sichtbarkeit und Zugriffsschutz
- Die IAM-Authorize-API wird auf strukturierte Action-Objekte umgestellt; bestehende `content.*`-Policies werden migriert
- Bestehende `guard`/`requiredAction`-Felder werden ohne Compat-Shim entfernt (Hard Cut, Plugin-SDK v2)

## Impact

- Affected specs: `routing`, `iam-access-control`
- Affected code: `packages/sdk/src/plugins.ts`, `packages/routing/src/app.routes.shared.ts`, `packages/core/src/routing/*`, `packages/auth/src/**/*`, `apps/sva-studio-react/src/**/*`, `packages/plugin-example/src/**/*`, `packages/plugin-news/src/**/*`
- **Breaking Change:** Plugin-SDK v2 — `guard` und `requiredAction` werden ohne Compat-Shim entfernt
- **Breaking Change:** IAM-Authorize-API — Request-Format wechselt von flachem `action`-String auf strukturiertes Objekt; bestehende IAM-Policies müssen migriert werden
- Affected arc42 sections: `04-solution-strategy`, `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`, `09-architecture-decisions`, `10-quality-requirements`, `11-risks-and-technical-debt`, `12-glossary`
- Affected architecture docs: `docs/architecture/routing-architecture.md`
