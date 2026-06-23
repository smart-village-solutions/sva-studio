## ADDED Requirements
### Requirement: Tenant-Autorisierung wird normativ aus IAM-Rollen, Gruppen und Permissions abgeleitet
Das System SHALL tenantlokale Autorisierungsentscheidungen normativ aus dem IAM-Datenmodell der aktiven Instanz ableiten. Rohrollen aus Keycloak duerfen tenantseitige Fachautorisierung nicht eigenstaendig begruenden.

#### Scenario: Tenant-Gate ignoriert rohe Keycloak-Fachrolle ohne IAM-Wirkung
- **WHEN** ein Benutzer in Keycloak eine historische oder externe Realm-Rolle besitzt, die im tenantlokalen IAM-Modell keiner wirksamen Rolle oder Permission entspricht
- **THEN** gewaehrt ein Tenant-UI- oder API-Gate dadurch keinen fachlichen Zugriff
- **AND** bleibt der Zugriff fail-closed auf die IAM-basierte Autorisierungsentscheidung beschraenkt

#### Scenario: IAM-Permission wirkt ohne zusaetzliche Keycloak-Fachrolle
- **WHEN** ein Benutzer im Tenant-Realm die erforderliche IAM-Rolle, Gruppenmitgliedschaft oder effektive Permission besitzt
- **THEN** gewaehrt das System den vorgesehenen Tenant-Zugriff
- **AND** verlangt dafuer keine zusaetzliche fachliche Keycloak-Realm-Rolle ausserhalb des normativen Sonderrollenschnitts

### Requirement: Legacy-Keycloak-Rollen bleiben Diagnose- statt Normierungsquelle
Das System SHALL historische oder externe Keycloak-Rollen fuer Tenant-Benutzer nur noch als Diagnose-, Drift- oder Interop-Artefakte behandeln, sofern sie nicht zu den ausdruecklich verwalteten Sonderrollen gehoeren.

#### Scenario: Diagnose zeigt Legacy-Rolle ohne Fachwirkung
- **WHEN** eine Analyse, Permissions-Uebersicht oder Reconcile-Ausgabe eine historische Keycloak-Rolle fuer einen Tenant-Benutzer findet
- **THEN** kennzeichnet das System diese Rolle als Legacy-, externes oder technisches Artefakt
- **AND** beschreibt ihre fehlende normative Fachwirkung eindeutig

## MODIFIED Requirements
### Requirement: Stabile Rollenidentität für Autorisierung und IdP-Sync
Das System SHALL fuer Rollen einen stabilen technischen Schluessel (`role_key`) verwenden, der unabhaengig von UI-Anzeigenamen ist und fuer IAM-Autorisierungsaufloesung sowie verbleibende technische Interop- oder Sonderrollenpfade genutzt wird.

#### Scenario: Anzeigename wird geändert
- **WHEN** ein Admin den Anzeigenamen einer Custom-Rolle aendert
- **THEN** bleibt der technische `role_key` unveraendert
- **AND** bestehende Rollen-Zuweisungen und Berechtigungsaufloesungen bleiben gueltig
- **AND** es entsteht keine neue Rolle durch Umbenennung

#### Scenario: Rollenauflösung bleibt IAM-deterministisch
- **WHEN** eine Rollen-Zuweisung fuer einen Benutzer ausgewertet wird
- **THEN** nutzt die Access-Control-Aufloesung den stabilen `role_key` als Referenz
- **AND** ist fuer tenantseitige Fachautorisierung nicht von Keycloak-Display-Metadaten oder einem allgemeinen Realm-Rollenabgleich abhaengig

### Requirement: Managed Scope für externe Rollen
Das System MUST bei Synchronisierung und Reconciliation strikt zwischen technisch verwalteten Sonderrollen, tenantlokalen IAM-Rollen und sonstigen externen Keycloak-Rollen unterscheiden.

#### Scenario: Externe, nicht verwaltete Keycloak-Rolle
- **WHEN** eine Rolle in Keycloak existiert, aber nicht zum technisch verwalteten Sonderrollen-Scope gehoert
- **THEN** wird diese Rolle durch den Standard-Reconcile-Lauf nicht als normative tenantlokale Fachrolle behandelt
- **AND** sie hat keine automatische Wirkung auf den Studio-Rollenkatalog
- **AND** der Managed-Scope wird nicht mehr allgemein aus allen studioverwalteten Tenant-Rollen abgeleitet

#### Scenario: Drift innerhalb des technischen Managed Scope
- **WHEN** eine ausdruecklich verwaltete Sonderrolle im zustaendigen Realm von ihrem Sollzustand abweicht
- **THEN** darf der Reconcile-Lauf die Abweichung gemaess Richtlinie korrigieren
- **AND** die Korrektur wird mit `request_id` und Ergebnisstatus auditierbar protokolliert
