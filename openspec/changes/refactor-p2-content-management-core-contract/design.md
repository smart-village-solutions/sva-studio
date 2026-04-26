## Context

Der Content-Core ist das kleinste gemeinsame CMS-Rueckgrat des Studios. Er muss fuer Listen, Detailansichten, Validierung, IAM, Historie, Revisionen und Audit stabil genug sein, ohne fachliche Payloads oder packagespezifische UI-Spezialisierungen in den Core zu ziehen.

Mehrere angrenzende Changes bauen auf diesem Vertrag auf:

- `refactor-p2-iam-capability-mapping-for-content-actions` mappt fachliche Capabilities auf primitive Rechte.
- `add-p2-admin-resource-host-standards` definiert Host-Standards fuer Suche, Filter, Bulk-Actions, Historie und Revisionen.
- `refactor-p3-content-ui-specialization-boundaries` grenzt spezialisierte Fach-Views vom Host-Core ab.

Dieser Change definiert deshalb nur die hosteigene Content-Semantik und die stabilen Integrationspunkte fuer IAM und Audit.

## Goals

- Content-Core-Felder bleiben fuer alle Content-Typen verfuegbar, typisiert und hostgefuehrt.
- Plugin-Payloads koennen fachlich wachsen, ohne Status, Scope, Historie, Revisionen, Persistenz oder Audit zu ersetzen.
- IAM prueft Core-Operationen ueber stabile, fully-qualified Primitive im Namespace `content`.
- Audit-Events koennen Content-Mutationen nachvollziehen, ohne plugin-spezifische Payload-Inhalte zu speichern.
- Bestehende Inhalte koennen ueber explizite Migrationen in den Core-Vertrag ueberfuehrt werden.

## Non-Goals

- Kein neuer UI-Vertrag fuer spezialisierte Content-Ansichten.
- Kein fachliches Capability-Mapping; dieser Change stellt nur primitive Actions bereit.
- Kein zweites Statusmodell je Plugin oder Content-Typ.
- Keine Runtime-Registrierung von Content-Typen nach dem validierten Build-time-Snapshot.

## Core Contract Boundary

Host-owned:

- Identitaet: `contentId`, `contentType`
- Scope: `instanceId`, optional `organizationId`, optional `ownerSubjectId`
- Lifecycle: `status`, `validationState`, Publikationsfenster und Publikationszeitpunkt
- Nachvollziehbarkeit: `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `historyRef`, optionale Revision- und Audit-Referenzen
- Persistenzpfad, Statusuebergaenge, Autorisierung, Historie, Revisionen und Audit-Emission

Plugin-owned:

- Payload-Schema und fachliche Felder
- Display-Metadaten, Tabellenhinweise und UI-Bindings innerhalb hostseitiger Shells
- Zusaetzliche Validierungsregeln, die den Host-Core nur verschaerfen, aber nicht umdeuten
- Fachliche Capabilities, die in einem separaten Mapping auf Host-Primitive abgebildet werden

## Authorization Model

Der Core nutzt primitive Actions im Namespace `content`, zum Beispiel `content.read`, `content.updatePayload`, `content.changeStatus`, `content.publish` und `content.readHistory`. Jede Content-Core-Operation muss vor der Persistenz einen Scope aufloesen, mindestens `instanceId`, `contentType`, optional `contentId`, optional `organizationId` und bekannte Ownership-Informationen.

Plugins duerfen keine primitiven Core-Actions ersetzen oder shadowen. Fachliche Actions koennen spaeter auf diese Primitive gemappt werden, bleiben aber ausserhalb dieses Changes.

## Audit Model

Audit-Events fuer Content-Core-Mutationen referenzieren stabile Core-Metadaten: Content-ID, Content-Type, Scope, Actor, Primitive Action, Ergebnis, Request-/Trace-Korrelation sowie vorherige und neue Host-Lifecycle-Werte, sofern betroffen.

Plugin-Payloads werden nicht als Audit-Rohdaten gespeichert. Stattdessen wird eine Klassifikation wie `payload_updated`, `metadata_updated`, `status_changed` oder `revision_restored` erfasst. Detaildifferenzen bleiben einem explizit spezifizierten Revisions-/History-Modell vorbehalten.

## Migration and Compatibility

Bestehende Content-Daten muessen beim Einfuehren des Core-Vertrags deterministisch migriert werden. Fehlende Core-Metadaten werden aus vorhandenen Feldern abgeleitet oder mit dokumentierten Default-Regeln gesetzt. Nicht migrierbare Datensaetze werden mit Content-ID, Content-Type, Scope und Grund gemeldet.

Eine semantische Aenderung an host-owned Core-Feldern erfordert eine Host-Migration und darf nicht durch ein Plugin lokal erzwungen werden.

## Risks

- Zu viele Core-Felder wuerden das Modell wieder fachlich aufblaehen; deshalb bleibt der Core auf Querschnittssemantik beschraenkt.
- Zu wenige Core-Felder wuerden IAM, Audit und History payload-abhaengig machen; deshalb sind Scope, Lifecycle und Nachvollziehbarkeit explizit Teil des Vertrags.
- Capability-Mapping und UI-Spezialisierung koennen denselben Begriff "Action" verwenden; dieser Change beschraenkt "Primitive Action" bewusst auf IAM-nahe Core-Operationen.
