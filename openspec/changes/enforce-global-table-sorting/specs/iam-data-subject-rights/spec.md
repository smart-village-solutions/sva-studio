## ADDED Requirements

### Requirement: DSR-Falllisten werden vor der Pagination global sortiert

Das System MUST paginierte DSR-Falllisten innerhalb des autorisierten Instanzumfangs zuerst filtern, danach deterministisch sortieren und erst anschließend paginieren. Die Liste MUST standardmäßig `createdAt desc` und die Seitengröße 25 verwenden, `createdAt` und `completedAt` unterstützen und eine bedienbare Pagination mit Gesamtzahl sowie den Seitengrößen 25, 50 und 100 bereitstellen.

#### Scenario: Administrator sortiert DSR-Fälle über mehrere Seiten

- **GIVEN** die aktuellen DSR-Filter ergeben mehr Treffer als auf eine Seite passen
- **WHEN** ein berechtigter Administrator nach einem unterstützten Zeitfeld sortiert
- **THEN** sortiert das Read-Model die vollständige gefilterte Treffermenge
- **AND** schneidet es erst danach die angeforderte Seite zu
- **AND** stabilisiert es gleiche Sortierwerte mit der eindeutigen Fallidentität aufsteigend

#### Scenario: Fehlendes Abschlussdatum bleibt fehlend

- **GIVEN** ein DSR-Fall besitzt kein `completedAt`
- **WHEN** die Liste nach `completedAt` sortiert oder die Spalte anzeigt
- **THEN** verwendet das System `createdAt` nicht als Ersatz
- **AND** zeigt die Zelle „Nicht verfügbar“ lokalisiert an
- **AND** steht der Fall unabhängig von der Richtung hinter Fällen mit vorhandenem `completedAt`

#### Scenario: Administrator navigiert durch DSR-Seiten

- **GIVEN** die aktuellen Filter ergeben mehr Treffer als die gewählte Seitengröße
- **WHEN** der Administrator Seite oder Seitengröße 25, 50 oder 100 ändert
- **THEN** lädt die UI die entsprechende serverseitige Seite und zeigt die Gesamtzahl an
- **AND** setzt ein Filter-, Sortier- oder Seitengrößenwechsel die Seite auf eins zurück

#### Scenario: Ungültige DSR-Sortierung wird abgewiesen

- **GIVEN** ein direkter DSR-Request enthält ein unbekanntes Sortierfeld oder eine unbekannte Richtung
- **WHEN** der Handler den Request validiert
- **THEN** antwortet er mit `400 invalid_request`
