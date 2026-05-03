## ADDED Requirements
### Requirement: Instanz-Detailseite zeigt Tenant-IAM-Betriebszustand getrennt von Provisioning-Readiness

Das System SHALL in der Instanz-Detailansicht den Tenant-IAM-Betriebszustand getrennt von der bestehenden Provisioning- und Keycloak-Struktur-Readiness ausweisen.

#### Scenario: Strukturstatus und Tenant-IAM-Status werden nicht vermischt

- **WHEN** eine Instanzdetailansicht geladen wird
- **THEN** bleiben `keycloakStatus`, `keycloakPreflight`, `keycloakPlan` und Provisioning-Runs für Struktur- und Provisioning-Fragen erhalten
- **AND** wird ein separater `tenantIamStatus` für die laufende Tenant-IAM-Betriebsfähigkeit angezeigt
- **AND** kann eine formal grüne Strukturansicht gleichzeitig einen degradierten Tenant-IAM-Befund tragen

#### Scenario: Bestandsaktionen werden tenant-iam-bezogen zugeordnet

- **WHEN** die Instanzdetailansicht für einen Tenant-IAM-Befund Handlungsmöglichkeiten anbietet
- **THEN** ordnet die UI nur fachlich sinnvolle Bestandsaktionen wie bestehende Provisioning-/Reset-Pfade oder den Rollen-Reconcile dem Befund zu
- **AND** schlägt sie keine unspezifische globale Reparaturaktion vor

### Requirement: Instanzdiagnostik korreliert Tenant-IAM-Reconcile und Access-Probe

Das System SHALL Tenant-IAM-Reconcile, tenantlokale Rechteprobe und bestehende Provisioning-Evidenz in der Instanzdetailansicht korrelierbar zusammenführen.

#### Scenario: Reconcile-Befund verweist auf Tenant-IAM-Evidenz

- **WHEN** der Rollen- oder User-Abgleich einer Instanz fehlgeschlagen oder degradiert ist
- **THEN** kann die Instanzdetailansicht den Reconcile-Zustand mit Fehlercode, letztem Lauf und `requestId` darstellen
- **AND** bleibt sichtbar, ob zusätzlich die tenantlokale Rechteprobe oder die Strukturkonfiguration betroffen ist
- **AND** stammt dieser Befund aus vorhandener Reconcile-Evidenz statt aus einer neu erfundenen parallelen Statusquelle

#### Scenario: Access-Probe und Provisioning bleiben unterscheidbar

- **WHEN** Realm, Clients und Secrets strukturell vorhanden sind, der tenantlokale Admin-Client aber operativ keine ausreichenden Rechte hat
- **THEN** bleibt `configuration` im `tenantIamStatus` unabhängig von `access` oder `reconcile` auswertbar
- **AND** wird der Befund nicht als bloßes Fehlen eines Registry-Felds fehlklassifiziert

#### Scenario: Detailvertrag erzwingt keine neue Persistenzschicht

- **WHEN** vorhandene Registry-, Provisioning- und Reconcile-Evidenz ausreicht, um den Tenant-IAM-Befund nachvollziehbar abzuleiten
- **THEN** darf der Instanz-Detailvertrag diese Evidenz direkt aggregieren
- **AND** ist eine zusätzliche Persistenz für Probe-Snapshots oder Diagnosehistorie in diesem Change nicht verpflichtend
