## ADDED Requirements

### Requirement: HTTP-nahe Frontend-Tests mit MSW

Das System SHALL fuer Frontend-Unit- und Integrations-Tests, die HTTP-Verhalten pruefen, `msw` als Standard-Mocking-Schicht verwenden.

#### Scenario: Frontend-Test prueft API-Verhalten

- **WHEN** ein Frontend-Test Request-, Fehler-, Lade- oder Retry-Verhalten gegen HTTP-Endpunkte prueft
- **THEN** beschreibt der Test das Netzwerkverhalten ueber `msw`
- **AND** mockt nicht primaer interne Fetch-Wrapper oder komponentenlokale Implementierungsdetails
- **AND** bleibt derselbe Mocking-Ansatz zwischen Browser- und Node-Testumgebungen wiederverwendbar

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
