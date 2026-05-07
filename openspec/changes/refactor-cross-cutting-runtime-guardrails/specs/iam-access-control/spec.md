## ADDED Requirements

### Requirement: Plugin-Permissions muessen auf kanonische IAM-Vertraege aufloesen

Das System MUST Plugin-deklarierte Permissions und Actions vor der Snapshot-Publikation gegen den hosteigenen IAM-Policy- und Action-Vertrag kreuzvalidieren.

#### Scenario: Plugin referenziert vorhandene Permission

- **GIVEN** ein Plugin deklariert eine Permission oder Action-Anforderung wie `news.create`
- **WHEN** der Host den Build-time-Registry-Snapshot validiert
- **THEN** wird die Referenz nur akzeptiert, wenn eine kanonische hostbekannte IAM-Definition dafuer existiert
- **AND** der Snapshot enthaelt die aufgeloeste, vollqualifizierte Referenz

#### Scenario: Plugin referenziert unbekannte oder falsch geschriebene Permission

- **GIVEN** ein Plugin deklariert eine Referenz wie `news.creat`
- **WHEN** die Registry validiert wird
- **THEN** bricht die Snapshot-Publikation mit einem deterministischen Validierungsfehler ab
- **AND** der Host publiziert keine Route oder UI-Affordance, die erst zur Laufzeit mit `403` scheitert

### Requirement: Vollqualifizierte Action-IDs werden statisch erzwungen

Das System MUST fully-qualified Action-IDs nicht nur fuer Plugin-Beitraege, sondern auch fuer interne host- und authnahe Autorisierungspfade statisch erzwingen.

#### Scenario: Interner Handler verwendet Kurzform

- **WHEN** ein interner Auth-, IAM- oder Content-Pfad eine autorisierbare Action als Kurzform wie `read` oder `write` modelliert
- **THEN** schlaegt der statische Qualitaetslauf fehl
- **AND** die Implementierung wird auf eine vollqualifizierte Action-ID migriert

#### Scenario: Nicht autorisierbarer interner Hilfswert bleibt ausserhalb des Scopes

- **WHEN** ein String nicht fuer eine Autorisierungsentscheidung, Auditierung oder Guard-Auswertung verwendet wird
- **THEN** erzwingt der Gate ihn nicht als Action-ID
- **AND** der Gate bleibt auf autorisierungsrelevante Kontraktstellen begrenzt
