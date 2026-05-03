## ADDED Requirements

### Requirement: Instanzbezogenes Routing sperrt nicht zugewiesene Module fail-closed

Das System SHALL modulbezogene Host-Routen und fachliche Einstiege pro Instanz gegen den expliziten zugewiesenen Modulsatz pruefen. Der zugewiesene Modulsatz wird pro Request aus dem instanzbezogenen Modulvertrag geladen; gecachte Werte werden nach jeder Zuweisungsmutation invalidiert.

#### Scenario: Nicht zugewiesenes Modul wird ueber URL aufgerufen

- **GIVEN** ein Modul ist global registriert, aber der Instanz nicht zugewiesen
- **WHEN** ein Benutzer eine modulbezogene Route dieses Moduls fuer diese Instanz aufruft
- **THEN** verweigert der Host den Zugriff fail-closed
- **AND** rendert keine fachliche Modulansicht fuer diese Instanz
- **AND** behandelt die Runtime das Modul nicht als implizit verfuegbar

#### Scenario: Server-seitiger API-Zugriff auf nicht zugewiesenes Modul wird durch IAM-Layer blockiert

- **GIVEN** ein Modul ist einer Instanz nicht zugewiesen
- **WHEN** eine Server-Funktion oder API-Route des Moduls direkt aufgerufen wird (Umgehung des Routing-Guards)
- **THEN** verweigert der IAM-Authorizer den Zugriff fail-closed, unabhaengig vom Routing-Layer
- **AND** kein fachlicher Datenzugriff findet statt
