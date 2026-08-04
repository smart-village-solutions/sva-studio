# Content-Management-Core-Vertrag

Der Content-Core ist hostgeführt. Plugins liefern Payload-Schema, UI-Bindings und zusätzliche Validierung, dürfen aber Scope, Status, Historie, Revisionen, Audit-Referenzen oder IAM-Semantik nicht umdeuten.

## Core-Felder

Persistente Content-Datensätze führen neben `id`, `contentType`, `title`, `payload`, `status`, `createdAt` und `updatedAt` auch diese hosteigenen Felder:

- `instanceId`
- optional `organizationId`
- optional `ownerUserId`
- optional `ownerOrganizationId`
- `validationState`
- optional `publishedAt`
- optional `publishFrom`
- optional `publishUntil`
- `createdBy`
- `updatedBy`
- `author`
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
- Titel, Publikationsfenster, Owner, Organisation, sichtbare Autorenanzeige und Validation State prüfen `content.updateMetadata`.
- Payload-Änderungen prüfen `content.updatePayload`.
- Statuswechsel prüfen zielabhängig `content.publish`, `content.archive`, `content.restore` oder `content.changeStatus`.
- History-Lesen prüft `content.readHistory`.
- Delete prüft `content.delete`.

## Technischer GenericItems-Vollzugriff

Das Modul „Generische Inhalte“ bildet alle Mainserver-`GenericItem`s unabhängig vom `genericType` ab. Dies schließt `FeaturedProject`, `FAQ`, `COCKPIT_CARD` sowie unbekannte oder zukünftige Typkennungen ein. Generische Listen, Details und Mutationen prüfen ausschließlich die jeweilige Action unter `generic-items.*`; zusätzliche Rechte der Fachplugins sind nicht erforderlich.

Die generische Bearbeitung ist ein technischer Vollzugriff und erzwingt nicht die engeren Validierungen der Fachplugins. Reguläre Live-Rollen sollen deshalb keine `generic-items.*`-Actions erhalten. Wenn eine Person sowohl generische als auch fachliche Leserechte besitzt, kann derselbe Mainserver-Datensatz in der gemeinsamen Inhaltsübersicht in beiden Content-Type-Repräsentationen erscheinen.

## Scoped Rollen-Permissions fuer Content

- Die datensatzbezogenen Content-Rechte koennen ueber Rollen additiv mit `accessScope` eingeschraenkt werden:
  - `all`: keine zusaetzliche Einschraenkung
  - `own`: nur Datensaetze mit `ownerUserId = actorAccountId`
  - `organization`: eigene Datensaetze plus Datensaetze mit `ownerOrganizationId = aktive Session-Organisation`; ohne aktive Organisation verhaelt sich dieser Scope wie `own`
- Diese Scope-Information lebt auf `iam.role_permissions.access_scope`, nicht auf `iam.permissions.scope`.
- Der Content-Autorisierungspfad liefert dafuer kanonisch:
  - `resource.attributes.ownerUserId`
  - `resource.attributes.ownerOrganizationId`
  - `resource.attributes.organizationId`, wenn der Datensatz organisationsrelevant ist
  - `context.attributes.actorAccountId`
- Fehlt dieser Kontext fuer ein scope-faehiges Content-Recht, bleibt die Entscheidung fail-closed.
- Create-Requests duerfen `organizationId`, `ownerUserId` und `ownerOrganizationId` nicht als Payload-Override setzen; der Server leitet Owner aus Account und aktiver Organisation ab.

## Audit und History

History darf Snapshot- und Diff-nahe Daten für Revisionen behalten. Audit-Events speichern dagegen nur stabile Core-Metadaten wie Content-ID, Content-Type, Action, Actor, Ergebnis sowie Request- und Trace-Korrelation. Ownership- und Autorenanzeige-Änderungen enthalten alte und neue Werte für `ownerUserId`, `ownerOrganizationId` und die sichtbare Autorenanzeige.

Plugin-Payloads werden nicht als Audit-Rohdaten geschrieben. Payload-Änderungen erscheinen nur als Klassifikation wie `payload_created`, `payload_updated` oder `payload_unchanged`.
