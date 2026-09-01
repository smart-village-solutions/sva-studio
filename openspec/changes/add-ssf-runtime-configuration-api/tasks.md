## 1. Generischer interner Servicevertrag

- [ ] 1.1 Manifest- und Handlervertrag für interne Plugin-Service-Endpunkte definieren
- [ ] 1.2 Generischen Service-Execution-Context mit gebundenem Tenant-Scope definieren
- [ ] 1.3 Stabile Auth-, Scope-, Replay- und Readiness-Fehlercodes festlegen

## 2. Service-Identität und Tenant-Assertion

- [ ] 2.1 Bestehende JWT-/JWKS-Prüfung für konfigurierbare interne Service-Clients wiederverwenden
- [ ] 2.2 Issuer-, Audience-, Action- und Client-Bindung implementieren
- [ ] 2.3 Signierte Tenant-Assertion mit `instanceId`, Ablaufzeit und Token-ID validieren
- [ ] 2.4 Host-owned Replay-Schutz und Schlüsselrotation implementieren
- [ ] 2.5 Rate Limit, PII-arme Auditierung und Readiness ergänzen

## 3. SSF-Runtime-Konfiguration

- [ ] 3.1 Minimales versioniertes Konfigurationsschema und Revision definieren
- [ ] 3.2 Internen SSF-Service-Handler über den generischen Vertrag registrieren
- [ ] 3.3 Tenantgebundenes RLS-Repository für den Konfigurationsabruf implementieren
- [ ] 3.4 Aktivierungs-, Suspendierungs- und Plugin-Readiness-Gates integrieren
- [ ] 3.5 Sicherstellen, dass Responses keine Secrets, IAM-Interna oder Fremdtenantdaten enthalten

## 4. Security- und Integrationstests

- [ ] 4.1 Positivtest für gültige Service-Identität und Tenant-Assertion ergänzen
- [ ] 4.2 Negativtests für freie `instanceId`, falsche Audience, falschen Client und fremden Tenant ergänzen
- [ ] 4.3 Negativtests für Ablauf, Replay, Signatur, deaktiviertes Plugin und suspendierten Tenant ergänzen
- [ ] 4.4 Browserzugriff und Customer-Session-Token am Studio-Endpoint ablehnen

## 5. Betrieb, Architektur und Abnahme

- [ ] 5.1 Deployment-Secrets, Key-Rotation, Replay-Speicher und Readiness dokumentieren
- [ ] 5.2 Betroffene arc42-Abschnitte und ADR für Service-Identität/Tenant-Assertion aktualisieren
- [ ] 5.3 Unit-, Type-, Server-Runtime-, Integrations-, Security- und E2E-Gates ausführen
- [ ] 5.4 Abnahme mit zwei Tenants sowie positiven und negativen Scope-Fällen dokumentieren
- [ ] 5.5 `openspec validate add-ssf-runtime-configuration-api --strict`, Dokumentations- und Platzierungschecks ausführen
