## ADDED Requirements

### Requirement: Instanz-Registry-Mutationswerte behalten ihren Positions- und Secret-Vertrag

Das System SHALL Create- und Update-Mutationen der Instanz-Registry in der bestehenden SQL-Parameterreihenfolge abbilden und dabei Secret-Erhalt, explizites Löschen und Ersetzen unterscheidbar halten. Eine interne Strukturierung der Wertelisten darf weder SQL-Text noch Schema, öffentlichen Repository-Vertrag, Hostname-Reihenfolge oder Fehleridentität verändern.

#### Scenario: Create bildet alle Werte positionsstabil ab

- **WHEN** eine Instanz mit minimalen, vollständigen oder partiell fehlenden optionalen Tenant-Admin-Daten angelegt wird
- **THEN** erzeugt das Repository exakt die bestehenden 20 SQL-Werte in unveränderter Position und mit unverändertem Typ
- **AND** führt es den primären Hostname-Upsert nur nach einer erfolgreich zurückgegebenen Instanzzeile aus

#### Scenario: Update erhält, löscht oder ersetzt Secrets unverändert

- **WHEN** ein Update für Auth-Client- oder Tenant-Admin-Client-Secret eine Kombination aus Keep-Flag `undefined`, `true` oder `false` und Runtime-Ciphertext `undefined`, `null` oder Wert erhält
- **THEN** erzeugt das Repository exakt die bestehenden 21 SQL-Werte in unveränderter Position und mit unverändertem Typ
- **AND** behält es die bisherige Bedeutung für Secret-Erhalt, Löschen und Ersetzen bei

#### Scenario: Fehlende Mutationsergebnisse und Fehler bleiben identisch

- **WHEN** Insert oder Update keine Zeile zurückgibt oder Insert, Update beziehungsweise Hostname-Upsert fehlschlägt
- **THEN** bleibt der Hostname-Upsert bei fehlender Zeile aus
- **AND** bleibt die ursprüngliche Fehlerobjekt-Identität samt bestehender Schrittannotation unverändert erhalten
