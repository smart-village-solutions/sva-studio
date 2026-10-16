# Studio-Integration der Bus-API-Key-Verwaltung

## Status, Abhängigkeit und bestehende Pfade

Überführung und lokale Implementierung vom 16. Oktober 2026; gemeinsame Abnahme und Rollout noch offen.
Der erforderliche Bus-Vertrag ist mit `0.7.3` bereits veröffentlicht. Release und
archivierter Bus-Change sind in [proposal.md](./proposal.md) verknüpft.

Der vorhandene Pfad ist das Root-Instanzdetail in
`apps/sva-studio-react/src/routes/admin/instances/`, dessen Instanz-Client
`apps/sva-studio-react/src/lib/iam-api-instance-bus-keys.ts` und die Registry-/Auth-Runtime in
`packages/instance-registry` und `packages/auth-runtime`. Plattformprüfung und
Fresh-Reauth sind in `packages/instance-registry/src/http-guards.ts` vorhanden.
Die serverseitige Einbindung orientiert sich am bestehenden Root-Instanz-Routing.

`Browser mit Studio-Session → Studio-Server → Bus-Admin-Schnittstelle → Bus-Redis`

Die Funktion bleibt eine Einstellung der zentralen Instanzverwaltung. Es entsteht
kein Tenant-Modul, Plugin, neues Package oder zusätzlicher Studio-Key-Bestand. Key-Lifecycle,
Hashing und Gültigkeitsprüfung bleiben vollständig beim Bus-Server.

## Autorisierung und Instanzzuordnung

Jeder neue Handler prüft vor einem Bus-Aufruf authentifizierte Plattform-Session,
Root-Host, `instance_registry_admin` und Registry-Existenz der gewählten Instanz.
Tenant-Hosts und Tenant-`system_admin` bleiben auch bei direktem HTTP-Aufruf gesperrt;
Organisationen oder tenantseitige Permissions ersetzen die Plattformrolle nicht.
Schreibaktionen verwenden die bestehenden CSRF- und Fresh-Reauth-Verträge.
Navigation und UI spiegeln diese Regeln, ersetzen aber keine Serverprüfung.
Eine normale interaktive Anmeldung zählt mit geprüftem frischem `auth_time`-Claim
ebenfalls als Nachweis. Silent-SSO und Token-Refresh erzeugen keinen neuen Nachweis.
Das gemeinsame Frischefenster bleibt standardmäßig bei zehn Minuten; die Bus-Integration
verlängert es nicht für andere Instanzverwaltungsaktionen. Nach Ablauf führt der
Anmeldelink im Fehlertext über den vorhandenen expliziten Reauth-Login zurück zur Instanz.

`instanceId` stammt aus der geprüften Route; `owner` wird aus `displayName` der Registry
und `label` exakt aus dieser `instanceId` erzeugt. Der Browser darf diese beiden Werte
nicht durch Body-Felder überschreiben. Vor dem Einsatz müssen Anzeigenamen den
gewünschten ausgeschriebenen Ortsnamen entsprechen. Historische Datensätze werden
nicht anhand ähnlicher Namen oder Label-Präfixe automatisch zugeordnet oder verändert.

Lesen und Sperren bleiben für bekannte suspendierte/archivierte Instanzen verfügbar.
Erstellen und Reaktivieren sind auf aktive Instanzen beschränkt. Mehrere Keys pro
Label sind zulässig. Eine manipulierte Key-ID darf keinen anderen Instanzdatensatz ändern.

## Browser- und Bus-Vertrag

