## ADDED Requirements

### Requirement: HTTP-nahe Frontend-Tests mit MSW

Das System SHALL fuer Frontend-Unit- und Integrations-Tests, die HTTP-Verhalten pruefen, `msw` als verbindliche Default-Mocking-Schicht verwenden.

#### Scenario: Frontend-Test prueft API-Verhalten

- **WHEN** ein neuer oder grundlegend ueberarbeiteter Frontend-Test Request-, Fehler-, Lade- oder Retry-Verhalten gegen HTTP-Endpunkte prueft
- **THEN** beschreibt der Test das Netzwerkverhalten ueber `msw`
- **AND** mockt nicht primaer interne Fetch-Wrapper oder komponentenlokale Implementierungsdetails
- **AND** bleibt derselbe Mocking-Ansatz zwischen Browser- und Node-Testumgebungen wiederverwendbar

#### Scenario: Bestehender Test nutzt noch direkten Fetch-Stub

- **WHEN** ein bestehender HTTP-naher Frontend-Test noch direkte `fetch`- oder Wrapper-Stubs nutzt
- **THEN** wird er spaetestens bei grundlegendem Umbau oder in einem definierten Pilotblock auf `msw` migriert
- **AND** muss nicht allein aus kosmetischen Gruenden sofort umgestellt werden

#### Scenario: Rein lokale Logik bleibt bei Modul-Mocks

- **WHEN** ein Test ausschliesslich lokale Fachlogik ohne HTTP-Verhalten prueft
- **THEN** sind Modul-Mocks oder andere passende Testdoubles weiterhin zulaessig
- **AND** wird `msw` nicht fuer Faelle erzwungen, in denen kein beobachtbarer Netzpfad existiert

#### Scenario: MSW ersetzt keinen echten E2E- oder Infra-Lauf

- **WHEN** die Teststrategie fuer einen Flow bewertet wird
- **THEN** gilt `msw` als Ersatz fuer HTTP-nahe Unit- oder Integrations-Mocks
- **AND** ersetzt nicht die bestehenden Live-E2E- oder Infra-Readiness-Anforderungen
- **AND** bleibt die Abgrenzung zu echten Service-Stacks dokumentiert

### Requirement: Property-based Tests fuer kritische Kernlogik

Das System SHALL fuer kritische, framework-agnostische Kernlogik gezielt Property-based Tests mit `fast-check` einsetzen.

#### Scenario: Kritischer Guard oder Normalisierer wird geaendert

- **WHEN** Guard-, Parser-, Routing-, Normalisierungs- oder aehnliche Kernlogik in kritischen Hotspots geaendert oder neu eingefuehrt wird
- **THEN** prueft die Teststrategie, ob Invarianten oder Randfallraeume mit `fast-check` abgesichert werden muessen
- **AND** werden beispielbasierte Tests bei hohem Kombinationsraum durch mindestens eine passende Property ergaenzt

#### Scenario: Reiner UI-Baustein ohne hohe Eingabevielfalt

- **WHEN** ein Testgegenstand hauptsaechlich aus praesentationsnaher UI ohne kritische Eingabeinvarianten besteht
- **THEN** ist `fast-check` nicht verpflichtend
- **AND** bleibt der gezielte Einsatz auf risikoreiche Kernlogik fokussiert

### Requirement: Governance- und Review-Kriterien fuer Foundations

Das System SHALL fuer Formular-, HTTP-Test- und Property-based-Testing-Foundations explizite Governance- und Review-Kriterien als Exit-Bedingung dokumentieren.

#### Scenario: Reviewer bewertet einen Referenzbereich

- **WHEN** ein Reviewer einen neuen oder grundlegend ueberarbeiteten Formular- oder HTTP-Test-Flow prueft
- **THEN** kann er schnell erkennen, ob der Default-Standard eingehalten wurde
- **AND** sind Ausnahmegrund, Migrationsstatus und relevante Pflichtartefakte nachvollziehbar dokumentiert

#### Scenario: Change erreicht den Exit-Status

- **WHEN** der Change als exit-bereit bewertet wird
- **THEN** sind Referenzimplementierungen, Ausnahmen, die vollstaendige Formularinventur und die Entscheidungskriterien fuer `fast-check` reviewbar dokumentiert
- **AND** darf fehlende Governance-Dokumentation den Exit blockieren
