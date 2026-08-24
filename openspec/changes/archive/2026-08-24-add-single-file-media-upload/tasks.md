## 1. Spezifikation
- [x] 1.1 Delta-Spec für `media-management` um direkten Single-File-Upload und Minimalpersistenz erweitern
- [x] 1.2 Konflikte mit aktiven Changes `add-media-async-processing` und `extend-media-management-governance` gegen den neuen Scope prüfen und dokumentieren

## 2. Implementierung
- [x] 2.1 Bestehenden Media-Upload-Vertrag im Backend auf Initialisierung, Upload-Abschluss und Asset-Persistierung prüfen; Zielzustand für Single-File-Flow festziehen
- [x] 2.2 Frontend-CTA in `/admin/media` an Dateiauswahl für genau eine Datei anbinden
- [x] 2.3 Browserseitigen Upload an die signierte URL inkl. Fortschritts-, Erfolg- und Fehlerzustand implementieren
- [x] 2.4 Finalisierung/Persistierung des `MediaAsset` mit Minimalmetadaten nach erfolgreichem Upload sicherstellen
- [x] 2.5 Erfolgsnavigation in die Detailansicht `/admin/media/$mediaId` implementieren
- [x] 2.6 Fehlerpfade für Initialisierung, Binär-Upload und Finalisierung getrennt modellieren und i18n-seitig absichern

## 3. Verifikation und Doku
- [x] 3.1 Unit- und Type-Tests für den geänderten Flow ergänzen bzw. anpassen
- [x] 3.2 E2E-Nachweis für `Datei auswählen -> Upload -> Finalisierung -> Detailansicht` ergänzen
- [x] 3.3 Relevante Doku unter `docs/` und betroffene arc42-Abschnitte aktualisieren
- [x] 3.4 `openspec validate add-single-file-media-upload --strict` ausführen
