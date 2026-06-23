## ADDED Requirements
### Requirement: Tenant-Bootstrap materialisiert keine allgemeinen Fachrollen in Keycloak
Das System SHALL bei Tenant-Bootstrap, Repair und Reconcile in Keycloak nur die fuer Login, technische Realm-Vertraege und ausdruecklich verbleibende Sonderrollen noetigen Artefakte materialisieren. Tenantlokale Fachrollen werden nicht allgemein als Keycloak-Realm-Rollen nachgezogen.

#### Scenario: Neuer Tenant bootstrappt nur technische Rollenartefakte
- **WHEN** eine neue Instanz erfolgreich angelegt und der initiale Tenant-Admin gebootstrappt wird
- **THEN** synchronisiert das System die fuer Login und Tenant-Administration erforderlichen Keycloak-Artefakte
- **AND** kann es `system_admin` als technische Sonderrolle bereitstellen, wenn der Schutzpfad dies verlangt
- **AND** erzeugt es keine allgemeinen tenantlokalen Fachrollen wie editierbare Custom-Rollen zusaetzlich in Keycloak

#### Scenario: Reconcile heilt keine historischen Fachrollen in Keycloak neu
- **WHEN** ein Bootstrap-, Repair- oder Reconcile-Pfad einen Bestands-Tenant mit historischen Keycloak-Fachrollen prueft
- **THEN** darf das System diese Rollen als Legacy-Drift melden
- **AND** materialisiert sie nicht erneut als Sollzustand des Tenant-Realm

## MODIFIED Requirements
### Requirement: Idempotenter Provisioning-Workflow
Das System SHALL neue Instanzen ueber einen idempotenten Provisioning-Workflow anlegen, der technische Teilaufgaben und Teilfehler kontrolliert behandelt. Soweit der Workflow modulbezogene IAM-Basisartefakte oder deren Reparatur ableitet, verwendet er dafuer dieselbe gemeinsame Modul-IAM-Vertragsquelle wie Runtime und Diagnose. Tenantlokale Fachrollen werden dabei normativ im IAM-Modell und nicht als allgemeiner Keycloak-Rollenkatalog aufgebaut.

#### Scenario: Erfolgreiche Neuanlage einer Instanz
- **WHEN** eine berechtigte Person eine neue Instanz mit gueltiger `instanceId` und gueltigem Ziel-Hostname anfordert
- **THEN** legt das System einen Provisioning-Lauf an
- **AND** erstellt oder reserviert die benoetigten Registry- und Basis-Konfigurationsartefakte
- **AND** erzeugt oder validiert getrennt den Login-Client `authClientId` und den Tenant-Admin-Client `tenantAdminClient.clientId`
- **AND** richtet die tenantlokale fachliche Rollen- und Permission-Basis im IAM-Modell aus
- **AND** dokumentiert den Uebergang bis zum Status `active`

#### Scenario: Bootstrap seedet `system_admin` atomar im IAM-Modell
- **WHEN** der Provisioning-Workflow einen neuen Tenant-Admin initialisiert
- **THEN** seedet der Workflow die Sonderrolle `system_admin` idempotent im IAM-Modell und weist sie dem initialen Tenant-Admin zu
- **AND** markiert der Workflow den Bootstrap nur dann als erfolgreich, wenn diese IAM-Seite erfolgreich abgeschlossen wurde
- **AND** bleibt ein Teilfehler in diesem Schritt als wiederholbarer, diagnostizierbarer Fehlerzustand sichtbar
