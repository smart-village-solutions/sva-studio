## ADDED Requirements

### Requirement: Tenant-Scope und Rollen-Gates schützen Löschregeln und Lifecycle-Zugriffe

Das System SHALL das Lesen und Bearbeiten tenantbezogener Löschregeln sowie den Self-Service-Zugriff auf Inhaltspräferenzen tenantgebunden schützen. Dieses Feature ist ausschließlich tenantgebunden und darf nicht über Root- oder Plattform-Scope ohne aktive `instanceId` freigeschaltet werden.

#### Scenario: Tenant-Admin liest oder bearbeitet Löschregeln der aktiven Instanz

- **WHEN** ein Administrator `/admin/iam?tab=deletion-rules` öffnet oder dort Änderungen speichert
- **THEN** erfolgt die Prüfung immer gegen die aktive `instanceId`
- **AND** ist der gelieferte V1-Scope auf tenantgebundene Admin-Rollen beschränkt
- **AND** werden Cross-Tenant-Zugriffe abgewiesen

#### Scenario: Root- oder Plattformrechte schalten Tenant-Löschregeln nicht implizit frei

- **WHEN** ein Benutzer ohne aktiven Tenant-Scope oder nur mit Plattform-/Root-Rechten eine Aktion für Tenant-Löschregeln ausführt
- **THEN** wird die Aktion abgewiesen
- **AND** behandelt das System Plattformrechte nicht als Fallback für tenantgebundene Löschregeln

#### Scenario: Self-Service-Override bleibt auf den eigenen Tenant-Account beschränkt

- **WHEN** ein authentifizierter Tenant-Benutzer einen per-Account-Override für die Inhaltsstrategie speichert
- **THEN** darf er nur den Override für seinen eigenen Tenant-Account schreiben
- **AND** bindet der Server den Zielaccount ausschließlich aus Session-/Authentifizierungskontext
- **AND** akzeptiert der Schreibpfad keine fremden Benutzer- oder Account-IDs als Override-Ziel

#### Scenario: Tenant kann Self-Service-Overrides vollständig unterbinden

- **WHEN** ein Tenant `allowContentPreferenceOverride = false` gesetzt hat
- **THEN** weist der Server Self-Service-Schreibversuche für Inhaltspräferenzen ab
- **AND** bleibt die wirksame Inhaltsregel auf den tenantweiten Standard begrenzt

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
- **AND** akzeptiert es als Strategiewerte ausschließlich `beibehalten` und `mit Eigentümer-Lifecycle mitbehandeln`
- **AND** werden Strategien für andere Inhaltsdomänen in diesem Change zurückgewiesen
