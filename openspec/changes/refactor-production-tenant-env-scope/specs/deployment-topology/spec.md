## MODIFIED Requirements

### Requirement: Env-gesteuerte Allowlist für gültige Instanz-Hosts

Das System SHALL für Production-Tenant-Lebenszyklen die zentrale Instanz-Registry als führende Quelle verwenden. `SVA_ALLOWED_INSTANCE_IDS` darf weder den Candidate-Preflight noch den Bootstrap noch die Production-Runtime-Konfiguration als Tenant-Scope steuern. Die Variable bleibt ausschließlich für lokale oder migrationsbezogene Fallback-Pfade zulässig.

#### Scenario: Aktivierung eines bereits gerouteten Tenants

- **WHEN** ein in der bestehenden Traefik-Hostliste enthaltener Tenant in der Registry aktiviert, suspendiert oder archiviert wird
- **THEN** folgt dessen fachliche Freigabe ausschließlich dem Registry-Status
- **AND** ist keine Änderung der Runtime-Konfiguration oder ein Application-Deploy erforderlich

#### Scenario: Lokaler Fallback verwendet eine explizite Allowlist

- **WHEN** ein lokaler oder migrationsbezogener Fallback ohne Registry-Verbindung ausgeführt wird
- **THEN** darf er eine syntaktisch validierte `SVA_ALLOWED_INSTANCE_IDS`-Liste verwenden
- **AND** wird diese Liste nicht als Production-Tenant-Scope publiziert oder in den Production-Stack übertragen

#### Scenario: Candidate-Preflight validiert aktive Registry-Tenants

- **WHEN** ein Candidate-Preflight läuft
- **THEN** prüft er lesbare tenant-spezifische Secrets für alle und nur die aktiven Registry-Tenants
- **AND** blockiert keine Freigabe wegen einer abweichenden Env-Tenantliste

#### Scenario: Bootstrap bewahrt Tenant-Lebenszyklen

- **WHEN** ein Bootstrap läuft
- **THEN** erzeugt, aktiviert oder verändert er keine Tenant-Registry-Datensätze aus `SVA_ALLOWED_INSTANCE_IDS`
- **AND** reconciled er nur die vorgesehenen abgeleiteten Berechtigungs- und Hostname-Integritätsdaten vorhandener aktiver Registry-Tenants
