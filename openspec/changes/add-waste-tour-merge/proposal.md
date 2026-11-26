# Ausgewählte Abfalltouren zusammenführen

## Ausgangslage

Im Frankfurter Abfallkalender verteilen gleich geplante Touren ihre Abholpunkte auf mehrere Datensätze. Bei Gelbe Tonne · Bezirk 12 erzeugt der gemeinsam verknüpfte Grenzbahnhof dreifach ausgegebene Termine. Die vorhandenen Aktionen für Abholpunkt-Zuordnungen und Tourstatus können die Bereinigung einzeln abbilden. Der gemeinsame Vorgang braucht eine Vorschau und einen atomaren Schreibvorgang, damit sich die Kalenderausgabe während der Umstellung nicht verschlechtert.

## Bedienung

In der bestehenden Mehrfachauswahl öffnet **Ausgewählte Touren zusammenführen** einen Dialog. Die Person wählt genau eine der markierten Touren als Ziel. Die Touren erscheinen mit ihrem vollständigen Namen. Bei gleichen Namen helfen Abholpunktzahl, Turnus, Gültigkeit und kurze Tour-ID bei der Auswahl. Die Vorschau zeigt die Zieltour, die Zahl der neuen und der insgesamt verbleibenden Zuordnungen sowie alle Touren, die archiviert werden. Sie macht auch ausgewählte Touren außerhalb des aktuellen Filters sichtbar und kennzeichnet, ob sie veröffentlicht bleiben oder archiviert werden.

Die erste Version führt veröffentlichte, turnusbasierte Touren mit identischer fachlicher Terminplanung zusammen. Abweichende Fraktionen, Gültigkeit, Terminregeln oder Hinweise und vorhandene eigenständige Tour-Einsätze oder abholpunktspezifische Einzeltermine blockieren die Aktion. Für Frankfurts Bezirk 12 wird aus den Listen mit 13, 9 und 6 Zuordnungen eine Zieltour mit 26 Abholpunkten. Die beiden Quelltouren werden archiviert.

## Ausführung und Nachweis

Der bestehende Waste-Plugin-Pfad prüft Vorschau und Bestätigung instanzgebunden unter `waste-management.tours.manage`. Dieselbe fachliche Prüfung bewertet die beteiligten Touren, ihre Abholpunkt-Zuordnungen und die anwendbaren Regeln. Die Bestätigung bindet Ziel, Quellen und den geprüften Datenstand. In einer tenantlokalen Transaktion prüft der Server den Stand erneut, ergänzt die vereinigten Zuordnungen und archiviert die Quellen. Bei einer veralteten Vorschau oder einem Fehler fordert die Oberfläche eine neue Vorschau an. Die Auditierung nutzt den bestehenden Waste-Pfad und protokolliert Ergebnis, Touren-IDs und Zählwerte.

Der Funktionsnachweis vergleicht die wirksamen Termine und Hinweise vor und nach dem Vorgang. Die wiederholten Kalenderzeilen am gemeinsamen Abholpunkt entfallen. Quelltouren bleiben samt ihren bisherigen Zuordnungen und Terminregeln im Archiv nachvollziehbar. Der Mainserver erhält den neuen Studio-Sollstand über den bestehenden Terminabgleich.

## Umfang des Lieferabschnitts

- Sammelaktion, Prüfung und Transaktion im bestehenden Waste-Plugin mit dem vorhandenen Rollen- und Statusmodell.
- Je Vorgang eine Zieltour. Das Zusammenführen mehrerer Gruppen und die Korrektur abweichender Tourpläne bleiben eigenständige Aufgaben.
- Betroffene Spezifikation `waste-management` und bestehende [Bausteinsicht des Waste-Plugins](../../../docs/architecture/05-building-block-view.md).
