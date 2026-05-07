## ADDED Requirements

### Requirement: Serialisierte Session-Refresh-Ausführung

Das System MUST für eine persistierte App-Session mit gemeinsamer `sessionId` konkurrierende Token-Refreshes deterministisch serialisieren.

#### Scenario: Zwei parallele Requests treffen auf dieselbe abgelaufene Session

- **GIVEN** zwei Requests verwenden dieselbe Redis-persistierte `sessionId`
- **AND** der Access-Token ist abgelaufen, aber der Refresh-Token noch gültig
- **WHEN** beide Requests nahezu gleichzeitig Session-Hydration auslösen
- **THEN** führt genau ein Request den Refresh gegen Keycloak aus
- **AND** konkurrierende Requests warten auf dasselbe Refresh-Ergebnis oder lesen den aktualisierten Session-Zustand wieder
- **AND** der Refresh-Token wird nicht mehrfach gegen den Upstream verbraucht

#### Scenario: Gewinner-Refresh scheitert

- **GIVEN** ein Request hält den Refresh-Slot für eine `sessionId`
- **WHEN** der Upstream-Refresh fehlschlägt
- **THEN** erhalten konkurrierende Requests denselben fehlgeschlagenen Session-Status
- **AND** das System erzeugt keinen zweiten konkurrierenden Refresh-Versuch für denselben Sessionzustand

### Requirement: Minimaler `/auth/me`-Antwortvertrag

Das System SHALL für `/auth/me` und gleichwertige Auth-Read-Endpoints nur eine explizite Allowlist stabiler Benutzer- und Sitzungsfelder ausliefern.

#### Scenario: Interne SessionUser-Felder wachsen

- **WHEN** interne Profil-, Diagnose- oder Session-Felder zum serverseitigen Benutzerobjekt hinzukommen
- **THEN** erscheinen diese Felder nicht automatisch in `/auth/me`
- **AND** nur explizit freigegebene Felder wie Identitäts-, Scope- und UI-relevante Statusinformationen werden serialisiert

#### Scenario: Auth-Read wird für Clients erweitert

- **WHEN** ein neues Feld in `/auth/me` benötigt wird
- **THEN** wird es über die explizite Allowlist oder ein normatives Output-Schema hinzugefügt
- **AND** die Änderung ist für Reviewer als Vertragsänderung sichtbar

### Requirement: Session-Store-Adapter teilen denselben Vertragskern

Das System MUST In-Memory- und Redis-Session-Stores über denselben kanonischen Session-Codec, dieselbe TTL-Semantik und dieselben Konkurrenzregeln betreiben.

#### Scenario: Session wird in verschiedenen Adaptern persistiert

- **WHEN** dieselbe fachliche Session in In-Memory- oder Redis-Adapter gespeichert und wieder gelesen wird
- **THEN** bleiben Tokens, Expiry-Felder, Versionsfelder und Konkurrenz-Metadaten semantisch identisch
- **AND** adapterbedingte Unterschiede verändern nicht das Auth-Ergebnis

#### Scenario: Test- und Produktionsadapter verhalten sich konkurrenzgleich

- **WHEN** Characterization- oder Integrationstests gegen beide Session-Store-Adapter laufen
- **THEN** prüfen sie dieselben Refresh-, TTL- und Invalidation-Szenarien
- **AND** ein nur adapter-spezifisch grüner Pfad gilt nicht als ausreichender Nachweis
