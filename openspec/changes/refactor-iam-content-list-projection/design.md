## Context

`GET /api/v1/iam/contents`, der manuelle Projektionsrefresh, der periodische
Reconciliation-Pfad und die gezielte Nachführung nach Mainserver-Mutationen
verwenden dieselbe Projektion. Der bestehende Vertrag ist account-,
organisations-, Principal- und Credential-gebunden. Die Zerlegung darf weder
diese Schlüssel noch Fehler-, Retry- oder Seiteneffektreihenfolgen verändern.

## Goals

- eine Verantwortung und einen fachlichen Änderungsgrund pro internem Modul
- reine Entscheidungen getrennt von Datenbank- und Mainserver-I/O testen
- bestehende Scope-, Snapshot-, Autorisierungs- und Mutationssemantik erhalten
- die aktuellen Fallow- und Sonar-Komplexitätsbefunde ohne Verlagerung abbauen

## Non-Goals

- keine Änderung an HTTP-, Permission-, Principal- oder Credential-Verträgen
- keine Änderung an Tabellen, Indizes, Migrationen oder Schema-Snapshots
- keine neue Source of Truth, Service-/Factory-Abstraktion oder Dependency
- keine Fallow-/Sonar-Suppression und keine Lockerung von Quality Gates

## Decisions

- `iam-content-list-projection.server.ts` bleibt mit höchstens 400 Zeilen die
  Serverfassade mit den drei bestehenden produktiven Exporten.
- Authorization besitzt Request-Aufbau, Typprüfung, Actor-Auflösung und
  Item-Access. Read besitzt Projektionstypen, Visibility-SQL und Paging; List
  orchestriert daraus Snapshot-Vorbereitung, Blocking-Entscheidung und Response.
- Ein internes Modell hält Row-, Target- und Sync-State-Typen sowie reine
  Mapping-, Sortier-, Deduplizierungs- und Zustandsableitungen.
- Ein Repository besitzt Schema-Kompatibilität, parametrisierte SQL-Zugriffe,
  Projektionszeilen und persistierte Sync-State-Transitionen.
- Ein Source-Modul besitzt typisierte Mainserver-Page-/Detail-Loader und die
  fail-closed DataProvider-Binding-Ableitung.
- Ein Sync-Modul besitzt Full-Refresh, Scheduler und die vorhandene
  In-Memory-Deduplizierung. Ein Mutation-Modul verwendet dieselbe Queue und
  denselben Scope-Vertrag für gezielte Nachführungen.
- Interne Runtime-Imports verwenden explizite `.js`-Endungen; die
  Abhängigkeitsrichtung bleibt Modell -> Repository/Source -> Read/Authorization
  -> Sync/Mutation/List -> Fassade und damit zyklusfrei.

## Preserved runtime sequence

1. angefragte Inhaltstypen und effektive Berechtigungen bestimmen
2. Actor-Account und accountgebundene Projektionsziele auflösen
3. vorhandenen Snapshot- und Sync-State prüfen
4. fehlende oder veraltete Ziele über dieselbe Refresh-Queue aktualisieren
5. Projektionszeilen scope-isoliert laden, deduplizieren, sortieren und paginieren
6. serverautoritatives Item-Access-Read-Model ergänzen und unverändert antworten

Gezielte Mutationsnachführungen starten weiterhin eine neue Generation,
serialisieren sich mit demselben Target-Key, schreiben oder löschen nur die
betroffene Quellidentität und lassen einen bestätigten Mainserver-Erfolg bei
Folgefehlern bestehen.

## Risks / Trade-offs

- Mehr interne Dateien erhöhen die Dateianzahl, verkleinern aber die jeweilige
  Änderungs- und Testfläche. Die Module bleiben zweckgebunden und werden nicht
  als allgemeines Service-Framework abstrahiert.
- Ähnliche SQL-Transitionen werden nur zusammengeführt, wenn Transaktion,
  Scope-Prädikat und Generation-Semantik identisch sind. Fachlich verschiedene
  Zustandsübergänge bleiben explizit.
- Ein strukturell ähnlicher Projection-Row-Typ in `auth-runtime` bleibt in
  dessen eigener Ownership; ein Shared-Package allein für eine Kennzahl wäre
  zusätzliche langfristige Kopplung.

## Migration Plan

1. Characterization-Tests und Test-Fixture entlang der Verantwortungen teilen.
2. Modell, Repository und Mainserver-Quelle ohne Verhaltensänderung extrahieren.
3. Sync-, Mutation- und Fassadenentscheidungen vereinfachen.
4. Nx-, Coverage-, Fallow-, Sonar-, OpenSpec- und Architektur-Gates prüfen.
