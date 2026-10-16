## Herkunft und Status

Dieser Plan übernimmt alle im Bus-Change `add-studio-api-key-management` noch offenen
Aufgaben. Die Veröffentlichung des Bus-Servers ist nachgewiesen; dort noch nicht
ausgeführte Kunden-Key-/Integrationstests bleiben hier offen. Bei der Überführung war
zunächst nur die Spezifikationseinordnung erledigt; die inzwischen ergänzte lokale Umsetzung
und die noch ausstehende Integrationsabnahme sind in den Checkboxen getrennt ausgewiesen.

| Ursprung im Bus-Plan | Fortführung hier                                               |
| -------------------- | -------------------------------------------------------------- |
| 1.2–1.4              | 1.1–1.3                                                        |
| 3.1–3.8              | 2.1–2.8                                                        |
| 4.1–4.9              | 3.1–3.9                                                        |
| 5.1                  | 4.1: offene Kompatibilitätsprüfung; Bus-Deploy bereits erfolgt |
| 5.2–5.7              | 4.2–4.7: Studio-Rollout und gemeinsame Abnahme                 |

## 1. Zuordnung und Bestandsprüfung

- [x] 1.1 Aktuelle Studio-Spezifikationen, offene Changes und arc42-Zuständigkeiten prüfen; Aufgaben als verknüpften Change übernehmen.
- [x] 1.2 `label = instanceId`, `owner = displayName`, Pflichtfelder und inklusive UTC-Datumsregel in Server und UI implementieren.
- [ ] 1.3 Bestehende Labels exakt gegen die Studio-Registry prüfen; unbekannte Labels und abweichende Ortsnamen vor Verwendung manuell klären.

## 2. Server-Integration

- [x] 2.1 Bestehende Root-Host-, Session- und `instance_registry_admin`-Guards sowie CSRF und Fresh-Reauth für sämtliche neuen Schreibaktionen einbinden; kein Tenant- oder Permission-Fallback.
- [x] 2.2 `BUS_API_BASE_URL` und `BUS_API_ADMIN_TOKEN` in die serverseitige Konfigurationsvalidierung und den bestehenden Deployment-Vertrag aufnehmen; fehlende Integration nur im Bus-Bereich melden.
- [x] 2.3 Fokussierten Bus-Adapter im bestehenden Serverpfad mit fester Ziel-Origin, Timeout, sicherer Fehlerabbildung und ohne automatische Write-Retries ergänzen.
- [x] 2.4 Instanzgebundene GET-/POST-/revoke-/activate-Endpunkte gemäß Design implementieren; Instanz, `owner` und `label` serverseitig aus der Registry auflösen und Label-Vorbedingung immer mitsenden.
- [x] 2.5 Kontakt, Initialen und `validThrough` serverseitig validieren; UTC-Ablauf berechnen und Erstellung/Reaktivierung außerhalb aktiver Instanzen sowie abgelaufene Reaktivierungen ablehnen.
- [x] 2.6 Mutationen über den bestehenden Plattform-/Instanz-Auditpfad mit Session-Benutzer-ID und Request-ID auditieren; Header `x-admin-actor-id` selbst setzen und bestätigte Bus-Erfolge bei Auditfehler nicht wiederholen.
- [x] 2.7 Vorhandenen Instanz-HTTP-Client ergänzen; Metadaten und einmalige Erstellantwort getrennt typisieren und Responses mit `Cache-Control: no-store` schützen.
- [x] 2.8 Gezielte Negativtests für Root-/Tenant-Host, Session, Rollen, CSRF, Reauth, Instanzexistenz, fremde Key-ID, Timeout und Secret-Redaktion ergänzen; vorgeschriebene Auth-/Server-Runtime-Gates erfüllen.
- [x] 2.9 Betroffene arc42-Abschnitte 03, 04, 05, 06, 07 und 08 prüfen und fortschreiben; bei belegtem Schemaänderungsbedarf die kanonischen Schema-Snapshots aktualisieren.

## 3. Instanzdetail und Formular

