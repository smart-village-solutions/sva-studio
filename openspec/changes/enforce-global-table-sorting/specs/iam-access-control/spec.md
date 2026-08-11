## ADDED Requirements

### Requirement: Governance-Falllisten werden vor der Pagination global sortiert

Das System MUST paginierte Governance-Falllisten innerhalb des autorisierten Instanzumfangs zuerst filtern, danach deterministisch sortieren und erst anschließend paginieren. Die Liste MUST standardmäßig `createdAt desc` und die Seitengröße 25 verwenden, `createdAt` und `updatedAt` unterstützen und eine bedienbare Pagination mit Gesamtzahl sowie den Seitengrößen 25, 50 und 100 bereitstellen.

#### Scenario: Administrator sortiert Governance-Fälle über mehrere Seiten

- **GIVEN** die aktuellen Governance-Filter ergeben mehr Treffer als auf eine Seite passen
- **WHEN** ein berechtigter Administrator nach einem unterstützten Zeitfeld sortiert
- **THEN** sortiert das Read-Model die vollständige gefilterte Treffermenge
- **AND** schneidet es erst danach die angeforderte Seite zu
- **AND** stabilisiert es gleiche Sortierwerte mit der eindeutigen Fallidentität aufsteigend

#### Scenario: Fehlendes Aktualisierungsdatum bleibt fehlend

- **GIVEN** ein Governance-Fall besitzt kein `updatedAt`
- **WHEN** die Liste nach `updatedAt` sortiert oder die Spalte anzeigt
- **THEN** verwendet das System `resolvedAt` nicht als Ersatz
- **AND** zeigt die Zelle „Nicht verfügbar“ lokalisiert an
- **AND** steht der Fall unabhängig von der Richtung hinter Fällen mit vorhandenem `updatedAt`

#### Scenario: Administrator navigiert durch Governance-Seiten

- **GIVEN** die aktuellen Filter ergeben mehr Treffer als die gewählte Seitengröße
- **WHEN** der Administrator Seite oder Seitengröße 25, 50 oder 100 ändert
- **THEN** lädt die UI die entsprechende serverseitige Seite und zeigt die Gesamtzahl an
- **AND** setzt ein Filter-, Sortier- oder Seitengrößenwechsel die Seite auf eins zurück

#### Scenario: Ungültige Governance-Sortierung wird abgewiesen

- **GIVEN** ein direkter Governance-Request enthält ein unbekanntes Sortierfeld oder eine unbekannte Richtung
- **WHEN** der Handler den Request validiert
- **THEN** antwortet er mit `400 invalid_request`
