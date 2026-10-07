# Design: Bestehenden Tenant-Admin sicher übernehmen

## Ziel und unmittelbarer Verbraucher

Der Production Studio-MCP soll einen bereits vorhandenen
`admin@smart-village.app` für eine ausgewählte Bestands-Instanz weiterverwenden
können. Die Ausnahme gilt ausschließlich für den `tenant_admin`-Artefakttyp und
muss vom berechtigten Operator ausdrücklich pro Tenant im Draft bestätigt
werden.

## Invarianten und Nachweis

| ID     | Invariante                                                                                                                                                                                       | Geplanter Nachweis                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| ADM-01 | Ohne explizite Übernahmefreigabe blockiert ein unmarkierter Admin weiterhin.                                                                                                                     | Readiness- und Plan-Test für Standardfall ohne Freigabe.                                                                           |
| ADM-02 | Eine Übernahme wird ausschließlich über die normalisierte, realmweit eindeutige E-Mail aufgelöst; der bestehende Username bleibt erhalten.                                                       | Positive Tests mit abweichendem konfiguriertem Username; negative Tests für abweichende E-Mail, fehlenden Wert und Mehrdeutigkeit. |
| ADM-03 | Execute bindet die Übernahme an die im bestätigten Plan gelesene Benutzeridentität und bricht bei geändertem Readback ab.                                                                        | Race-Test zwischen Readiness, Planbestätigung und Worker-Ausführung.                                                               |
| ADM-04 | Studio setzt ausschließlich `system_admin` und die eigenen Ownership-Attribute; es setzt kein `instance_registry_admin` und erhält Passwort, Enabled-Status, fremde Rollen und fremde Attribute. | Adapter-/Execution-Readback-Tests für Rollen, Credentials, Status und Attribute.                                                   |
| ADM-05 | Ownership-Marker gelten nur für die ausgewählte `instanceId`; andere Instanzen können den Account nicht übernehmen.                                                                              | Cross-instance-Test mit identischer E-Mail in anderem Realm-Kontext.                                                               |
| ADM-06 | Vorhandene unmarkierte Clients und Rollen bleiben weiterhin blockiert; fehlende Studio-Clients dürfen gemäß bestehendem Plan erstellt werden.                                                    | Regressionstests für Client-/Rollen-Konflikte und Readiness der 50 fehlenden Clients.                                              |
| ADM-07 | Passwörter und Client-Secrets erscheinen weder in Plan, MCP-Antwort, Audit-Details noch Logs.                                                                                                    | Redaction- und Fingerprint-Tests.                                                                                                  |
| ADM-08 | Ein erfolgreicher Bootstrap oder technischer Smoke aktiviert keinen Tenant.                                                                                                                      | Lifecycle-Test: Status bleibt bis zur separaten Aktivierung unverändert.                                                           |

Die Identitätsprüfung muss im Worker erneut erfolgen. Eine positive Readiness
allein berechtigt nicht zur Übernahme. Ein Passwort-Reset ist ein eigener
Keycloak-Schritt und wird nicht Bestandteil der Adoption-Mutation.

## Ausführungsgrenze

Der bestehende Pfad `draft readiness → Registry-Sollzustand → bestätigter
Provisioning-Plan → Worker → Readback` bleibt maßgeblich. Die Freigabe wird im
MCP-/Registry-Vertrag explizit transportiert und in den Fingerprint des
Sollzustands aufgenommen. Der Worker schreibt die Ownership-Marker erst nach
erneuter Identitätsprüfung. Bei jeder Abweichung gilt fail-closed.

Für die CSV-Tenanten wird danach derselbe bereits bestehende Provisioning-Plan
mit `realmMode=existing`, Studio-Login-Client `sva-studio-login`,
Tenant-Admin-Client `sva-studio-realm-admin`, dem freigegebenen Admin-Profil
und genau den Modulen `news`, `events`, `poi`, `media`, `categories`
verwendet. Die Mainserver-Client-Secrets aus der CSV werden dabei nicht als
Studio-Credentials verwendet oder ausgegeben.

## Risiken und Failure Modes

- Der konfigurierte Benutzername ist für die Übernahme unerheblich; der bestehende Keycloak-Username bleibt unverändert.
- Die E-Mail kann nach dem Plan geändert werden: Execution scheitert vor der
  ersten Mutation.
- Ein vorhandener Admin ist deaktiviert: den Status erhalten; kein implizites
  Reaktivieren.
- Ein Benutzer kann fremde Rollen oder Attribute tragen: diese bleiben
  erhalten; Studio setzt nur seine eigenen Attribute und die eigene Rolle.
- Ein Plan kann durch parallele Änderungen veralten: Fingerprint ablehnen und
  neuen read-only Plan verlangen.
- Ein Tenant kann erfolgreich provisioniert, aber noch nicht betriebsbereit
  sein: keine automatische Aktivierung; Status und offene SMTP-/Login-Prüfungen
  bleiben separat sichtbar.

## Liefergrenze

Es wird weder ein neuer Provider noch ein Batch-Workflow eingeführt. Die 50
MCP-Aufrufe verwenden den vorhandenen Einzelinstanzpfad mit stabilen
Idempotenzschlüsseln. Nach dem Code-Rollout werden Readiness und Pläne erneut
für alle 50 Realms gelesen, bevor ein Provisionierungslauf gestartet wird.
