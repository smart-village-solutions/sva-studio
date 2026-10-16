## Herkunft und Status

Dieser Plan übernimmt alle im Bus-Change `add-studio-api-key-management` noch offenen
Aufgaben. Die Veröffentlichung des Bus-Servers ist nachgewiesen; dort noch nicht
ausgeführte Kunden-Key-/Integrationstests bleiben hier offen. Nur die Spezifikationseinordnung
wurde bei der Überführung erledigt. Die übrigen Checkboxen bezeichnen künftige Umsetzung.

| Ursprung im Bus-Plan | Fortführung hier                                               |
| -------------------- | -------------------------------------------------------------- |
| 1.2–1.4              | 1.1–1.3                                                        |
| 3.1–3.8              | 2.1–2.8                                                        |
| 4.1–4.9              | 3.1–3.9                                                        |
| 5.1                  | 4.1: offene Kompatibilitätsprüfung; Bus-Deploy bereits erfolgt |
| 5.2–5.7              | 4.2–4.7: Studio-Rollout und gemeinsame Abnahme                 |

## 1. Zuordnung und Bestandsprüfung

- [x] 1.1 Aktuelle Studio-Spezifikationen, offene Changes und arc42-Zuständigkeiten prüfen; Aufgaben als verknüpften Change übernehmen.
- [ ] 1.2 `label = instanceId`, `owner = displayName`, Pflichtfelder und inklusive UTC-Datumsregel in Server und UI implementieren.
- [ ] 1.3 Bestehende Labels exakt gegen die Studio-Registry prüfen; unbekannte Labels und abweichende Ortsnamen vor Verwendung manuell klären.

## 2. Server-Integration

- [ ] 2.1 Bestehende Root-Host-, Session- und `instance_registry_admin`-Guards sowie CSRF und Fresh-Reauth für sämtliche neuen Schreibaktionen einbinden; kein Tenant- oder Permission-Fallback.
- [ ] 2.2 `BUS_API_BASE_URL` und `BUS_API_ADMIN_TOKEN` in die serverseitige Konfigurationsvalidierung und den bestehenden Deployment-Vertrag aufnehmen; fehlende Integration nur im Bus-Bereich melden.
- [ ] 2.3 Fokussierten Bus-Adapter im bestehenden Serverpfad mit fester Ziel-Origin, Timeout, sicherer Fehlerabbildung und ohne automatische Write-Retries ergänzen.
- [ ] 2.4 Instanzgebundene GET-/POST-/revoke-/activate-Endpunkte gemäß Design implementieren; Instanz, `owner` und `label` serverseitig aus der Registry auflösen und Label-Vorbedingung immer mitsenden.
- [ ] 2.5 Kontakt, Initialen und `validThrough` serverseitig validieren; UTC-Ablauf berechnen und Erstellung/Reaktivierung außerhalb aktiver Instanzen sowie abgelaufene Reaktivierungen ablehnen.
- [ ] 2.6 Mutationen über den bestehenden Plattform-/Instanz-Auditpfad mit Session-Benutzer-ID und Request-ID auditieren; Header `x-admin-actor-id` selbst setzen und bestätigte Bus-Erfolge bei Auditfehler nicht wiederholen.
- [ ] 2.7 Vorhandenen Instanz-HTTP-Client ergänzen; Metadaten und einmalige Erstellantwort getrennt typisieren und Responses mit `Cache-Control: no-store` schützen.
- [ ] 2.8 Gezielte Negativtests für Root-/Tenant-Host, Session, Rollen, CSRF, Reauth, Instanzexistenz, fremde Key-ID, Timeout und Secret-Redaktion ergänzen; vorgeschriebene Auth-/Server-Runtime-Gates erfüllen.
- [ ] 2.9 Betroffene arc42-Abschnitte 03, 04, 05, 06, 07 und 08 prüfen und fortschreiben; bei belegtem Schemaänderungsbedarf die kanonischen Schema-Snapshots aktualisieren.

## 3. Instanzdetail und Formular

- [ ] 3.1 „Bus-API-Keys“ in „Betrieb“ der zentralen Instanzdetailseite integrieren; ausschließlich Plattform-Superadmins, kein aktivierbares Tenant-Modul, bestehende Studio-UI-Bausteine.
- [ ] 3.2 Nur Keys mit exakt passendem Label anzeigen; Lade-, Leer-, Konfigurations- und Fehlerzustände darstellen, ohne das restliche Instanzdetail zu blockieren.
- [ ] 3.3 Ort und Instanz-ID anzeigen; Pflichtfelder für Kunden-Kontakt-E-Mail und editierbare Erstellerinitialen anbieten.
- [ ] 3.4 „Gültig bis einschließlich“ mit dem 31. Dezember des laufenden Jahres vorbelegen, freie gültige Auswahl und Erklärung des exakten UTC-Ablaufs anbieten.
- [ ] 3.5 Klartext-Key einmalig mit expliziter Kopieraktion zeigen; nach Schließen oder Instanzwechsel verwerfen und nicht in Browser-Speichern, URLs oder Telemetrie persistieren.
- [ ] 3.6 Bestätigtes Sperren und zulässiges Reaktivieren anbieten; manuelle Rotation durch Erstellen, Client-Umstellung und bewusstes späteres Sperren des alten Keys unterstützen.
- [ ] 3.7 Unklaren Erstellungsausgang nach Timeout darstellen, Metadaten neu laden und keine automatische Neuerstellung auslösen; verspätete Antworten früherer Instanzen verwerfen.
- [ ] 3.8 Deutsche/englische Texte, Tastaturbedienung und zugängliche Formularfehler ergänzen.
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
