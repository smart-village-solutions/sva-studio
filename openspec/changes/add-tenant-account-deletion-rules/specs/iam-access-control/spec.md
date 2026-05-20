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
- **AND** erweitert diese Berechtigung den V1-Scope nicht auf Accounts mit `last_login_at = null`
- **AND** ist ein manueller Lauf in V1 tenantweit für die aktive `instanceId` über alle qualifizierten Accounts definiert
- **AND** gehören per-Account- oder Teilmengenläufe nicht zu diesem Change

#### Scenario: Geplanter Lifecycle-Lauf nutzt dedizierte tenantgebundene Service-Identität

- **WHEN** ein geplanter Lifecycle-Lauf für eine bestimmte `instanceId` ausgeführt wird
- **THEN** erfolgt die Ausführung unter einer dedizierten technischen Service-Identität, die explizit `iam.accountLifecycle.run` für genau diese `instanceId` besitzt
- **AND** reichen Plattform- oder Root-Rechte ohne diese tenantgebundene Zuweisung nicht aus
- **AND** werden Cross-Tenant-Ausführungen ohne passende Berechtigung abgewiesen

### Requirement: Löschregeln werden fachlich und autorisierungsseitig validiert

Das System SHALL Änderungen an tenantbezogenen Löschregeln serverseitig validieren, bevor sie wirksam werden.

#### Scenario: Geordnete Fristen sind verpflichtend

- **WHEN** ein Benutzer tenantbezogene Löschregeln speichert
- **THEN** gilt `deactivateAfterDays < pseudonymizeAfterDays < deleteAfterDays`
- **AND** müssen alle drei Werte positive ganzzahlige Tageswerte sein
- **AND** werden null, negative oder nicht-ganzzahlige Werte ebenso wie ungültige oder gleichrangige Fristen mit einer stabilen, verständlichen Fehlermeldung abgewiesen

#### Scenario: Inhaltsstrategie bleibt auf V1-Scope begrenzt

- **WHEN** ein Benutzer eine Default-Inhaltsstrategie oder einen per-Account-Override speichert
- **THEN** akzeptiert das System nur Werte für den Scope `iam.contents`
- **AND** akzeptiert es als Strategiewerte ausschließlich `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln` und `bei Löschung mitbehandeln`
- **AND** werden Strategien für andere Inhaltsdomänen in diesem Change zurückgewiesen

#### Scenario: Self-Service-Override bleibt auf den eigenen Tenant-Account beschränkt

- **WHEN** ein authentifizierter Tenant-Benutzer einen per-Account-Override für die Inhaltsstrategie speichert
- **THEN** darf er nur den Override für seinen eigenen Tenant-Account schreiben
- **AND** bindet der Server den Zielaccount ausschließlich aus Session-/Authentifizierungskontext
- **AND** akzeptiert der Schreibpfad keine fremden Benutzer- oder Account-IDs als Override-Ziel

#### Scenario: Kein separater Cross-User-Override-Schreibpfad für Admins

- **WHEN** ein Administrator versucht, über diesen Change die Override-Präferenz eines anderen Benutzerkontos zu schreiben
- **THEN** stellt das System dafür keinen separaten Admin-Schreibpfad bereit
- **AND** entstehen aus `iam.deletionRules.read`, `iam.deletionRules.manage` oder `iam.accountLifecycle.run` keine impliziten Cross-User-Override-Schreibrechte
