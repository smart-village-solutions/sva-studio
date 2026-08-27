# Content-Management-Core-Vertrag

Der Content-Core ist für lokal im Studio persistierte Inhalte hostgeführt. Bei Mainserver-basierten Inhalten bleibt dagegen der Mainserver fachlich führend; lokale Cores, References, History und Listenprojektionen sind optionale, rekonstruierbare Begleitzustände. Plugins liefern Payload-Schema, UI-Bindings und zusätzliche Validierung, dürfen aber IAM-Semantik oder die jeweilige fachliche Source of Truth nicht umdeuten.

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
- `content.transferOwnership`
- `content.delete`

`content.write`, `content.update` und `content.moderate` sind keine Runtime-Aliase. Bestehende Rollen werden per Migration und Seed-Zuordnung auf die feineren Primitive übertragen.

## Operationsregeln

- Listen und Details prüfen `content.read`.
- Create prüft `content.create` vor Persistenz.
- Titel, Publikationsfenster, sichtbare Autorenanzeige und Validation State prüfen `content.updateMetadata`.
- Die technische Inhaberschaft wird ausschließlich über den getrennten, bestätigungspflichtigen Transferpfad mit `content.transferOwnership` geändert. Ein normales Update akzeptiert weder Owner-Felder noch eine Mainserver-DataProvider-ID.
- Payload-Änderungen prüfen `content.updatePayload`.
- Statuswechsel prüfen zielabhängig `content.publish`, `content.archive`, `content.restore` oder `content.changeStatus`.
- History-Lesen prüft `content.readHistory`.
- Delete prüft `content.delete`.

## Technischer GenericItems-Vollzugriff

Das Modul „Generische Inhalte“ bildet alle Mainserver-`GenericItem`s unabhängig vom `genericType` ab. Dies schließt `FeaturedProject`, `FAQ`, `COCKPIT_CARD` sowie unbekannte oder zukünftige Typkennungen ein. Generische Listen, Details und Mutationen prüfen ausschließlich die jeweilige Action unter `generic-items.*`; zusätzliche Rechte der Fachplugins sind nicht erforderlich.

Die generische Bearbeitung ist ein technischer Vollzugriff und erzwingt nicht die engeren Validierungen der Fachplugins. Reguläre Live-Rollen sollen deshalb keine `generic-items.*`-Actions erhalten.

Für die gemeinsame Inhaltsübersicht deklariert jedes GenericItem-Fachplugin seinen exakten `genericType` im Build-time-Registry-Vertrag. Ein solcher Datensatz erscheint dort ausschließlich unter dem registrierten Fach-Content-Type; nur unbekannte oder nicht übernommene Diskriminatoren fallen auf `generic-items.generic-item` zurück. Diese Klassifikation erfolgt vor der Autorisierung: Fehlende Fachrechte erzeugen in der gemeinsamen Übersicht keinen generischen Ersatz. Der technische Vollzugriff auf alle GenericItems bleibt ausschließlich im eigenständigen Modul „Generische Inhalte“ erhalten.

Der Server liest diese Zuordnung aus einem kleinen Ownership-Modul des aktivierten Plugins und lädt dafür weder React-Flächen noch den Browser-Plugin-Snapshot. Die Mainserver-Fassade akzeptiert nur registrierte GenericItem-Projektionstypen und füllt gefilterte Seiten über weitere Upstream-Seiten auf, bis die angeforderte Seite vollständig oder das Ende erreicht ist. Progressive Folgeseiten setzen den Scan am zurückgegebenen Upstream-Offset fort, statt vorherige Mainserver-Seiten erneut zu laden.

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

History darf Snapshot- und Diff-nahe Daten für Revisionen behalten. Audit-Events speichern dagegen nur stabile Core-Metadaten wie Content-ID, Content-Type, Action, Actor, Ergebnis sowie Request- und Trace-Korrelation. Studio-ausgelöste Inhabertransfers erfassen Quell- und Ziel-Principal PII-arm und kennzeichnen ihre Abdeckung als `studio_mutations`. Das Audit ist keine vollständige Inhaberhistorie, weil externe Änderungen fehlen können; der aktuelle Datensatz bleibt maßgeblich. Änderungen der sichtbaren Autorenanzeige werden davon getrennt erfasst.

Plugin-Payloads werden nicht als Audit-Rohdaten geschrieben. Payload-Änderungen erscheinen nur als Klassifikation wie `payload_created`, `payload_updated` oder `payload_unchanged`.

Die öffentliche History-Projektion enthält Actor-Anzeige, Aktion, Zeitpunkt, stabile Feld-IDs, Statusübergang und Zusammenfassung sowie `origin = studio` und `coverage = studio_mutations`. Sie gibt `snapshot_json` nicht aus. `mutation_ref` korreliert erfolgreiche Mainserver-Mutationen und verhindert doppelte sichtbare Einträge bei Wiederholungen.

Mainserver-basierte Inhalte erhalten erst nach einer erfolgreichen fachlichen Mutation einen lokalen History-Core und eine gebundene Provider-Referenz. Abgelehnte oder fehlgeschlagene Versuche bleiben ausschließlich im Audit- und Diagnosepfad. Direkte Änderungen außerhalb des Studios werden nicht nachträglich als Studio-History rekonstruiert.

Ein fehlender History-Core oder eine fehlende Provider-Referenz blockiert weder Liste, Detail noch Bearbeitung eines durch die typspezifische IAM-Action autorisierten Mainserver-Inhalts. `404 not_found` des History-Pfads wird für typisierte Mainserver-Inhalte als leere Studio-History mit der dokumentierten Abdeckung `studio_mutations` behandelt.
