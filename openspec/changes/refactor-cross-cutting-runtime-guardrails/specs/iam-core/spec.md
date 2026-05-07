## ADDED Requirements

### Requirement: Serialisierte Session-Refresh-Ausfuehrung

Das System MUST fuer eine persistierte App-Session mit gemeinsamer `sessionId` konkurrierende Token-Refreshes deterministisch serialisieren.

#### Scenario: Zwei parallele Requests treffen auf dieselbe abgelaufene Session

- **GIVEN** zwei Requests verwenden dieselbe Redis-persistierte `sessionId`
- **AND** der Access-Token ist abgelaufen, aber der Refresh-Token noch gueltig
- **WHEN** beide Requests nahezu gleichzeitig Session-Hydration ausloesen
- **THEN** fuehrt genau ein Request den Refresh gegen Keycloak aus
- **AND** konkurrierende Requests warten auf dasselbe Refresh-Ergebnis oder lesen den aktualisierten Session-Zustand wieder
- **AND** der Refresh-Token wird nicht mehrfach gegen den Upstream verbraucht

#### Scenario: Gewinner-Refresh scheitert

- **GIVEN** ein Request haelt den Refresh-Slot fuer eine `sessionId`
- **WHEN** der Upstream-Refresh fehlschlaegt
- **THEN** erhalten konkurrierende Requests denselben fehlgeschlagenen Session-Status
- **AND** das System erzeugt keinen zweiten konkurrierenden Refresh-Versuch fuer denselben Sessionzustand

### Requirement: Minimaler `/auth/me`-Antwortvertrag

Das System SHALL fuer `/auth/me` und gleichwertige Auth-Read-Endpoints nur eine explizite Allowlist stabiler Benutzer- und Sitzungsfelder ausliefern.

#### Scenario: Interne SessionUser-Felder wachsen

- **WHEN** interne Profil-, Diagnose- oder Session-Felder zum serverseitigen Benutzerobjekt hinzukommen
- **THEN** erscheinen diese Felder nicht automatisch in `/auth/me`
- **AND** nur explizit freigegebene Felder wie Identitaets-, Scope- und UI-relevante Statusinformationen werden serialisiert

#### Scenario: Auth-Read wird fuer Clients erweitert

- **WHEN** ein neues Feld in `/auth/me` benoetigt wird
- **THEN** wird es ueber die explizite Allowlist oder ein normatives Output-Schema hinzugefuegt
- **AND** die Aenderung ist fuer Reviewer als Vertragsaenderung sichtbar

### Requirement: Session-Store-Adapter teilen denselben Vertragskern

Das System MUST In-Memory- und Redis-Session-Stores ueber denselben kanonischen Session-Codec, dieselbe TTL-Semantik und dieselben Konkurrenzregeln betreiben.

#### Scenario: Session wird in verschiedenen Adaptern persistiert

- **WHEN** dieselbe fachliche Session in In-Memory- oder Redis-Adapter gespeichert und wieder gelesen wird
- **THEN** bleiben Tokens, Expiry-Felder, Versionsfelder und Konkurrenz-Metadaten semantisch identisch
- **AND** adapterbedingte Unterschiede veraendern nicht das Auth-Ergebnis

#### Scenario: Test- und Produktionsadapter verhalten sich konkurenzgleich

- **WHEN** Characterization- oder Integrationstests gegen beide Session-Store-Adapter laufen
- **THEN** pruefen sie dieselben Refresh-, TTL- und Invalidation-Szenarien
- **AND** ein nur adapter-spezifisch gruener Pfad gilt nicht als ausreichender Nachweis
