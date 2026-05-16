## ADDED Requirements
### Requirement: Bootstrap- und Seed-Pfade unterscheiden neue und bestehende Umgebungen

Das System SHALL im lokalen und staging-nahen Betrieb normativ zwischen neuer Umgebung und bestehender Umgebung unterscheiden, damit Seed-, Bootstrap- und Reconcile-Pfade keine bestehende Umgebungsidentität stillschweigend überschreiben.

#### Scenario: Neue Umgebung darf autoritativ initialisiert werden

- **WHEN** ein Teammitglied eine neue lokale Entwicklungsumgebung oder einen neuen staging-nahen Server initialisiert
- **THEN** darf der autoritative Bootstrap-Pfad die geschützten Identitätsfelder der Instanz setzen
- **AND** ist dieser Pfad bewusst vom normalen kontinuierlichen Seed- oder Testpfad getrennt

#### Scenario: Bestehende Umgebung bleibt im kontinuierlichen Betrieb geschützt

- **WHEN** ein Seed-, Test- oder Routine-Betriebspfad gegen eine bestehende Umgebung mit bereits gesetzten Identitätsfeldern läuft
- **THEN** werden `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` und tenant-spezifische Auth-Secret-Zuordnungen standardmäßig nicht still überschrieben
- **AND** bleibt die Umgebung für kontinuierliche lokale oder staging-nahe Tests stabil

### Requirement: Bestehende staging-nahe Umgebungen erhalten sichtbare Drift-Guardrails fuer Identitaetsfelder

Das System SHALL für bestehende staging-nahe Umgebungen sichtbare Guardrails bereitstellen, wenn Bootstrap- oder Seed-Pfade auf abweichende geschützte Identitätswerte treffen.

#### Scenario: Abweichende Zielwerte werden sichtbar statt still übernommen

- **WHEN** ein Bootstrap-, Seed- oder Reconcile-Pfad auf eine bestehende staging-nahe Umgebung mit bereits belegten geschützten Identitätsfeldern trifft
- **AND** der Zielwert von `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` oder tenant-spezifischen Auth-Secret-Zuordnungen abweicht
- **THEN** wird die Abweichung mindestens als sichtbare Warnung oder harter Fehler ausgewiesen
- **AND** der Pfad übernimmt die neue Identität nicht stillschweigend als Standardverhalten

### Requirement: Betriebsfaehige Tenant-Umgebungen erfordern konsistente Secret-Zuordnungen

Das System SHALL im lokalen und staging-nahen Betrieb tenant-spezifische Auth-Secrets als Teil der Umgebungs-Readiness behandeln, damit ein erfolgreicher Login nicht nach korrekter Host-Auflösung am Callback mit ungültigen Client-Credentials scheitert.

#### Scenario: Readiness erkennt Secret-Drift vor kontinuierlichem Testbetrieb

- **WHEN** eine bestehende Tenant-Umgebung für kontinuierliche lokale oder staging-nahe Tests bereitgestellt oder reconciled wird
- **THEN** prüft der Betriebs- oder Readiness-Pfad, ob tenant-spezifische Auth-Secrets für die konfigurierte Realm-/Client-Kombination vorhanden und nutzbar sind
- **AND** wird eine Umgebung mit fehlendem tenant-spezifischem Secret nicht still als betriebsbereit eingestuft
