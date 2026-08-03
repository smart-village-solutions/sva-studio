## ADDED Requirements

### Requirement: Auditspur für Content-Ownership-Änderungen

Das System SHALL Änderungen an Content-Ownership und sichtbarer Autorenanzeige revisionssicher historisieren.

#### Scenario: Ownership wird geändert

- **WHEN** `ownerUserId` oder `ownerOrganizationId` eines Inhalts geändert wird
- **THEN** erzeugt das System einen Historien- oder Audit-Eintrag mit altem Wert, neuem Wert, Zeitpunkt, auslösendem Account, betroffenem Inhalt und betroffenem Feldtyp
- **AND** der Eintrag enthält keine zusätzliche Klartext-PII

#### Scenario: Sichtbare Autorenanzeige wird geändert

- **WHEN** die sichtbare Autorenanzeige eines Inhalts geändert wird
- **THEN** erzeugt das System einen Historien- oder Audit-Eintrag mit altem Wert, neuem Wert, Zeitpunkt, auslösendem Account, betroffenem Inhalt und betroffenem Feldtyp
- **AND** diese Änderung ist von einer normalen Inhaltsbearbeitung unterscheidbar
