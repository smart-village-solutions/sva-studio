## 1. Spezifikation und Architektur

- [x] 1.1 Keycloak in den Root-Realms `studio-dev`, `studio-staging` und `sva-studio` als Service-Token-Aussteller sowie Claims und Rotationsprozess verbindlich festlegen.
- [x] 1.2 Action-ID und Rollenbindung für `instance.create` im IAM-Modell festlegen.
- [x] 1.3 Action-ID-Matrix und Least-Privilege-Scopes für alle MCP-Lese-, kontrollierten und kritischen Mutationen festlegen.
- [x] 1.4 Die betroffenen arc42-Abschnitte 03 bis 10 aktualisieren und ADR-047 für das neue IAM- und Risikopolicy-Pattern ergänzen.

## 2. Studio-Service-Token-Pfad

- [x] 2.1 Service-Token gegen Aussteller, Audience, Ablauf und Berechtigung fail-closed validieren.
- [x] 2.2 Ausschließlich für die Instanz-Registry den Maschinenakteur serverseitig in die bestehenden Lese- und Mutationspfade einbinden.
- [x] 2.3 Audit und Korrelation um Authentisierungsart und Token-Subject ergänzen, ohne Geheimnisse zu speichern.
- [x] 2.4 Browser-Session-, CSRF- und Fresh-Reauth-Guards unverändert gegen Regression absichern.
- [x] 2.5 Einen versionierten Fehlervertrag für die Instanzanlage mit stabilem Code, Kategorie, Wiederholbarkeit, Folgeaktion und Korrelation definieren.
- [x] 2.6 Den Create-Handler an dieselbe Fehlerklassifikation wie übrige Mutationen anbinden; unbekannte Fehler als `internal_unclassified` behandeln.
- [x] 2.7 Serverseitige Confirmation-Challenges für kritische MCP-Actions mit Ablauf, einmaligem Verbrauch und atomarer Zustands-/Versionsprüfung implementieren.

## 3. Lokales MCP-Tool

- [x] 3.1 Neues Workspace-Package für den lokalen stdio-MCP-Server anlegen und in Codex konfigurierbar machen.
- [x] 3.2 `studio_instances_create` mit dem bestehenden Create-Schema, Idempotenz und Korrelation implementieren.
- [x] 3.3 Basis-URL und Service-Token nur aus lokaler, nicht versionierter Konfiguration beziehen und Secrets redigieren.
- [x] 3.4 Sichere Ergebnis- und Fehlerverträge für Erfolg, Duplikat, Authentisierungs- und Validierungsfehler implementieren.
- [x] 3.5 Nach Fehlern eine zeitlich begrenzte, kontextabhängige Read-only-Diagnose ausführen und Primärfehler sowie Diagnose-Evidenz getrennt ausgeben.
- [x] 3.6 Read- und Diagnose-Tools für Instanzliste, Detail, Audit, aggregierte Diagnose sowie Provisioning-Run bereitstellen.
- [x] 3.7 Kontrollierte Mutations-Tools für Update, Provisioning, Reconcile, Modulzuweisung, IAM-Seeding und Admin-Bootstrap bereitstellen.
- [x] 3.8 Kritische Mutations-Tools für Statuswechsel, Modulentzug und Secret-Rotation mit Challenge- und Phrase-Vertrag bereitstellen.

## 4. Verifikation und Betrieb

- [x] 4.1 Unit-Tests für Tool-Schema, Idempotenz, Header, Redaction und Fehlerklassifikation ergänzen.
- [x] 4.2 API-Integrationstests für gültige, abgelaufene, falsch gebundene und unberechtigte Service-Tokens ergänzen.
- [x] 4.3 MCP-Integrationstest mit einer Stub-Studio-API ergänzen.
- [x] 4.4 Fehler- und Diagnosematrix einschließlich Redaction, Timeouts, Teilfehlern und unbekannten Ausnahmen testen.
- [x] 4.5 Autorisierung, Challenge-Ablauf, Replay, Race, Zustandswechsel und Bestätigungsphrase für jede kritische Action testen.
- [x] 4.6 Deutsche Betriebsdokumentation für Token-Ausstellung, Rotation, lokale Konfiguration, Tool-Aufruf, Fehlercodes und kritische Bestätigungen ergänzen.
- [x] 4.7 Relevante Nx-Unit-, Type-, Runtime- und Sicherheits-Gates ausführen.
- [x] 4.8 Rolloutreihenfolge `studio-dev` → `studio-staging` → `sva-studio`, Secret-Rotation, OTEL-Abnahmekriterien und Kill-Switch-Rollback dokumentieren.

## 5. Prozessketten-Logging

- [x] 5.1 Typisierten, PII-/secret-sicheren Fehlerkontext und PostgreSQL-Allowlist implementieren.
- [x] 5.2 Create-Schritte vom Lookup bis zur Cache-Invalidierung stufengenau und ohne doppelte Error-Events korrelieren.
- [x] 5.3 Queue und Worker mit stabilen Stufen für Claim, Preflight, Plan, Keycloak, Secret-Sync, Admin-Bootstrap und Abschluss vereinheitlichen.
- [x] 5.4 Rohe Provider- und Fehlermeldungen aus Provisioning-, Audit- und Worker-Logs entfernen und Redaction-Verträge testen.

## 6. Modularer MCP-Instanzprozess und Doctor-Abnahme

- [x] 6.1 Den Prozessvertrag für `create`, `repair` und `adapt` mit verständlichen Schritt-, Ergebnis- und Folgeaktionsmodellen implementieren.
- [x] 6.2 Den Worker um einen persistierten Keycloak-Postflight erweitern und verhindern, dass historische Preflight-Evidenz den aktuellen Doctor-Zustand übersteuert.
- [x] 6.3 Tenant-IAM-Rechteprobe und instanzbezogenen Rollenabgleich als sichere, korrelierte Prozessschritte verfügbar machen.
- [x] 6.4 Das MCP-Tool für den Gesamtprozess sowie gezielte Diagnose- und Folgeaktionen ergänzen; Erfolg nur bei aktivem, vollständig grünem Doctor melden.
- [x] 6.5 Human-in-the-Loop-Zustände mit verständlicher Erklärung, konkreter nächster Action und weiterhin challenge-geschützter Aktivierung ausgeben.
- [x] 6.6 Unit-, API- und MCP-Vertragstests für Neuanlage, Reparatur, Modulerweiterung, Teilfehler, Postflight und Human-in-the-Loop-Abschluss ergänzen.
- [x] 6.7 Architektur-, Betriebs- und MCP-Dokumentation für den Gesamtprozess sowie seine sicheren Folgeaktionen aktualisieren.
