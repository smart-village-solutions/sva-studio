## 1. OpenSpec und Doku
- [x] 1.1 Proposal, Design und Waste-Management-Delta für Fraktions-Erinnerungen anlegen
- [x] 1.2 Proposal, Design und Waste-Management-Delta auf das kanalbezogene JSON-Schema aktualisieren
- [x] 1.3 `openspec validate add-waste-fraction-reminder-settings --strict` erfolgreich ausführen
- [x] 1.4 Relevante Fach- oder Architekturdoku nur bei tatsächlicher Architekturwirkung ergänzen

## 2. Verträge und Persistenz
- [x] 2.1 Core-/SDK-Typen und API-Inputs auf das verschachtelte Reminder-JSON-Schema umstellen
- [x] 2.2 Waste-Schema um die fachlich führende JSONB-Spalte `reminder_config` an `waste_fractions` erweitern
- [x] 2.3 Backfill und Migrationspfad von den flachen Reminder-Spalten in `reminder_config` implementieren
- [x] 2.4 Repository-Mapping und Static-Content-Builder auf das neue Reminder-Modell umstellen

## 3. Host-Fassade und Fachlogik
- [x] 3.1 Request-Schemas und Fraktions-Handler auf kanalbezogene Slots, stabile Slot-IDs und Lead-Day-Validierung erweitern
- [x] 3.2 Serverseitige Normalisierung für `none`, `once` und `twice` im JSON-Schema absichern
- [x] 3.3 Persistente Slot-ID-Strategie für Migration und Folgeänderungen absichern

## 4. Plugin-UI
- [x] 4.1 Fraktionsformular auf kanalbezogene Reminder-Blöcke mit Slot-Konfiguration je Channel umstellen, ohne die Fraktionen-Tabelle dafür zu ergänzen
- [x] 4.2 Fraktions-Mapping, Dialog-Tests und Submit-Normalisierung auf das verschachtelte Reminder-Modell erweitern

## 5. Verifikation
- [x] 5.1 Relevante Unit- und Type-Tests für Core, Repository, Auth-Runtime, App-Server und Plugin grün ausführen
- [x] 5.2 Checkliste auf den tatsächlichen Umsetzungsstand aktualisieren
