## ADDED Requirements

### Requirement: Redis-basierte Permission-Snapshots

Das System SHALL effektive Berechtigungen als serialisierte Snapshots in Redis pro Benutzer-, Instanz- und Kontextscope verwalten.

#### Scenario: Cache-Miss schreibt Snapshot nach Redis

- **WHEN** für einen Benutzer-/Kontextscope noch kein gültiger Snapshot in Redis existiert
- **THEN** werden die effektiven Berechtigungen aus den führenden IAM-Daten berechnet
- **AND** der resultierende Snapshot wird in Redis gespeichert

#### Scenario: Cache-Hit lädt Snapshot aus Redis

- **WHEN** für einen Benutzer-/Kontextscope ein gültiger Snapshot in Redis vorliegt
- **THEN** wird die Autorisierungsentscheidung auf Basis des Redis-Snapshots getroffen
- **AND** der Endpunkt benötigt für den Hit-Pfad keine erneute Permission-Berechnung

### Requirement: Ereignisbasierte Invalidierung für Snapshot-Kontexte

Das System SHALL Redis-Snapshots bei relevanten Mutationen gezielt invalidieren.

#### Scenario: Rollen- oder Membership-Änderung invalidiert betroffene Snapshots

- **WHEN** Rollen, Gruppen, Memberships, Permissions oder Hierarchiebezüge eines Benutzers geändert werden
- **THEN** werden die betroffenen Redis-Snapshots invalidiert oder versioniert unbrauchbar gemacht
- **AND** die nächste Anfrage erzeugt einen Snapshot auf Basis des aktuellen Zustands

#### Scenario: Eventverlust wird durch Fallback begrenzt

- **WHEN** ein Invalidation-Event nicht verarbeitet wird
- **THEN** begrenzen TTL- und Recompute-Regeln die Dauer potenziell veralteter Entscheidungen
- **AND** ein dokumentierter Fallback-Pfad bleibt aktiv

### Requirement: Endpoint-nahe Performance-Verifikation für Authorize

Das System SHALL die Redis-gestützte Authorize-Strecke endpoint-nah unter Last verifizieren.

#### Scenario: Lastprofil wird mit Bericht nachgewiesen

- **WHEN** die Redis-gestützte Authorize-Strecke gegen das vereinbarte Lastprofil getestet wird
- **THEN** werden mindestens Cache-Hit-, Cache-Miss- und Recompute-Szenarien gemessen
- **AND** die Ergebnisse werden versioniert als Bericht dokumentiert
