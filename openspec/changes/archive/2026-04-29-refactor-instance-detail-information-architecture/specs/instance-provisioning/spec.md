## MODIFIED Requirements
### Requirement: Instanz-Detailseite zeigt Tenant-IAM-Betriebszustand getrennt von Provisioning-Readiness

Das System SHALL in der Instanz-Detailansicht den Tenant-IAM-Betriebszustand getrennt von der bestehenden Provisioning- und Keycloak-Struktur-Readiness ausweisen und diese Befunde so gruppieren, dass aktuelle Betriebsbewertung und historische Diagnose nicht verwechselt werden.

#### Scenario: Strukturstatus und Tenant-IAM-Status werden nicht vermischt

- **WHEN** eine Instanzdetailansicht geladen wird
- **THEN** bleiben `keycloakStatus`, `keycloakPreflight`, `keycloakPlan` und Provisioning-Runs fuer Struktur- und Provisioning-Fragen erhalten
- **AND** wird ein separater `tenantIamStatus` fuer die laufende Tenant-IAM-Betriebsfaehigkeit angezeigt
- **AND** kann eine formal gruene Strukturansicht gleichzeitig einen degradierten Tenant-IAM-Befund tragen
- **AND** erzwingt die UI nicht, dass Operatoren alle diese Ebenen im selben Erstblick gleichrangig interpretieren muessen

#### Scenario: Aktueller Strukturzustand dominiert gegenueber alter Run-Historie

- **WHEN** aktuelle Struktur-Evidenz und Historien-Evidenz unterschiedliche Signale liefern
- **THEN** priorisiert die Detailansicht fuer den Erstblick den aktuellen Strukturzustand
- **AND** bleibt alte Provisioning-Historie diagnostisch verfuegbar
- **AND** darf historische Fehl-Evidenz nicht den Primaerstatus der Seite bestimmen, solange aktuelle Evidenz etwas anderes belegt

#### Scenario: Bestandsaktionen werden tenant-iam-bezogen zugeordnet

- **WHEN** die Instanzdetailansicht fuer einen Tenant-IAM-Befund Handlungsmoeglichkeiten anbietet
- **THEN** ordnet die UI nur fachlich sinnvolle Bestandsaktionen wie bestehende Provisioning-/Reset-Pfade oder den Rollen-Reconcile dem Befund zu
- **AND** schlaegt sie keine unspezifische globale Reparaturaktion vor

#### Scenario: Historische Provisioning-Evidenz bleibt nachgeordnet verfuegbar

- **WHEN** aktuelle Struktur-Checks und der letzte erfolgreiche Provisioning-Zustand gruene oder betriebsbereite Signale liefern
- **THEN** bleiben aeltere Run-Eintraege mit fehlgeschlagenen Schritten weiterhin verfuegbar
- **AND** werden diese in der Detailansicht als historische Evidenz und nicht als aktueller Primärstatus dargestellt
- **AND** bleibt fuer Operatoren klar erkennbar, welcher Befund aktuell und welcher nur rueckblickend relevant ist

#### Scenario: Befunde zeigen Status, Frische und Herkunft

- **WHEN** die Detailansicht einen hervorgehobenen Struktur- oder Tenant-IAM-Befund anzeigt
- **THEN** zeigt die UI fuer diesen Befund nach Moeglichkeit nicht nur den Status, sondern auch letzte belastbare Evidenzzeit oder gleichwertige Frischeinformation
- **AND** macht sie sichtbar, ob der Befund aus Preflight, Access-Probe, Reconcile oder Provisioning-Evidenz abgeleitet wurde