| Studio-Endpunkt                                                       | Bus-Aufruf                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/v1/iam/instances/:instanceId/bus-api-keys`                  | `GET /internal/api-keys?label=<instanceId>`                                  |
| `POST /api/v1/iam/instances/:instanceId/bus-api-keys`                 | `POST /internal/api-keys` mit Registry-Owner/Label und validierten Metadaten |
| `POST /api/v1/iam/instances/:instanceId/bus-api-keys/:keyId/revoke`   | `POST /internal/api-keys/:keyId/revoke?label=<instanceId>`                   |
| `POST /api/v1/iam/instances/:instanceId/bus-api-keys/:keyId/activate` | `POST /internal/api-keys/:keyId/activate?label=<instanceId>`                 |

Der Adapter kodiert IDs als Pfad-/Query-Werte, verwendet eine serverseitig konfigurierte
feste Ziel-Origin, begrenzte Timeouts und keine automatischen Write-Retries. Ein falsches
Label oder unbekannter Key ergibt beim Bus HTTP 404, leere/wiederholte Label-Filter 400.
Studio sendet den Label-Kontext immer mit und beschränkt auch die Antwortprojektion auf
exakt passende Datensätze. Vom Browser gelieferte Admin-Header werden nicht übernommen.
`Content-Type: application/json` wird nur mit einem JSON-Body gesendet; Sperren und
Reaktivieren senden keinen Body und keinen JSON-Content-Type.

`BUS_API_BASE_URL` und `BUS_API_ADMIN_TOKEN` gehören ausschließlich zur Serverkonfiguration;
der Token entspricht dem Bus-`ADMIN_API_TOKEN`. Remote-Ziele erfordern HTTPS; lokales
HTTP bleibt auf das vorhandene lokale Runtime-Profil beschränkt. Umgebungen erhalten
getrennte Konfigurationen. Der vorhandene Token besitzt umfassende Bus-Adminrechte:
die Studio-Fassade darf deshalb nur die vier genannten Operationen anbieten.

Das Secret gelangt nicht in `VITE_`-Variablen, Konfigurationsantworten, Browser-Bundles,
URLs, Logs oder Telemetrie. Browser-Antworten erhalten `Cache-Control: no-store`.
Fehlende Bus-Konfiguration ist ein lokaler Fehlerzustand dieses Abschnitts.

## Formular, Daten und Zeit

Ort und Instanz-ID sind sichtbar. Bei jeder Erstellung sind die syntaktisch gültige,
getrimmte Kunden-Kontakt-E-Mail (`contact`) und getrimmte Initialen (`createdBy`) Pflicht.
Initialen werden bei jeder Erstellung manuell eingegeben und dürfen ein bis 32 Buchstaben
einschließlich kombinierender Zeichen enthalten; es entsteht kein neues Profilfeld.
Der tatsächliche Audit-Akteur stammt separat aus der Session.

Der Browser sendet `contact`, `createdBy` und das Date-only-Feld `validThrough`.
Der Server validiert diese Werte erneut und berechnet `expiresAt` mit UTC-Kalenderarithmetik:

- „Gültig bis einschließlich“ ist mit 31. Dezember des aktuellen Jahres in `Europe/Berlin`
  vorbelegt, beim Öffnen berechnet und nicht hart codiert.
- Der letzte Gültigkeitstag ist frei wählbar, wenn der berechnete Ablauf beim Absenden
  noch in der Zukunft liegt.
- `2026-12-31` ergibt `2027-01-01T00:00:00.000Z`; `2027-03-15` ergibt `2027-03-16T00:00:00.000Z`.
- Dies ist UTC-Tagesbeginn, nicht Berliner Mitternacht; der erste Beispielwert entspricht
  in Berlin 01:00 Uhr. Der genaue UTC-Ablauf wird erklärt.
- Browser-Zeitzone, Sommerzeit und Schaltjahre dürfen keine Tagesverschiebung bewirken.
- Historische beliebige Ablaufzeitpunkte bleiben als exakte Zeitpunkte sichtbar. Die
  inklusive Tagesdarstellung wird nur auf passende UTC-Grenzen angewendet; kein Datum
  bedeutet beim Alt-Key „ohne Ablaufdatum“.

## Bedienung und Fehlerverhalten

Der Bereich unter „Betrieb“ nutzt vorhandene Studio-Tabellen, Statusdarstellung,
Formulare und Dialoge und steht unter „IAM-Basis neu aufbauen“. „Key erstellen“ steht
unten links vor „Metadaten neu laden“. Die Liste enthält Key-ID, Kontakt, Initialen, Erstellung,
Gültigkeit und Status; keine Hashes oder Klartext-Keys. Neue Keys erscheinen einmalig
mit einer expliziten Kopieraktion und Hinweis auf die einmalige Anzeige. Ihr Wert bleibt
nur im flüchtigen UI-Zustand und wird nach Schließen oder Instanzwechsel verworfen.
Verspätete Antworten einer zuvor ausgewählten Instanz werden ignoriert.
Der Erstelldialog zeigt den API-Key ohne zusätzliche Key-ID. Die Kopierbestätigung
steht im reservierten Platz der Buttonzeile; ein Kopierfehler erscheint im Dialog.
Nach erfolgreicher Kopieraktion schließt „Schließen“ direkt. Andernfalls erscheint
eine Rückfrage: „Ja, ich habe den API-Key kopiert“ verwirft den Key und schließt;
„Nein, ich muss den API-Key noch kopieren“ führt zur Anzeige desselben Keys zurück.

Sperren wird bestätigt; die betroffene Key-ID ist im Dialog ausdrücklich beschriftet,
und beide Sperrbuttons verwenden die vorhandene Variante `destructive`.
Reaktivieren ist nur für gesperrte, noch nicht abgelaufene Keys
zulässig und verlängert kein Ablaufdatum. Rotation erfolgt manuell: erstellen, den
neuen Key im tatsächlichen Client verteilen und prüfen, anschließend den alten sperren.
Das Erstellen sperrt keinen bestehenden Key automatisch.

Ein Timeout kann nach erfolgreicher Bus-Erstellung auftreten, bevor die einmalige
Antwort ankommt. Studio meldet den unklaren Ausgang und lädt Metadaten neu; es erstellt
nicht automatisch erneut. Der nicht wieder auslesbare Key kann bewusst gesperrt und
ersetzt werden. Nach bestätigtem Bus-Erfolg verursacht auch ein nachgelagerter Auditfehler
keine Wiederholung; Erfolg und Auditstörung werden getrennt korreliert dargestellt.
Bus-Fehler werden sicher abgebildet, ohne rohe Downstream-Antworten offenzulegen.
Unbestätigte Sperrungen und Reaktivierungen erhalten eigene Meldungen ohne
Anweisungen zur Neuerstellung. Bei abgelehnten oder nicht erreichbaren Bus-Aufrufen
wird zum Laden der Metadaten und Prüfen des aktuellen Status aufgefordert.

Alle Texte werden deutsch/englisch über i18n geführt; Tastaturbedienung, Fokusführung
und Formularfehler sollen dem bestehenden Design-System und WCAG 2.1 AA folgen.
Die Bus-Karte stellt den Fokus nach Dialogschluss auf den auslösenden oder nächsten
verfügbaren Aktionsbutton zurück; vorübergehend deaktivierte Buttons werden erst nach
Mutation und Readback fokussiert. Kopierergebnisse werden nur übernommen, solange
derselbe Key angezeigt wird. Gezielte Regressionstests und der ergänzende bestandene
Chromium-Tastaturcheck mit API-Testantworten sind in [tasks.md](./tasks.md) festgehalten;
sie ersetzen nicht die vollständige Integrations- und Releaseabnahme.

## Audit, Invarianten und Nachweise

Studio setzt `x-admin-actor-id` aus der serverseitigen Benutzer-ID und korreliert mit
`x-request-id`. Der Bus akzeptiert die optionale Actor-Angabe erst nach Bearer-Prüfung;
sie ist eine Assertion des Studio-Servers und kein eigenständiger Identitätsnachweis.
Zulässig ist eine nicht leere ID mit höchstens 256 Zeichen ohne Steuerzeichen oder Komma.
Initialen ersetzen diese Identität nicht.

Mutationen nutzen den bestehenden Plattform-/Instanz-Auditpfad mit Akteur, Instanz,
Key-ID, Aktion, Ergebnis und Request-ID. Klartext-Key, Hash, Admin-Token und Kontakt-E-Mail
werden nicht in Auditdetails, operativen Logs oder Fehlertelemetrie gespeichert.
Der aktuelle Audit-Repository-Vertrag wird vor Änderungen geprüft; neue Tabellen oder
ein paralleler Auditpfad sind nicht vorab Teil des Entwurfs.

| Kritische Invariante                      | Geplanter Nachweis vor Abnahme                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Ausschließlich Root-Plattform-Superadmins | Direkte GET/POST-Aufrufe mit Tenant-Host, Tenant-Admin, fehlender Rolle/Session sowie CSRF-/Reauth-Negativtests |
| Exakte Instanzbindung                     | Manipulierte Route/Body/Key-ID, falsches Label und verzögerte Antworten nach Instanzwechsel                     |
| Secrets bleiben geschützt                 | Response-/Bundle-Prüfung, Audit-Redaktion, Einmalanzeige und leerer UI-Zustand nach Schließen                   |
| Datum bleibt korrekt                      | Jahreswechsel, Schaltjahr und mehrere Browser-Zeitzonen gegen die UTC-Beispiele                                 |
| Keine unbeabsichtigte Doppelanlage        | Timeout und Auditfehler nach Bus-Erfolg lösen keinen zweiten Create-Aufruf aus                                  |
| Lifecycle wirkt am Proxy                  | Test-Key benutzen, sperren → 401, zulässig reaktivieren → Erfolg; Rotation mit zwei Keys                        |

Dies sind geplante Nachweise. Die erfolgreichen Bus-Tests und sein Produktions-Healthcheck
belegen die veröffentlichte Abhängigkeit, aber nicht die noch ausstehende Studio-Abnahme.

## Rollout und Rückfall

Zunächst Labels/Ortsnamen gegen die Registry prüfen und unbekannte Zuordnungen manuell
klären. Die Kunden-Key-Kompatibilitätsprüfung ist offen. Danach umgebungsspezifische
Serververbindung und Secrets konfigurieren und mindestens zwei persönliche Plattformkonten
bereitstellen; Root-Kontoanlage erfolgt vorerst über die bestehende Keycloak-Administration.

Der einzige Studio-Rolloutpfad bleibt `docs/guides/studio-rollout-process.md`:
GitHub Actions Build → Dev → Staging → freigegebenes Production mit demselben Image-Digest.
Es wird kein neuer Operatorpfad oder weiterer Bus-Deploy vorausgesetzt. Der Rückfall
setzt die Studio-Änderung zurück beziehungsweise deaktiviert deren Bus-Konfiguration;
Bus-Keys und die bisherige Bus-Admin-Schnittstelle bleiben erhalten. Nachzuweisen sind
beide persönlichen Logins und der gesamte Key-Lifecycle mit einem Test-Key.
