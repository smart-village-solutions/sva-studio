## ADDED Requirements

### Requirement: Tenantbezogener Inaktivitäts-Lebenszyklus ergänzt das Recht auf Löschung

Das System SHALL für Tenant-Accounts einen regelbasierten Inaktivitäts-Lebenszyklus bereitstellen, der die Stufen `active`, `deactivated`, `pseudonymized` und `deleted` verwendet. Der Lebenszyklus gilt nur im Tenant-Scope, leitet Inaktivität in V1 ausschließlich aus `last_login_at` ab und endet in einem finalen Tombstone-Soft-Delete statt in einer physischen Löschung.

#### Scenario: Inaktivität wird aus dem letzten Login bestimmt

- **WHEN** das System prüft, ob ein Tenant-Account die konfigurierten Löschregeln erreicht hat
- **THEN** verwendet es in V1 ausschließlich `last_login_at` als Referenzzeitpunkt
- **AND** verlangt kein neues Aktivitäts-Tracking-System und keine zusätzlichen Aktivitätsquellen

#### Scenario: Lebenszyklus durchläuft die fachlichen Stufen geordnet

- **WHEN** ein Tenant-Account die konfigurierten Schwellwerte erreicht
- **THEN** wechselt er höchstens in der Reihenfolge `active` → `deactivated` → `pseudonymized` → `deleted`
- **AND** beschreibt `deleted` einen finalen Tombstone-Soft-Delete
- **AND** werden referenzwahrende Nachweise und Auditspuren weiterhin pseudonymisiert erhalten

#### Scenario: Root- und Plattform-Accounts bleiben außerhalb des Löschregelmodells

- **WHEN** ein Root- oder Plattform-Admin ohne Tenant-Scope betrachtet wird
- **THEN** wird der Account nicht durch tenantbezogene Inaktivitätsregeln verarbeitet
- **AND** bleiben solche Identitäten außerhalb dieses V1-Löschkonzepts

### Requirement: Inhaltsbehandlung ist tenantweit steuerbar und pro Account überschreibbar

Das System SHALL für den Lösch-Lebenszyklus eine tenantweite Default-Inhaltsstrategie und einen per-Account-Override für eigene Inhalte unterstützen. In V1 ist `iam.contents` die einzige unterstützte Inhaltsdomäne.

#### Scenario: Tenantweite Default-Strategie wirkt ohne individuellen Override

- **WHEN** ein Tenant Löschregeln mit einer Default-Inhaltsstrategie konfiguriert
- **THEN** gilt diese Strategie für eigene Inhalte eines Accounts, solange kein individueller Override gesetzt ist
- **AND** ist die Wirkung auf `iam.contents` begrenzt

#### Scenario: Individueller Override ersetzt nur die Inhaltsstrategie des eigenen Accounts

- **WHEN** ein Benutzer eine abweichende Inhaltspräferenz für die Behandlung seiner eigenen Inhalte speichert
- **THEN** überschreibt diese Präferenz nur die tenantweite Default-Inhaltsstrategie für diesen Account
- **AND** verändert sie keine Fristenwerte des Tenants
- **AND** erweitert sie den Scope nicht auf andere Inhaltsdomänen als `iam.contents`
