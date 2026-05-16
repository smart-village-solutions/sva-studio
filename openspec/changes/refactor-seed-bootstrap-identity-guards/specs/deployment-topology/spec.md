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
- **AND** werden unterschiedliche, aber gültige Umgebungswerte nicht allein deshalb an einen lokalen Referenzzustand angeglichen

### Requirement: Bestehende staging-nahe Umgebungen erhalten sichtbare Drift-Guardrails fuer Identitaetsfelder

Das System SHALL für bestehende staging-nahe Umgebungen sichtbare Guardrails bereitstellen, wenn Bootstrap- oder Seed-Pfade auf abweichende geschützte Identitätswerte treffen.

#### Scenario: Abweichende Zielwerte werden sichtbar statt still übernommen

- **WHEN** ein Bootstrap-, Seed- oder Reconcile-Pfad auf eine bestehende staging-nahe Umgebung mit bereits belegten geschützten Identitätsfeldern trifft
- **AND** der Zielwert von `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id`, `tenant_admin_client_id` oder tenant-spezifischen Auth-Secret-Zuordnungen abweicht
- **THEN** wird die Abweichung mindestens als sichtbare Warnung oder harter Fehler ausgewiesen
- **AND** der Pfad übernimmt die neue Identität nicht stillschweigend als Standardverhalten
- **AND** unterscheidet der Pfad zwischen `fehlendem Pflichtbestand` und `bestehendem, aber anderem gültigen Umgebungswert`

### Requirement: Betriebsfaehige Tenant-Umgebungen erfordern konsistente Secret-Zuordnungen

Das System SHALL im lokalen und staging-nahen Betrieb tenant-spezifische Auth-Secrets als Teil der Umgebungs-Readiness behandeln, damit ein erfolgreicher Login nicht nach korrekter Host-Auflösung am Callback mit ungültigen Client-Credentials scheitert und schreibende IAM-Operationen nicht mit unvollständigen Tenant-Admin-Credentials ausfallen.

#### Scenario: Readiness erkennt Secret-Drift vor kontinuierlichem Testbetrieb

- **WHEN** eine bestehende Tenant-Umgebung für kontinuierliche lokale oder staging-nahe Tests bereitgestellt oder reconciled wird
- **THEN** prüft der Betriebs- oder Readiness-Pfad, ob tenant-spezifische Login- und Tenant-Admin-Secrets für die konfigurierte Realm-/Client-Kombination vorhanden und nutzbar sind
- **AND** wird eine Umgebung mit fehlendem tenant-spezifischem Login- oder Tenant-Admin-Secret nicht still als betriebsbereit eingestuft

#### Scenario: Write-Path-Smoke erkennt unvollstaendige Tenant-Admin-Credentials

- **WHEN** eine bestehende Tenant-Umgebung im lokalen oder staging-nahen Betrieb als betriebsbereit bewertet wird
- **THEN** umfasst der Smoke- oder Readiness-Pfad mindestens eine schreibende IAM-Operation oder eine gleichwertige Admin-Credential-Prüfung
- **AND** wird ein Zustand, in dem Rollenanlage oder vergleichbare Keycloak-Admin-Operationen mit `keycloak_unavailable` oder `tenant_admin_credentials_incomplete` scheitern, nicht als stabiler Zielzustand akzeptiert

#### Scenario: Readiness prueft auch Profil- und Integrationspfade

- **WHEN** eine bestehende Tenant-Umgebung im lokalen oder staging-nahen Betrieb als betriebsbereit bewertet wird
- **THEN** umfasst der Smoke- oder Readiness-Pfad neben Login und Admin-Schreibpfad auch die Profilprojektion und mindestens eine kanonische Integrationsprüfung wie den SVA-Mainserver-Verbindungsstatus
- **AND** wird ein Zustand mit leerer Profilprojektion, fehlerhaftem Session-Seed oder fehlender kanonischer Schnittstellenkonfiguration nicht als stabiler Zielzustand akzeptiert

#### Scenario: Additiver Reconcile bleibt der Default im kontinuierlichen Betrieb

- **WHEN** eine bestehende lokale oder staging-nahe Umgebung im normalen Entwicklungs- oder Testbetrieb reconciled wird
- **THEN** ergänzt der Pfad fehlende kanonische Pflichtbestände und meldet problematische Abweichungen sichtbar
- **AND** überschreibt er bestehende geschützte Identitäts- oder Integrationswerte nicht ohne expliziten autoritativen Modus
