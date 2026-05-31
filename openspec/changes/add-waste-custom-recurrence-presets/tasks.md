## 1. OpenSpec und Doku
- [ ] 1.1 Proposal, Design und Waste-Management-Delta anlegen
- [ ] 1.2 `openspec validate add-waste-custom-recurrence-presets --strict` erfolgreich ausführen
- [ ] 1.3 `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md` um die externe Waste-Schema-Erweiterung ergänzen

## 2. Verträge und Persistenz
- [ ] 2.1 Core-/SDK-Typen für Abstandspresets und Tour-Referenzen ergänzen
- [ ] 2.2 Waste-Schema und Repository-Methoden für Presets sowie Tour-Join-Auflösung erweitern

## 3. Host-Fassade und Fachlogik
- [ ] 3.1 Auth-Runtime-Settings um Preset-Write-Pfad ergänzen, ohne die interfaces-geführte Datenquellenpflege aufzuweichen
- [ ] 3.2 Tour-Create/-Update und öffentliche Kalenderlogik auf Preset-Referenzen erweitern
- [ ] 3.3 Serverseitige Fallback-Umschaltung beim Preset-Löschen atomar absichern

## 4. Plugin-UI
- [ ] 4.1 Settings-Tab um Preset-Liste, Create/Edit-Dialog und Löschdialog mit Fallback-Auswahl erweitern
- [ ] 4.2 Tour-Formular und Präsentationslogik auf benutzerdefinierte Presets zusätzlich zu den festen Defaults erweitern

## 5. Verifikation
- [ ] 5.1 Relevante Unit- und Type-Tests für Repository, Auth-Runtime, Plugin und Public-Waste grün ausführen
- [ ] 5.2 Waste-E2E für Preset-Anlage, Tour-Auswahl, Bearbeitung und Fallback-Löschung grün ausführen
- [ ] 5.3 Checkliste auf den tatsächlichen Umsetzungsstand aktualisieren
