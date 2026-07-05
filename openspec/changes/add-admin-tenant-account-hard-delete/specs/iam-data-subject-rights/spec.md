## MODIFIED Requirements

### Requirement: Tenantbezogener Inaktivitäts-Lebenszyklus ergänzt das Recht auf Löschung

Das System SHALL für Tenant-Accounts einen regelbasierten Inaktivitäts-Lebenszyklus bereitstellen, der die Stufen `active`, `deactivated`, `pseudonymized` und `deleted` verwendet. Der Lebenszyklus gilt nur im Tenant-Scope, leitet Inaktivität in V1 ausschließlich aus erfolgreichen Login-Events der betroffenen `instanceId` ab und endet im Standardpfad in einem finalen Tombstone-Soft-Delete statt in einer physischen Löschung. Ein separater, privilegierter Admin-Hard-Delete für Tenant-Accounts darf als explizite Ausnahme zusätzlich existieren, ersetzt den Lifecycle-Standardpfad jedoch nicht.

#### Scenario: Lebenszyklus bleibt der tombstone-basierte Standardpfad

- **WHEN** das System einen Tenant-Account über den automatischen oder manuellen Inaktivitäts-Lifecycle verarbeitet
- **THEN** beschreibt `deleted` weiterhin den finalen Tombstone-Soft-Delete ohne physische Löschung
- **AND** bleibt dieser Lifecycle unabhängig von einem separaten privilegierten Admin-Hard-Delete

#### Scenario: Privilegierter Admin-Hard-Delete ist vom Lifecycle getrennt

- **WHEN** ein berechtigter Tenant-Admin einen Tenant-Account über den expliziten Admin-Delete-Pfad physisch löscht
- **THEN** gilt dieser Vorgang nicht als normaler Lifecycle-Übergang des Inaktivitätsmodells
- **AND** darf er den Account physisch entfernen, sobald referenzierende Daten regelkonform bereinigt wurden
- **AND** bleiben die tenantbezogenen Löschregeln für die Behandlung eigener Inhalte weiterhin maßgeblich
