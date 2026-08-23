## 1. Fachvertrag und Persistenz

- [x] 1.1 Link-Datumsfelder aus Core-, Plugin-SDK- und API-Typen entfernen
- [x] 1.2 Auth-Runtime-Schemas, Handler und Duplizierungslogik bereinigen
- [x] 1.3 Repository-Statements und Runtime-Schema auf Links ohne Datumsspalten umstellen
- [x] 1.4 Importkatalog und Importplanung auf das zentrale Tour-Gültigkeitsmodell anpassen

## 2. Laufzeitverhalten und Oberfläche

- [x] 2.1 Link-Zeitfenster aus der Terminmaterialisierung entfernen
- [x] 2.2 Ausgewählte Abholorte weiterhin zuerst gruppieren
- [x] 2.3 Beide Gruppen stabil nach Region, Ort und Straße sortieren

## 3. Dokumentation und Verifikation

- [x] 3.1 Kanonische Waste-Spezifikation und Datenbankdokumentation aktualisieren
- [x] 3.2 Betroffene Unit-, Repository-, Runtime- und UI-Tests anpassen oder ergänzen
- [x] 3.3 Betroffene Nx-Unit- und Type-Gates sowie `pnpm check:server-runtime` ausführen
- [x] 3.4 `pnpm check:file-placement` und `pnpm openspec validate remove-location-tour-validity --strict` ausführen
- [x] 3.5 Arc42-Abweichung dokumentieren: keine Aktualisierung erforderlich, da keine Baustein- oder Laufzeitgrenze geändert wird
