# Design: Root-Verwaltung der Mainserver-Schnittstelle

## Ausgangslage

`iam.instance_external_interfaces` ist der kanonische, instanzbezogene Speicher. `loadSvaMainserverSettings` und `saveSvaMainserverSettings` lesen beziehungsweise schreiben den Default-Eintrag `sva_mainserver`; die Runtime lädt denselben Eintrag. Der aktuelle HTTP-Vertrag `/api/v1/interfaces/mainserver` bestimmt die Instanz aus dem Tenant-Actor und verlangt `integration.manage`. Die Root-Instanzverwaltung besitzt einen eigenen Root-Host- und `instance_registry_admin`-Guard. Der Registry-Wert `mainserverConfigRef` wird nicht zur Auflösung des Runtime-Endpunkts genutzt.

## Gewählter Zuschnitt

Die bestehende Root-Instanzverwaltung erhält `GET /api/v1/iam/instances/mainserver-interfaces` für die Übersicht sowie `GET` und `PUT /api/v1/iam/instances/{instanceId}/mainserver-interface` für eine ausdrücklich ausgewählte Instanz. Das zentrale MCP ergänzt dafür Lese- und Speichertools im vorhandenen Instanz-Toolset. Root-UI und MCP verwenden dieselben HTTP-Verträge und dieselbe secretfreie Projektion. Der Server delegiert an die vorhandenen Mainserver-Settings-Funktionen und ergänzt keine zweite Persistenz oder eigene URL-Normalisierung.

Die Bestandsübersicht liest die aktiven Registry-Instanzen und ermittelt den Status ihres jeweiligen Default-Interfaces unter instanzgebundenem Datenbankkontext. Ein fehlender Datensatz ist `missing`, ein vorhandener deaktivierter Datensatz `disabled`, ein vorhandener aktivierter Datensatz `configured`. Erhebungsfehler sind `error` mit stabilem Fehlercode und werden niemals als `missing` ausgegeben. Eine optionale Mainserver-Anbindung wird nicht allein durch den Instanzstatus `active` verpflichtend.

Das Root-Detail bietet öffentliche `graphqlBaseUrl`, `oauthTokenUrl` und `enabled` zur gezielten Bearbeitung. Die bestehenden Tenant-Ansichten bleiben fachlich gleichberechtigt; beide Verwaltungswege verändern denselben Eintrag. Nach dem Speichern lesen UI und MCP den konkreten Eintrag erneut. Interface-Healthcheck und Provider-Zugriff bleiben gesonderte Prüfungen.

## Vertrauens- und Ausführungsgrenzen

- Nur der Root-Host mit `instance_registry_admin` darf die instanzübergreifenden Root-APIs nutzen. Tenant-Host, Tenant-Token und fehlende Root-Rolle scheitern vor dem Datenzugriff. Die Ziel-`instanceId` stammt aus dem validierten Pfad oder der gefilterten aktiven Instanzliste, nicht aus einem frei übergebenen Tenant-Actor.
- Jede Repository-Operation bindet den Datenbankkontext an genau diese Zielinstanz. Die vorhandene RLS-Policy bleibt wirksam; ein globaler RLS-Bypass ist nicht Teil des Changes.
- Schreibzugriffe nutzen den vorhandenen Root-Zugriffsschutz, Browser-CSRF beziehungsweise die bestehende MCP-Serviceauthentisierung und den Audit-Pfad. Frische Re-Authentisierung folgt dem bestehenden Root-Vertrag für vergleichbare Konfigurationsmutationen. Der Server lehnt zusätzliche Felder, fremde Interface-Typen und ungültige URLs ab. Der bestehende Mainserver-Upsert bleibt alleiniger Speicherpfad.
- Root-Read-Model und MCP-Ergebnisse enthalten nur öffentliche URLs, Aktivstatus und einen eingeschränkten Status. Weder verschlüsselte Secretblöcke noch Provider-Antworttexte oder Zugangsdaten werden ausgegeben oder protokolliert.
- Persönliche Tenant-Aufrufe bleiben an Host, Actor-Instanz und `integration.manage` gebunden. Sie dürfen keine Root-`instanceId` setzen und können keinen anderen Tenant bearbeiten.

## Fehlerfälle und Nachweise

Ein einzelner fehlgeschlagener Tenant-Read erscheint als `error`, ohne die übrigen Ergebnisse als erfolgreich auszugeben oder fehlende Konfiguration zu behaupten. Ein Schreibfehler lässt den vorherigen Eintrag unverändert; nach unklarer Antwort wird der Zielzustand vor einer Wiederholung gelesen. Die Liste begrenzt gleichzeitige Tenant-Reads und liefert einen nachvollziehbaren Teilfehler statt eines stillen Erfolgs.

Gezielte Vertrags- und Integrationstests belegen Root-Host/Rolle, Tenant-Ausschluss, Zielinstanzbindung und RLS-Kontext, `missing`/`disabled`/`configured`/`error`, URL-/SSRF-Validierung, Speichern mit Readback und secretfreie MCP-Ausgaben. UI-Tests belegen Status- und Fehlerdarstellung sowie die gezielte Instanzauswahl. Eine separate Betriebsprüfung verifiziert die tatsächliche Mainserver-Verbindung; sie wird nicht aus dem Save-Ergebnis abgeleitet.
