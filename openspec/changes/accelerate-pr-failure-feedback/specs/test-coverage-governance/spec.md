## MODIFIED Requirements

### Requirement: Performante Coverage-Ausführung via Nx Cache

Das System SHALL redundante Coverage-Arbeit durch Changed-first-Ausführung, disjunkte Shards und Nx-Caching nachweislich deterministischer Coverage-Targets vermeiden. Coverage-Caching MUST pro Target deaktiviert bleiben, solange vollständige Inputs, Outputs und Fresh-/Restore-Äquivalenz nicht durch Contract-Tests belegt sind.

#### Scenario: Coverage-Cache bei nachgewiesener Deterministik

- **GIVEN** ein Coverage-Target hat vollständige Inputs und Outputs deklariert
- **AND** Contract-Tests bestätigen identische Summary-, LCOV-, Pfad- und Gate-Ergebnisse für Fresh Run und Cache Restore
- **WHEN** Quellcode, Testcode, Toolchain und Coverage-Konfiguration unverändert sind
- **THEN** darf Nx den Coverage-Report aus einem zulässigen Cache wiederherstellen
- **AND** der Testlauf wird für dieses Target übersprungen

#### Scenario: Coverage-Target ohne Determinismusnachweis

- **GIVEN** Fresh-/Restore-Äquivalenz oder vollständige Inputs und Outputs sind nicht belegt
- **WHEN** das Coverage-Target in CI läuft
- **THEN** bleibt Nx-Caching für dieses Target deaktiviert
- **AND** Changed-first, Sharding und Workflow-Artefakte dürfen die Ausführung ohne Ergebniswiederverwendung beschleunigen

#### Scenario: Cache-Invalidierung bei Änderungen

- **WHEN** Quellcode, Testcode, Toolchain, Nx-Inputs oder Coverage-Konfiguration sich ändern
- **THEN** wird der bisherige Cache-Eintrag nicht verwendet
- **AND** Coverage wird neu generiert und vollständig ausgewertet

#### Scenario: Sichere Nx-Cache-Grenze in CI

- **GIVEN** ein nachgewiesen deterministisches Coverage-Target läuft in GitHub Actions
- **WHEN** ein Cache-Eintrag wiederhergestellt oder gespeichert wird
- **THEN** umfasst sein Schlüssel Toolchain, Lockfile, Nx-Konfiguration, Plattform und Vertrauensscope
- **AND** geschützte `main`-, Release- und Deployment-Kontexte stellen niemals einen von Pull Requests erzeugten Cache wieder her
- **AND** ein zweiter kleiner PR-Push spart mindestens 30 Prozent der cachefähigen unveränderten Target-Laufzeit

## ADDED Requirements

### Requirement: PR-Coverage meldet direkt verursachte Verstöße zuerst

Das System SHALL direkt geänderte coverage-relevante Projekte vor dem übrigen affected beziehungsweise vollständigen Coverage-Scope ausführen und auswerten, ohne Paket- oder Globalregeln zu entfernen.

#### Scenario: Direkt geändertes Paket verletzt seinen Floor

- **GIVEN** ein Pull Request ändert ein coverage-relevantes Projekt direkt
- **WHEN** dessen Coverage den Paket-Floor oder die erlaubte Baseline-Abweichung verletzt
- **THEN** wird die Verletzung unmittelbar nach der priorisierten Projektphase gemeldet
- **AND** der Fehler benennt Projekt, Metrik, Ist-/Soll-Wert und Head-SHA
- **AND** der PR-Coverage-Pfad startet keine übrigen Coverage-Targets mehr

#### Scenario: Priorisierte Phase ist grün

- **WHEN** alle direkt geänderten coverage-relevanten Projekte ihre Paketregeln erfüllen
- **THEN** läuft der disjunkte übrige affected beziehungsweise vollständige Scope
- **AND** der finale Aggregator prüft unverändert alle Paketregeln, globale Coverage, Exemptions und erwartete Artefakte

#### Scenario: Scope kann nicht sicher bestimmt werden

- **WHEN** Base-SHA, Projektgraph oder Dateizuordnung ungültig oder mehrdeutig ist
- **THEN** fällt Coverage auf den bestehenden vollständigen Scope zurück
- **AND** die Summary benennt die Fallback-Ursache

### Requirement: Coverage-Shards werden vollständig und fail-closed aggregiert

Das System SHALL Coverage-Phasen und -Shards über versionierte, Head-SHA-gebundene Artefakte zu genau einem erforderlichen Coverage-Status aggregieren.

#### Scenario: Alle erwarteten Shards sind erfolgreich

- **WHEN** jeder im Scope-Plan erwartete Shard ein gültiges disjunktes Ergebnis für denselben Head-SHA liefert
- **THEN** aggregiert das Gate alle Reports deterministisch
- **AND** der erforderliche Status verwendet weiterhin den bestehenden Check-Namen `Coverage`

#### Scenario: Shard-Evidenz ist unvollständig

- **WHEN** ein erwarteter Report fehlt, veraltet, doppelt, überlappend oder nicht auswertbar ist
- **THEN** schlägt der Coverage-Aggregator fail-closed fehl
- **AND** die Summary nennt den betroffenen Shard und die konkrete Vertragsverletzung
