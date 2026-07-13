## ADDED Requirements

### Requirement: Lokaler MCP-Steuerungspfad für Instanzanlage

Das System SHALL berechtigten lokalen Codex- oder CLI-Operatoren einen stdio-basierten MCP-Steuerungspfad für die Anlage neuer Studio-Instanzen bereitstellen. Der MCP-Pfad verwendet ausschließlich den bestehenden fachlichen Instanz-Anlagevertrag und führt weder direkte Datenbank- noch Keycloak-Mutationen aus.

#### Scenario: MCP-Tool legt Instanz über den bestehenden Provisioning-Vertrag an

- **WHEN** ein berechtigter lokaler Operator `studio_instances_create` mit einer gültigen Instanzkonfiguration aufruft
- **THEN** validiert das Tool den bestehenden Create-Vertrag und ruft die konfigurierte Studio-API auf
- **AND** verwendet Studio denselben fachlichen Provisioning-Pfad wie die Control-Plane
- **AND** liefert das Tool Instanz-ID, primären Host, Status und Korrelation zurück
- **AND** bleibt die neue Instanz im Status `requested`, bis getrennte Folgeaktionen ausgeführt werden

#### Scenario: Wiederholter MCP-Aufruf ist idempotent

- **WHEN** der lokale Operator denselben Idempotenz-Key mit derselben Instanzkonfiguration erneut verwendet
- **THEN** führt Studio keine doppelte Instanzanlage aus
- **AND** liefert das Tool ein deterministisches Ergebnis oder den bereits bestehenden fachlichen Zustand zurück

#### Scenario: MCP-Tool schützt Geheimnisse

- **WHEN** Eingabe oder Studio-Antwort Auth-Client- oder Tenant-Admin-Secrets enthalten könnte
- **THEN** gibt das MCP-Tool diese Werte weder in Erfolgs- noch Fehlerantworten zurück
- **AND** protokolliert es diese Werte nicht lokal

### Requirement: Handlungsfähige Fehlerdiagnose für MCP-Instanzanlage

Das System SHALL für die MCP-Instanzanlage einen stabilen, maschinenlesbaren Fehlervertrag bereitstellen und nach Fehlern eine begrenzte, kontextabhängige Read-only-Diagnose ergänzen. Der Vertrag enthält mindestens Fehlercode, Kategorie, Wiederholbarkeit, empfohlene Folgeaktion und Korrelation. Die Diagnose darf keine Mutation oder automatische Reparatur ausführen.

#### Scenario: Fehler liefert stabile Ursache und sichere Folgeaktion

- **WHEN** eine MCP-Instanzanlage wegen Eingabe, Konflikt, Plattform-Readiness, Abhängigkeit oder eines internen Fehlers scheitert
- **THEN** erhält der MCP-Client einen stabilen Fehlercode, Kategorie, Wiederholbarkeitsangabe, Folgeaktion sowie Request- und Idempotenz-Korrelation
- **AND** bleibt ein unbekannter Fehler als nicht klassifiziert erkennbar und wird nicht pauschal als Keycloak-Fehler ausgegeben

#### Scenario: MCP ergänzt nach einem Fehler passende Read-only-Evidenz

- **WHEN** eine MCP-Instanzanlage scheitert
- **THEN** prüft der MCP-Client innerhalb eines begrenzten Diagnosebudgets nur zur Fehlerklasse passende Read-only-Evidenz
- **AND** bleibt die ursprüngliche Fehlerursache maßgeblich, falls die Diagnose selbst fehlschlägt oder abläuft
- **AND** enthält die Diagnose keine Geheimnisse, Stacktraces oder nicht erforderlichen Infrastrukturdetails

#### Scenario: Diagnose löst keine automatische Mutation aus

- **WHEN** die Diagnose einen reparierbaren Befund erkennt
- **THEN** gibt der MCP-Client ausschließlich eine empfohlene Folgeaktion aus
- **AND** wiederholt, repariert, provisioniert oder aktiviert er die Instanz nicht selbsttätig

### Requirement: Dreistufige MCP-Instanz-Control-Plane

Das System SHALL die vorhandenen Instanzverwaltungs- und Provisioning-Fähigkeiten über getrennte MCP-Tools für Lesen und Diagnose, kontrollierte Mutationen sowie kritische Mutationen bereitstellen. Die Tools verwenden ausschließlich die bestehenden fachlichen Registry- und Provisioning-Verträge.

#### Scenario: Diagnose-Tools lesen den Instanzzustand ohne Mutation

- **WHEN** ein berechtigter MCP-Client Instanzen, Instanzdetails, Audits, Provisioning-Runs oder eine aggregierte Instanzdiagnose abruft
- **THEN** liefert das System die relevante Read-only-Evidenz ohne fachliche Mutation
- **AND** priorisiert eine aggregierte Diagnose eine sichere nächste Aktion

#### Scenario: Kontrollierte MCP-Mutation verwendet vorhandenen Fachvertrag

- **WHEN** ein berechtigter MCP-Client Provisioning ausführt, reconciled, eine Instanz aktualisiert, ein Modul zuweist, die IAM-Basis seedet oder die Admin-Struktur bootstrappt
- **THEN** verwendet Studio den jeweils bestehenden fachlichen Vertrag
- **AND** erzwingt der Request einen action-spezifischen Scope, Idempotenz und Audit-Korrelation

#### Scenario: Kritische MCP-Mutation erfordert serverseitige Bestätigung

- **WHEN** ein MCP-Client eine Instanz aktiviert, suspendiert, archiviert, ein Modul entzieht oder ein Secret rotiert
- **THEN** verlangt Studio einen action-spezifischen Scope, eine gültige aktuelle Bestätigungs-Challenge, einen Idempotenz-Key und eine explizite Bestätigungsphrase
- **AND** lehnt Studio eine abgelaufene, wiederverwendete oder durch Zustandsänderung ungültig gewordene Challenge fail-closed ab
- **AND** wird die Mutation einschließlich Bestätigung und Ergebnis append-only auditiert
