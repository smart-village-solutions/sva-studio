## MODIFIED Requirements
### Requirement: Plattformrollen und Tenant-Admin-Rollen bleiben getrennt
Das System SHALL tenant-lokale Admin-Rollen und globale Plattformrollen in der Instanzverwaltung strikt trennen.

#### Scenario: Tenant-Admin-Bootstrap entfernt versehentliche Plattformrolle
- **WHEN** ein Tenant-Admin im Reconcile-Pfad die Rolle `instance_registry_admin` trägt
- **THEN** entfernt der Reconcile diese Rolle
- **AND** stellt mindestens `system_admin` sicher

#### Scenario: Nur Plattform-Admin darf Keycloak-Provisioning anstoßen
- **WHEN** ein Benutzer ohne `instance_registry_admin` versucht, Instanz-Realm-Grundeinstellungen zu ändern oder ein Keycloak-Provisioning auszulösen
- **THEN** lehnt das System die Operation ab

#### Scenario: Technischer Keycloak-Zugang blockiert fehlende Rechte vor dem Lauf
- **WHEN** der technische Keycloak-Admin-Zugang den Ziel-Realm nicht verwalten kann
- **THEN** markiert der Preflight die Ausführung als blockiert
- **AND** es wird kein Keycloak-Mutationslauf gestartet
