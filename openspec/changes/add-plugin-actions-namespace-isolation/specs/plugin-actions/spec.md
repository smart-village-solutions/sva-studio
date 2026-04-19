## ADDED Requirements

### Requirement: Namespaced Plugin-Action-IDs
Das System MUST Plugin-Aktionen ausschließlich mit vollständig qualifizierten Action-IDs im Format `<namespace>.<actionName>` akzeptieren.

#### Scenario: Plugin registriert gültige Action-ID
- **WHEN** ein Plugin mit Namespace `content` die Action `content.publish` registriert
- **THEN** wird die Registrierung angenommen
- **AND** die Action-ID ist eindeutig in der globalen Registry auflösbar

#### Scenario: Plugin registriert Action ohne Namespace
- **WHEN** ein Plugin die Action `publish` ohne Namespace registriert
- **THEN** wird die Registrierung mit einem Validierungsfehler abgewiesen

### Requirement: Namespace-Isolation bei Action-Ownership
Das System MUST sicherstellen, dass Plugins nur Aktionen im eigenen Namespace registrieren und ohne expliziten Core-Bridge-Contract keine fremden Namespaces ausführen.

#### Scenario: Plugin nutzt fremden Namespace
- **WHEN** ein Plugin mit Namespace `news` versucht `events.publish` zu registrieren
- **THEN** wird die Registrierung abgewiesen
- **AND** ein strukturierter Fehler mit `expectedNamespace` und `receivedNamespace` wird erzeugt

#### Scenario: Cross-Namespace-Ausführung ohne Freigabe
- **WHEN** ein Plugin eine Action aus einem fremden Namespace ausführt
- **THEN** verweigert das System die Ausführung
- **AND** es wird ein Audit-Event mit Ergebnis `denied` geschrieben

### Requirement: Fail-Fast bei Action-Kollisionen
Das System MUST Action-Kollisionen während der Registry-Initialisierung deterministisch erkennen und den Startvorgang fail-fast abbrechen.

#### Scenario: Doppelte Action-ID
- **WHEN** zwei Plugins dieselbe Action-ID `events.publish` registrieren
- **THEN** bricht die Registry-Initialisierung mit einer eindeutigen Kollisionsermeldung ab
- **AND** es wird keine teilweise inkonsistente Registry veröffentlicht

### Requirement: Namespace-sichere IAM-Prüfung
Das System MUST Autorisierungsentscheidungen gegen vollständig qualifizierte Action-IDs inklusive Namespace treffen.

#### Scenario: Berechtigung nur für eigenes Namespace
- **GIVEN** ein Benutzer hat eine Berechtigung für `events.publish`
- **WHEN** derselbe Benutzer `news.publish` ausführt
- **THEN** wird die Aktion als `forbidden` abgewiesen

### Requirement: Auditierbare Plugin-Actions
Das System MUST für Registrierung und Ausführung von Plugin-Aktionen Audit-Ereignisse mit Namespace-Kontext erzeugen.

#### Scenario: Erfolgreiche Action-Ausführung
- **WHEN** eine Plugin-Action erfolgreich ausgeführt wird
- **THEN** enthält das Audit-Event mindestens `actionId`, `actionNamespace`, `actionOwner`, `result`, `requestId`, `traceId`
