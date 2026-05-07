## MODIFIED Requirements
### Requirement: Zentrale Instanz-Registry

Das System SHALL eine zentrale Registry für Studio-Instanzen bereitstellen, die Tenant-Identität, Hostnamen, Lebenszyklusstatus und Basis-Konfiguration führt. Persistenzverträge und SQL-nahe Registry-Zugriffe haben dafür genau eine führende Ownership in der Datenzugriffsschicht; paketinterne Komfortkanten dürfen diese Verträge nur delegierend weiterreichen.

#### Scenario: Führende Persistenz-Ownership für die Registry ist eindeutig

- **WHEN** Instanz-Registry-Daten aus fachlichen Services, Runtime oder Admin-Pfaden gelesen oder geschrieben werden
- **THEN** stammen SQL-nahe Registry-Verträge und deren Implementierung aus genau einer führenden Persistenzschicht
- **AND** führen nachgelagerte Komfort- oder Aggregator-Packages keine parallel gepflegte Registry-Implementierung mehr
- **AND** können neue Registry-Felder nicht stillschweigend nur in einem von zwei Pfaden wirksam werden

#### Scenario: Aktive Instanz ist in der Registry beschrieben

- **WHEN** eine Studio-Instanz produktiv erreichbar sein soll
- **THEN** existiert ein Registry-Eintrag mit `instanceId`, `status`, `primaryHostname` und den benötigten Basis-Metadaten
- **AND** enthält der Auth-Vertrag mindestens `authRealm`, `authClientId` und `tenantAdminClient`
- **AND** kann die Runtime daraus Tenant-Kontext, Login-Konfiguration und Tenant-Admin-Konfiguration getrennt ableiten
