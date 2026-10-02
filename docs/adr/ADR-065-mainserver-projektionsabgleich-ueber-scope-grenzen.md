# ADR-065: Mainserver-Projektionsabgleich über Scope-Grenzen

## Status

Akzeptiert am 2. Oktober 2026.

## Kontext

Der Mainserver ist die maßgebliche Quelle für externe Inhalte. Studio hält dafür getrennte Listenprojektionen je Konto, Organisation und Principal. Eine bestätigte Löschung muss eine ID aus allen Scopes des Mandanten entfernen. Eine pro Scope geführte Prozess-Queue verhindert jedoch weder Schreibvorgänge anderer Replikas noch das spätere Zurückschreiben einer zuvor geladenen Page.

## Entscheidung

- Alle Mainserver-Projektionsschreibvorgänge eines Mandanten und Inhaltstyps nehmen vor dem Zugriff auf Projektionszeilen und Sync-State denselben transaktionalen PostgreSQL-Advisory-Lock. Nach dem Warten liest die Transaktion den aktuellen Sync-State erneut.
- Ein Refresh schreibt nur mit führender `refresh_run_id`. Er wird überholt, wenn seit seinem Start ein erfolgreicher Abgleich in einem tatsächlich betroffenen Scope oder eine mandantenweite Mutation abgeschlossen wurde. Die betroffenen Scopes ergeben sich aus dem Konto und der Credential-Quelle des tatsächlichen Mainserver-Listenresultats; eine andere Quelle zwischen Pages beendet den Lauf.
- Bestätigte Löschungen und Mutationen, die Projektionszeilen scopeübergreifend entfernen, aktualisieren im vorhandenen `iam.content_list_projection_sync_state` den reservierten Schlüssel `__mainserver_global_mutation__`. Dieser Schlüssel ist ausschließlich ein Generationsmarker und niemals ein lesbarer Inhaltssnapshot. Die Löschung einer ID erfolgt auch dann, wenn inzwischen ein anderer Lauf die Leader-ID des eigenen Scopes besitzt. Nur dessen Sync-State-Abschluss bleibt an die Leader-ID gebunden.
- Das Entfernen eines einzelnen GenericItem-Geschwisters bestätigt keinen vollständigen Snapshot dieses Geschwister-Scopes. Ein überholter Page-Write oder Abschluss wird als Fehler nur dieses Inhaltstyps erfasst; andere Typen desselben Batches können weiter persistieren. Für den überholten Typ bleibt die Wiederholung beziehungsweise Reconciliation zuständig. Das Legacy-Schema ohne `sync_scope_key` verwendet weiter den einen typweiten Sync-State.

## Folgen

Die Datenbank serialisiert kurze Projektionsschreibtransaktionen pro Mandant und Inhaltstyp über Replikas hinweg. Mainserver-Listenaufrufe erfolgen außerhalb dieser Sperre. Unabhängige Konten behalten getrennte Snapshots; ein globaler Löschvorgang kann bereits geladene ältere Pages verwerfen und einen neuen Abgleich auslösen. Es ist keine neue Tabelle oder Migration erforderlich.

## Verworfene Alternativen

- Die vorhandene pro Scope geführte In-Process-Queue reicht über Replikas und Geschwister-Scopes hinweg nicht aus.
- Ein bloßer Zeitstempelvergleich ohne gemeinsame Sperre sieht noch nicht committete Mutationen nicht zuverlässig.
- Ein typweiter Überholvergleich würde lange Abgleiche wegen Erfolgen fremder Konten wiederholt abbrechen.
- Eine zusätzliche Tombstone-Tabelle wäre für den vorhandenen Sync-State-Vertrag eine unnötige zweite Persistenzschicht.

## Bezüge

- [Mainserver-Projektionsrefresh](../architecture/06-runtime-view.md#mainserver-projektionsrefresh)
- [Mainserver-Inhaltsprojektion](../architecture/05-building-block-view.md#ergänzung-2026-08-mainserver-inhaltsprojektion)
- [Content-Management-Schema](../development/studio-db-schema.md#6-content-management)
