## ADDED Requirements

### Requirement: Strukturierte Log-Metadaten werden semantisch redigiert

Das System MUST strukturierte Log-Metadaten vor jeder Ausgabe anhand normalisierter semantischer Schlüssel redigieren. Groß-/Kleinschreibung und übliche Trennzeichen dürfen den Schutz gleichbedeutender Account-, Actor-, Subject-, User-, Session- oder Credential-Felder nicht umgehen. Aufrufer MUST zusätzlich vermeiden, sensible Identitäten in zusammengesetzte Werte oder frei benannte Schlüssel einzubetten. Request-, Trace-, Job- und Execution-IDs MUST im Log-Body bleiben und dürfen nicht als frei skalierende Transport-Labels verwendet werden.

#### Scenario: Sensibler Schlüssel verwendet eine Alias-Schreibweise

- **WHEN** Log-Metadaten denselben sensiblen Identitätsbegriff als `actorId`, `actor_id` oder `actor-id` enthalten
- **THEN** behandelt die Redaction alle Varianten gleich
- **AND** erscheint der ursprüngliche Wert in keiner Log-Ausgabe

#### Scenario: Verbundfeld enthält eine sensible Identität

- **WHEN** ein technischer Kontext aus Scope und Account- oder Subject-ID zusammengesetzt werden könnte
- **THEN** protokolliert der Aufrufer kein identitätshaltiges Verbundfeld
- **AND** übergibt er nur getrennte, ausdrücklich zulässige beziehungsweise zentral redigierte Felder

#### Scenario: Korrelations-ID bleibt aus der Label-Dimension ausgeschlossen

- **WHEN** ein strukturiertes Ereignis eine Request-, Trace-, Job- oder Execution-ID enthält
- **THEN** bleibt die ID ein Feld im Log-Body
- **AND** wird sie nicht als Loki-, OTEL- oder vergleichbares frei skalierendes Transport-Label exportiert

### Requirement: Operative Log-Metadaten verwenden sichere Routen und Fehlerklassen

Das System MUST Requests über stabile Pfade oder Route-Templates ohne Query-String beschreiben. Externe Fehlerantworten MUST als nicht vertrauenswürdige Eingabe behandelt und über stabile interne Fehlercodes, Status- und Retry-Klassen abgebildet werden; freie Provider-Fehlerbeschreibungen, vollständige URLs, Payloads, Header und Tokens dürfen nicht ungefiltert in operative Logs übernommen werden.

#### Scenario: Request-URL enthält sensible Query-Parameter

- **WHEN** ein Server-Request eine URL mit Query-String verarbeitet
- **THEN** enthält das strukturierte Log höchstens den sicheren Pfad oder das Route-Template
- **AND** enthält es weder den Query-String noch dessen Werte

#### Scenario: Provider liefert einen freien Fehlertext

- **WHEN** ein externer Provider einen Status und eine freie Fehlerbeschreibung zurückgibt
- **THEN** protokolliert das System einen stabilen internen Fehlercode und zulässige Klassifikationsfelder
- **AND** übernimmt es den freien Provider-Text nicht ungefiltert

### Requirement: Log-Level bilden operative Bedeutung statt Aufrufhäufigkeit ab

Das System MUST Log-Level anhand des abschließenden operativen Ergebnisses wählen. Unerwartete interne Fehler und 5xx-Ergebnisse MUST als `error` erscheinen; erwartbare Ablehnungen dürfen höchstens als `warn` erscheinen; fachlich relevante Zustandsänderungen dürfen als `info` erscheinen; routinemäßige erfolgreiche Reads, Cache-Treffer, Pagination-, Konfigurations- und Health-Ereignisse MUST als `debug` erscheinen oder ohne Einzelereignis bleiben. Der Server-Logger MUST den effektiven Schwellwert zentral bestimmen, damit `debug` in einem expliziten Development-Diagnosemodus tatsächlich ausgegeben und beim normalen `info`-Schwellwert unterdrückt wird. Die Redaction MUST für alle Schwellwerte identisch bleiben.

#### Scenario: Routinemäßiger Read ist erfolgreich

- **WHEN** ein Cache-Zugriff, GraphQL-Read, Konfigurations-Read oder Pagination-Schritt ohne Abweichung erfolgreich ist
- **THEN** erzeugt der Pfad kein `info`-Ereignis pro Zugriff

#### Scenario: Interner Fehler endet als 5xx

- **WHEN** eine Operation wegen eines unerwarteten internen Fehlers mit einem 5xx-Ergebnis endet
- **THEN** emittiert die verantwortliche Grenze ein strukturiertes `error`-Ereignis

#### Scenario: Mutation ändert fachlichen Zustand

- **WHEN** eine autorisierte Mutation oder ein Jobabschluss erfolgreich fachlichen Zustand ändert
- **THEN** darf die verantwortliche Grenze genau ein strukturiertes `info`-Ereignis emittieren

#### Scenario: Development-Diagnose aktiviert Debug-Ereignisse explizit

- **WHEN** ein Entwickler den zentralen Server-Log-Schwellwert explizit auf `debug` setzt
- **THEN** werden strukturierte `debug`-Ereignisse über den aktiven Development-Transport ausgegeben
- **AND** gelten dieselben Redaction- und Safe-Field-Regeln wie für höhere Level

#### Scenario: Normaler Betrieb unterdrückt Debug-Ereignisse

- **WHEN** der effektive Server-Log-Schwellwert `info` ist
- **THEN** werden `debug`-Ereignisse nicht ausgegeben
- **AND** bleiben `info`-, `warn`- und `error`-Ereignisse entsprechend ihrer operativen Bedeutung erhalten
