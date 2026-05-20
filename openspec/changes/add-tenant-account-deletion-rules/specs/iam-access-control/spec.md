## ADDED Requirements

### Requirement: Tenantgebundene Permissions für Löschregeln und Account-Lifecycle

Das System SHALL das Lesen und Bearbeiten tenantbezogener Löschregeln sowie das Ausführen des Account-Lifecycles über explizite, vollständig qualifizierte Actions im `iam`-Namespace autorisieren. Dieses Feature ist ausschließlich tenantgebunden und darf nicht über Root- oder Plattform-Scope ohne aktive `instanceId` freigeschaltet werden.

Die normative Action-Menge für V1 umfasst `iam.deletionRules.read`, `iam.deletionRules.manage` und `iam.accountLifecycle.run`.

#### Scenario: Tenant-Admin liest oder bearbeitet Löschregeln der aktiven Instanz

- **WHEN** ein Administrator `/admin/iam?tab=deletion-rules` öffnet oder dort Änderungen speichert
- **THEN** prüft das System `iam.deletionRules.read` für das Laden und `iam.deletionRules.manage` für das Bearbeiten
- **AND** erfolgt die Prüfung immer gegen die aktive `instanceId`
- **AND** werden Cross-Tenant-Zugriffe abgewiesen

#### Scenario: Root- oder Plattformrechte schalten Tenant-Löschregeln nicht implizit frei

- **WHEN** ein Benutzer ohne aktiven Tenant-Scope oder nur mit Plattform-/Root-Rechten eine Aktion für Tenant-Löschregeln ausführt
- **THEN** wird die Aktion abgewiesen
- **AND** behandelt das System Plattformrechte nicht als Fallback für `iam.deletionRules.read` oder `iam.deletionRules.manage`

#### Scenario: Lifecycle-Lauf verlangt explizite tenantgebundene Ausführungsberechtigung

- **WHEN** ein manueller oder geplanter Lauf Tenant-Accounts anhand der Löschregeln verarbeitet
- **THEN** verlangt das System die Action `iam.accountLifecycle.run` im Scope der betroffenen `instanceId`
- **AND** darf dieselbe Berechtigung nicht stillschweigend aus allgemeinen Plattform- oder Root-Rechten abgeleitet werden

### Requirement: Löschregeln werden fachlich und autorisierungsseitig validiert

Das System SHALL Änderungen an tenantbezogenen Löschregeln serverseitig validieren, bevor sie wirksam werden.

#### Scenario: Geordnete Fristen sind verpflichtend

- **WHEN** ein Benutzer tenantbezogene Löschregeln speichert
- **THEN** gilt `deactivateAfterDays < pseudonymizeAfterDays < deleteAfterDays`
- **AND** werden ungültige oder gleichrangige Fristen mit einer stabilen, verständlichen Fehlermeldung abgewiesen

#### Scenario: Inhaltsstrategie bleibt auf V1-Scope begrenzt

- **WHEN** ein Benutzer eine Default-Inhaltsstrategie oder einen per-Account-Override speichert
- **THEN** akzeptiert das System nur Werte für den Scope `iam.contents`
- **AND** werden Strategien für andere Inhaltsdomänen in diesem Change zurückgewiesen