- [x] 3.1 „Bus-API-Keys“ in „Betrieb“ der zentralen Instanzdetailseite integrieren; ausschließlich Plattform-Superadmins, kein aktivierbares Tenant-Modul, bestehende Studio-UI-Bausteine.
- [x] 3.2 Nur Keys mit exakt passendem Label anzeigen; Lade-, Leer-, Konfigurations- und Fehlerzustände darstellen, ohne das restliche Instanzdetail zu blockieren.
- [x] 3.3 Ort und Instanz-ID anzeigen; Pflichtfelder für Kunden-Kontakt-E-Mail und editierbare Erstellerinitialen anbieten.
- [x] 3.4 „Gültig bis einschließlich“ mit dem 31. Dezember des laufenden Jahres vorbelegen, freie gültige Auswahl und Erklärung des exakten UTC-Ablaufs anbieten.
- [x] 3.5 Klartext-Key einmalig mit expliziter Kopieraktion zeigen; nach Schließen oder Instanzwechsel verwerfen und nicht in Browser-Speichern, URLs oder Telemetrie persistieren. Verspätete Kopierergebnisse werden nur für den weiterhin angezeigten Key übernommen.
- [x] 3.6 Bestätigtes Sperren und zulässiges Reaktivieren anbieten; manuelle Rotation durch Erstellen, Client-Umstellung und bewusstes späteres Sperren des alten Keys unterstützen.
- [x] 3.7 Unklaren Erstellungsausgang nach Timeout darstellen, Metadaten neu laden und keine automatische Neuerstellung auslösen; verspätete Antworten früherer Instanzen verwerfen.
- [x] 3.8 Deutsche/englische Texte, Tastaturbedienung und zugängliche Formularfehler ergänzen. Kopierfehler stehen im Dialog; nach Dialogschluss wird der Fokus lokal wiederhergestellt. Gezielte DOM-Tests und der ergänzende Chromium-Tastaturcheck mit API-Testantworten sind grün.
- [ ] 3.9 Gezielte Vitest-/Typ- und Browser-Tests für Formular, Datum, Einmalanzeige, Instanzwechsel, Mutationen und Zugriffsausschlüsse durchführen.

## 4. Betrieb und gemeinsame Abnahme

- [ ] 4.1 Bestehende Client-Keys und manuelle Admin-Aufrufe gegen den veröffentlichten Bus-Stand prüfen; die bereits bestandenen Bus-Tests und Healthchecks ersetzen diesen Nachweis nicht.
- [ ] 4.2 Studio-Serververbindung und umgebungsspezifische Secrets konfigurieren; Browser-Build und Antworten auf unbeabsichtigte Secret-Ausgabe prüfen.
- [ ] 4.3 Mindestens zwei persönliche Root-Keycloak-Konten mit Plattformrolle und unabhängigen Logins bereitstellen; vorhandene MFA-/Recovery-Regeln anwenden.
- [ ] 4.4 Studio nach dem kanonischen GitHub-Actions-Rollout über Dev und Staging ausrollen; Kontakt/Initialen und Jahresend-Standard anhand zugeordneter Beispielinstanzen prüfen.
- [ ] 4.5 Mit Test-Key vollständigen Proxy-Aufruf mit `x-api-key` und konfiguriertem `x-federal-state` nachweisen; Sperren ergibt 401, zulässige Reaktivierung wieder Erfolg.
- [ ] 4.6 Zwei gleichzeitig gültige Keys für manuelle Rotation und gezieltes Sperren nur des alten Keys prüfen.
- [ ] 4.7 Studio-Produktionsrollout und Rückfallpfad dokumentieren und gemeinsame Abnahme festhalten; Bus-Release-Nachweis nur referenzieren, keinen erneuten Bus-Deploy voraussetzen.
- [ ] 4.8 Passende Studio-Pflichtchecks, Dateiablage- und Dokumentationsprüfung sowie strikte OpenSpec-Validierung für den Implementierungsstand ausführen; erst nach Abnahme archivieren.

## Lokaler Implementierungsnachweis vom 16. Oktober 2026

Branch `feature/bus-api-key-management` basiert unverändert auf Planungscommit
`a0abb81894fe2548c07af82b3648841dcf01ef66`. PR 1858 wurde nicht gemergt;
Es wurden ausschließlich Keys im isolierten lokalen Test-Bus erstellt und verändert;
produktive Bus-Keys, externe Konten und zentrale Zielumgebungen blieben unverändert.

Umgesetzt sind die vier Session-Endpunkte, Serveradapter, gemeinsame DTOs und UTC-Arithmetik,
Instanz-HTTP-Client, Bereich unter Betrieb, zweisprachige Texte und vorhandene Deployment-Verträge.
Der bestehende Audittyp `instance_reconfigured` trägt `area: bus_api_keys` und die Aktion;
eine neue Tabelle oder ein neuer IAM-Mechanismus war nicht erforderlich. Die vorhandenen
Root-/Rollen-/CSRF-/Reauth-Verträge werden wiederverwendet; technische Registry-Service-Tokens
werden ausdrücklich nicht für Bus-Keys freigegeben.

Erfolgreiche lokale Nachweise:

- 20 Adaptertests, 23 Handler-/Negativtests und 12 UTC-Datumstests
- 22 gezielte UI-Tests einschließlich A11y, Einmalanzeige, A–B–A-Instanzwechsel,
  Zeitanteilen historischer Keys, Kopier-/Schließzweigen, Fokus-Rückgabe,
  verspäteten Kopierergebnissen und fehlgeschlagenem Readback nach unklarem Write
- 14 gezielte Auth-Callback-Tests für explizite und normale interaktive Anmeldungen
  sowie fehlende, alte, zukünftige und stille Authentisierungsnachweise
- bestehende Routing- und Instanzdetail-Tests
- einzelner Chromium-Flow im bestehenden Instanzdetail-E2E mit simulierten Bus-Antworten:
  Erstellung, Einmalanzeige, Verwerfen und bestätigte Sperrung
