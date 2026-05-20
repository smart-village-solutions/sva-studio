## ADDED Requirements

### Requirement: Tenant-Löschregeln im IAM-Admin-Cockpit

Das System MUST unter `/admin/iam?tab=deletion-rules` einen tenantgebundenen Admin-Tab für Löschregeln bereitstellen. Der Tab zeigt und bearbeitet ausschließlich die Regeln der aktiven `instanceId` und ist nicht für Root- oder Plattform-Administration ohne Tenant-Scope vorgesehen.

#### Scenario: Tenant-Admin bearbeitet Löschregeln der aktiven Instanz

- **WENN** ein berechtigter Tenant-Admin `/admin/iam?tab=deletion-rules` öffnet
- **DANN** zeigt die UI die aktuellen Werte für `deactivateAfterDays`, `pseudonymizeAfterDays`, `deleteAfterDays` und die tenantweite Default-Inhaltsstrategie
- **UND** zeigt die UI die Baseline-Defaults/Fallbacks `90 / 180 / 365` getrennt von tenant-spezifischen Werten an
- **UND** können die Werte in einer validierten Bearbeitungsmaske geändert werden
- **UND** ist die auswählbare Strategiemenge auf `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln` und `bei Löschung mitbehandeln` begrenzt
- **UND** wird klar angezeigt, dass sich die Regeln nur auf Tenant-Accounts der aktiven `instanceId` beziehen

#### Scenario: UI erklärt die fachlichen Lebenszykluszustände

- **WENN** der Tab `deletion-rules` dargestellt wird
- **DANN** beschreibt die UI die Zustände `active`, `deactivated`, `pseudonymized` und `deleted`
- **UND** erläutert, dass `deleted` einen finalen Tombstone-Soft-Delete und keine physische Löschung bedeutet
- **UND** erläutert, dass `deactivated` nicht automatisch durch Login aufgehoben wird und eine separate Reaktivierung verlangt
- **UND** macht kenntlich, dass ohne Reaktivierung spätere automatische Lifecycle-Stufen weiterlaufen können
- **UND** weist darauf hin, dass V1 Inaktivität ausschließlich aus `last_login_at` ableitet

#### Scenario: Root- oder plattformweite Administration erhält keinen Tenant-Regeltab

- **WENN** ein Benutzer ohne aktiven Tenant-Scope oder nur mit Root-/Plattformrechten `/admin/iam?tab=deletion-rules` aufruft
- **DANN** zeigt die UI keinen bearbeitbaren Tenant-Regelzustand
- **UND** erhält der Benutzer einen verweigerten oder nicht verfügbaren Zustand ohne Leckage tenantbezogener Konfigurationsdaten

### Requirement: Self-Service zeigt Löschregeln und Inhaltspräferenz transparent an

Das System MUST in den Account-/Privacy-Oberflächen die tenantweiten Löschregeln transparent darstellen und dem Benutzer einen per-Account-Override für die Behandlung eigener Inhalte im Scope `iam.contents` anbieten.

#### Scenario: Benutzer sieht tenantweite Fristen und eigene Inhaltspräferenz

- **WENN** ein authentifizierter Benutzer `/account/privacy` oder die zugehörige Datenschutzfläche seines Accounts öffnet
- **DANN** sieht er die tenantweiten Fristen für Deaktivierung, Pseudonymisierung und finalen Tombstone-Soft-Delete
- **UND** sieht er bei nicht konfigurierten Tenants die Baseline-Defaults/Fallbacks `90 / 180 / 365` als wirksame Standardwerte
- **UND** wird erklärt, dass die Fristen sich auf Inaktivität relativ zu `last_login_at` beziehen
- **UND** sieht der Benutzer seine aktuell wirksame Inhaltspräferenz für eigene Inhalte im Scope `iam.contents`
- **UND** werden die zulässigen Strategiewerte `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln` und `bei Löschung mitbehandeln` verständlich benannt

#### Scenario: Benutzer überschreibt die tenantweite Default-Inhaltsstrategie für eigene Inhalte

- **WENN** ein Benutzer seine Inhaltspräferenz in der Privacy-Oberfläche ändert
- **DANN** kann er die tenantweite Default-Inhaltsstrategie für seine eigenen Inhalte gezielt überschreiben
- **UND** ist der Override auf den Scope `iam.contents` begrenzt
- **UND** zeigt die UI nach dem Speichern den wirksamen Zustand verständlich und ohne Rohdateninterpretation an

#### Scenario: Self-Service bleibt auch ohne verfügbare Override-Daten verständlich

- **WENN** für einen Benutzer noch kein individueller Override gespeichert ist
- **DANN** zeigt die UI die tenantweite Default-Inhaltsstrategie als wirksamen Zustand
- **UND** erklärt, dass nur eigene Inhalte im Scope `iam.contents` betroffen sind
- **UND** bleibt die Oberfläche tastaturbedienbar, screenreader-tauglich und mit klaren Leer-, Lade- und Fehlerzuständen ausgestattet
