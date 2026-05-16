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
- **AND** behandelt der Seed unterschiedliche, aber fachlich legitime Umgebungswerte nicht automatisch als Fehler, solange kein expliziter Reparatur- oder Bootstrap-Modus angefordert wurde

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

#### Scenario: Standard-Reconcile schützt legitime Umgebungsunterschiede

- **WHEN** ein bestehender lokaler oder staging-naher Bestand bereits konsistente, aber von einer anderen Umgebung abweichende Host-, Realm-, Client- oder Secret-Werte besitzt
- **THEN** behandelt der Standard-Reconcile diese Abweichung nicht automatisch als zu überschreibenden Drift
- **AND** ergänzt fehlende Pflichtbestände additiv oder weist die Abweichung sichtbar aus
- **AND** erfordert ein autoritatives Angleichen an einen anderen Zielzustand einen expliziten Bootstrap- oder Reparaturmodus

### Requirement: Tenant-spezifische Auth-Secrets gehoeren zum geschuetzten Umgebungsvertrag

Das System SHALL tenant-spezifische Auth-Secret-Zuordnungen als Teil der geschützten Umgebungsidentität behandeln, damit ein korrigierter Tenant-Zustand weder beim Callback auf globale Fallback-Secrets zurückfällt noch bei schreibenden IAM-Operationen mit unvollständigen Tenant-Admin-Credentials ausfällt.

#### Scenario: Bestehende Tenant-Umgebung nutzt hinterlegtes Secret statt globalem Fallback

- **WHEN** eine bestehende lokale oder staging-nahe Umgebung einen tenant-spezifischen `auth_client_id` und `auth_realm` verwendet
- **THEN** ist für diesen Tenant eine lesbare tenant-spezifische Secret-Zuordnung vorhanden oder wird über einen expliziten Bootstrap-/Reconcile-Pfad wiederhergestellt
- **AND** darf ein globales Fallback-Secret nicht als dauerhafter Sollzustand für diese Umgebung gelten

#### Scenario: Bestehende Tenant-Umgebung besitzt vollstaendige Tenant-Admin-Credentials fuer Schreibpfade

- **WHEN** eine bestehende lokale oder staging-nahe Umgebung einen tenant-spezifischen `tenant_admin_client_id` für Keycloak-Admin-Operationen verwendet
- **THEN** ist für diesen Tenant eine lesbare tenant-spezifische `tenant_admin_client_secret`-Zuordnung vorhanden oder wird über einen expliziten Bootstrap-/Reconcile-Pfad wiederhergestellt
- **AND** gilt eine vorhandene `tenant_admin_client_id` ohne Secret nicht als betriebsbereiter Zustand

#### Scenario: Readiness deckt Host- und Secret-Drift gemeinsam auf

- **WHEN** eine bestehende Tenant-Umgebung nach Seed-, Bootstrap- oder Reconcile-Läufen geprüft wird
- **THEN** umfasst die Prüfung mindestens Tenant-Host-Auflösung, Realm-/Client-Zuordnung, die Verwendung des tenant-spezifischen Login-Secrets im Login-Flow und die Verfügbarkeit des tenant-spezifischen Tenant-Admin-Secrets für schreibende IAM-Operationen
- **AND** wird ein Zustand, der nur mit globalem Secret-Fallback funktioniert, am Callback scheitert oder bei Rollenanlage und ähnlichen Schreibpfaden `tenant_admin_credentials_incomplete` erzeugt, nicht als erfolgreich reconciled bewertet

### Requirement: Reconcile bestehender Umgebungen ergaenzt kanonische Laufzeitbestaende

Das System SHALL bei bestehenden lokalen und staging-nahen Umgebungen fehlende kanonische Laufzeitbestände ergänzen können, damit aktuelle Runtime-Pfade nicht an halb migrierten Legacy-Beständen scheitern.

#### Scenario: Reconcile ergänzt neuen kanonischen Integrations-Backbone

- **WHEN** die Runtime für eine Instanz einen kanonischen Speicherort wie `iam.instance_external_interfaces` für externe Schnittstellenkonfiguration verwendet
- **AND** eine bestehende Umgebung dort noch keinen Datensatz besitzt, obwohl ältere oder parallele Bestände vorhanden oder erwartet sind
- **THEN** darf der Reconcile-Pfad den fehlenden kanonischen Datensatz ergänzen
- **AND** darf diese Ergänzung nicht voraussetzen, dass bestehende Umgebungsidentität still geändert wird
- **AND** ersetzt diese Ergänzung keine bereits vorhandenen, fachlich gültigen Datensätze pauschal durch lokale Referenzwerte

#### Scenario: Reconcile bewertet Profilprojektion als Teil des Laufzeitzustands

- **WHEN** eine bestehende Tenant-Umgebung nach Seed-, Bootstrap- oder Reconcile-Läufen geprüft wird
- **THEN** wird auch geprüft, ob lokale Account-Felder aus der Session robust ergänzt werden können und die Profilprojektion danach sinnvolle Namen, Mail-Adressen und Rollen liefert
- **AND** gilt eine Umgebung mit leerer Profilprojektion oder fehlerhaftem Session-Seed nicht als vollständig reconciled
