## ADDED Requirements
### Requirement: The system SHALL update Mainserver-backed content list projections incrementally after successful single-record mutations
Das System SHALL die fuehrende serverseitige Listenquelle fuer Mainserver-gestuetzte Inhaltstypen nach erfolgreichen Studio-initiierten Einzelmutationen gezielt fuer den betroffenen Datensatz aktualisieren und keinen typweiten Vollrefresh als Standardpfad verwenden.

#### Scenario: Create aktualisiert nur den neuen Datensatz in der Inhaltsliste
- **WENN** ein berechtigter Benutzer einen neuen News-, Event- oder POI-Datensatz erfolgreich ueber Studio im Mainserver anlegt
- **DANN** aktualisiert das System die fuehrende Listenquelle gezielt fuer genau diesen Datensatz
- **UND** der restliche Projektionsbestand desselben Inhaltstyps bleibt unveraendert
- **UND** der neue Datensatz erscheint ohne erzwungenen Vollrefresh des gesamten Inhaltstyps in der Inhaltsliste

#### Scenario: Update aktualisiert nur den geaenderten Datensatz in der Inhaltsliste
- **WENN** ein berechtigter Benutzer einen bestehenden News-, Event- oder POI-Datensatz erfolgreich ueber Studio aendert
- **DANN** aktualisiert das System die fuehrende Listenquelle gezielt fuer genau diesen Datensatz
- **UND** die Listenansicht zeigt die geaenderten Metadaten, ohne alle Datensaetze dieses Typs neu aufzubauen

#### Scenario: Delete entfernt nur den betroffenen Datensatz aus der Inhaltsliste
- **WENN** ein berechtigter Benutzer einen bestehenden News-, Event- oder POI-Datensatz erfolgreich ueber Studio loescht
- **DANN** entfernt das System gezielt genau diesen Datensatz aus der fuehrenden Listenquelle
- **UND** der Loeschvorgang startet keinen typweiten Neuaufbau aller Datensaetze desselben Inhaltstyps

### Requirement: The system SHALL retain periodic full refresh only as reconciliation path for Mainserver-backed content lists
Das System SHALL den periodischen Vollabgleich fuer Mainserver-gestuetzte Inhaltstypen als Reconciliation-Pfad fuer externe Aenderungen, Drift und Fehlerfaelle behalten, aber nicht als Standardreaktion auf jede erfolgreiche Einzelmutation verwenden.

#### Scenario: Externe Mainserver-Aenderung wird weiter ueber Reconciliation sichtbar
- **WENN** ein News-, Event- oder POI-Datensatz ausserhalb von Studio direkt im Mainserver geaendert, angelegt oder geloescht wird
- **DANN** darf das System diese Aenderung weiterhin ueber den periodischen Vollabgleich in die fuehrende Listenquelle uebernehmen
- **UND** der gezielte Mutationspfad muss dafuer nicht alle externen Aenderungen selbst abdecken

#### Scenario: Gezielte Nachsynchronisation scheitert nach erfolgreicher Mutation
- **WENN** eine Studio-Mutation im Mainserver erfolgreich war, aber die gezielte Projektionsaktualisierung den Datensatz nicht deterministisch nachladen oder entfernen kann
- **DANN** bleibt die Mutation fachlich erfolgreich
- **UND** das System protokolliert den Fehler deterministisch
- **UND** der periodische Vollabgleich bleibt fuer die spaetere Reconciliation zustaendig
