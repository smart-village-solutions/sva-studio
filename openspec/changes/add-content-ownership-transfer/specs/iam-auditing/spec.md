## ADDED Requirements

### Requirement: Auditspur für kontrollierte Content-Inhabertransfers

Das System SHALL erfolgreiche, abgelehnte und unklare Content-Inhabertransfers append-only und PII-minimiert auditieren. Der Nachweis SHALL den tatsächlich handelnden Account von optional auflösbarem Quell-Principal, Ziel-Principal, Credential-Quelle und fachlichem Content-Inhaber trennen.

Die Auditspur SHALL ihre Abdeckung als `studio_mutations` kennzeichnen. Sie SHALL nicht als vollständige Inhaberhistorie dargestellt oder zur Rekonstruktion des aktuellen Inhabers verwendet werden, weil DataProvider und Inhalte außerhalb des Studios verändert werden können. Maßgeblich für den aktuellen Mainserver-Inhaber SHALL immer der DataProvider eines aktuellen Content-Reads sein.

#### Scenario: Lokaler Inhalt wird erfolgreich übertragen

- **GIVEN** ein autorisierter Benutzer überträgt einen lokalen Inhalt
- **WHEN** das Repository die neue Ownership atomar bestätigt
- **THEN** auditiert Studio Action, Actor, Instanz, Content-ID/-Typ, alten und neuen Owner-Typ sowie deren technische IDs, Zeitpunkt, Ergebnis und Operationsreferenz
- **AND** historisiert es keine zusätzliche Klartext-PII

#### Scenario: Mainserver-Inhalt wird erfolgreich übertragen

- **GIVEN** ein autorisierter Benutzer überträgt einen Mainserver-Inhalt
- **WHEN** Response oder Target-Re-Read den Ziel-DataProvider bestätigt
- **THEN** auditiert Studio Actor, Auflösungszustand des optionalen Source-Principals, Target-Principal, Credential-Fingerprint, alten und neuen DataProvider, Binding-Versionen, Content-ID/-Typ, Operationsreferenz und Ergebnis
- **AND** ist die Action als `content.transferOwnership` von einem normalen Update unterscheidbar

#### Scenario: Source-Principal ist nicht mehr eindeutig auflösbar

- **GIVEN** Scope `all` autorisiert den Transfer eines aktuellen DataProviders ohne eindeutige Studio-Principal-Bindung
- **WHEN** Studio den Transfer auditiert
- **THEN** kennzeichnet es die Source-Principal-Auflösung als `unresolved`
- **AND** bleibt der tatsächlich gelesene Quell-DataProvider im Audit erhalten

#### Scenario: Source-Principal-Anreicherung schlägt technisch fehl

- **GIVEN** Scope `all` autorisiert den Transfer unabhängig vom Source-Principal
- **AND** die optionale Source-Principal-Anreicherung endet mit einem technischen Fehler
- **WHEN** Studio den Transfer auditiert
- **THEN** kennzeichnet es die Source-Principal-Auflösung als `failed`
- **AND** bleibt der tatsächlich gelesene Quell-DataProvider im Audit erhalten

#### Scenario: Transfer wird vor dem Provider-Write abgelehnt

- **WHEN** Permission, Source-Scope, Zielvalidierung, Binding, Credentials oder Typ-Capability den Transfer verweigern
- **THEN** auditiert Studio den stabilen Denial-Code, Actor, Instanz, Content-Referenz und Operationskorrelation
- **AND** speichert es keine Ziel-E-Mail, Credential-Geheimnisse oder vollständige Mainserver-Antwort

#### Scenario: Upstream-Ergebnis bleibt unklar

- **GIVEN** die Transfermutation endet mit Timeout oder verlorenem Response
- **AND** Actor-/Target-Re-Reads liefern keine eindeutige Evidenz
- **WHEN** Studio den Vorgang fail-closed beendet
- **THEN** auditiert es `content_transfer_reconciliation_required` mit erwarteter Source-/Target-Provider-Referenz und den redigierten Read-Ergebnissen
- **AND** verhindert derselbe Reconciliation-Zustand eine unkontrollierte neue Transfermutation

#### Scenario: Actor verliert nach Transfer den Zugriff

- **GIVEN** der Provider-Transfer wurde erfolgreich bestätigt
- **AND** der bisherige Actor besitzt im Ziel-Scope kein Leserecht
- **WHEN** der anschließende Reload 403 oder 404 liefert
- **THEN** bleibt das Transfer-Audit erfolgreich
- **AND** wird der erwartete Zugriffsverlust nicht als Provider- oder Transferfehler umklassifiziert

#### Scenario: Externe Inhaberänderung fehlt im Studio-Audit

- **GIVEN** der DataProvider eines Inhalts wurde außerhalb des Studios geändert
- **AND** das Studio besitzt dafür kein eigenes Transferereignis
- **WHEN** Audit oder optionale Inhaberhistorie angezeigt werden
- **THEN** erfindet Studio kein Transferereignis
- **AND** kennzeichnet es die Historie als möglicherweise unvollständig
- **AND** zeigt die Content-Ansicht trotzdem den DataProvider des aktuellen Fresh Reads als aktuellen Inhaber

#### Scenario: Audit und aktueller DataProvider widersprechen sich

- **GIVEN** das letzte Studio-Audit nennt `dp-source` als Inhaber
- **AND** ein aktueller Content-Read liefert `dp-target`
- **WHEN** Studio den aktuellen Inhaber bestimmt
- **THEN** verwendet es `dp-target`
- **AND** startet es die vorgesehene Projektions-Reconciliation
- **AND** schreibt es ohne beobachtete Studio-Mutation kein rückdatiertes Transfer-Audit
