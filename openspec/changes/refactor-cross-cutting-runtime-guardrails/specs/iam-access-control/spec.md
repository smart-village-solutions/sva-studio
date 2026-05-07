## ADDED Requirements

### Requirement: Plugin-Permissions müssen auf kanonische IAM-Verträge auflösen

Das System MUST Plugin-deklarierte Permissions und Actions vor der Snapshot-Publikation gegen den hosteigenen IAM-Policy- und Action-Vertrag kreuzvalidieren.

#### Scenario: Plugin referenziert vorhandene Permission

- **GIVEN** ein Plugin deklariert eine Permission oder Action-Anforderung wie `news.create`
- **WHEN** der Host den Build-time-Registry-Snapshot validiert
- **THEN** wird die Referenz nur akzeptiert, wenn eine kanonische hostbekannte IAM-Definition dafür existiert
- **AND** der Snapshot enthält die aufgelöste, vollqualifizierte Referenz

#### Scenario: Plugin referenziert unbekannte oder falsch geschriebene Permission

- **GIVEN** ein Plugin deklariert eine Referenz wie `news.creat`
- **WHEN** die Registry validiert wird
- **THEN** bricht die Snapshot-Publikation mit einem deterministischen Validierungsfehler ab
- **AND** der Host publiziert keine Route oder UI-Affordance, die erst zur Laufzeit mit `403` scheitert

### Requirement: Vollqualifizierte Action-IDs werden statisch erzwungen

Das System MUST fully-qualified Action-IDs nicht nur für Plugin-Beiträge, sondern auch für interne host- und authnahe Autorisierungspfade statisch erzwingen.

#### Scenario: Interner Handler verwendet Kurzform

- **WHEN** ein interner Auth-, IAM- oder Content-Pfad eine autorisierbare Action als Kurzform wie `read` oder `write` modelliert
- **THEN** schlägt der statische Qualitätslauf fehl
- **AND** die Implementierung wird auf eine vollqualifizierte Action-ID migriert

#### Scenario: Nicht autorisierbarer interner Hilfswert bleibt außerhalb des Scopes

- **WHEN** ein String nicht für eine Autorisierungsentscheidung, Auditierung oder Guard-Auswertung verwendet wird
- **THEN** erzwingt der Gate ihn nicht als Action-ID
- **AND** der Gate bleibt auf autorisierungsrelevante Kontraktstellen begrenzt
