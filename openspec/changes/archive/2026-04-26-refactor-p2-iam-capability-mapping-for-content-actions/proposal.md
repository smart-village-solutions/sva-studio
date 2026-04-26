# Change: Capability-Mapping für Inhaltsaktionen auf primitive Studio-Rechte ausrichten

## Why

Das Studio besitzt bereits eine zentrale Permission Engine, aber fachnahe Inhaltsaktionen können mit wachsendem CMS-Umfang zu verstreuter Speziallogik führen. Ein explizites Capability-Mapping zwischen fachlicher Aktion und primitiven Studio-Rechten macht Autorisierungsentscheidungen konsistenter, besser prüfbar und besser erklärbar.

Ohne diesen Vertrag drohen drei Drift-Pfade: Die UI blendet Aktionen anhand anderer Annahmen ein als die API, Content-Typen definieren eigene Sonderprüfungen, und Audit-Events beschreiben nicht mehr eindeutig, welches fachliche Vorhaben durch welches technische Recht erlaubt oder verweigert wurde.

## What Changes

- Einführung eines hostseitigen Capability-Mapping-Vertrags für mutierende Inhaltsaktionen.
- Trennung zwischen fachlichen Capabilities wie Publish, Archive, Restore, Bulk-Edit oder Revisionsverwaltung und primitiven Studio-Action-IDs.
- Verpflichtende Capability-Deklaration für mutierende Content-Aktionen, bevor sie in UI oder API nutzbar werden.
- Serverseitige Auflösung von Capability auf primitive Studio-Action vor jeder Autorisierungsentscheidung.
- Additive Nutzung derselben Mapping-Information für UI-Verfügbarkeit, API-Autorisierung, Diagnose und Audit-Klassifikation.
- Deterministische Denials für fehlende oder ungültige Mappings, damit neue Content-Typen nicht stillschweigend unsicher oder uneinheitlich freigeschaltet werden.
- Vorbereitung nachvollziehbarer Autorisierungsentscheidungen für neue Content-Typen und Plugin-Beiträge.

## Aufwand/Nutzen

- Nutzen: hoch für Content-Statuswechsel und Plugin-Content-Aktionen, weil hier UI, API, Berechtigungen und Audit bereits fachlich eng gekoppelt sind.
- Aufwand: mittel, wenn der Scope auf Content-Aktionsregistrierung, serverseitigen Resolver und minimale Audit-Felder begrenzt bleibt.
- Risiko: mittel, hauptsächlich durch falsche oder unvollständige Mappings; wird durch deny-by-default und deterministische Diagnosecodes reduziert.
- Optimierung: Admin-Aktionen bleiben als später kompatibles Zielbild erwähnt, sind aber nicht Teil dieses P2-Umsetzungsschnitts. Audit-Exports und neue Admin-Verträge werden nicht erweitert, solange die gespeicherten Audit-Felder konsistent bleiben.

## Impact

- Affected specs:
  - `iam-access-control`
  - `content-management`
  - `iam-auditing`
- Affected code:
  - `packages/auth-runtime`
  - `packages/core`
  - `packages/plugin-sdk`
  - serverseitige Content-Action-Handler
  - Audit-Event-Erzeugung für Content-Aktionen
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/06-runtime-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/10-quality-requirements.md`
