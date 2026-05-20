## ADDED Requirements

### Requirement: Tenantbezogener Inaktivitäts-Lebenszyklus ergänzt das Recht auf Löschung

Das System SHALL für Tenant-Accounts einen regelbasierten Inaktivitäts-Lebenszyklus bereitstellen, der die Stufen `active`, `deactivated`, `pseudonymized` und `deleted` verwendet. Der Lebenszyklus gilt nur im Tenant-Scope, leitet Inaktivität in V1 ausschließlich aus `last_login_at` des Tenant-Account-Records beziehungsweise des aktiven Tenant-Mitgliedschaftskontexts der betroffenen `instanceId` ab und endet in einem finalen Tombstone-Soft-Delete statt in einer physischen Löschung.

#### Scenario: Inaktivität wird aus dem letzten Login bestimmt

- **WHEN** das System prüft, ob ein Tenant-Account die konfigurierten Löschregeln erreicht hat
- **THEN** verwendet es in V1 ausschließlich tenantbezogenes `last_login_at` des Tenant-Account-Records beziehungsweise des aktiven Tenant-Mitgliedschaftskontexts der betroffenen `instanceId` als Referenzzeitpunkt
- **AND** behandelt es diesen Wert nicht als globales Cross-Tenant-Inaktivitätssignal
- **AND** verlangt kein neues Aktivitäts-Tracking-System und keine zusätzlichen Aktivitätsquellen

#### Scenario: Lebenszyklus durchläuft die fachlichen Stufen geordnet

- **WHEN** ein Tenant-Account die konfigurierten Schwellwerte erreicht
- **THEN** wechselt er höchstens in der Reihenfolge `active` → `deactivated` → `pseudonymized` → `deleted`
- **AND** hebt ein bloßer Login den Zustand `deactivated` nicht automatisch auf
- **AND** verlangt eine Rückkehr aus `deactivated` einen separaten Reaktivierungsprozess
- **AND** dürfen ohne Reaktivierung spätere automatische Lifecycle-Stufen weiterhin greifen
- **AND** beschreibt `deleted` einen finalen Tombstone-Soft-Delete
- **AND** werden referenzwahrende Nachweise und Auditspuren weiterhin pseudonymisiert erhalten

#### Scenario: Neue oder unkonfigurierte Tenants verwenden Baseline-Defaults

- **WHEN** für einen Tenant noch keine individuellen Löschregeln konfiguriert wurden
- **THEN** verwendet das System die Baseline-Defaults/Fallbacks `deactivateAfterDays=90`, `pseudonymizeAfterDays=180` und `deleteAfterDays=365`
- **AND** gelten diese Werte so lange als wirksame Tenant-Regeln, bis tenant-spezifische Werte gespeichert werden

#### Scenario: Root- und Plattform-Accounts bleiben außerhalb des Löschregelmodells

- **WHEN** ein Root- oder Plattform-Admin ohne Tenant-Scope betrachtet wird
- **THEN** wird der Account nicht durch tenantbezogene Inaktivitätsregeln verarbeitet
- **AND** bleiben solche Identitäten außerhalb dieses V1-Löschkonzepts

### Requirement: Inhaltsbehandlung ist tenantweit steuerbar und pro Account überschreibbar

Das System SHALL für den Lösch-Lebenszyklus eine tenantweite Default-Inhaltsstrategie und einen per-Account-Override für eigene Inhalte unterstützen. In V1 ist `iam.contents` die einzige unterstützte Inhaltsdomäne. Die normative V1-Strategiemenge lautet `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln` und `bei Löschung mitbehandeln`.

#### Scenario: Strategiebedeutungen sind zustandsbezogen und nicht physisch

- **WHEN** das System die Inhaltsstrategie eines Accounts im Scope `iam.contents` auswertet
- **THEN** bedeutet `beibehalten`, dass Inhalte über alle Account-Zustandswechsel unverändert bleiben
- **AND** bedeutet `bei Deaktivierung mitbehandeln`, dass Inhalte beim Übergang des Accounts nach `deactivated` in denselben fachlichen Stufeneffekt überführt werden
- **AND** bedeutet `bei Pseudonymisierung mitbehandeln`, dass Inhalte beim Übergang des Accounts nach `pseudonymized` in denselben fachlichen Stufeneffekt überführt werden
- **AND** bedeutet `bei Löschung mitbehandeln`, dass Inhalte erst beim finalen Übergang des Accounts nach `deleted` in denselben fachlichen Stufeneffekt überführt werden
- **AND** bleibt die Inhaltsbehandlung in V1 zustandsbezogene Tombstone-Behandlung und keine physische Löschung

#### Scenario: Tenantweite Default-Strategie wirkt ohne individuellen Override

- **WHEN** ein Tenant Löschregeln mit einer Default-Inhaltsstrategie konfiguriert
- **THEN** gilt diese Strategie für eigene Inhalte eines Accounts, solange kein individueller Override gesetzt ist
- **AND** stammt die Strategie aus der normativen V1-Menge `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln`
- **AND** ist die Wirkung auf `iam.contents` begrenzt

#### Scenario: Individueller Override ersetzt nur die Inhaltsstrategie des eigenen Accounts

- **WHEN** ein Benutzer eine abweichende Inhaltspräferenz für die Behandlung seiner eigenen Inhalte speichert
- **THEN** überschreibt diese Präferenz nur die tenantweite Default-Inhaltsstrategie für diesen Account
- **AND** verändert sie keine Fristenwerte des Tenants
- **AND** bleibt auch der Override auf die normative V1-Menge `beibehalten`, `bei Deaktivierung mitbehandeln`, `bei Pseudonymisierung mitbehandeln`, `bei Löschung mitbehandeln` begrenzt
- **AND** erweitert sie den Scope nicht auf andere Inhaltsdomänen als `iam.contents`

#### Scenario: Unkonfigurierter Tenant verwendet geerbte Regeln bis zur expliziten Speicherung

- **WHEN** für einen Tenant noch keine explizite Löschregel-Konfiguration gespeichert ist
- **THEN** gelten die Baseline-Defaults `90 / 180 / 365` und die geerbte Default-Inhaltsstrategie als wirksamer Tenant-Zustand
- **AND** bleibt dieser geerbte Zustand wirksam, bis ein Tenant-Admin eine explizite Konfiguration speichert
