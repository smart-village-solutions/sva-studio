# Mapstick im Studio mit wählbaren Kartenstilen

## Warum und Freigabe

Mapstick soll die bisher verwendeten Karten- und Geocoding-Dienste im Studio ablösen. Der Nutzer hat am 18.11.2026 die Integration in einem separaten Worktree einschließlich kompakter Stilauswahl innerhalb der Karte und lokaler Speicherung der Auswahl beauftragt. Die anschließende PR-Erstellung einschließlich Branch-Push wurde ausdrücklich freigegeben.

## Ziel und Umfang

Ziel ist die Nutzung des eigenen Mapstick-Dienstes in den bestehenden Karteneditoren mit wählbarem Farbschema, ohne die Oberfläche der Mapstick-App einzubetten. Betroffen sind ausschließlich der bestehende Karten-/Geocoding-Hostpfad, seine SDK-Verträge, die gemeinsame Karten-UI, die Kartenverbraucher POI, Events, generische Inhalte, Stellen und Baustellen sowie zugehörige Dokumentation und Tests.

Nicht-Ziele: Routing, Erreichbarkeiten, Luftbilder, neue kommunale Datenlayer, Änderungen oder Deployment am Mapstick-Dienst, produktive Schnittstellenänderungen, Merge und Rollout.

## Umsetzung

- Mapstick bleibt eine externe Schnittstelle. Automatische Einrichtung für bestehende und künftige eigene Mandanten muss über eine betreiberspezifische Serverkonfiguration erfolgen; fremde Installationen erhalten keinen allgemeinen Mapstick-Standard. Der vorhandene Provisionierungsschritt und die bereits tenantgebundenen Schnittstellen-/Kartenaufrufe verwenden dafür dieselbe idempotente Repository-Funktion.
- Photon über den bestehenden autorisierten, budgetierten Geocoding-Pfad normalisieren.
- Feste Mapstick-Kartenressourcen über gleichnamige Studio-Endpunkte bereitstellen, einschließlich begrenzter PMTiles-Bytebereiche; keine freie Proxy-Zielwahl.
- Vorhandene MapLibre-Runtimes um PMTiles ergänzen. Stilauswahl für OSM Standard, OSM Bright, Basic, 3D und Fiord; Terrain/Luftbilder sind keine Farbschemata dieses Lieferumfangs.
- Stilwechsel an der bestehenden Map-Instanz; Kamera, Marker und Zeichendaten bleiben erhalten. Speicherung als optionale Browserpräferenz; gesperrter Speicher beeinträchtigt die Karte nicht.
- Bestehende Legacy-Schnittstellen bleiben während der Konfigurationsmigration lesbar; deren Verbraucher wechseln beim Speichern auf Mapstick. Entfernung der Legacy-Anbieter erst nach nachgewiesener Migration aller betroffenen Instanzen, nicht durch stillschweigende Änderung produktiver Datensätze.

## Kritische Invarianten und Nachweise

- Ressourcenpfade erlauben ausschließlich bekannte Styles, Sprites, Glyphen und das feste Archiv. Keine Ziel-URL aus Benutzereingaben, keine Weiterleitungen; Bytebereich, Bodygröße und Zeit begrenzen. Negative Handler-Tests prüfen unerlaubte Pfade und Bereiche sowie Authentifizierung und Abbruch.
- Geocoding bleibt tenantgebunden, autorisiert und rate-limitiert. Tests prüfen Photon-Feldmapping, leere/ungültige Treffer und die bestehenden Fehlerpfade.
- Stilwechsel erstellt keine zweite Karte und ändert keine Fachwerte. Tests prüfen Instanz- und Markererhalt sowie Zeichnungsbestand; vorhandenen Zeichenadapter für Style-Neuladen verwenden.
- UI-Texte deutsch/englisch über bestehende Übersetzungsauflösung; native Auswahl mit zugänglichem Namen.

## Betroffene Architektur

- Specs: sva-mainserver-integration
- arc42: 05 Bausteinsicht und 08 Querschnittskonzepte

## Ergänzung zur Betreibergrenze

