# Dossier 6: App und Abfallkalender

Die Modulzuweisung und die Katalogpflege sind im [Dossier zu Kategorien und Modulen](04-kategorien-und-module.md#deutsche-app-texte-und-sprachen) beschrieben.

## `waste-management.overview` – Abfallkalender

- **Route / Typ / Owner:** `/plugins/waste-management`, Übersicht, Plugin `waste-management`.
- **Nutzerziel:** Abfallstammdaten, Touren, Termine, Ausgabe und Werkzeuge in einem Fachbereich
  verwalten.
- **Produktfakten:** Die Seite besitzt Bereiche für Abfallarten, Touren, Abholorte,
  Ausweichtermine, Ausgabe, Datentools und Einstellungen sowie technische und Audit-Historie. Die
  Ausgabe konfiguriert die statischen PDF-Inhalte für Branding und Kontaktinformationen. Die
  öffentliche Webversion des Abfallkalenders erzeugt das PDF anschließend ad hoc für die gewählte
  Adresse, die Fraktionen und das Jahr. Abholorte verbinden Regionen, Orte, Straßen, Hausnummern
  und konkrete Sammelstellen. Einstellungen bleiben auch bei fehlerhafter Datenquelle erreichbar.
- **Kontextabhängig:** Route erfordert das Modul `waste-management` und `waste-management.read`;
  einzelne Aktionen besitzen zusätzliche fully-qualified Rechte. Einige Tabtexte weisen noch auf
  künftige oder nachgelagerte Anbindungen hin und dürfen nicht als verfügbare Funktion beschrieben
  werden.
- **Leitfragen / Stichwörter:** Welche Stammdaten müssen vor Touren vorhanden sein? Wie hängen
  Abholort, Fraktion, Tour und Ausweichtermin zusammen? Abfallkalender, Abfallart, Tour, Abholort,
  PDF-Konfiguration, öffentliche Webversion, Datentool, Audit.
- **Evidenz:** `packages/plugin-waste-management/src/waste-management.page.tsx`,
  `plugin.translations.de.*.ts`, `plugin.tsx`.

### PDF-Legende und Logo

Die Legende entsteht aus den gepflegten Abfallarten (Name, Kürzel, Farbe, Beschreibung),
Tourbeschreibungen und Terminnotizen. Diese Inhalte werden an ihren jeweiligen Stammdaten
bearbeitet; unter **Ausgabe → PDF-Inhalte** werden die Branding-Grafik und der
Kontaktblock gepflegt. Es gibt kein separates Freitextfeld „PDF-Legende“.

Die kompakte Legende hat höchstens acht Zeilen und kürzt lange Texte. Deshalb können weitere
Hinweise entfallen; sie ersetzt nicht alle Termindetails. Ein umfangreicherer Hinweisbereich
benötigt eine fachliche Layoutentscheidung. Das Landkreislogo muss als konkret freigegebene,
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
