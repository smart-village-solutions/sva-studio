## ADDED Requirements

### Requirement: Mainserver-Content-Audit trennt Actor, Mutationsprincipal und Inhaber

Das System SHALL Studio-initiierte Mainserver-Content-Mutationen PII-minimiert mit dem tatsächlich handelnden Account, dem gewählten persönlichen oder organisatorischen Mutationsprincipal, der Credential-Quelle beziehungsweise Credential-Signatur und dem Content-DataProvider auditieren.

Der tatsächlich handelnde Account SHALL bei Erstellen, Aktualisieren, Veröffentlichen, Archivieren, Wiederherstellen und Hard Delete stets Actor bleiben. Das Audit SHALL außerdem Autorisierungsmodus, Operationsreferenz, Mapping-Ergebnis und Provider-Outcome unterscheiden.

#### Scenario: Person handelt im Namen der aktiven Organisation

- **GIVEN** ein Benutzer führt eine zulässige Mutation mit `actingPrincipalType = organization` aus
- **WHEN** Studio den Audit-Nachweis schreibt
- **THEN** enthält er mindestens Actor, aktive Organisation, Credential-Quelle/Fingerprint, Content-DataProvider, Action, Autorisierungsmodus, Ergebnis und Operationsreferenz
- **AND** verwechselt er die handelnde Person nicht mit dem ursprünglichen Inhaber

#### Scenario: Person handelt im eigenen Namen

- **GIVEN** ein Benutzer führt eine zulässige Mutation mit `actingPrincipalType = user` aus
- **WHEN** Studio den Audit-Nachweis schreibt
- **THEN** enthält er Actor, persönliche Credential-Quelle/Fingerprint, Content-DataProvider, Action, Modus, Ergebnis und Operationsreferenz
- **AND** speichert er keine Keys, Secrets oder Tokens

#### Scenario: Autorisierung verwendet credential-sichtbare Kompatibilität

- **GIVEN** die für `own` oder `organization` erforderlichen aktuellen Bindungen fehlen oder sind konfliktbehaftet
- **WHEN** Studio einen credential-sichtbaren Inhalt autorisiert
- **THEN** enthält der Audit-Nachweis `authorizationMode = credential_visible_compatibility`
- **AND** dokumentiert er Principal, Credential-Fingerprint, Action, Pre-Read-Ergebnis, Provider-Outcome und Operationsreferenz
- **AND** legt eine Metrik die fortbestehende Nutzung des Modus offen

#### Scenario: Create erzeugt automatische Bindung

- **GIVEN** ein Studio-Create liefert mit gebundenem Credential einen DataProvider
- **WHEN** Studio die Principal-Bindung erzeugt oder bestätigt
- **THEN** auditiert es Principal-Typ, Credential-Fingerprint, DataProvider, Evidenzquelle, Ergebnis und Operationsreferenz
- **AND** speichert keine Credential-Geheimnisse oder DataProvider-Kontaktdaten

#### Scenario: Automatische Beobachtung erzeugt Konflikt

- **GIVEN** Create- oder Identity-Evidenz widerspricht einer bestehenden Bindung
- **WHEN** Studio den Konflikt persistiert
- **THEN** auditiert es beide technischen Provider-Referenzen, Principal, Credential-Fingerprint und Korrelationsreferenz
- **AND** überschreibt es keine Bindung
- **AND** bleibt der betroffene Scope im Kompatibilitätsmodus

#### Scenario: Scope wechselt automatisch zur exakten Auswertung

- **GIVEN** die für `own` oder `organization` erforderlichen aktuellen Bindungen sind vollständig und konfliktfrei
- **WHEN** Studio den Scope erstmals exakt auswertet
- **THEN** auditiert es den Wechsel mit Scope, Principal-Typen, DataProvider-IDs, Zeitpunkt und Ergebnis
- **AND** lädt die betroffene Oberfläche ihren Autorisierungskontext neu

#### Scenario: Hard Delete verwendet Preimage und Tombstone

- **GIVEN** ein Benutzer führt einen autorisierten Hard Delete aus
- **WHEN** der Same-Credential-Pre-Read erfolgreich ist
- **THEN** persistiert Studio Actor, Principal, Credential-Fingerprint, Content-ID, Content-Typ und DataProvider unter einer Operationsreferenz
- **AND** finalisiert nach Provider-Erfolg einen Tombstone
- **AND** benötigt keinen Post-Delete-Read

### Requirement: Mainserver-Content-History weist ihre Studio-Abdeckung aus

Das System SHALL die History Mainserver-basierter Inhalte auf im Studio beobachtete Mutationen begrenzen und ihre Abdeckung als `coverage = studio_mutations` ausweisen. Direkte Änderungen im Mainserver SHALL nicht ohne bestätigten Event-Vertrag als Studio-History rekonstruiert werden.

#### Scenario: Inhalt wurde direkt im Mainserver geändert

- **GIVEN** ein Content wurde außerhalb des Studios direkt im Mainserver bearbeitet
- **WHEN** Studio den aktuellen typisierten Content und seine History lädt
- **THEN** zeigt es den aktuellen Mainserver-Zustand
- **AND** erzeugt keinen erfundenen History-Eintrag
- **AND** kennzeichnet die History weiterhin mit `coverage = studio_mutations`

#### Scenario: Studio-Mutation wird historisiert

- **GIVEN** Studio hat eine Mainserver-Mutation erfolgreich beobachtet
- **WHEN** der History-Eintrag finalisiert wird
- **THEN** referenziert er Actor, Mutationsprincipal, Content-DataProvider und Operationsreferenz
- **AND** behauptet keine vollständige Abdeckung externer Änderungen

#### Scenario: Abgelehnte oder fehlgeschlagene Mutation bleibt nur im Audit

- **GIVEN** eine Content-Mutation wird lokal abgelehnt oder schlägt im Mainserver fehl
- **WHEN** Studio Audit und History finalisiert
- **THEN** bleibt der Versuch auditierbar
- **AND** erscheint nicht als erfolgreiche Änderung in der sichtbaren Content-History
