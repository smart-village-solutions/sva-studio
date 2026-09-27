# Instanz-Lebenszyklus und Navigation

Die Instanzverwaltung unter `/admin/instances` bündelt Anlage, Einrichtung,
Betrieb, Diagnose und Einstellungen in den bestehenden Routen.

## Liste und Anlage

Die Liste öffnet das Detail über den Instanznamen. Hostname und Parent-Domain,
Lifecycle und belegter Handlungsbedarf stehen nebeneinander. Ohne aktuelle
Betriebsevidenz zeigt die Liste „Betrieb nicht verifiziert“. Suspendieren und
Archivieren liegen unter „Weitere Aktionen“. Der Gesamt-Audit wird erst auf
Anforderung geladen; die Liste löst keine Detailabfragen pro Instanz aus.

Die Anlage führt durch vier Schritte:

1. Instanz-ID, Anzeigename und Parent-Domain erfassen.
2. Neue oder bestehende Nutzer-Datenbank (Realm) wählen. Abgeleitete Clients und
   weitere technische Angaben bleiben aufklappbar.
3. Benutzername, E-Mail, Vor- und Nachname des ersten Administrators erfassen.
4. Alle Angaben prüfen. „Ändern“ öffnet die jeweilige Gruppe und erlaubt die
   direkte validierte Rückkehr. Änderungen verwerfen die vorherige Readiness.

Die serverseitigen Befunde unterscheiden Anlageblocker, Voraussetzungen der
Einrichtung und offene Aktivierungsvoraussetzungen. Nur Anlageblocker sperren
Create; eine fehlgeschlagene oder ausstehende Prüfung erteilt keine Freigabe.
Nach Create öffnet dieselbe Detailroute `/admin/instances/<instanceId>`.

## Bereitstellung abschließen

Der kompakte Kopf zeigt Identität, Lifecycle und Betriebszustand getrennt.
Bei noch nicht eingerichteten Instanzen folgt die Fünferfolge: vorbereiten,
Änderungen bestätigen, technisch bereitstellen, Betriebsbereitschaft prüfen,
aktivieren. Der aktuelle Schritt zeigt Ergebnis, Auswirkung und genau eine
Hauptaktion aus dem vorhandenen Serververtrag. Erfolgreiche Keycloak-Schritte
bleiben bei einem lokalen IAM-Fehler sichtbar. Technische Belege sind aufklappbar.

Planänderungen bleiben an den aktuellen Fingerprint gebunden. Ein Retry wird
nur bei sicherer Freigabe ausgeführt. Eine angenommene Mutation oder ein
fehlgeschlagener Refresh wird nicht als Betriebsbereitschaft ausgegeben.
Die Aktivierung bleibt manuell und benötigt die Bestätigung im Einrichtungsabschnitt.

## Betrieb und Module

Die Tabs `Betrieb`, `Doctor` und `Einstellungen` sind immer direkt erreichbar.
Aktive, suspendierte und archivierte Bestandsinstanzen bleiben in `Betrieb`,
auch bei Störungen oder fehlenden historischen Setup-Markern.

Jede Modulzeile verbindet Zuweisung, effektive Aktivierung, Policy und technische
Bereitschaft. „Keine technische Prüfung vorgesehen“ unterscheidet sich von
fehlender oder nicht verifizierter Evidenz. Rollen, Permissions, Herkunft,
Overrides, Checks und Jobs stehen in den Zeilendetails. Pflichtmodule und
laufende Jobs sperren unzulässige Änderungen; Entzug benötigt eine Bestätigung.
Der separate Einstieg `/admin/modules` verwendet dieselbe Oberfläche und behält
seinen bisherigen Bootstrap-Einstieg.

## Doctor

`Doctor öffnen` bleibt im Kopf erreichbar. Der Doctor ordnet Befunde mit
Handlungsbedarf zuerst und trennt deren Quelle, Serviceidentität und Korrelation
in technischen Details. Empfohlene Diagnose- und Reparaturmaßnahmen verwenden
denselben Aktionshandler wie die Einrichtung. Es gibt keine automatische neue
Rechteprobe. Eine Aktivierungsempfehlung führt zurück zum Aktivierungsabschnitt
und fokussiert dessen Überschrift; sie aktiviert die Instanz nicht unmittelbar.

Auf Maßnahme und Validierung folgen aufklappbare Audit-Ergebnisse und technische
Historie. Strukturierte HTTP-Fehler bleiben erhalten; unbekannte Fehlercodes
bekommen einen sicheren allgemeinen Text statt ungefilterter Servermeldungen.

## Einstellungen und Einladungsvorlage

Allgemeine Angaben und Administratorprofil sind offen sichtbar. Realm und
Clients sowie Zugangsdaten stehen in eigenen aufklappbaren Gruppen. Die
Fehlerübersicht führt zum betroffenen Feld und öffnet dessen Gruppe.

Die Einladungsvorlage wird in einem eigenen Dialog gespeichert oder zurückgesetzt.
Dieser Request verwendet den gespeicherten Instanzstand und die Vorlagenrevision;
er übernimmt keine ungespeicherten Namen, Realm-Angaben oder Secrets. Konflikte
bleiben im Editor sichtbar. Tabwechsel, Refresh und fehlgeschlagene Saves
bewahren den lokalen Entwurf. Neue Secret-Eingaben werden erst nach erfolgreichem
Instanz-Save gelöscht. Eine vollständige Anmeldeweiterleitung persistiert keine
Entwürfe oder Secrets im Browser-Speicher.
