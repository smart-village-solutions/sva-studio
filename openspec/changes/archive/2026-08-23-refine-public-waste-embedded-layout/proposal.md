# Change: Eingebettetes Layout des öffentlichen Abfallkalenders verfeinern

## Why

Die öffentliche Abfallkalender-App verwendet derzeit mehrere verschachtelte Karten, Rahmen, Radien und Schatten. Dadurch wirkt sie in einer fremden Webseite wie eine eigenständige Anwendung im iFrame statt wie ein integrierter Inhaltsbereich. Außerdem sind globale Aktionen visuell und semantisch als Tabs modelliert, obwohl sie jeweils eine Aktion mit aufklappbaren Optionen auslösen.

## What Changes

- Adresse, direkt zugeordnete Änderungsaktion und Fraktionsfilter werden in einen flachen Standortkontext überführt.
- Kalenderexport, PDF/Druckversion und E-Mail-Erinnerung werden als eigenständige Disclosure-Aktionen statt als Tabs dargestellt und ausgezeichnet.
- Rahmen, Radien, Verläufe und Schatten werden auf funktional notwendige Elemente reduziert; Inhaltsbereiche werden vorrangig durch Abstand und dezente Trennlinien gegliedert.
- Die Standortsuche zeigt vor der Texteingabe alle verfügbaren Optionen und filtert diese Liste während der Eingabe.
- Die Ansichten Liste, Monat und Jahr bleiben als echte Tabs erhalten.
- Betroffene Komponenten- und Routentests werden auf die korrigierte Semantik angepasst.

## Impact

- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web/src/components`, `apps/public-waste-calendar-web/src/styles.css`
- Affected arc42 sections: keine; die Änderung bleibt innerhalb der bestehenden Public-Waste-Capability und verändert weder Laufzeit- noch Integrationsarchitektur
