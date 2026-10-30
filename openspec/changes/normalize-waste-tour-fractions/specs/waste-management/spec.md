## ADDED Requirements

### Requirement: Tour-Fraktions-Zuordnungen sind relational und referenziell sicher

Das System SHALL Tour-Fraktions-Zuordnungen ausschließlich in einer Beziehungstabelle innerhalb der jeweiligen Waste-Tenant-Datenbank speichern und durch UUID-Fremdschlüssel, ein eindeutiges Tour-Fraktions-Paar und eine eindeutige Position pro Tour absichern.

#### Scenario: Eine verwendete Fraktion wird gelöscht

- **WHEN** eine Fraktion noch mindestens einer Tour zugeordnet ist und gelöscht werden soll
- **THEN** verhindert die Datenbank die Löschung
- **AND** der bestehende API-Pfad antwortet mit HTTP 409
- **AND** Fraktion, Touren und Zuordnungen bleiben unverändert

#### Scenario: Eine unbenutzte Fraktion oder eine Tour wird gelöscht

- **WHEN** eine unbenutzte Fraktion gelöscht wird
- **THEN** bleibt ihre Löschung nach den bestehenden übrigen Regeln möglich
- **AND** beim Löschen einer Tour werden deren Zuordnungen mitgelöscht, ohne die Fraktionen oder Zuordnungen anderer Touren zu entfernen

### Requirement: Tour und Fraktionszuordnungen werden atomar und vertragsstabil verarbeitet

Das System SHALL Tour und Zuordnungen in allen Schreibpfaden atomar speichern, konkurrierende Änderungen derselben Tour serialisieren und die bisherigen äußeren Feldverträge sowie die Reihenfolge der Fraktionsliste erhalten.

#### Scenario: Eine Zuordnung ist ungültig oder eine Mutation scheitert

- **WHEN** eine Tourmutation ungültige, doppelte oder unbekannte Fraktions-IDs enthält oder ein Write innerhalb ihrer Transaktion fehlschlägt
- **THEN** wird die gesamte Mutation zurückgewiesen beziehungsweise zurückgerollt
- **AND** es bleiben weder teilweise geänderte Tourdaten noch teilweise ersetzte Zuordnungen zurück
- **AND** die bestehende Mindestanzahlvalidierung regulärer Tourmutationen bleibt erhalten

#### Scenario: Jahresübernahme oder Datenaustausch verarbeitet Touren

- **WHEN** Touren kopiert, in das Folgejahr übernommen oder über bestehende Austauschprofile importiert und exportiert werden
- **THEN** werden Fraktionszuordnungen vollständig und in derselben Reihenfolge verarbeitet
- **AND** bleiben `wasteFractionIds` und bestehende tabellarische Feldnamen sowie portable Referenzsemantik erhalten
- **AND** gelten die bestehenden Atomaritäts- und Idempotenzverträge weiterhin

#### Scenario: Gleichzeitige Zuordnung und Fraktionslöschung

- **WHEN** eine Fraktion gleichzeitig einer Tour zugewiesen und gelöscht werden soll
- **THEN** kann kein Commit eine verwaiste Zuordnung hinterlassen
- **AND** bleibt nach konkurrierenden Touränderungen jeweils ein vollständiger atomarer Zuordnungssatz erhalten

### Requirement: Die Normalisierung migriert Bestände geprüft mit befristeter Altversionskompatibilität

Das System SHALL bestehende Arrays über den vorhandenen versionierten Waste-Tenant-Migrationspfad verlustfrei übernehmen, ungültige Bestände ohne automatische Fachkorrektur zurückweisen und Altverbraucher während Expand transaktional anbinden. Contract SHALL standardmäßig deaktiviert bleiben und erst nach ausdrücklich bestätigtem Wechsel sämtlicher Verbraucher ausgewählt werden.

#### Scenario: Ein gültiger Bestand wird übernommen

- **WHEN** die Expand-Migration unter gesperrten Tabellen in der Transaktion des bestehenden Runners ausgeführt wird
- **THEN** erhält sie UUID-Zuordnung und Reihenfolge jeder Tour einschließlich leerer Bestandsarrays
- **AND** prüft sie Gleichheit, Fremdschlüssel, Eindeutigkeit, Grants und Trigger vor dem Abschluss der Migration
- **AND** erzeugen Neuprovisionierung und Bestandsmigration denselben Endzustand

#### Scenario: Der Bestand oder die Ausführungsbedingungen sind ungültig

- **WHEN** ungültige UUIDs, NULL-/Leereinträge, doppelte Referenzen, fehlende Fraktionen, fehlende Rechte oder ein Lock-Timeout festgestellt werden
- **THEN** bricht die Migration der betroffenen Datenbank ohne teilweise übernommene Fachdaten ab
- **AND** erfolgt weder eine stille Bereinigung noch eine Freigabe inkompatibler Verbraucher

#### Scenario: Ein Prozessabbruch oder ein Teilfehler betrifft mehrere Tenant-Datenbanken

- **WHEN** der Migrationslauf unterbrochen wird oder nur einige Tenant-Datenbanken bereits erfolgreich migriert sind
- **THEN** unterscheidet der vorhandene Runner committed und nicht committed migrierte Datenbanken eindeutig
- **AND** setzt ein Wiederanlauf keine bereits übernommenen Fachzuordnungen zurück
- **AND** bleiben Altverbraucher während Expand kompatibel; nach Contract gilt ein Image-Rollback allein nicht als Recovery

#### Scenario: Expand und Contract werden getrennt ausgeliefert

- **WHEN** nur die reguläre Migration ausgeführt wird
- **THEN** bleiben Arrayspalte und transaktionaler Kompatibilitätstrigger für Altversionen erhalten
- **AND** werden neue Zuordnungen schon jetzt durch Fremdschlüssel abgesichert
- **AND** ist die Beziehungstabelle für Runtime-Rollen nicht direkt beschreibbar
- **AND** entfernt erst die ausdrücklich bestätigte Contract-Stufe den Kompatibilitätstrigger, die Arrayspalte und ihren GIN-Index, während die neue Schreibschnittstelle unverändert nutzbar bleibt

### Requirement: Zuordnungsänderungen bleiben Teil der Mainserver-Quellrevision

Das System SHALL bestätigte Inserts, Updates und Deletes von Tour-Fraktions-Zuordnungen über die bestehende transaktionale Mainserver-Revisionsverfolgung erfassen.

#### Scenario: Eine Zuordnung wird geändert oder zurückgerollt

- **WHEN** eine Zuordnungsänderung committed wird
- **THEN** steigt die bestehende Quellrevision und der bestehende Sync-Pfad kann die Änderung erkennen
- **AND** hinterlässt eine zurückgerollte Änderung weder geänderte Zuordnungen noch eine dafür persistierte Revision
