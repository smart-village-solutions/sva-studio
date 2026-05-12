## Kontext

Externe technische Schnittstellen sind im Studio keine Fachfunktion eines einzelnen Plugins, sondern eine Querschnitts-Capability. Der Host muss Persistenz, Secret-Schutz, Default-Auflösung, Diagnose und Sicherheitsgrenzen kontrollieren. Gleichzeitig sollen Plugins künftig zusätzliche Typmetadaten deklarieren können, ohne direkte DB- oder Secret-Zugriffe zu erhalten.

## Entscheidungen

### Host-owned Registry

- `iam.external_interface_types` hält den globalen Typkatalog.
- `iam.instance_external_interfaces` hält instanzgebundene Konfigurationen.
- Secrets werden als verschlüsselter JSON-Block gespeichert.
- Die AAD bindet Secrets an den konkreten Interface-Datensatz.

### Runtime-Verträge

- `@sva/core` trägt die kanonischen Typen.
- `@sva/server-runtime` löst Instanzschnittstellen fail-closed auf.
- `@sva/data-repositories` bleibt die einzige DB-nahe Zugriffsschicht.

### Plugin-Grenze

- Plugins dürfen zusätzliche `externalInterfaceTypes` deklarieren.
- Persistenz, Secret-Auflösung, Resolver, Audit und Health-Checks bleiben host-owned.

### Migration

- Bestehende `sva_mainserver`-Einträge aus `iam.instance_integrations` werden in die neue Registry kopiert.
- Mainserver-Leser und `/interfaces` schreiben ab diesem Change in die neue Registry.
