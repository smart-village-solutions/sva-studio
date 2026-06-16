## 1. Spezifikation
- [ ] 1.1 Delta-Spec fuer `media-management` um direkten Single-File-Upload und Minimalpersistenz erweitern
- [ ] 1.2 Konflikte mit aktiven Changes `add-media-async-processing` und `extend-media-management-governance` gegen den neuen Scope pruefen und dokumentieren

## 2. Implementierung
- [ ] 2.1 Bestehenden Media-Upload-Vertrag im Backend auf Initialisierung, Upload-Abschluss und Asset-Persistierung pruefen; Zielzustand fuer Single-File-Flow festziehen
- [ ] 2.2 Frontend-CTA in `/admin/media` an Dateiauswahl fuer genau eine Datei anbinden
- [ ] 2.3 Browserseitigen Upload an die signierte URL inkl. Fortschritts-, Erfolg- und Fehlerzustand implementieren
- [ ] 2.4 Finalisierung/Persistierung des `MediaAsset` mit Minimalmetadaten nach erfolgreichem Upload sicherstellen
- [ ] 2.5 Erfolgsnavigation in die Detailansicht `/admin/media/$mediaId` implementieren
- [ ] 2.6 Fehlerpfade fuer Initialisierung, Binär-Upload und Finalisierung getrennt modellieren und i18n-seitig absichern

## 3. Verifikation und Doku
- [ ] 3.1 Unit- und Type-Tests fuer den geaenderten Flow ergaenzen bzw. anpassen
- [ ] 3.2 E2E-Nachweis fuer `Datei auswaehlen -> Upload -> Finalisierung -> Detailansicht` ergaenzen
- [ ] 3.3 Relevante Doku unter `docs/` und betroffene arc42-Abschnitte aktualisieren
- [ ] 3.4 `openspec validate add-single-file-media-upload --strict` ausfuehren
