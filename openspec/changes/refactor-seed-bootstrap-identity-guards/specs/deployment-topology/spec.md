## ADDED Requirements
### Requirement: Bootstrap- und Seed-Pfade unterscheiden neue und bestehende Umgebungen

Das System SHALL im lokalen und staging-nahen Betrieb normativ zwischen neuer Umgebung und bestehender Umgebung unterscheiden, damit Seed-, Bootstrap- und Reconcile-Pfade keine bestehende Umgebungsidentität stillschweigend überschreiben.

#### Scenario: Neue Umgebung darf autoritativ initialisiert werden

- **WHEN** ein Teammitglied eine neue lokale Entwicklungsumgebung oder einen neuen staging-nahen Server initialisiert
- **THEN** darf der autoritative Bootstrap-Pfad die geschützten Identitätsfelder der Instanz setzen
- **AND** ist dieser Pfad bewusst vom normalen kontinuierlichen Seed- oder Testpfad getrennt

#### Scenario: Bestehende Umgebung bleibt im kontinuierlichen Betrieb geschützt

- **WHEN** ein Seed-, Test- oder Routine-Betriebspfad gegen eine bestehende Umgebung mit bereits gesetzten Identitätsfeldern läuft
- **THEN** werden `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id` und `tenant_admin_client_id` standardmäßig nicht still überschrieben
- **AND** bleibt die Umgebung für kontinuierliche lokale oder staging-nahe Tests stabil

### Requirement: Bestehende staging-nahe Umgebungen erhalten sichtbare Drift-Guardrails fuer Identitaetsfelder

Das System SHALL für bestehende staging-nahe Umgebungen sichtbare Guardrails bereitstellen, wenn Bootstrap- oder Seed-Pfade auf abweichende geschützte Identitätswerte treffen.

#### Scenario: Abweichende Zielwerte werden sichtbar statt still übernommen

- **WHEN** ein Bootstrap-, Seed- oder Reconcile-Pfad auf eine bestehende staging-nahe Umgebung mit bereits belegten geschützten Identitätsfeldern trifft
- **AND** der Zielwert von `parent_domain`, `primary_hostname`, `auth_realm`, `auth_client_id` oder `tenant_admin_client_id` abweicht
- **THEN** wird die Abweichung mindestens als sichtbare Warnung oder harter Fehler ausgewiesen
- **AND** der Pfad übernimmt die neue Identität nicht stillschweigend als Standardverhalten
