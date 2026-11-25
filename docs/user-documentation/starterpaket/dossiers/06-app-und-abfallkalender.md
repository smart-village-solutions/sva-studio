# Dossier 6: App und Abfallkalender

Die Modulzuweisung und die Katalogpflege sind im [Dossier zu Kategorien und Modulen](04-kategorien-und-module.md#deutsche-app-texte-und-sprachen) beschrieben.

## `waste-management.overview` – Abfallkalender

- **Route / Typ / Owner:** `/plugins/waste-management`, Übersicht, Plugin `waste-management`.
- **Nutzerziel:** Abfallstammdaten, Touren, Termine, Ausgabe und Werkzeuge in einem Fachbereich
  verwalten.
- **Produktfakten:** Die Seite besitzt Bereiche für Abfallarten, Touren, Abholpunkte,
  Ausweichtermine, Ausgabe, Datentools und Einstellungen sowie technische und Audit-Historie. Die
  Ausgabe konfiguriert die statischen PDF-Inhalte für Branding und Kontaktinformationen. Die
  öffentliche Webversion des Abfallkalenders erzeugt das PDF anschließend ad hoc für die gewählte
  Adresse, die Fraktionen und das Jahr. Abholpunkte verbinden Regionen, Orte, Straßen, Hausnummern
  und konkrete Sammelstellen. Einstellungen bleiben auch bei fehlerhafter Datenquelle erreichbar.
- **Kontextabhängig:** Route erfordert das Modul `waste-management` und `waste-management.read`;
  einzelne Aktionen besitzen zusätzliche fully-qualified Rechte. Einige Tabtexte weisen noch auf
  künftige oder nachgelagerte Anbindungen hin und dürfen nicht als verfügbare Funktion beschrieben
  werden.
- **Leitfragen / Stichwörter:** Welche Stammdaten müssen vor Touren vorhanden sein? Wie hängen
  Abholpunkt, Fraktion, Tour und Ausweichtermin zusammen? Abfallkalender, Abfallart, Tour, Abholpunkt,
  PDF-Konfiguration, öffentliche Webversion, Datentool, Audit.
- **Evidenz:** `packages/plugin-waste-management/src/waste-management.page.tsx`,
  `plugin.translations.de.*.ts`, `plugin.tsx`.

### Straße erfassen und Abholpunkt für eine Tour anlegen

1. Öffnen Sie **Abfallkalender → Stammdaten**, wählen Sie **Straßen** und anschließend **Straße anlegen**.
   Wählen Sie den Ort, tragen Sie den Straßennamen ein und klicken Sie auf **Straße speichern**.
   Für Pferdeschwemme wählen Sie zum Beispiel den Ort **Perleberg**. Die gespeicherte Straße
   steht nun im Adressformular zur Auswahl.
2. Öffnen Sie **Abholpunkte → Abholpunkt anlegen** und wählen Sie Ort und Straße. Wenn die Abholung
   für die gesamte Pferdeschwemme gelten soll, wählen Sie **Alle Hausnummern** und klicken Sie
   auf **Abholpunkt speichern**. Wenn unterschiedliche Touren beispielsweise für die Hausnummern
   2 bis 6 und 8 bis 12 gelten, pflegen Sie unter **Stammdaten → Hausnummern** zuerst die
   tatsächlich vorhandenen Hausnummern. Wählen Sie beim Anlegen jedes Abholpunkts die konkrete
   Hausnummer. So bleibt die Zuordnung auf die jeweils gewünschten Adressen beschränkt.
3. Öffnen Sie unter **Touren** die gewünschte Tour und wählen Sie **Abholpunkte zuordnen**.
   Der gespeicherte Abholpunkt ist jetzt in der **Tour-Zuordnung** auswählbar. Prüfen Sie vor
   dem Speichern der Zuordnung den Ort, die Straße und gegebenenfalls die Hausnummer.

In längeren Auswahllisten erscheint ein Suchfeld. Das gilt für die Abfallfraktionen beim Bearbeiten
einer Tour, die betroffenen Touren eines globalen Ausweichtermins und die Abholpunkte eines
Tour-Einsatzes. Bei diesen Mehrfachauswahlen können Sie die ganze Optionszeile anklicken. Bei der
Zuordnung von Abholpunkten und Touren behalten die Zeilen beim Markieren ihre Position.

### PDF-Legende und Logo

Unter dem Kalenderraster stehen links Name, Kürzel und Farbe der Abfallarten. Daneben erscheinen
die gepflegten Tourbeschreibungen und Terminnotizen, etwa die Haltzeiten und Standorte des
Schadstoffmobils. Lange Hinweise werden umgebrochen und bei Bedarf auf Folgeseiten fortgesetzt.

Unter **Ausgabe → PDF-Inhalte** werden die Branding-Grafik und der Kontaktblock gepflegt.
Ein ausgefüllter Kontaktblock erhält rechts unter dem Raster eine eigene Spalte. Die Hinweise
nutzen ohne Kontaktblock die gesamte Restbreite. Das Landkreislogo muss als konkret freigegebene,
öffentlich ladbare Grafik vorliegen. Fehlt diese, zeigt der Export den vorhandenen Platzhalter.
Details zu Pflegewegen und Grenzen stehen in der [Public-Waste-Referenz](../../../reference/public-waste-api.md#pdf-legende-und-landkreislogo-pflegen).

### Abfallfraktionen kontrolliert löschen

Die Einzellöschung bietet bei verwendeten Fraktionen eine Auswirkungsvorschau. Eine Fraktion kann
entweder aus weiterbestehenden Touren entfernt, durch eine andere aktive Fraktion ersetzt oder
mit sämtlichen zugeordneten Touren und Terminen gelöscht werden. „Touren erhalten“ erscheint nur,
wenn keine Tour dadurch fraktionslos wird. Beim vollständigen Löschen betrifft die Wirkung auch
weitere Fraktionen gemeinsam genutzter Touren; ihre Stammdatensätze bleiben bestehen.

Doppelte Zielzuordnungen werden vermieden; neu entstehende Abholkollisionen verhindern die
Ersetzung. Erinnerungsauswahlen werden entfernt, nicht übertragen. Nicht mehr gültige ausstehende
Erinnerungen werden storniert. Ändert sich der Datenbestand, muss die Vorschau erneut geprüft werden.
Die Bedienung, Prüfgrenzen und Berechtigung beschreibt die
[Waste-Referenz](../../../reference/waste-management-tour-gueltigkeit.md#abfallfraktion-löschen-oder-ersetzen).
