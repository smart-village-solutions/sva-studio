# plugin-actions Specification

## Purpose
TBD - created by archiving change add-plugin-actions-namespace-isolation. Update Purpose after archive.
## Requirements
### Requirement: Namespaced Plugin-Action-IDs
Das System MUST Plugin-Aktionen ausschließlich mit vollständig qualifizierten Action-IDs im Format `<namespace>.<actionName>` akzeptieren.

#### Scenario: Plugin registriert gültige Action-ID
- **WHEN** ein Plugin mit Namespace `news` die Action `news.publish` registriert
- **THEN** wird die Registrierung angenommen
- **AND** die Action-ID ist eindeutig in der globalen Registry auflösbar

#### Scenario: Plugin registriert Action ohne Namespace
- **WHEN** ein Plugin die Action `publish` ohne Namespace registriert
- **THEN** wird die Registrierung mit einem Validierungsfehler abgewiesen

### Requirement: Gemeinsames Namensmodell für Core und Plugins
Das System MUST für autorisierbare Actions ein gemeinsames Namensmodell verwenden, bei dem sowohl Core- als auch Plugin-Actions vollständig qualifiziert sind und sich nur durch reservierte bzw. plugin-eigene Namespaces unterscheiden.

#### Scenario: Core-Namespace ist reserviert
- **WHEN** eine Core-Action wie `content.read` oder `iam.users.manage` definiert wird
- **THEN** verwendet sie ebenfalls das Format `<namespace>.<action>`
- **AND** ihr Namespace gilt als reservierter Core-Namespace

#### Scenario: Plugin-Namespace bleibt plugin-eigen
- **WHEN** ein Plugin mit Namespace `news` eine Action wie `news.create` definiert
- **THEN** verwendet sie ebenfalls das Format `<namespace>.<actionName>`
- **AND** ihr Namespace gilt als plugin-eigener Namespace und nicht als Core-Namespace

### Requirement: Namespace-Isolation bei Action-Ownership
Das System MUST sicherstellen, dass Plugins nur Aktionen im eigenen Namespace registrieren und ohne expliziten Core-Bridge-Contract keine fremden Namespaces ausführen.

#### Scenario: Plugin nutzt fremden Namespace
- **WHEN** ein Plugin mit Namespace `news` versucht `events.publish` zu registrieren
- **THEN** wird die Registrierung abgewiesen
- **AND** der Validierungsfehler enthält den deterministischen Fehlercode `plugin_action_namespace_mismatch:<expectedNamespace>:<receivedNamespace>:<actionId>`

#### Scenario: Cross-Namespace-Ausführung ohne Freigabe
- **WHEN** ein Plugin eine Action aus einem fremden Namespace ausführt
- **THEN** verweigert das System die Ausführung
- **AND** es wird ein Audit-Event mit Ergebnis `denied` geschrieben

#### Scenario: Plugin darf keinen reservierten Core-Namespace registrieren
- **WHEN** ein Plugin versucht eine Action in einem reservierten Core-Namespace wie `content.publish` oder `iam.users.manage` zu registrieren
- **THEN** wird die Registrierung abgewiesen
- **AND** der Namespace bleibt ausschließlich dem Core oder einem expliziten Bridge-Contract vorbehalten

### Requirement: Fail-Fast bei Action-Kollisionen
Das System MUST Action-Kollisionen während der Registry-Initialisierung deterministisch erkennen und den Startvorgang fail-fast abbrechen.

#### Scenario: Doppelte Action-ID
- **WHEN** zwei Plugins dieselbe Action-ID `events.publish` registrieren
- **THEN** bricht die Registry-Initialisierung mit einer eindeutigen Kollisionsermeldung ab
- **AND** es wird keine teilweise inkonsistente Registry veröffentlicht

### Requirement: Legacy-Aliase bleiben explizit und deprecationsfähig
Das System MUST Legacy-Kurzformen für Plugin-Actions nur als explizit deklarierte Alias-Einträge unterstützen, auf die kanonische fully-qualified Action-ID auflösen und bei Nutzung als veraltet markieren.

#### Scenario: Expliziter Legacy-Alias wird auf kanonische Action-ID aufgelöst
- **WHEN** ein Plugin für `news.create` zusätzlich den Legacy-Alias `create` deklariert
- **THEN** kann die Registry `create` auf die kanonische Action-ID `news.create` auflösen
- **AND** der Registry-Eintrag markiert `create` als deprecated Alias und `news.create` als kanonische Action-ID

#### Scenario: Legacy-Alias bleibt unqualifizierte Kurzform
- **WHEN** ein Plugin einen Alias mit Namespace wie `events.publish` oder `content.read` deklarieren will
- **THEN** wird die Registrierung mit einem Alias-Validierungsfehler abgewiesen
- **AND** nur unqualifizierte Legacy-Kurzformen ohne Punkt sind zulässig

#### Scenario: Impliziter Legacy-Alias ohne Deklaration ist unzulässig
- **WHEN** eine unqualifizierte Kurzform wie `create` nicht explizit als Alias registriert wurde
- **THEN** darf das System daraus keine implizite Zuordnung zu einer Plugin-Action ableiten

#### Scenario: Legacy-Alias kollidiert mit bestehender Action-ID oder anderem Alias
- **WHEN** ein deklarierter Legacy-Alias bereits als kanonische Action-ID oder Alias eines anderen Eintrags existiert
- **THEN** wird die Registry-Initialisierung deterministisch mit einem Kollisionsfehler abgebrochen

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

