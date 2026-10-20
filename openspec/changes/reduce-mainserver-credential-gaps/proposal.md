# Change: Vorhandene Mainserver-Credentials still wiederherstellen

## Why

[Issue #1908](https://github.com/smart-village-solutions/sva-studio/issues/1908) beschreibt blockierte Nachrichtenaktualisierungen in Prignitz. Die lesende Loki-Prüfung vom 20.10.2026 ergab im Fenster 17.10., 09:06:11 bis 20.10., 09:06:11 Europe/Berlin insgesamt 93 Projektionswarnungen: 69 für Prignitz und 24 für Linz am Rhein. Die zusätzlich untersuchten drei Kategorienfehler samt drei Credential-Warnungen gehören zu Linz am Rhein. In Prignitz scheiterten vier manuelle Aktualisierungen mit beziehungsweise ohne Organisationskontext; 65 weitere Meldungen stammen vom Scheduler. Die untersuchten Serien halten den vorhandenen Cooldown mit 15–16 Minuten Abstand ein. Die individuelle Credential-Ursache und der damalige Deployment-Digest sind nicht nachgewiesen; ausbleibende spätere Warnungen beweisen keine Wiederherstellung.

Studio liest persönliche Credentials aus Keycloak und organisatorische Credentials aus der Studio-Datenbank. Der technische Organisationsaccount enthält eine zusätzliche Keycloak-Kopie. Die Schreibreihenfolge Datenbank → Keycloak sowie manuelle Datenbankänderungen erlauben abweichende Kopien; Keycloak ist deshalb keine pauschal führende Organisationsquelle. Bestehende verifizierte DataProvider-Bindings erlauben den Nachweis einer exakten bekannten Credential-Version.

## What Changes

- Studio versucht bei einem passenden Credential-Fehler still und begrenzt eine Wiederherstellung im bestehenden authentifizierten POST-Refreshpfad. GET, Login, Listenpolling und Scheduler schreiben keine Credentials.
- Persönlich: vorhandene Attribute einmal frisch aus dem instanzgebundenen Keycloak lesen und den Inhaltsabruf bei vollständigen Credentials einmal wiederholen. Der Reader liest bereits direkt; ein Credential-Cache wird nicht als belegte Ursache behauptet.
- Organisatorisch: ausschließlich einen lokalen Verlust derselben bekannten, zuvor verifizierten Version aus dem eindeutig zugeordneten Keycloak-Account zurücksichern. Vorhandene vollständige abweichende Daten, unklare Zuordnung oder Verifikations-/Konfliktzustände führen zum Supportpfad statt automatischer Synchronisation.
- Nach erfolgreichem Credential-Read-back den aktuellen autorisierten Inhaltsabruf genau einmal erneut versuchen. Rücksicherung und erfolgreicher Inhaltsabruf bleiben getrennte Ergebnisse.
- Bei nicht möglicher Wiederherstellung oder verbleibendem Fehler eine präzise verständliche Meldung mit kopierbarem Diagnoseblock und Empfänger `support@smart-village.solutions` anzeigen; keine automatische E-Mail.

## Scope Boundaries

Ziel ist die Verringerung vermeidbarer blockierter Inhaltsabgleiche durch erneutes Lesen vorhandener Credentials beziehungsweise eng begrenzte lokale Rücksicherung und einen erneuten Inhaltsabruf. Maximal betroffen sind vorhandene Credential-Reader, Organisations-Credential-Persistenz und Binding-Prüfung, POST-Projektionsrefresh sowie bestehende Inhaltsstatus-/Fehlerflächen und zugehörige Tests/Dokumentation.

Keine Mainserver-Neuprovisionierung, kein Aufruf von `user_provisionings`, keine Credential-Rotation, keine Keycloak-Writes, keine Accountanlage oder automatische Wiederzuordnung, keine Rollen-/Ownership-Änderung und kein neuer technischer Wiederherstellungszugang. Die vorhandene technische Keycloak-Verbindung dient nur dem Lesen. Kein fremder Principal-, Shared- oder Bootstrap-Fallback. Kein bidirektionaler Synchronisationsmechanismus, keine neuen Tabellen, Worker, Dienste oder Freischaltkonfigurationen. Der 15-Minuten-Cooldown, bestehende Autorisierung und Lesesichten bleiben erhalten. Der Change behauptet keine bereits erfolgte Behebung von Prignitz.

## Coordination and Impact

- Specs: `sva-mainserver-integration`, `iam-organizations`, `content-management`. Der Organisations-Delta ist nötig, weil die neue eng begrenzte lokale Rücksicherung einen bestehenden Persistenzvertrag erweitert; der unmittelbare Verbraucher bleibt der vorhandene Refreshpfad.
- `enforce-mainserver-credential-readiness` bleibt für Readiness/Cooldown zuständig und schließt Recovery bislang aus; dieser Change ergänzt diese Fähigkeit. Die offene Abnahme aus `verify-mainserver-credential-readiness-rollout` wird nicht als erledigt übernommen. Bestehende Provisioning- und Ownership-Changes werden nicht erweitert.
- Bestehende Pfade: `packages/auth-runtime/src/mainserver-credentials.ts`, `mainserver-effective-credentials.ts`, `iam-contents/mainserver-data-provider-bindings.ts`, Organisations-Credential-Repositories in `packages/iam-admin`, `apps/sva-studio-react/src/lib/iam-content-list-projection-*`, `hooks/use-contents.ts` und `routes/content/`.
- Bestehenden Runtime-Diagnosevertrag, Projektions-Sync-State, Organisationslease und sichere Audit-/Fehlerpfade erweitern; kein paralleles Recovery-Statusmodell. Vor DB-Schreibänderungen Schema-Snapshot und Schemaübersicht prüfen; keine Schemaänderung geplant.
- Bei Umsetzung arc42 04/05/06/08 prüfen und betroffene Aussagen fortschreiben, insbesondere lokale Rücksicherung und Auth-/Fehlergrenzen in 06/08. Ein neues IAM-Pattern erfordert die bestehende ADR-Regel; kein eigenständiges Recovery-Framework. Dieser reine Vorschlag ändert noch keine heutige Runtime-Dokumentation.

## Acceptance

Die Lieferfähigkeit hängt nicht mehr von einem ungeklärten Mainserver-Reprovisioning-Vertrag ab: Der Recovery-Pfad ruft ihn nicht auf. Tests belegen das Wiederherstellen ausschließlich derselben verifizierten Version, sichere Ablehnung aller anderen Fälle, Konkurrenzschutz und höchstens einen wiederholten Inhaltsabruf. Erfolgreiche lokale Rücksicherung beweist keine aktuelle externe Gültigkeit; diese wird erst durch den regulären Inhaltsabruf geprüft.

Nach gesonderter Freigabe wird der Nutzerablauf in einer Testumgebung mit persönlichen und organisatorischen Credentials, vorhandenem/fehlendem Snapshot und nicht reparierbaren Zuständen geprüft. Secretfreie Nachweise dokumentieren Scope, Zeitfenster und Ergebnis. Weniger Logs allein gelten nicht als Erfolg. Rollouts folgen ausschließlich dem kanonischen Studio-Rollout-Prozess.
