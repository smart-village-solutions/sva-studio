## 1. OpenSpec und Doku
- [x] 1.1 Proposal, Design und Waste-Management-Delta für Fraktions-Erinnerungen anlegen
- [x] 1.2 `openspec validate add-waste-fraction-reminder-settings --strict` erfolgreich ausführen
- [x] 1.3 Relevante Fach- oder Architekturdoku nur bei tatsächlicher Architekturwirkung ergänzen

## 2. Verträge und Persistenz
- [x] 2.1 Core-/SDK-Typen und API-Inputs für Reminder-Konfiguration an Fraktionen ergänzen
- [ ] 2.2 Waste-Schema und Repository-Mapping für Reminder-Felder an `waste_fractions` erweitern
  Hinweis: Das Repository-Mapping ist umgesetzt; die SQL-Ownership der instanzbezogenen `waste_*`-Tabellen liegt laut `docs/development/waste-management-portierungsstrategie.md` nicht in `packages/data`.

## 3. Host-Fassade und Fachlogik
- [x] 3.1 Request-Schemas und Fraktions-Handler um Reminder-Validierung erweitern
- [x] 3.2 Serverseitige Normalisierung für `none`, `once` und `twice` absichern

## 4. Plugin-UI
- [x] 4.1 Fraktionsformular um einen vierter Block für Erinnerungen mit Auswahl, Dropdowns und Kanal-Switches erweitern, ohne die Fraktionen-Tabelle dafür zu ergänzen
- [x] 4.2 Fraktions-Mapping und Dialog-Tests auf Reminder-Felder erweitern

## 5. Verifikation
- [x] 5.1 Relevante Unit- und Type-Tests für Core, Repository, Auth-Runtime und Plugin grün ausführen
- [x] 5.2 Checkliste auf den tatsächlichen Umsetzungsstand aktualisieren
