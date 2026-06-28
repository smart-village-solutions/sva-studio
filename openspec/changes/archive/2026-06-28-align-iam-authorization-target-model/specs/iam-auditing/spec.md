## ADDED Requirements

### Requirement: Auditspur für IAM-Zielbild-Restpunkte

Das System SHALL Ownership-Transfers, Änderungen der sichtbaren Autorenanzeige und System-Admin-Ausnahmewege revisionssicher und PII-minimiert auditieren.

#### Scenario: Ownership-Transfer wird auditiert

- **WHEN** `ownerUserId` oder `ownerOrganizationId` eines Inhalts geändert wird
- **THEN** erzeugt das System ein Audit-Ereignis mit Inhalt, Actor, altem Owner-Wert, neuem Owner-Wert, Zeitpunkt, Ergebnis, `request_id` und `trace_id`
- **AND** der Eintrag speichert keine unnötige Klartext-PII

#### Scenario: Autorenanzeige-Modus wird geändert

- **WHEN** der Modus oder Snapshot der sichtbaren Autorenanzeige geändert wird
- **THEN** erzeugt das System ein Audit-Ereignis, das diese Änderung von normaler Payload- oder Titelbearbeitung unterscheidbar macht
- **AND** der Eintrag enthält alten Wert, neuen Wert, Actor, Inhalt, Ergebnis und Korrelationsdaten

#### Scenario: System-Admin-Ausnahme wird verwendet

- **WHEN** ein begrenzter Plattform-, Bootstrap-, Migration- oder Reconcile-Pfad erhöhte Systemrechte nutzt
- **THEN** erzeugt das System ein Audit-Ereignis mit Pfadklasse, Actor oder Service-Actor, Scope, Grundklasse, Ergebnis, `request_id` und `trace_id`
- **AND** normale Tenant-Mutationspfade werden nicht als Ausnahme klassifiziert
