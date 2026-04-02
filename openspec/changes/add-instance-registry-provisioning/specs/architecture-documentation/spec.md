## MODIFIED Requirements

### Requirement: Nachvollziehbare Architekturentscheidungen

Das System SHALL Architekturentscheidungen mit Kontext, Begruendung und Auswirkungen dokumentieren.

#### Scenario: Deployment- und Auth-Grenzen mit Architekturwirkung

- **WHEN** ein Change Deployment-Topologie, Host-Ableitung oder Auth-Grenzen veraendert
- **THEN** referenziert der Change mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Architekturentscheidungen, Qualitaetsanforderungen und Risiken
- **AND** dokumentiert, ob eine neue ADR erforderlich ist oder welche bestehende ADR fortgeschrieben wird

#### Scenario: Registry- und Provisioning-Modell mit Architekturwirkung

- **WHEN** ein Change die autoritative Quelle fuer Tenant-Freigaben von Runtime-Env auf eine zentrale Registry verlagert oder einen Provisioning-Lebenszyklus einfuehrt
- **THEN** referenziert der Change mindestens die arc42-Abschnitte `04`, `05`, `06`, `07`, `08`, `09`, `10` und `11`
- **AND** verlinkt fuer jeden referenzierten Abschnitt den konkreten Dokumentpfad unter `docs/architecture/` mit kurzer Aenderungszusammenfassung
- **AND** dokumentiert die Zieltopologie "ein Deployment, viele Tenant-Hosts" explizit
- **AND** beschreibt die Steuerung neuer Instanzen ueber eine Control Plane oder einen gleichwertigen Ops-Pfad
- **AND** benennt eine neue oder fortgeschriebene ADR mit konkreter ADR-ID

## ADDED Requirements

### Requirement: Architektur- und Betriebsdoku fuer Registry-basierten Tenant-Lebenszyklus

Das System SHALL den Registry-basierten Tenant-Lebenszyklus und den Provisioning-Vertrag konsistent in Architektur- und Betriebsdokumentation verankern.

#### Scenario: Neue Instanz wird ueber die Dokumentation nachvollziehbar angelegt

- **WHEN** ein Teammitglied den Prozess fuer eine neue Studio-Instanz nachschlaegt
- **THEN** beschreiben Architektur- und Betriebsdoku die Schritte Validierung, Provisioning, Aktivierung, Smoke-Check und Auditierung konsistent
- **AND** benennen die beteiligten technischen Systeme wie Registry, Auth, Integrationen und Deploy-/Ops-Pfade

#### Scenario: Registry ersetzt env-basierte Tenant-Freigabe im Zielbild

- **WHEN** die Dokumentation das produktive Multi-Tenant-Modell beschreibt
- **THEN** wird die zentrale Registry als fuehrende Freigabequelle genannt
- **AND** env-basierte Tenant-Freigaben werden als lokaler oder migrierender Sonderfall eingeordnet
