## MODIFIED Requirements
### Requirement: Reproduzierbare lokale Test- und Seed-Pfade für Instanzen

Das System SHALL reproduzierbare lokale Seed-, Bootstrap- und Reconcile-Pfade für Instanzen bereitstellen, damit Registry-Auflösung und Provisioning ohne produktive Infrastruktur prüfbar bleiben und bestehende Umgebungsidentität nicht still überschrieben wird.

#### Scenario: Lokale Seed-Instanzen stehen für Entwicklung bereit

- **WHEN** ein Teammitglied einen lokalen Standardmodus startet
- **THEN** stehen mindestens zwei aktive Seed-Instanzen für Entwicklung und Tests reproduzierbar bereit
- **AND** ist mindestens ein negativer Tenant-Fall für fail-closed-Tests definiert

#### Scenario: Lokales Provisioning nutzt denselben fachlichen Vertrag

- **WHEN** eine neue Instanz lokal über CLI, Test-Setup oder Admin-Pfad angelegt wird
- **THEN** nutzt dieser Pfad dieselben Validierungs- und Statusregeln wie der produktive Provisioning-Vertrag
- **AND** kann die neue Instanz ohne neues App-Deployment im lokalen Multi-Tenant-Pfad getestet werden

#### Scenario: Standard-Seed ergänzt bestehende Umgebungsidentität nur nicht-destruktiv

- **WHEN** ein Standard-Seed auf eine bereits vorhandene Instanz mit gesetzten Werten für `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` oder tenant-spezifische Auth-Secret-Zuordnungen trifft
- **THEN** überschreibt der Seed diese bestehenden Werte nicht stillschweigend
- **AND** darf der Seed geschützte Identitätsfelder nur setzen oder ergänzen, wenn sie noch leer oder nicht vorhanden sind

## ADDED Requirements
### Requirement: Seed, Bootstrap und Reconcile haben getrennte Verantwortung fuer Umgebungsidentitaet

Das System SHALL additive Baseline-Seeds normativ von autoritativen Bootstrap- und Reconcile-Pfaden trennen, damit laufzeitkritische Umgebungsidentität nicht unbemerkt durch Standard-Seeds verändert wird.

#### Scenario: Neue Umgebung wird autoritativ initialisiert

- **WHEN** eine neue lokale oder staging-nahe Umgebung erstmalig initialisiert wird
- **THEN** darf der Bootstrap-Pfad `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` und tenant-spezifische Auth-Secrets autoritativ setzen
- **AND** bleibt dieser autoritative Pfad explizit von einem normalen Standard-Seed unterscheidbar

#### Scenario: Bestehende Umgebung wird nur explizit reconciled

- **WHEN** eine bestehende Umgebung bewusst auf neue Host-, Realm- oder Client-Werte ausgerichtet werden soll
- **THEN** erfolgt diese Identitätsänderung nur über einen expliziten Reconcile- oder Bootstrap-Pfad
- **AND** nicht über einen normalen Standard-Seed

### Requirement: Tenant-spezifische Auth-Secrets gehoeren zum geschuetzten Umgebungsvertrag

Das System SHALL tenant-spezifische Auth-Secret-Zuordnungen als Teil der geschützten Umgebungsidentität behandeln, damit ein korrigierter Tenant-Zustand nicht beim Callback auf globale Fallback-Secrets zurückfällt.

#### Scenario: Bestehende Tenant-Umgebung nutzt hinterlegtes Secret statt globalem Fallback

- **WHEN** eine bestehende lokale oder staging-nahe Umgebung einen tenant-spezifischen `auth_client_id` und `auth_realm` verwendet
- **THEN** ist für diesen Tenant eine lesbare tenant-spezifische Secret-Zuordnung vorhanden oder wird über einen expliziten Bootstrap-/Reconcile-Pfad wiederhergestellt
- **AND** darf ein globales Fallback-Secret nicht als dauerhafter Sollzustand für diese Umgebung gelten

#### Scenario: Readiness deckt Host- und Secret-Drift gemeinsam auf

- **WHEN** eine bestehende Tenant-Umgebung nach Seed-, Bootstrap- oder Reconcile-Läufen geprüft wird
- **THEN** umfasst die Prüfung mindestens Tenant-Host-Auflösung, Realm-/Client-Zuordnung und die Verwendung des tenant-spezifischen Secrets im Login-Flow
- **AND** wird ein Zustand, der nur mit globalem Secret-Fallback funktioniert oder am Callback scheitert, nicht als erfolgreich reconciled bewertet
