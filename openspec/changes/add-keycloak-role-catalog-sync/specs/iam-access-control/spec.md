## ADDED Requirements

### Requirement: Stabile Rollenidentität für Autorisierung und IdP-Sync

Das System SHALL für Rollen einen stabilen technischen Schlüssel (`role_key`) verwenden, der unabhängig von UI-Anzeigenamen ist und für Keycloak-Synchronisierung sowie Autorisierungsauflösung genutzt wird.

#### Scenario: Anzeigename wird geändert

- **WHEN** ein Admin den Anzeigenamen einer Custom-Rolle ändert
- **THEN** bleibt der technische `role_key` unverändert
- **AND** bestehende Rollen-Zuweisungen und Berechtigungsauflösungen bleiben gültig
- **AND** es entsteht keine neue Rolle durch Umbenennung

#### Scenario: Rollenauflösung nach Synchronisierung

- **WHEN** eine Rollen-Zuweisung für einen Benutzer ausgewertet wird
- **THEN** nutzt die Access-Control-Auflösung den stabilen `role_key` als Referenz
- **AND** ist unabhängig von Keycloak-Display-Metadaten deterministisch

### Requirement: Managed Scope für externe Rollen

Das System MUST bei Synchronisierung und Reconciliation strikt zwischen studioverwalteten Rollen und nicht verwalteten Keycloak-Rollen unterscheiden.

#### Scenario: Externe, nicht verwaltete Keycloak-Rolle

- **WHEN** eine Rolle in Keycloak existiert, aber nicht zum Studio-Managed-Scope gehört
- **THEN** wird diese Rolle durch den Reconcile-Lauf nicht verändert oder gelöscht
- **AND** sie hat keine automatische Wirkung auf den Studio-Rollenkatalog

#### Scenario: Drift innerhalb des Managed Scope

- **WHEN** eine studioverwaltete Rolle im Managed-Scope in Keycloak abweicht
- **THEN** darf der Reconcile-Lauf die Abweichung gemäß Richtlinie korrigieren
- **AND** die Korrektur wird mit `request_id` und Ergebnisstatus auditierbar protokolliert
