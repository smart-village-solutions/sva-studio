# Content-Management-Core-Vertrag

Der Content-Core ist hostgeführt. Plugins liefern Payload-Schema, UI-Bindings und zusätzliche Validierung, dürfen aber Scope, Status, Historie, Revisionen, Audit-Referenzen oder IAM-Semantik nicht umdeuten.

## Core-Felder

Persistente Content-Datensätze führen neben `id`, `contentType`, `title`, `payload`, `status`, `createdAt` und `updatedAt` auch diese hosteigenen Felder:

- `instanceId`
- optional `organizationId`
- optional `ownerSubjectId`
- `validationState`
- optional `publishedAt`
- optional `publishFrom`
- optional `publishUntil`
- `createdBy`
- `updatedBy`
- `historyRef`
- optional `currentRevisionRef`
- optional `lastAuditEventRef`

Nicht ableitbare Bestandswerte werden in der Migration deterministisch befüllt: `validationState` wird `valid`, `historyRef` nutzt die jüngste History-ID oder die Content-ID als Fallback, `currentRevisionRef` folgt initial `historyRef`.

## IAM-Primitive

Content-Operationen verwenden keine groben Schreibrechte mehr. Kanonisch sind:

- `content.read`
- `content.create`
- `content.updateMetadata`
- `content.updatePayload`
- `content.changeStatus`
- `content.publish`
- `content.archive`
- `content.restore`
- `content.readHistory`
- `content.manageRevisions`
- `content.delete`

`content.write`, `content.update` und `content.moderate` sind keine Runtime-Aliase. Bestehende Rollen werden per Migration und Seed-Zuordnung auf die feineren Primitive übertragen.

## Operationsregeln

- Listen und Details prüfen `content.read`.
- Create prüft `content.create` vor Persistenz.
- Titel, Publikationsfenster, Owner, Organisation und Validation State prüfen `content.updateMetadata`.
- Payload-Änderungen prüfen `content.updatePayload`.
- Statuswechsel prüfen zielabhängig `content.publish`, `content.archive`, `content.restore` oder `content.changeStatus`.
- History-Lesen prüft `content.readHistory`.
- Delete prüft `content.delete`.

## Audit und History

History darf Snapshot- und Diff-nahe Daten für Revisionen behalten. Audit-Events speichern dagegen nur stabile Core-Metadaten wie Content-ID, Content-Type, Action, Actor, Ergebnis sowie Request- und Trace-Korrelation.

Plugin-Payloads werden nicht als Audit-Rohdaten geschrieben. Payload-Änderungen erscheinen nur als Klassifikation wie `payload_created`, `payload_updated` oder `payload_unchanged`.