- ergänzender Chromium-Tastaturcheck am aktuellen lokalen Stand mit API-Testantworten:
  27 bestandene Prüfungen für Tab-/Shift-Tab-Fokusbegrenzung, Enter/Escape,
  Fokus-Rückgabe nach Abbruch und Sperrung, Übergang zur Einmalanzeige,
  beide Schließbestätigungszweige, direktes Schließen nach erfolgreichem Kopieren,
  unveränderte Dialoghöhe und sichtbaren Clipboard-Fehler
- `auth-runtime:test:types`, `check:server-runtime` vollständig für 20 Projekte,
  Skript-Typecheck, gezieltes ESLint, Dateiablage und Dokumentationsprüfung
- strikte OpenSpec-Validierung über die vorhandene CLI mit Node 22.12.0;
  sämtliche Studio-Codeprüfungen nutzten die Workspace-Runtime Node 24.15.0

Der App-Typecheck ist weiterhin rot ausschließlich an unveränderten Zod-/Resolver-Typen
in `plugin-cockpit-cards` und `plugin-faq`. Der reguläre App-Testtarget wird außerdem durch
entsprechende Buildfehler in `plugin-projects` und `plugin-generic-items` blockiert.
Gezielte UI-/E2E-Targets wurden deshalb über Nx mit `--excludeTaskDependencies` ausgeführt;
die fachfremden Plugins und versionierten Abhängigkeiten wurden nicht geändert.
3.9 und 4.8 bleiben bis zur vollständigen grünen App-/Freigabeprüfung offen.

Der anschließende manuelle Test mit persönlicher Plattformanmeldung und isoliertem
lokalem Bus-Server samt eigenem Redis bestätigte Erstellung, Sperrung, Reaktivierung und
den Audit-Readback. Die fehlgeschlagenen Sperrversuche vor der Korrektur des leeren
JSON-Requests wurden ebenfalls im Studio-Audit nachvollzogen. Der lokale Bus hatte
absichtlich keinen echten Proxy-Upstream; ein erfolgreicher Proxy-Zugriff wurde nicht geprüft.

Nach der letzten UI-Abstimmung liegen der Bereich unter „IAM-Basis neu aufbauen“ und
die Erstellaktion unten links. Der Einmal-Key-Dialog zeigt keine zusätzliche Key-ID,
bestätigt Kopieren in der Buttonzeile und schließt nach erfolgreichem Button-Kopieren
direkt; andernfalls führt die Rückfrage entweder zum Schließen oder zurück zum selben Key.
Kopierfehler werden inzwischen innerhalb des Dialogs ausgegeben. Der Sperrdialog zeigt
eine beschriftete Key-ID; die Sperraktionen verwenden `destructive`. Fehlermeldungen
unterscheiden Erstellung, Sperrung und Reaktivierung.

Die normale interaktive Anmeldung zählt mit geprüftem frischem `auth_time`-Claim als
Fresh-Reauth-Nachweis. Das gemeinsame Zeitfenster bleibt auf ausdrückliche Nutzerentscheidung
unverändert bei standardmäßig zehn Minuten; eine globale Verlängerung gehört nicht zum Scope.
Die im abschließenden Review gefundenen Probleme bei verspäteten Kopierergebnissen
und der Fokus-Rückgabe wurden lokal in der Bus-Karte korrigiert und mit Regressionstests
abgesichert. Beim Übergang vom Erstellformular zur Key-Anzeige bleibt der Fokus im
neuen Dialog; nach Abschluss kehrt er zum auslösenden oder nächsten verfügbaren
Aktionsbutton zurück. Vorübergehend deaktivierte Buttons werden erst nach Ende der
Mutation und des Readbacks fokussiert. Der ergänzende Browser-Tastaturcheck bestand
am 16. Oktober 2026 um 16:50 Uhr (Europe/Berlin) im separaten Chromium-Kontext.
Der lokale Bericht liegt als ignoriertes Artefakt unter
`output/playwright/bus-keyboard-report.json`; er enthält ausschließlich Prüfergebnisse
und Testdaten. Nicht simulierte Admin-Endpunkte antworteten in diesem isolierten
Kontext ohne echte Session mit 401; der Check ist deshalb kein vollständiger
authentifizierter E2E- oder Proxy-Nachweis. Der verpflichtende Changelog-Eintrag zur tatsächlichen
Implementierungs-PR und die finalen Checks vor Freigabe stehen ebenfalls aus.

Weder der Browser-Test mit simulierten Bus-Antworten noch der isolierte lokale Bus
mit Dummy-Upstream belegen einen echten Proxy-Key-Lifecycle. Registry-/Bestandsabgleich,
Kundenkey-Kompatibilität, zwei persönliche Logins, umgebungsspezifische Secrets,
Bundle-Prüfung im vollständigen Release-Build sowie die Proxy-, Rotations- und
Rollout-Nachweise gegen die Zielumgebung aus Abschnitt 4 bleiben offen.