Nutzeranforderung vom 18.11.2026: Alle eigenen bestehenden und zukünftigen Mandanten erhalten die externe Schnittstelle automatisch; fremde Studio-Betreiber erhalten sie nicht. Bestätigte Abgrenzung: ausschließlich in eigenen Installationen automatisch einrichten; keine technische Zugriffssperre am öffentlichen Kartenservice. Die eigenen Portainer-Betriebsprofile setzen SVA_MANAGED_MAPSTICK_URL; generische/Standalone-Installationen erhalten keinen Default. Neue Mandanten erhalten die Schnittstelle im bestehenden Provisionierungsschritt; bestehende beim ersten Schnittstellen- oder Kartenaufruf. Explizit bearbeitete bestehende Mapstick-Datensätze werden nicht zurückgesetzt.

## Lokaler Nachweisstand vom 18.11.2026

- Gezielte Vitest-Dateitests für Photon-/Host-API, Ressourcenhandler, Installationseinrichtung,
  externe Schnittstellen, Keyless-Resolver, SDK-Präferenzidentität, gemeinsame Karten-UI
  und die Kartenverbraucher POI, Events, generische Inhalte, Jobs und Baustellen bestanden.
- App-Typprüfung `sva-studio-react:test:types` sowie die sechs unmittelbar betroffenen
  Package-Typprüfungen bestanden. Die spätere Trennung von SDK-Bindings und UI wurde
  erneut durch App-Typprüfung, SDK-/UI-Build und gezielte Verbrauchertests geprüft.
- `pnpm check:server-runtime` bestand für alle 20 Serverprojekte. Nach den letzten
  Änderungen bestanden zusätzlich die gezielten Runtime-Gates von `server-runtime`,
  `core` und `plugin-sdk`.
- Der gezielte Chromium-Test `construction-sites.spec.ts` prüft mit echtem MapLibre/
  Terra Draw den Stilwechsel, Standort-/Zeichnungserhalt, Bearbeiten, Undo/Redo und
  Speichern. Die API und der Basiskartenstil sind kontrollierte Testantworten; dieser
  Nachweis ersetzt keine produktive Mapstick-/IAM- oder Datenbank-Abnahme.
- Dateiplatzierung, Dokumentationsprüfung und strikte OpenSpec-Validierung bestanden.
- Der gezielte Lintlauf über die geänderten TS-/TSX-Dateien bleibt wegen 19 bereits
  im Basisstand vorhandener Fehler rot. Derselbe ESLint-Kontext mit den Originaldateien
  aus `HEAD` reproduzierte je betroffener Datei exakt dieselben Fehler, ohne neue
  Fehlermeldungen. Betroffen sind vorhandene statisch/lazy gemischte App-Imports,
  bestehende unnötige String-Escapes und eine vorhandene fehlende Error-Cause.
  Neue UI-SDK-Grenzverletzungen wurden durch Plugin-Bindings und den Core-Vertrag
  beseitigt; der neue Ressourcenhandler verwendet lazy Server-Runtime-Imports.

Die Migration 0119 ist vorbereitet und wurde nicht auf produktiven Datenbanken
angewendet. Weder produktive Mandantenschnittstellen noch der Mapstick-Service wurden
in diesem Arbeitszug verändert. Dieser Nachweisstand beschreibt die lokale Prüfung
vor der freigegebenen PR-Erstellung; ein Rollout ist nicht beauftragt. Die tatsächliche Einbindung des externen Dienstes muss
nach einem später freigegebenen Rollout separat live bestätigt werden.


## PR-Korrekturen vom 18.11.2026

Die drei Review-Befunde wurden gemeinsam an der Grenze zwischen gespeicherter
Schnittstellenkonfiguration und ausgehenden Ressourcenaufrufen geprüft. Der behauptete
Zugriff auf private Geocoding-Ziele bzw. automatische Redirects ist durch den bestehenden
socketgebundenen Fetch-Pfad und seine Tests widerlegt. Die generische Speicher-API
weist nun neue Mapstick-Datensätze und Änderungen der vier provisionierten Zieladressen
zurück; Runtime-Schalter, Rate und Timeout bleiben editierbar. Der Ressourcenhandler
validiert zusätzlich die kanonische gespeicherte HTTPS-Style-Adresse vor der Ableitung.

Der Baustelleneditor übergibt die gespeicherte Stilpräferenz bereits an die erste
Kartenerstellung. Die Komplexitätskorrekturen nutzen ausschließlich vorhandene Dateien:
Datensatzaufbau im vorhandenen Mapping-Modul, Transaktion im vorhandenen DB-Modul,
private Funktionen für Bereichsprüfung und Karteninitialisierung. Es gibt keine neue
Konfigurationsschicht, zusätzliche Datei oder Abschwächung eines Quality Gates.
