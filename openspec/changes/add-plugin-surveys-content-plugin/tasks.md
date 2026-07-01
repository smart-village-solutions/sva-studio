## 1. Spezifikation

- [ ] 1.1 Delta fuer `content-management` finalisieren
- [ ] 1.2 Delta fuer `sva-mainserver-integration` finalisieren
- [ ] 1.3 neue Capability `plugin-surveys` finalisieren
- [ ] 1.4 vereinfachtes Statusmodell und bereinigtes Survey-Zielschema mit dem Wunsch-Schema abgleichen
- [ ] 1.5 Editor-Tabs, Moderationsabgrenzung und Exportvarianten in den Specs explizit verankern

## 2. Plugin-Grundstruktur

- [ ] 2.1 Nx-Library `packages/plugin-surveys` mit `scope:plugin` und Standard-Targets anlegen
- [ ] 2.2 `plugin.manifest.json`, `README.md`, `src/index.ts` und `src/plugin.tsx` nach Muster von News, Events und POI anlegen
- [ ] 2.3 Standard-Content-Contribution fuer Navigation, Admin-Resource, Actions und Permissions verdrahten

## 3. Mainserver-Integration

- [ ] 3.1 typed Survey-GraphQL-Adapter im host-owned Mainserver-Layer definieren
- [ ] 3.2 neue Survey-Queries und -Mutations gegen den Snapshot- und Mapping-Vertrag absichern
- [ ] 3.3 deterministische Fehler- und Berechtigungsabbildung fuer Survey-Operationen definieren
- [ ] 3.4 Survey-Schemaaenderungen fuer Statusmodell und Teilnahmeoptionen in Snapshot, Mapping und Tests nachziehen

## 4. Studio-UI

- [ ] 4.1 Surveys in Inhaltsliste und `Neuer Inhalt` integrieren
- [ ] 4.2 Listen-, Erstellungs- und Bearbeitungsseiten fuer Surveys mit stabiler gemeinsamer Tab-Struktur umsetzen
- [ ] 4.3 Create- und Edit-Ansicht in denselben Editor-Rahmen fuehren und nicht verfuegbare Bereiche im Create-Fall mit Hinweisen darstellen
- [ ] 4.4 Freitext-Freigabe, kompakte Ergebnisansicht und getrennte Exportaktionen in die Detail-/Bearbeitungsansicht integrieren
- [ ] 4.5 Tabpanels mit flachen thematischen Cards ohne Card-Verschachtelung und ohne innere Tabs umsetzen
- [ ] 4.6 Wiederholende Fragen-, Options-, Moderations- und Ergebnislisten innerhalb gemeinsamer Cards als Abschnitte strukturieren

## 5. Qualitaet und Doku

- [ ] 5.1 Unit- und Type-Tests fuer Plugin-, API- und UI-Vertraege ergaenzen
- [ ] 5.2 relevante Architektur- und Entwicklungsdokumentation aktualisieren
- [ ] 5.3 kleinsten relevanten Gate-Pfad fuer Plugin-, Host- und Mainserver-Aenderungen ausfuehren
