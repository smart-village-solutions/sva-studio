## Kontext

`@sva/sdk` war zuletzt nur noch ein Compatibility-Layer, der grosse Teile von `@sva/plugin-sdk` und `@sva/server-runtime` re-exportierte und dazu noch wenige lokale Helper wie `runtime-profile` oder Browser-Logging sichtbar hielt. Diese Zwischenlage war bewusst zeitlich begrenzt. Nachdem aktive produktive Consumer ausserhalb von `packages/sdk` bereits entfernt sind, ist der Hauptrest nicht mehr Laufzeitlogik, sondern Repo-Struktur: Targets, Coverage-Policy, Builder-Workspace, Skriptimporte und Dokumentation tragen das Altpaket weiter.

## Ziele

- den Compatibility-Layer technisch entfernen statt nur als deprecated zu markieren
- die vorhandenen Verantwortungen direkt in ihren Zielpackages belassen
- ehemals paketgebundene Tests sauber auf neue Verantwortungsbereiche verteilen
- aktive Repo-Metadaten, Coverage-Gates und Governance-Doku auf den Zustand ohne `sdk` umstellen

## Nicht-Ziele

- keine zweite Uebergangsphase mit Shim- oder Stub-Paket
- keine historische Alt-Dokumentation ausserhalb aktiver Norm- und Repo-Quellen bereinigen
- keine neue Boundary-Logik erfinden; nur die bereits entschiedene Zielarchitektur technisch vollziehen

## Entscheidungen

- `@sva/plugin-sdk` bleibt die einzige oeffentliche Plugin-Boundary.
- `@sva/server-runtime` bleibt die einzige oeffentliche Server-Runtime-Boundary.
- `@sva/core` traegt `runtime-profile`.
- `@sva/monitoring-client/logging` traegt browsernahes Logging.
- Paketinterne SDK-Tests werden nicht geloescht, sondern nach Verantwortung verteilt:
  - Plugin-bezogene Vertrags- und Registry-Tests nach `plugin-sdk`
  - Request-Context-, Logger-, Bootstrap-, JSON-Error- und Bridge-Tests nach `server-runtime`
  - CI-/Coverage-/Release-/Ops-nahe Skript- und Quality-Gate-Tests in ein eigenes internes Nx-Projekt `tooling-testing`
- Coverage-Hotspots fuer Request-Context und Monitoring-Bridge wandern von `sdk` nach `server-runtime`.

## Risiken / Trade-offs

- Die Entfernung ist absichtlich breaking; externe Altimporte funktionieren danach nicht mehr.
  - Minderung: aktive Consumer existieren laut Repo-Scan nicht mehr, und die Doku enthaelt einen klaren Migrationspfad.
- Durch die Testverlagerung koennen Coverage- oder Lint-Ziele unerwartet kippen.
  - Minderung: neue Test-Homes werden explizit in Nx/Vitest/Lint konfiguriert und vor Abschluss verifiziert.
- Einige historische Reports verweisen weiter auf `packages/sdk`.
  - Minderung: aktive Norm- und Repo-Quellen werden bereinigt; historische Reports bleiben bewusst ausserhalb des Scopes.

## Migrationsplan

1. Neues OpenSpec fuer den Breaking Cut anlegen.
2. SDK-Tests auf Zielpackages und `tooling-testing` verteilen.
3. Aktive Skriptimporte, Coverage-Policy und Workspace-Metadaten auf Zielpackages umstellen.
4. Aktive Architektur-, Governance- und Entwicklerdokumentation auf den Zustand ohne `@sva/sdk` aktualisieren.
5. `packages/sdk` vollstaendig entfernen.
6. Vollstaendige Verifikation mit OpenSpec, Repo-Suche, Unit-Tests, Type- und Runtime-Gates.
