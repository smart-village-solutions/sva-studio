## ADDED Requirements

### Requirement: Auditspur für kontrollierte Content-Inhabertransfers

Das System SHALL erfolgreiche, abgelehnte und unklare Content-Inhabertransfers append-only und PII-minimiert auditieren. Der Nachweis SHALL den tatsächlich handelnden Account von Quell-Principal, Ziel-Principal, Credential-Quelle und fachlichem Content-Inhaber trennen.

#### Scenario: Lokaler Inhalt wird erfolgreich übertragen

- **GIVEN** ein autorisierter Benutzer überträgt einen lokalen Inhalt
- **WHEN** das Repository die neue Ownership atomar bestätigt
- **THEN** auditiert Studio Action, Actor, Instanz, Content-ID/-Typ, alten und neuen Owner-Typ sowie deren technische IDs, Zeitpunkt, Ergebnis und Operationsreferenz
- **AND** historisiert es keine zusätzliche Klartext-PII

#### Scenario: Mainserver-Inhalt wird erfolgreich übertragen

- **GIVEN** ein autorisierter Benutzer überträgt einen Mainserver-Inhalt
- **WHEN** Response oder Target-Re-Read den Ziel-DataProvider bestätigt
- **THEN** auditiert Studio Actor, Source-/Target-Principal, Credential-Fingerprint, alten und neuen DataProvider, Binding-Versionen, Content-ID/-Typ, Operationsreferenz und Ergebnis
- **AND** ist die Action als `content.transferOwnership` von einem normalen Update unterscheidbar

#### Scenario: Transfer wird vor dem Provider-Write abgelehnt

- **WHEN** Permission, Source-Scope, Zielvalidierung, Binding, Credentials oder Typ-Capability den Transfer verweigern
- **THEN** auditiert Studio den stabilen Denial-Code, Actor, Instanz, Content-Referenz und Operationskorrelation
- **AND** speichert es keine Ziel-E-Mail, Credential-Geheimnisse oder vollständige Mainserver-Antwort

#### Scenario: Upstream-Ergebnis bleibt unklar

- **GIVEN** die Transfermutation endet mit Timeout oder verlorenem Response
- **AND** Source-/Target-Re-Reads liefern keine eindeutige Evidenz
- **WHEN** Studio den Vorgang fail-closed beendet
- **THEN** auditiert es `content_transfer_reconciliation_required` mit erwarteter Source-/Target-Provider-Referenz und den redigierten Read-Ergebnissen
- **AND** verhindert derselbe Reconciliation-Zustand eine unkontrollierte neue Transfermutation

#### Scenario: Actor verliert nach Transfer den Zugriff

- **GIVEN** der Provider-Transfer wurde erfolgreich bestätigt
- **AND** der bisherige Actor besitzt im Ziel-Scope kein Leserecht
- **WHEN** der anschließende Reload 403 oder 404 liefert
- **THEN** bleibt das Transfer-Audit erfolgreich
- **AND** wird der erwartete Zugriffsverlust nicht als Provider- oder Transferfehler umklassifiziert
