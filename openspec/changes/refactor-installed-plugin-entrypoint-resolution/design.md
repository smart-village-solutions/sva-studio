# Design: Manifesttreue Auflösung installierter Plugin-Pakete

## Ausgangspunkt

`plugin-catalog.json` enthält den konfigurierten Paketsatz, während die Laufzeitprofile derzeit eigene statische Workspace-Kataloge importieren. Die installierten Manifest-Globs erfassen viele Paketnamen, die Modul-Globs jedoch nur `plugin-*` mit festen `dist`-Dateien. `nodeServerModuleLoaders` ist leer. Die vorhandene Build-Registry kann Paketpfade bereits auf Katalogquellen abbilden; der mit #1511 eingeführte Descriptor-Katalog trennt Browser-Views von serverseitigen Metadaten.

## Ausführungsgrenzen

- **Build-Auswahl:** Nur ein expliziter Katalogeintrag mit Profilzuordnung für das gewählte Distributionsprofil darf einen installierten Paketpfad in den Build aufnehmen. Der Paketname ist `sourceRef`; Installation allein ist keine Aktivierung. Die Profilzuordnung wird als Build-Metadatum gelesen und nicht als neuer Runtime-Aktivierungszustand eingeführt.
- **Manifestprüfung:** Vor Erzeugung der statischen Imports werden das installierte Manifest, die Plugin-Identität, die deklarierten Entrypoints und deren physische Lage innerhalb des Pakets geprüft. Ein fehlender oder ausbrechender Pfad ist ein Buildfehler.
- **Statische Bindung:** Der Build erzeugt aus genau diesen überprüften Pfaden statische Imports beziehungsweise Import-Factories für die vorhandenen Register. Browser-, Descriptor-, Server- und Job-Module bleiben getrennt, damit Server-Bootstrap keine Browser-Fachseite auswertet.
- **Runtime-Validierung:** Der bestehende SDK-Katalog validiert Kompatibilität und Beiträge. Server und Jobs konsumieren nur Quellen des validierten Snapshots; ein nicht ausgewähltes Paket wird weder registriert noch gebündelt.
- **Artefaktprüfung:** Der Test installiert ein temporär gepacktes Plugin in einer isolierten Build-Kopie. Die bestehende Image-/Chunk-Verifikation leitet den erwarteten installierten Paketsatz aus derselben Build-Auswahl ab und vergleicht ihn mit dem tatsächlichen Artefakt. Das Testpaket bleibt außerhalb des Produktkatalogs.

## Lieferabschnitte

1. Den Katalogeintrag für installierte Pakete und die benötigten Build-Inputs an einer bestehenden Composition Root zusammenführen; bestehende Workspace-Profile unverändert nachweisen.
2. Manifestpfade für Browser, Descriptor, Server und Jobs auflösen und als statische, profilgefilterte Loader in die vorhandenen Register einspeisen. Feste `plugin-*`-/Dateinamenannahmen im ersetzten installierten Pfad entfernen.
3. Einen echten gepackten Paketfall und seine Negativfälle ausführen; die bestehende Image-/Chunk-Verifikation an die ausgewählte Paketmenge anbinden und anschließend Profil-Builds, Runtime- und Artefakt-Gates sowie Dokumentation abschließen.

## Invarianten und Failure Modes

| Invariante | Verletzung | Prävention und Nachweis |
| --- | --- | --- |
| Ein gewähltes installiertes Plugin hat in Browser, Server und Jobs dieselbe validierte Katalogentscheidung. | Getrennte Inventare registrieren unterschiedliche Beiträge. | Katalogquelle ist der Build-Eingang; Integrationsprobe vergleicht Snapshot und gebundene Loader. |
| Kein nicht gewähltes Paket gelangt in den Runtime-Importgraphen. | Breite Globs erzeugen Chunks für fremde Pakete. | Statische Imports nur aus ausgewählten Manifesten; Chunk-Provenance- und Negativtest. |
| Ein deklarierter Pfad bleibt innerhalb des installierten Pakets und existiert vor dem Build. | Fehlendes Artefakt oder Pfad-Ausbruch führt zu späterem Startfehler oder unerwartetem Import. | Pfadnormalisierung, Existenzprüfung und gepackter Negativtest vor Veröffentlichung. |
| Server und Worker werten keine Browser-Views aus. | Browser-only Import bricht Bootstrap. | Getrennte Register und echter Modulauflösungstest mit absichtlich serverseitig nicht ladbarer View. |

## Offene fachliche Grenze

Das gepackte Paket ist ein Testverbraucher der Auflösung, keine Zusage eines neuen fachlichen Plugins. Ein produktives Drittplugin benötigt zusätzlich einen explizit gewählten Distributionssatz und, für Jobs, einen vom Host bereitgestellten Runtime-Contract. Die Testdistribution verwendet einen im Test injizierten Host-Contract; der Produktions-Host erhält in diesem Change keinen erfundenen generischen Job-Provider.
