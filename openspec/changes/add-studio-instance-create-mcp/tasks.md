## 1. Spezifikation und Architektur

- [ ] 1.1 Service-Token-Aussteller, Claims und Rotationsprozess verbindlich festlegen.
- [ ] 1.2 Action-ID und Rollenbindung für `instance.create` im IAM-Modell festlegen.
- [ ] 1.3 Action-ID-Matrix und Least-Privilege-Scopes für alle MCP-Lese-, kontrollierten und kritischen Mutationen festlegen.
- [ ] 1.4 Die betroffenen arc42-Abschnitte 03, 04, 05, 06, 08 und 09 aktualisieren; erforderliche ADR für das neue IAM-Pattern ergänzen.

## 2. Studio-Service-Token-Pfad

- [ ] 2.1 Service-Token gegen Aussteller, Audience, Ablauf und Berechtigung fail-closed validieren.
- [ ] 2.2 Ausschließlich für die MCP-Instanzanlage den Maschinenakteur serverseitig in den bestehenden Instanz-Anlagepfad einbinden.
- [ ] 2.3 Audit und Korrelation um Authentisierungsart und Token-Subject ergänzen, ohne Geheimnisse zu speichern.
- [ ] 2.4 Browser-Session-, CSRF- und Fresh-Reauth-Guards unverändert gegen Regression absichern.
- [ ] 2.5 Einen versionierten Fehlervertrag für die Instanzanlage mit stabilem Code, Kategorie, Wiederholbarkeit, Folgeaktion und Korrelation definieren.
- [ ] 2.6 Den Create-Handler an dieselbe Fehlerklassifikation wie übrige Mutationen anbinden; unbekannte Fehler als `internal_unclassified` behandeln.
- [ ] 2.7 Serverseitige Confirmation-Challenges für kritische MCP-Actions mit Ablauf, einmaligem Verbrauch und atomarer Zustands-/Versionsprüfung implementieren.

## 3. Lokales MCP-Tool

- [ ] 3.1 Neues Workspace-Package für den lokalen stdio-MCP-Server anlegen und in Codex konfigurierbar machen.
- [ ] 3.2 `studio_instances_create` mit dem bestehenden Create-Schema, Idempotenz und Korrelation implementieren.
- [ ] 3.3 Basis-URL und Service-Token nur aus lokaler, nicht versionierter Konfiguration beziehen und Secrets redigieren.
- [ ] 3.4 Sichere Ergebnis- und Fehlerverträge für Erfolg, Duplikat, Authentisierungs- und Validierungsfehler implementieren.
- [ ] 3.5 Nach Fehlern eine zeitlich begrenzte, kontextabhängige Read-only-Diagnose ausführen und Primärfehler sowie Diagnose-Evidenz getrennt ausgeben.
- [ ] 3.6 Read- und Diagnose-Tools für Instanzliste, Detail, Audit, aggregierte Diagnose sowie Provisioning-Run bereitstellen.
- [ ] 3.7 Kontrollierte Mutations-Tools für Update, Provisioning, Reconcile, Modulzuweisung, IAM-Seeding und Admin-Bootstrap bereitstellen.
- [ ] 3.8 Kritische Mutations-Tools für Statuswechsel, Modulentzug und Secret-Rotation mit Challenge- und Phrase-Vertrag bereitstellen.

## 4. Verifikation und Betrieb

- [ ] 4.1 Unit-Tests für Tool-Schema, Idempotenz, Header, Redaction und Fehlerklassifikation ergänzen.
- [ ] 4.2 API-Integrationstests für gültige, abgelaufene, falsch gebundene und unberechtigte Service-Tokens ergänzen.
- [ ] 4.3 MCP-Integrationstest mit einer Stub-Studio-API ergänzen.
- [ ] 4.4 Fehler- und Diagnosematrix einschließlich Redaction, Timeouts, Teilfehlern und unbekannten Ausnahmen testen.
- [ ] 4.5 Autorisierung, Challenge-Ablauf, Replay, Race, Zustandswechsel und Bestätigungsphrase für jede kritische Action testen.
- [ ] 4.6 Deutsche Betriebsdokumentation für Token-Ausstellung, Rotation, lokale Konfiguration, Tool-Aufruf, Fehlercodes und kritische Bestätigungen ergänzen.
- [ ] 4.7 Relevante Nx-Unit-, Type-, Runtime- und Sicherheits-Gates ausführen.
