# Entwurf und Nachweisgrenzen

## Freigabe und Scope

Grundlage ist der vom Nutzer ausdrücklich zur Implementierung freigegebene Plan. Basis: cae1b538fbf6b8adc823001b84b2bb9391343f8a. Ziel: kürzeste Wartezeit; kein Remote-Cache, keine Docker-Build-Optimierung, kein Merge/Deploy.

## Invarianten

1. Die Vereinigungsmenge ausgeführter Testfälle entspricht der bisherigen Auswahl; vorhandene Skips bleiben nachvollziehbar. Parametrisierte E2E-Fälle ersetzen lediglich die bisher innere Schleife.
2. Jeder Teilbericht gehört zum erwarteten Base-/Head-Paar und dem geplanten Shard. Fehlende, doppelte, fehlgeschlagene oder fremde Evidenz blockiert.
3. Coverage wird instrumentiert pro Projekt zusammengeführt; globale und Projekt-Floors werden erst über vollständigen Berichten bewertet. Fehlende Berichte sind kein Nullwert.
4. Main-, Hotfix- und diagnostische E2E-Evidenz bleiben getrennt. Ein einzelner erfolgreicher Shard ist keine Freigabe.
5. Coverage-/E2E-Läufe bleiben ungecacht. Kein Zugriff auf produktive Daten, keine neuen Secrets, keine Testabsenkung.

## Ausführung und Fehlerfälle

Bestehende Nx-Targets und Scope-Controller bleiben zuständig. App-Routen: vier Datei-Shards, App-Coverage: vier Datei-Shards, Abfallplugin-Coverage: zwei Datei-Shards; andere Coverage-Projekte: vier Projekt-Shards. E2E: vier voneinander isolierte Runner mit je einem Worker. Reportausgaben sind runnerlokal; nur validierte Artefakte werden aggregiert. Teilwiederholungen dürfen nur Evidenz derselben Quelle übernehmen. Keine Änderung am Release-Vertrag ohne negative Tests auf fehlende Shards und falsche Quelle.

Die bestehende PR-Scope-CLI teilt die 14 Coverage-Partitionen anhand des
Git-Diffs und der Projektmanifeste auf zwei Matrizen auf; sie installiert dafür
keine Dependencies und startet Nx nicht. Schwere App-/Abfall-Shards gehören
nur bei direkter Änderung zur Prioritätsmenge. Die identische reine Zuordnung
bestimmt beim frühen Merge die verpflichtenden Reports; der bestehende
Coverage-Controller prüft den vollständigen Plan erneut gegen den Quellstand.
Ein Graphfehler bewahrt einen bereits erfolgreichen Git-Diff für diese
Zuordnung, während die vollständige Fallback-Menge verpflichtend bleibt.

Der erste Main-Nachweis zeigt den verbleibenden seriellen App-Unit-Restlauf als
kritischen Pfad. Main verwendet deshalb dieselben sieben App-Unit-Partitionen
wie der PR-Pfad, jeweils mit einem Worker und vollständigem Base-/Head- sowie
Datei-/Fallmengennachweis. Der verbleibende Unit-Job führt ausschließlich die
anderen nicht durch identische Coverage-Ausführung gedeckten Projekte aus.
Der stabile Main-Check `Unit` verlangt Coverage, Restlauf und alle sieben
App-Nachweise; es entsteht kein weiterer Controller.

Der native Report-Merge führt keine Tests aus. Seine Vorarbeit darf deshalb
auf die tatsächlich vom gemeinsamen Vitest-Konfigurationsloader benötigte
Plugin-SDK-Buildkette begrenzt werden; ein frischer isolierter Checkout muss
die App- und Abfall-Konfiguration damit laden können. Die tatsächlichen
Unit-/Coverage-Testtargets behalten ihre vollständigen Build- und Runtime-Gates.

## Nachweise

Gezielte Vitest-Vertragstests auf Scope/Fallback/No-op, Vollständigkeit, doppelte/fremde/manipulierte Reports, rote/abgebrochene Jobs und Teilwiederholung; Skript-Typecheck und erforderliche Runtime-Gates. Fresh-/Shard-Mengen und Coverage-Zähler werden verglichen. Drei gepaarte Messungen und fünf Flake-Wiederholungen je struktureller Änderung; zehn CI-Endstände zur abschließenden Median-/P90-Bewertung. Solange diese fehlen, keine Zielerreichung behaupten.

## Rücknahme

Einzeln prüfbare Abschnitte; ersetzte Ausführungspfade im Cutover entfernen. Bei Abdeckungs-/Evidenzdrift oder neuen Flakes den betreffenden Abschnitt zurücknehmen. Keine dauerhaft parallel laufende Shadow-Pipeline.
