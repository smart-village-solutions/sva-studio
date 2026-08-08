# ADR-050: Zentraler scopegebundener UI-Zugriff

**Status:** Accepted
**Entscheidungsdatum:** 2026-08-08
**Entschieden durch:** SVA Studio Team

## Kontext

Identität, effektive Tenant-Rechte, Organisationskontext und Modulzuweisung wurden historisch von mehreren Hooks, Route-Guards und Plugin-Oberflächen unterschiedlich kombiniert. Ladende Zustände, Dev-Auth-Verfügbarkeit oder verspätete Antworten konnten dadurch eine andere Sicht erzeugen als Sidebar oder Mutationselemente. Eine globale Action sagt außerdem nichts über datensatzbezogene Ownership aus.

## Entscheidung

1. `AuthProvider` bleibt Owner von Identität, Session-Lifecycle, `/auth/me`, Login und Logout. Seine flache Permission-Liste ist keine Quelle für Route- oder UI-Entscheidungen.
2. Ein anwendungsweiter Organisationskontext und `EffectiveAccessProvider` besitzen den aktuellen Plattform-/Tenant-Scope und genau eine Access-Generation.
3. Plattform-Snapshots verwenden ausschließlich validierte technische Plattformrollen. Tenant-Snapshots verwenden `/iam/me/permissions`, aktuelle Modulzuweisung und optional den aktiven Organisationskontext.
4. `unresolved`, `loading` und `error` sind fail-closed. Scope- oder Organisationswechsel verwerfen alte Rechte atomar; verspätete Antworten alter Generationen werden ignoriert.
5. Tenant-Anforderungen verwenden vollständig qualifizierte Action-IDs. Wo ein Modul existiert, ist dessen Zuweisung ein additives Gate und kein Ersatz für die Action.
6. Datensatzbezogene `own`-, Organisations- und Geo-Rechte benötigen eine passende serverautoritativ gelieferte Ressourcen-Capability. Eine globale Action oder ein Cache-Hit reicht nicht.
7. Plugin-Actions, Routen, Navigation und Admin-Ressourcen deklarieren `UiAccessRequirement`. Der Host löst den Snapshot auf und veröffentlicht eine read-only Projektion über `@sva/plugin-sdk`.
8. Identitäts-/Session-Refresh, Access-Refetch und Session-Widerruf bleiben getrennte Operationen. Ein erwartbarer Ressourcen-`403` löst ohne stabiles Stale-Signal keinen globalen Refetch aus.
9. Scope-beschränkte Read-Permissions dürfen den Einstieg in eine ausdrücklich als Sammlung deklarierte, serverseitig gefilterte Listenfläche freigeben. Daraus folgt keine Capability für einen konkreten Datensatz oder eine Mutation.

## Konsequenzen

### Positiv

- Routing, Sidebar, Host und Plugins entscheiden aus demselben Scope und derselben Generation.
- Dev-Auth-Verfügbarkeit kann keine Autorisierung umgehen.
- Read-only- und Negativpfade lassen sich pro Action und Modul reproduzierbar testen.
- Ressourcen-Ownership bleibt an der Servergrenze und wird nicht aus globalen UI-Rechten abgeleitet.

### Negativ

- Bestehende Host- und Plugin-Flächen müssen ihren impliziten Rollen-/Permission-Zugriff migrieren.
- Während der Brownfield-Phase sind Übergangsdiagnosen nötig, bevor fehlende Access-Anforderungen fail-fast werden können.
- Der Host trägt die Ownership für Provider-Lifecycle und Plugin-Snapshot-Publikation.

## Verbindliche Leitplanken

- Keine UI-Freigabe aus `/auth/me.permissionActions`.
- Keine Autorisierungsfreigabe aus bloßer Dev-Auth-Verfügbarkeit.
- Keine Tenant-Aktion ohne vollständig qualifizierte Action-ID; Modul-Gates sind additiv.
- Keine Datensatzmutation aus globaler Action ohne erforderliche Ressourcen-Capability.
- Keine alte Permission-Anzeige während Scope- oder Organisationswechsel.
- UI-Entscheidungen ergänzen Server-Enforcement, ersetzen es nie.

## Verwandte ADRs

- `ADR-012-permission-kompositionsmodell-rbac-v1.md`
- `ADR-014-postgres-notify-cache-invalidierung.md`
- `ADR-026-redis-als-primary-permission-cache.md`
- `ADR-034-plugin-sdk-vertrag-v1.md`
- `ADR-037-plugin-spezifische-iam-rechte.md`
