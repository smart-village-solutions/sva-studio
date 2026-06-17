# Change: Öffentliche Waste-Weboberfläche mit Aktionspanels und rechter Fraktionsliste

## Why
Die öffentliche Waste-Weboberfläche verteilt Standortkontext, Fraktionsauswahl und globale Aktionen derzeit auf getrennte Bereiche. Dadurch wirkt die Bedienung unruhig, und Kalenderexport, PDF-Download sowie E-Mail-Abo verwenden kein einheitliches Aktionsmodell.

## What Changes
- Die vollständige Ansicht für aufgelöste Standorte wird in einen zweispaltigen Kontextblock mit Adresse links und vertikaler Fraktionsliste rechts umgebaut.
- Darunter entsteht ein gemeinsamer horizontaler Aktionsblock für Kalenderexport, PDF-Download und E-Mail-Abo mit genau einem gleichzeitig geöffneten Optionspanel.
- Die öffentliche Datenprojektion erweitert die Reminder-Informationen um kalenderfähige Slots, damit der iCal-Export optional `VALARM`-Einträge für die aktuell aktiven Fraktionen erzeugen kann.
- Das E-Mail-Abo nutzt die rechte Fraktionsliste als führende Auswahl und zeigt im Aktionspanel nur noch E-Mail-, Datenschutz- und Slot-Felder für die aktiven Fraktionen.

## Impact
- Affected specs: `public-waste-calendar`
- Affected code: `apps/public-waste-calendar-web/src/components`, `apps/public-waste-calendar-web/src/lib/public-waste-*.ts`, `apps/public-waste-calendar-web/src/styles.css`
- Affected arc42 sections: keine
